import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { OrganizationService } from '../services/organization.service';
import { authenticate } from '../middleware/auth';
import { hasPermission } from '../rbac/hasPermission';
import { PERMISSIONS } from '../rbac/permissions';
import { JWTUser } from '../types';
import { logger } from '../config/logger';

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
        description: 'Create a new organization. Optionally create an admin user for the organization. If admin is provided, a token will be returned.',
        tags: ['Organizations'],
        body: {
          type: 'object',
          required: ['name', 'code'],
          properties: {
            name: { type: 'string' },
            code: { type: 'string' },
            primary_color: { type: 'string' },
            contact_email: { type: 'string', format: 'email' },
            contact_phone: { type: 'string' },
            address: { type: 'string' },
            admin: {
              type: 'object',
              description: 'Optional: Create admin user along with organization. If provided, a JWT token will be returned.',
              properties: {
                name: { type: 'string' },
                email: { type: 'string', format: 'email' },
                password: { type: 'string', minLength: 6 },
                phone: { type: 'string' },
              },
              required: ['name', 'email', 'password'],
            },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              code: { type: 'string' },
              primary_color: { type: 'string' },
              contact_email: { type: 'string', format: 'email' },
              contact_phone: { type: 'string' },
              address: { type: 'string' },
              is_active: { type: 'boolean' },
              created_at: { type: 'string', format: 'date-time' },
              updated_at: { type: 'string', format: 'date-time' },
              admin: {
                type: 'object',
                description: 'Present only if admin was created',
                properties: {
                  user: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', format: 'uuid' },
                      email: { type: 'string' },
                      name: { type: 'string' },
                      role: { type: 'string', enum: ['admin'] },
                      organization_id: { type: 'string', format: 'uuid' },
                    },
                  },
                  token: { 
                    type: 'string',
                    description: 'JWT token for the admin user. Use this for authenticated requests.',
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = createOrgSchema.parse(request.body);
        
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
        const statusCode = error.message.includes('already exists') ? 409 : 500;
        reply.code(statusCode).send({ error: error.message });
      }
    }
  );

  // Check if organization code is available (public, for UI validation)
  fastify.get(
    '/check-code/:code',
    {
      schema: {
        description: 'Check if an organization code is available',
        tags: ['Organizations'],
        params: {
          type: 'object',
          properties: {
            code: { type: 'string' },
          },
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
        reply.code(500).send({ error: error.message });
      }
    }
  );

  // Get organization (authenticated)
  fastify.get(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get organization by ID',
        tags: ['Organizations'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
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
        reply.code(error.message.includes('not found') ? 404 : 500).send({ error: error.message });
      }
    }
  );

  // Update organization
  fastify.put(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Update organization',
        tags: ['Organizations'],
        security: [{ bearerAuth: [] }],
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

        const data = updateOrgSchema.parse(request.body);
        const updated = await organizationService.update(params.id, data);
        reply.send(updated);
      } catch (error: any) {
        const statusCode = error.message.includes('not found') ? 404 :
                          error.message.includes('already exists') ? 409 : 400;
        reply.code(statusCode).send({ error: error.message });
      }
    }
  );
}

