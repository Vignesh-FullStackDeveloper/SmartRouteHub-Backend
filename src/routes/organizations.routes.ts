import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { OrganizationService } from '../services/organization.service';
import { authenticate } from '../middleware/auth';
import { hasPermission } from '../rbac/hasPermission';
import { PERMISSIONS } from '../rbac/permissions';
import { JWTUser } from '../types';
import { logger } from '../config/logger';
import { commonSchemas, commonResponses } from '../schemas/common.schemas';
import { organizationSchemas } from '../schemas/organization.schemas';
import { sendErrorResponse } from '../utils/error-handler.util';
import { extractRequestBodyData } from '../utils/request.util';

const createOrgSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  primary_color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  contact_email: z.string().email().optional(),
  contact_phone: z.string().optional(),
  address: z.string().optional(),
  admin: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(6),
    phone: z.string().optional(),
  }).optional(),
});

const updateOrgSchema = createOrgSchema.partial();

export async function organizationsRoutes(fastify: FastifyInstance) {
  const organizationService = new OrganizationService();

  // Create organization (public, for initial setup)
  fastify.post(
    '/',
    {
      schema: {
        description: 'Create a new organization and optionally create an admin user. If admin is provided, a JWT token will be returned for immediate use. This endpoint is public and used for initial system setup.',
        tags: ['Organizations'],
        summary: 'Create organization',
        body: organizationSchemas.CreateOrganizationRequest,
        response: {
          201: {
            description: 'Organization created successfully',
            content: {
              'application/json': {
                schema: organizationSchemas.OrganizationWithAdmin,
              },
            },
          },
          400: commonResponses[400],
          409: {
            description: 'Conflict - Organization code already exists',
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
        const bodyData = extractRequestBodyData(request.body);
        const data = createOrgSchema.parse(bodyData);
        
        // Log request data for debugging
        logger.info({
          message: 'Organization creation request received',
          hasAdmin: !!data.admin,
          adminEmail: data.admin?.email,
          code: data.code,
        });
        
        const result = await organizationService.create(data);
        
        // Generate token for admin user if created
        if (result.admin) {
          const jwtUser = {
            id: result.admin.user.id,
            organization_id: result.admin.user.organization_id,
            email: result.admin.user.email,
            role: result.admin.user.role,
          };
          const token = fastify.jwt.sign(jwtUser);
          result.admin.token = token;
          
          logger.info({
            message: 'Organization created with admin user',
            organizationId: result.id,
            adminUserId: result.admin.user.id,
          });
        } else {
          logger.warn({
            message: 'Organization created without admin user',
            organizationId: result.id,
            code: result.code,
          });
        }
        
        reply.code(201).send(result);
      } catch (error: any) {
        logger.error({
          message: 'Organization creation failed',
          error: error.message,
          stack: error.stack,
          body: request.body,
        });
        sendErrorResponse(reply, error);
      }
    }
  );

  // Check if organization code is available (public, for UI validation)
  fastify.get(
    '/check-code/:code',
    {
      schema: {
        description: 'Check if an organization code is available. This is a public endpoint for UI validation during organization registration.',
        tags: ['Organizations'],
        summary: 'Check code availability',
        params: {
          type: 'object',
          required: ['code'],
          properties: {
            code: {
              type: 'string',
              description: 'Organization code to check',
            },
          },
        },
        response: {
          200: {
            description: 'Code availability status',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    code: { type: 'string' },
                    available: { type: 'boolean', description: 'True if code is available, false if already taken' },
                  },
                  required: ['code', 'available'],
                },
              },
            },
          },
          400: commonResponses[400],
          500: commonResponses[500],
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const params = request.params as { code: string };
        const available = await organizationService.checkCodeAvailable(params.code);
        reply.send({
          code: params.code,
          available,
        });
      } catch (error: any) {
        sendErrorResponse(reply, error);
      }
    }
  );

  // Get organization (authenticated)
  fastify.get(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get organization details by ID. Users can only access their own organization unless they are superadmin.',
        tags: ['Organizations'],
        security: [{ bearerAuth: [] }],
        summary: 'Get organization by ID',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Organization UUID',
            },
          },
        },
        response: {
          200: {
            description: 'Organization details',
            content: {
              'application/json': {
                schema: organizationSchemas.Organization,
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
        if (!hasPermission(user, PERMISSIONS.ORGANIZATION.GET)) {
          return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
        }

        const params = request.params as { id: string };
        const organization = await organizationService.getById(params.id);

        // Verify user belongs to this organization (unless superadmin)
        if (user.role !== 'superadmin' && user.organization_id !== organization.id) {
          return reply.code(403).send({ error: 'Access denied' });
        }

        reply.send(organization);
      } catch (error: any) {
        sendErrorResponse(reply, error);
      }
    }
  );

  // Update organization
  fastify.put(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Update organization information. Users can only update their own organization unless they are superadmin. All fields are optional.',
        tags: ['Organizations'],
        security: [{ bearerAuth: [] }],
        summary: 'Update organization',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Organization UUID',
            },
          },
        },
        body: organizationSchemas.UpdateOrganizationRequest,
        response: {
          200: {
            description: 'Organization updated successfully',
            content: {
              'application/json': {
                schema: organizationSchemas.Organization,
              },
            },
          },
          400: commonResponses[400],
          401: commonResponses[401],
          403: commonResponses[403],
          404: commonResponses[404],
          409: {
            description: 'Conflict - Organization code already exists',
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
        if (!hasPermission(user, PERMISSIONS.ORGANIZATION.UPDATE)) {
          return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
        }

        // Verify user belongs to this organization (unless superadmin)
        const params = request.params as { id: string };
        if (user.role !== 'superadmin' && user.organization_id !== params.id) {
          return reply.code(403).send({ error: 'Access denied' });
        }

        const bodyData = extractRequestBodyData(request.body);
        const data = updateOrgSchema.parse(bodyData);
        const updated = await organizationService.update(params.id, data);
        reply.send(updated);
      } catch (error: any) {
        sendErrorResponse(reply, error);
      }
    }
  );
}

