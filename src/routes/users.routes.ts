import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { UserService } from '../services/user.service';
import { authenticate, requireRole, requirePermission } from '../middleware/auth';

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(6),
  role: z.enum(['admin', 'driver', 'parent']),
  driver_id: z.string().optional(),
  organization_id: z.string().uuid().optional(), // Required for superadmin
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  is_active: z.boolean().optional(),
});

export async function usersRoutes(fastify: FastifyInstance) {
  const userService = new UserService();

  // Create user (admin only, or superadmin with organization_id)
  fastify.post(
    '/',
    {
      preHandler: [
        authenticate,
        requireRole(['admin', 'superadmin']),
        requirePermission('user', 'create'),
      ],
      schema: {
        description: 'Create a new user. For superadmin, organization_id must be provided in body.',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = createUserSchema.parse(request.body);
        
        // For superadmin, organization_id must be provided in body
        // For regular admins, use their organization_id
        let organizationId: string;
        if (request.user!.role === 'superadmin') {
          const body = request.body as any;
          if (!body.organization_id) {
            reply.code(400).send({ error: 'organization_id is required for superadmin' });
            return;
          }
          organizationId = body.organization_id;
        } else {
          organizationId = request.user!.organization_id!;
        }
        
        const user = await userService.create(data, organizationId);
        reply.code(201).send(user);
      } catch (error: any) {
        const statusCode = error.message.includes('already exists') ? 409 : 400;
        reply.code(statusCode).send({ error: error.message });
      }
    }
  );

  // Get all users
  fastify.get(
    '/',
    {
      preHandler: [authenticate, requirePermission('user', 'read')],
      schema: {
        description: 'Get all users',
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
    async (request: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
      try {
        const users = await userService.getAll(request.user!.organization_id, request.query);
        reply.send(users);
      } catch (error: any) {
        reply.code(500).send({ error: error.message });
      }
    }
  );

  // Get user by ID
  fastify.get(
    '/:id',
    {
      preHandler: [authenticate, requirePermission('user', 'read')],
      schema: {
        description: 'Get user by ID',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const user = await userService.getById(request.params.id, request.user!.organization_id);
        reply.send(user);
      } catch (error: any) {
        reply.code(error.message.includes('not found') ? 404 : 500).send({ error: error.message });
      }
    }
  );

  // Update user
  fastify.put(
    '/:id',
    {
      preHandler: [authenticate, requirePermission('user', 'update')],
      schema: {
        description: 'Update user',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
      try {
        const data = updateUserSchema.parse(request.body);
        const updated = await userService.update(
          request.params.id,
          data,
          request.user!.organization_id
        );
        reply.send(updated);
      } catch (error: any) {
        const statusCode = error.message.includes('not found') ? 404 :
                          error.message.includes('already exists') ? 409 : 400;
        reply.code(statusCode).send({ error: error.message });
      }
    }
  );
}

