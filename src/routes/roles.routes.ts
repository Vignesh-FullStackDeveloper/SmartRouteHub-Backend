import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { RoleService } from '../services/role.service';
import { OrganizationService } from '../services/organization.service';
import { authenticate, requireRole } from '../middleware/auth';
import { JWTUser } from '../types';
import { commonSchemas, commonResponses } from '../schemas/common.schemas';
import { roleSchemas } from '../schemas/role.schemas';
import { sendErrorResponse } from '../utils/error-handler.util';
import { sendSuccess, sendError, parsePagination, getPaginationMeta } from '../utils/response.util';
import { logger } from '../config/logger';
import { extractRequestBodyData } from '../utils/request.util';

const createRoleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  permissionIds: z.array(z.string().uuid()),
});

const updateRoleSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  permissionIds: z.array(z.string().uuid()).optional(),
});

export async function rolesRoutes(fastify: FastifyInstance) {
  const roleService = new RoleService();
  const organizationService = new OrganizationService();

  // Helper to get organization code from user
  async function getOrganizationCode(user: JWTUser): Promise<string> {
    if (!user.organization_id) {
      throw new Error('Organization ID is required');
    }
    const organization = await organizationService.getById(user.organization_id);
    return organization.code;
  }

  fastify.post(
    '/',
    {
      preHandler: [authenticate, requireRole(['admin'])],
      schema: {
        description: 'Create a new custom role with specified permissions. Only organization admins can create roles.',
        tags: ['Roles'],
        security: [{ bearerAuth: [] }],
        summary: 'Create role',
        body: roleSchemas.CreateRoleRequest,
        response: {
          201: {
            description: 'Role created successfully',
            content: {
              'application/json': {
                schema: roleSchemas.Role,
              },
            },
          },
          400: commonResponses[400],
          401: commonResponses[401],
          403: commonResponses[403],
          409: {
            description: 'Conflict - Role name already exists',
            content: {
              'application/json': {
                schema: commonSchemas.ErrorResponse,
              },
            },
          },
          500: commonResponses[500],
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        const organizationCode = await getOrganizationCode(user);
        const bodyData = extractRequestBodyData(request.body);
        const data = createRoleSchema.parse(bodyData);
        const role = await roleService.create(organizationCode, data);
        reply.code(201).send(role);
      } catch (error: any) {
        sendErrorResponse(reply, error);
      }
    }
  );

  // Get all roles (Organization Admin only)
  fastify.get(
    '/',
    {
      preHandler: [authenticate, requireRole(['admin'])],
      schema: {
        description: 'Get all roles in the organization, including default and custom roles with their permissions',
        tags: ['Roles'],
        security: [{ bearerAuth: [] }],
        summary: 'List all roles',
        querystring: roleSchemas.RoleQuery,
        response: {
          200: {
            description: 'List of roles',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        additionalProperties: true,
                      },
                    },
                    pagination: {
                      type: 'object',
                      nullable: true,
                      properties: {
                        total: { type: 'number' },
                        limit: { type: 'number' },
                        offset: { type: 'number' },
                        hasMore: { type: 'boolean' },
                      },
                    },
                    message: { type: 'string', nullable: true },
                  },
                },
              },
            },
          },
          400: { type: 'object', properties: { success: { type: 'boolean' }, error: { type: 'string' }, details: { type: 'object' } } },
          401: commonResponses[401],
          403: { type: 'object', properties: { success: { type: 'boolean' }, error: { type: 'string' } } },
          500: { type: 'object', properties: { success: { type: 'boolean' }, error: { type: 'string' } } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        const organizationCode = await getOrganizationCode(user);
        const query = request.query as any;
        
        // Parse pagination
        let pagination;
        try {
          pagination = parsePagination(query);
        } catch (error: any) {
          logger.warn({ message: 'Invalid pagination parameters', error: error.message, userId: user.id });
          return sendError(reply, 400, error.message);
        }

        const result = await roleService.getByOrganization(organizationCode, pagination);
        const paginationMeta = getPaginationMeta(result.total, pagination.limit, pagination.offset);
        logger.info({ 
          message: 'Roles retrieved', 
          userId: user.id, 
          role: user.role, 
          count: result.data.length,
          total: result.total 
        });
        return sendSuccess(reply, result.data, 'Roles retrieved successfully', paginationMeta);
      } catch (error: any) {
        logger.error({ 
          message: 'Error retrieving roles', 
          error: error.message, 
          stack: error.stack,
          userId: (request.user as JWTUser)?.id 
        });
        sendErrorResponse(reply, error);
      }
    }
  );

  // Get role by ID (Organization Admin only, Superadmin can access with organizationCode)
  fastify.get(
    '/:id',
    {
      preHandler: [authenticate, requireRole(['admin', 'superadmin'])],
      schema: {
        description: 'Get a specific role by ID with all assigned permissions. Superadmin must provide organizationCode in query parameter.',
        tags: ['Roles'],
        security: [{ bearerAuth: [] }],
        summary: 'Get role by ID',
        params: commonSchemas.UUIDParam,
        querystring: commonSchemas.OrganizationCodeQuery,
        response: {
          200: {
            description: 'Role details',
            content: {
              'application/json': {
                schema: roleSchemas.Role,
              },
            },
          },
          400: commonResponses[400],
          401: commonResponses[401],
          403: commonResponses[403],
          404: commonResponses[404],
          500: commonResponses[500],
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        let organizationCode: string;
        
        if (user.role === 'superadmin') {
          const query = request.query as { organizationCode?: string };
          if (!query.organizationCode) {
            return reply.code(400).send({ error: 'Organization code is required for superadmin' });
          }
          organizationCode = query.organizationCode;
        } else {
          organizationCode = await getOrganizationCode(user);
        }
        
        const params = request.params as { id: string };
        const role = await roleService.getById(organizationCode, params.id);
        if (!role) {
          return reply.code(404).send({ error: 'Role not found' });
        }
        reply.send(role);
      } catch (error: any) {
        sendErrorResponse(reply, error);
      }
    }
  );

  // Update role (Organization Admin only)
  fastify.put(
    '/:id',
    {
      preHandler: [authenticate, requireRole(['admin'])],
      schema: {
        description: 'Update role name, description, or permissions. All fields are optional - only provided fields will be updated.',
        tags: ['Roles'],
        security: [{ bearerAuth: [] }],
        summary: 'Update role',
        params: commonSchemas.UUIDParam,
        body: roleSchemas.UpdateRoleRequest,
        response: {
          200: {
            description: 'Role updated successfully',
            content: {
              'application/json': {
                schema: roleSchemas.Role,
              },
            },
          },
          400: commonResponses[400],
          401: commonResponses[401],
          403: commonResponses[403],
          404: commonResponses[404],
          409: {
            description: 'Conflict - Role name already exists',
            content: {
              'application/json': {
                schema: commonSchemas.ErrorResponse,
              },
            },
          },
          500: commonResponses[500],
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        const organizationCode = await getOrganizationCode(user);
        const params = request.params as { id: string };
        const bodyData = extractRequestBodyData(request.body);
        const data = updateRoleSchema.parse(bodyData);
        const role = await roleService.update(organizationCode, params.id, data);
        reply.send(role);
      } catch (error: any) {
        sendErrorResponse(reply, error);
      }
    }
  );

  // Delete role (Organization Admin only, Superadmin can delete default roles)
  fastify.delete(
    '/:id',
    {
      preHandler: [authenticate, requireRole(['admin', 'superadmin'])],
      schema: {
        description: 'Delete a role. Organization admins can only delete custom roles (type="custom"). Superadmin can delete any role including default roles. Role must not be assigned to any users.',
        tags: ['Roles'],
        security: [{ bearerAuth: [] }],
        summary: 'Delete role',
        params: commonSchemas.UUIDParam,
        querystring: commonSchemas.OrganizationCodeQuery,
        response: {
          200: {
            description: 'Role deleted successfully',
            content: {
              'application/json': {
                schema: roleSchemas.DeleteRoleResponse,
              },
            },
          },
          400: {
            description: 'Bad Request - Role is assigned to users or invalid request',
            content: {
              'application/json': {
                schema: commonSchemas.ErrorResponse,
              },
            },
          },
          401: commonResponses[401],
          403: {
            description: 'Forbidden - Cannot delete default role (only superadmin can delete default roles)',
            content: {
              'application/json': {
                schema: commonSchemas.ErrorResponse,
              },
            },
          },
          404: commonResponses[404],
          500: commonResponses[500],
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        
        // For superadmin, we need to get organization code from query or allow deletion
        let organizationCode: string;
        if (user.role === 'superadmin') {
          // Superadmin might need to specify organization code
          const query = request.query as { organizationCode?: string };
          if (!query.organizationCode) {
            return reply.code(400).send({ error: 'Organization code is required for superadmin' });
          }
          organizationCode = query.organizationCode;
        } else {
          organizationCode = await getOrganizationCode(user);
        }
        
        const params = request.params as { id: string };
        // Pass user email to identify default superadmin (superadmin@smartroutehub.com)
        await roleService.delete(organizationCode, params.id, user.role as 'superadmin' | 'admin', user.email);
        reply.send({ success: true, message: 'Role deleted successfully' });
      } catch (error: any) {
        sendErrorResponse(reply, error);
      }
    }
  );
}

