import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { DriverService } from '../services/driver.service';
import { authenticate } from '../middleware/auth';
import { hasPermission } from '../rbac/hasPermission';
import { PERMISSIONS } from '../rbac/permissions';
import { JWTUser } from '../types';

const createDriverSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(6),
  driver_id: z.string().min(1),
});

const updateDriverSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  driver_id: z.string().min(1).optional(),
  is_active: z.boolean().optional(),
  assigned_bus_id: z.string().uuid().optional(),
  assigned_route_id: z.string().uuid().optional(),
});

export async function driversRoutes(fastify: FastifyInstance) {
  const driverService = new DriverService();

  // Create driver
  fastify.post(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Create a new driver',
        tags: ['Drivers'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['name', 'email', 'password', 'driver_id'],
          properties: {
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            phone: { type: 'string' },
            password: { type: 'string', minLength: 6 },
            driver_id: { type: 'string' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              email: { type: 'string' },
              phone: { type: 'string' },
              driver_id: { type: 'string' },
              organization_id: { type: 'string' },
              is_active: { type: 'boolean' },
              created_at: { type: 'string', format: 'date-time' },
              updated_at: { type: 'string', format: 'date-time' },
            },
          },
          400: { type: 'object', properties: { error: { type: 'string' } } },
          403: { type: 'object', properties: { error: { type: 'string' } } },
          409: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        if (!user.organization_id) {
          return reply.code(400).send({ error: 'Organization ID is required' });
        }
        if (!hasPermission(user, PERMISSIONS.USER.CREATE)) {
          return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
        }

        const data = createDriverSchema.parse(request.body);
        const driver = await driverService.create(data, user.organization_id);
        reply.code(201).send(driver);
      } catch (error: any) {
        if (error.name === 'ZodError') {
          return reply.code(400).send({ error: 'Validation error', details: error.errors });
        }
        const statusCode = error.message.includes('already exists') ? 409 : 400;
        reply.code(statusCode).send({ error: error.message });
      }
    }
  );

  // Get all drivers
  fastify.get(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get all drivers',
        tags: ['Drivers'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            is_active: { type: 'boolean' },
            has_bus: { type: 'boolean' },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        // Check permissions in descending order of authority
        if (hasPermission(user, PERMISSIONS.USER.GET_ALL)) {
          // Highest level: return full dataset
          const drivers = await driverService.getAll(user.organization_id!, request.query as any);
          return reply.send(drivers);
        }
        
        if (hasPermission(user, PERMISSIONS.USER.GET)) {
          // Restricted: return filtered dataset (e.g., only own driver info if user is a driver)
          if (user.role === 'driver') {
            const driver = await driverService.getById(user.id, user.organization_id!);
            return reply.send([driver]);
          }
          // For other roles with GET permission, return empty or limited data
          return reply.send([]);
        }
        
        return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
      } catch (error: any) {
        reply.code(500).send({ error: error.message });
      }
    }
  );

  // Get driver by ID
  fastify.get(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get driver by ID',
        tags: ['Drivers'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        // Check permissions in descending order of authority
        if (hasPermission(user, PERMISSIONS.USER.GET_ALL)) {
          // Highest level: can get any driver
          const params = request.params as { id: string };
          const driver = await driverService.getById(params.id, user.organization_id!);
          return reply.send(driver);
        }
        
        if (hasPermission(user, PERMISSIONS.USER.GET)) {
          // Restricted: can only get own driver info
          const params = request.params as { id: string };
          if (user.role === 'driver' && params.id === user.id) {
            const driver = await driverService.getById(params.id, user.organization_id!);
            return reply.send(driver);
          }
          return reply.code(403).send({ error: 'Forbidden: Can only access own driver information' });
        }
        
        return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
      } catch (error: any) {
        reply.code(error.message.includes('not found') ? 404 : 500).send({ error: error.message });
      }
    }
  );

  // Update driver
  fastify.put(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Update driver',
        tags: ['Drivers'],
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
            email: { type: 'string', format: 'email' },
            phone: { type: 'string' },
            driver_id: { type: 'string' },
            is_active: { type: 'boolean' },
            assigned_bus_id: { type: 'string', format: 'uuid' },
            assigned_route_id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              email: { type: 'string' },
              phone: { type: 'string' },
              driver_id: { type: 'string' },
              organization_id: { type: 'string' },
              is_active: { type: 'boolean' },
              created_at: { type: 'string', format: 'date-time' },
              updated_at: { type: 'string', format: 'date-time' },
            },
          },
          400: { type: 'object', properties: { error: { type: 'string' } } },
          403: { type: 'object', properties: { error: { type: 'string' } } },
          404: { type: 'object', properties: { error: { type: 'string' } } },
          409: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        if (!hasPermission(user, PERMISSIONS.USER.UPDATE)) {
          return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
        }

        // Additional check: drivers can only update themselves
        const params = request.params as { id: string };
        if (user.role === 'driver' && params.id !== user.id) {
          return reply.code(403).send({ error: 'Forbidden: Can only update own driver information' });
        }

        const data = updateDriverSchema.parse(request.body);
        const updated = await driverService.update(
          params.id,
          data,
          user.organization_id!
        );
        reply.send(updated);
      } catch (error: any) {
        const statusCode = error.message.includes('not found') ? 404 :
                          error.message.includes('already exists') ? 409 : 400;
        reply.code(statusCode).send({ error: error.message });
      }
    }
  );

  // Get driver schedule (which bus at which time)
  fastify.get(
    '/:id/schedule',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get driver schedule',
        tags: ['Drivers'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        // Check permissions in descending order of authority
        if (hasPermission(user, PERMISSIONS.USER.GET_ALL)) {
          // Highest level: can get any driver's schedule
          const params = request.params as { id: string };
          const schedule = await driverService.getSchedule(
            params.id,
            user.organization_id!
          );
          return reply.send(schedule);
        }
        
        if (hasPermission(user, PERMISSIONS.USER.GET)) {
          // Restricted: can only get own schedule
          const params = request.params as { id: string };
          if (user.role === 'driver' && params.id === user.id) {
            const schedule = await driverService.getSchedule(
              params.id,
              user.organization_id!
            );
            return reply.send(schedule);
          }
          return reply.code(403).send({ error: 'Forbidden: Can only access own schedule' });
        }
        
        return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
      } catch (error: any) {
        reply.code(error.message.includes('not found') ? 404 : 500).send({ error: error.message });
      }
    }
  );

  // Delete driver
  fastify.delete(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Delete driver',
        tags: ['Drivers'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        if (!hasPermission(user, PERMISSIONS.USER.DELETE)) {
          return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
        }

        const params = request.params as { id: string };
        await driverService.delete(params.id, user.organization_id!);
        reply.send({ message: 'Driver deleted successfully' });
      } catch (error: any) {
        const statusCode = error.message.includes('not found') ? 404 :
                          error.message.includes('assigned to') ? 400 : 500;
        reply.code(statusCode).send({ error: error.message });
      }
    }
  );
}

