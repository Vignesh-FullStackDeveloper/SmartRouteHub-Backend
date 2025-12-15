import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { RoleService } from '../services/role.service';
import { OrganizationService } from '../services/organization.service';
import { authenticate, requireRole } from '../middleware/auth';
import { JWTUser } from '../types';

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
        description: 'Create a new role with permissions',
        tags: ['Roles'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['name', 'permissionIds'],
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            permissionIds: {
              type: 'array',
              items: { type: 'string', format: 'uuid' },
            },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string' },
              permissions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    code: { type: 'string' },
                  },
                },
              },
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
        const data = createRoleSchema.parse(request.body);
        const role = await roleService.create(organizationCode, data);
        reply.code(201).send(role);
      } catch (error: any) {
        const statusCode = error.message.includes('already exists') || error.message.includes('not found') ? 400 : 500;
        reply.code(statusCode).send({ error: error.message });
      }
    }
  );

  // Get all roles (Organization Admin only)
  fastify.get(
    '/',
    {
      preHandler: [authenticate, requireRole(['admin'])],
      schema: {
        description: 'Get all roles in the organization',
        tags: ['Roles'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                description: { type: 'string' },
                permissions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' },
                      code: { type: 'string' },
                    },
                  },
                },
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
        const roles = await roleService.getByOrganization(organizationCode);
        reply.send(roles);
      } catch (error: any) {
        reply.code(500).send({ error: error.message });
      }
    }
  );

  // Get role by ID (Organization Admin only)
  fastify.get(
    '/:id',
    {
      preHandler: [authenticate, requireRole(['admin'])],
      schema: {
        description: 'Get role by ID',
        tags: ['Roles'],
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
              id: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string' },
              permissions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    code: { type: 'string' },
                  },
                },
              },
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
        const params = request.params as { id: string };
        const role = await roleService.getById(organizationCode, params.id);
        if (!role) {
          return reply.code(404).send({ error: 'Role not found' });
        }
        reply.send(role);
      } catch (error: any) {
        reply.code(500).send({ error: error.message });
      }
    }
  );

  // Update role (Organization Admin only)
  fastify.put(
    '/:id',
    {
      preHandler: [authenticate, requireRole(['admin'])],
      schema: {
        description: 'Update role permissions',
        tags: ['Roles'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            permissionIds: {
              type: 'array',
              items: { type: 'string', format: 'uuid' },
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string' },
              permissions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    code: { type: 'string' },
                  },
                },
              },
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
        const params = request.params as { id: string };
        const data = updateRoleSchema.parse(request.body);
        const role = await roleService.update(organizationCode, params.id, data);
        reply.send(role);
      } catch (error: any) {
        const statusCode = error.message.includes('not found') ? 404 : 
                          error.message.includes('already exists') || error.message.includes('not found') ? 400 : 500;
        reply.code(statusCode).send({ error: error.message });
      }
    }
  );

  // Delete role (Organization Admin only)
  fastify.delete(
    '/:id',
    {
      preHandler: [authenticate, requireRole(['admin'])],
      schema: {
        description: 'Delete a role',
        tags: ['Roles'],
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
        await roleService.delete(organizationCode, params.id);
        reply.send({ message: 'Role deleted successfully' });
      } catch (error: any) {
        const statusCode = error.message.includes('assigned to') ? 400 : 404;
        reply.code(statusCode).send({ error: error.message });
      }
    }
  );
}

