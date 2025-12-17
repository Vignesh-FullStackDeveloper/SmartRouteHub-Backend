import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { UserService } from '../services/user.service';
import { authenticate, requireRole } from '../middleware/auth';
import { hasPermission } from '../rbac/hasPermission';
import { PERMISSIONS } from '../rbac/permissions';
import { JWTUser } from '../types';
import { commonSchemas, commonResponses } from '../schemas/common.schemas';
import { userSchemas } from '../schemas/user.schemas';
import { sendErrorResponse } from '../utils/error-handler.util';
import { sendSuccess, sendError, parsePagination, getPaginationMeta } from '../utils/response.util';
import { logger } from '../config/logger';
import { extractRequestBodyData } from '../utils/request.util';

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(6),
  role: z.enum(['admin', 'driver', 'parent']),
  role_id: z.string().uuid().optional(), // Custom role ID
  driver_id: z.string().optional(),
  organization_id: z.string().uuid().optional(), // Required for superadmin
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  is_active: z.boolean().optional(),
  role_id: z.string().uuid().nullable().optional(), // Can update role assignment
});

export async function usersRoutes(fastify: FastifyInstance) {
  const userService = new UserService();

  // Create user (Organization Admin only)
  fastify.post(
    '/',
    {
      preHandler: [authenticate, requireRole(['admin'])],
      schema: {
        description: 'Create a new user (admin, driver, or parent) and optionally assign a custom role. Requires user:create permission.',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        summary: 'Create user',
        body: userSchemas.CreateUserRequest,
        response: {
          201: {
            description: 'User created successfully',
            content: {
              'application/json': {
                schema: userSchemas.User,
              },
            },
          },
          400: commonResponses[400],
          401: commonResponses[401],
          403: commonResponses[403],
          409: {
            description: 'Conflict - Email already exists',
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
        
        if (!user.organization_id) {
          return reply.code(400).send({ error: 'Organization ID is required' });
        }

        const bodyData = extractRequestBodyData(request.body);
        const data = createUserSchema.parse(bodyData);
        const newUser = await userService.create(data, user.organization_id);
        reply.code(201).send(newUser);
      } catch (error: any) {
        sendErrorResponse(reply, error);
      }
    }
  );

  // Get all users
  fastify.get(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get all users in the organization. Admins see all users. Parents and drivers see only their own information.',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        summary: 'List users',
        querystring: userSchemas.UserQuery,
        response: {
          200: {
            description: 'List of users',
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
        if (!user.organization_id) {
          return reply.code(400).send({ error: 'Organization ID is required' });
        }
        
        const query = request.query as any;
        
        // Parse pagination
        let pagination;
        try {
          pagination = parsePagination(query);
        } catch (error: any) {
          logger.warn({ message: 'Invalid pagination parameters', error: error.message, userId: user.id });
          return sendError(reply, 400, error.message);
        }

        // Build basic filters
        const basicFilters: any = {
          ...pagination,
        };
        if (query.role) basicFilters.role = query.role;
        if (query.is_active !== undefined) basicFilters.is_active = query.is_active === 'true' || query.is_active === true;
        
        // Check permissions in descending order of authority
        if (hasPermission(user, PERMISSIONS.USER.GET_ALL) || user.role === 'admin') {
          // Admin role: return full dataset with pagination
          const result = await userService.getAll(user.organization_id, basicFilters);
          const paginationMeta = getPaginationMeta(result.total, pagination.limit, pagination.offset);
          logger.info({ 
            message: 'Users retrieved', 
            userId: user.id, 
            role: user.role, 
            count: result.data.length,
            total: result.total 
          });
          return sendSuccess(reply, result.data, 'Users retrieved successfully', paginationMeta);
        }
        
        if (hasPermission(user, PERMISSIONS.USER.GET)) {
          // Restricted: return filtered dataset based on role
          if (user.role === 'parent' || user.role === 'driver') {
            // Parent/Driver: can only see their own user info (no pagination needed)
            const userData = await userService.getById(user.id, user.organization_id);
            return reply.send([userData]);
          }
          // For other roles with GET permission, return empty
          return sendSuccess(reply, [], 'No users found', getPaginationMeta(0, pagination.limit, pagination.offset));
        }
        
        logger.warn({ message: 'Insufficient permissions to get users', userId: user.id, role: user.role });
        return sendError(reply, 403, 'Forbidden: Insufficient permissions');
      } catch (error: any) {
        logger.error({ 
          message: 'Error retrieving users', 
          error: error.message, 
          stack: error.stack,
          userId: (request.user as JWTUser)?.id 
        });
        sendErrorResponse(reply, error);
      }
    }
  );

  // Get user by ID
  fastify.get(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get a specific user by ID. Users can only access their own information unless they have user:read permission.',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        summary: 'Get user by ID',
        params: commonSchemas.UUIDParam,
        response: {
          200: {
            description: 'User details',
            content: {
              'application/json': {
                schema: userSchemas.User,
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
        if (!user.organization_id) {
          return reply.code(400).send({ error: 'Organization ID is required' });
        }
        const params = request.params as { id: string };
        // Check permissions in descending order of authority
        if (hasPermission(user, PERMISSIONS.USER.GET_ALL)) {
          // Highest level: can get any user
          const userData = await userService.getById(params.id, user.organization_id!);
          return reply.send(userData);
        }
        
        if (hasPermission(user, PERMISSIONS.USER.GET)) {
          // Restricted: can only get own user info
          if (params.id === user.id) {
            const userData = await userService.getById(params.id, user.organization_id!);
            return reply.send(userData);
          }
          return reply.code(403).send({ error: 'Forbidden: Can only access own user information' });
        }
        
        return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
      } catch (error: any) {
        sendErrorResponse(reply, error);
      }
    }
  );

  // Update user (Organization Admin only)
  fastify.put(
    '/:id',
    {
      preHandler: [authenticate, requireRole(['admin'])],
      schema: {
        description: 'Update user information and optionally assign/change custom role. All fields are optional.',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        summary: 'Update user',
        params: commonSchemas.UUIDParam,
        body: userSchemas.UpdateUserRequest,
        response: {
          200: {
            description: 'User updated successfully',
            content: {
              'application/json': {
                schema: userSchemas.User,
              },
            },
          },
          400: commonResponses[400],
          401: commonResponses[401],
          403: commonResponses[403],
          404: commonResponses[404],
          409: {
            description: 'Conflict - Email already exists',
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
        if (!user.organization_id) {
          return reply.code(400).send({ error: 'Organization ID is required' });
        }

        const params = request.params as { id: string };
        const bodyData = extractRequestBodyData(request.body);
        const data = updateUserSchema.parse(bodyData);
        const updated = await userService.update(
          params.id,
          data,
          user.organization_id
        );
        reply.send(updated);
      } catch (error: any) {
        sendErrorResponse(reply, error);
      }
    }
  );

  // Delete user (Organization Admin only)
  fastify.delete(
    '/:id',
    {
      preHandler: [authenticate, requireRole(['admin'])],
      schema: {
        description: 'Delete a user permanently. Requires user:delete permission. This is a hard delete operation.',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        summary: 'Delete user',
        params: commonSchemas.UUIDParam,
        response: {
          200: {
            description: 'User deleted successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    message: { type: 'string' },
                  },
                  required: ['success', 'message'],
                },
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
        if (!user.organization_id) {
          return reply.code(400).send({ error: 'Organization ID is required' });
        }

        const params = request.params as { id: string };
        // Hard delete - remove user from database
        await userService.delete(params.id, user.organization_id);
        reply.send({ success: true, message: 'User deleted successfully' });
      } catch (error: any) {
        sendErrorResponse(reply, error);
      }
    }
  );
}

