import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { PermissionService } from '../services/permission.service';
import { OrganizationService } from '../services/organization.service';
import { authenticate, requireRole } from '../middleware/auth';
import { JWTUser } from '../types';

const createPermissionSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).regex(/^[a-z0-9_]+$/, 'Code must contain only lowercase letters, numbers, and underscores'),
  description: z.string().optional(),
});

export async function permissionsRoutes(fastify: FastifyInstance) {
  const permissionService = new PermissionService();
  const organizationService = new OrganizationService();

  // Helper to get organization code from user
  async function getOrganizationCode(user: JWTUser): Promise<string> {
    if (!user.organization_id) {
      throw new Error('Organization ID is required');
    }
    const organization = await organizationService.getById(user.organization_id);
    return organization.code;
  }

  // Create permission (Organization Admin only)
  fastify.post(
    '/',
    {
      preHandler: [authenticate, requireRole(['admin'])],
      schema: {
        description: 'Create a new permission',
        tags: ['Permissions'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['name', 'code'],
          properties: {
            name: { type: 'string' },
            code: { type: 'string' },
            description: { type: 'string' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              code: { type: 'string' },
              description: { type: 'string' },
              created_at: { type: 'string' },
              updated_at: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        const organizationCode = await getOrganizationCode(user);
        const data = createPermissionSchema.parse(request.body);
        const permission = await permissionService.create(organizationCode, data);
        reply.code(201).send(permission);
      } catch (error: any) {
        const statusCode = error.message.includes('already exists') ? 409 : 
                          error.message.includes('Organization') ? 400 : 500;
        reply.code(statusCode).send({ error: error.message });
      }
    }
  );

  // Get all permissions (Organization Admin only)
  fastify.get(
    '/',
    {
      preHandler: [authenticate, requireRole(['admin'])],
      schema: {
        description: 'Get all permissions for the organization',
        tags: ['Permissions'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                code: { type: 'string' },
                description: { type: 'string' },
                created_at: { type: 'string' },
                updated_at: { type: 'string' },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        const organizationCode = await getOrganizationCode(user);
        const permissions = await permissionService.getAll(organizationCode);
        reply.send(permissions);
      } catch (error: any) {
        reply.code(500).send({ error: error.message });
      }
    }
  );

  // Delete permission (Organization Admin only)
  fastify.delete(
    '/:id',
    {
      preHandler: [authenticate, requireRole(['admin'])],
      schema: {
        description: 'Delete a permission',
        tags: ['Permissions'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        const organizationCode = await getOrganizationCode(user);
        const params = request.params as { id: string };
        await permissionService.delete(organizationCode, params.id);
        reply.send({ message: 'Permission deleted successfully' });
      } catch (error: any) {
        const statusCode = error.message.includes('assigned to') ? 400 : 404;
        reply.code(statusCode).send({ error: error.message });
      }
    }
  );
}
