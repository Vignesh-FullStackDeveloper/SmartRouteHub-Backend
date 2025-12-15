import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { UserService } from '../services/user.service';
import { authenticate, requireRole } from '../middleware/auth';
import { hasPermission } from '../rbac/hasPermission';
import { PERMISSIONS } from '../rbac/permissions';
import { JWTUser } from '../types';

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
        description: 'Add users and assign roles',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['name', 'email', 'password', 'role'],
          properties: {
            name: { type: 'string' },
            email: { type: 'string' },
            phone: { type: 'string' },
            password: { type: 'string' },
            role: { type: 'string', enum: ['admin', 'driver', 'parent'] },
            role_id: { type: 'string', format: 'uuid' },
            driver_id: { type: 'string' },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        
        if (!user.organization_id) {
          return reply.code(400).send({ error: 'Organization ID is required' });
        }

        const data = createUserSchema.parse(request.body);
        const newUser = await userService.create(data, user.organization_id);
        reply.code(201).send(newUser);
      } catch (error: any) {
        const statusCode = error.message.includes('already exists') ? 409 : 400;
        reply.code(statusCode).send({ error: error.message });
      }
    }
  );

  // Get all users (Organization Admin only)
  fastify.get(
    '/',
    {
      preHandler: [authenticate, requireRole(['admin'])],
      schema: {
        description: 'View list of users',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            role: { type: 'string', enum: ['admin', 'driver', 'parent'] },
            is_active: { type: 'boolean' },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        if (!user.organization_id) {
          return reply.code(400).send({ error: 'Organization ID is required' });
        }
        
        const users = await userService.getAll(user.organization_id, request.query as any);
        return reply.send(users);
      } catch (error: any) {
        reply.code(500).send({ error: error.message });
      }
    }
  );

  // Get user by ID
  fastify.get(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get user by ID',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
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
        reply.code(error.message.includes('not found') ? 404 : 500).send({ error: error.message });
      }
    }
  );

  // Update user (Organization Admin only)
  fastify.put(
    '/:id',
    {
      preHandler: [authenticate, requireRole(['admin'])],
      schema: {
        description: 'Update user info and change roles',
        tags: ['Users'],
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
            email: { type: 'string' },
            phone: { type: 'string' },
            is_active: { type: 'boolean' },
            role_id: { type: 'string', format: 'uuid' },
          },
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
        const data = updateUserSchema.parse(request.body);
        const updated = await userService.update(
          params.id,
          data,
          user.organization_id
        );
        reply.send(updated);
      } catch (error: any) {
        const statusCode = error.message.includes('not found') ? 404 :
                          error.message.includes('already exists') ? 409 : 400;
        reply.code(statusCode).send({ error: error.message });
      }
    }
  );

  // Delete user (Organization Admin only)
  fastify.delete(
    '/:id',
    {
      preHandler: [authenticate, requireRole(['admin'])],
      schema: {
        description: 'Remove a user',
        tags: ['Users'],
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
        if (!user.organization_id) {
          return reply.code(400).send({ error: 'Organization ID is required' });
        }

        const params = request.params as { id: string };
        // Hard delete - remove user from database
        await userService.delete(params.id, user.organization_id);
        reply.send({ message: 'User deleted successfully' });
      } catch (error: any) {
        const statusCode = error.message.includes('not found') ? 404 : 500;
        reply.code(statusCode).send({ error: error.message });
      }
    }
  );
}

