import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { DriverService } from '../services/driver.service';
import { authenticate, requirePermission } from '../middleware/auth';

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
      preHandler: [authenticate, requirePermission('user', 'create')],
      schema: {
        description: 'Create a new driver',
        tags: ['Drivers'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = createDriverSchema.parse(request.body);
        const driver = await driverService.create(data, request.user!.organization_id);
        reply.code(201).send(driver);
      } catch (error: any) {
        const statusCode = error.message.includes('already exists') ? 409 : 400;
        reply.code(statusCode).send({ error: error.message });
      }
    }
  );

  // Get all drivers
  fastify.get(
    '/',
    {
      preHandler: [authenticate, requirePermission('user', 'read')],
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
    async (request: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
      try {
        const drivers = await driverService.getAll(request.user!.organization_id, request.query);
        reply.send(drivers);
      } catch (error: any) {
        reply.code(500).send({ error: error.message });
      }
    }
  );

  // Get driver by ID
  fastify.get(
    '/:id',
    {
      preHandler: [authenticate, requirePermission('user', 'read')],
      schema: {
        description: 'Get driver by ID',
        tags: ['Drivers'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const driver = await driverService.getById(request.params.id, request.user!.organization_id);
        reply.send(driver);
      } catch (error: any) {
        reply.code(error.message.includes('not found') ? 404 : 500).send({ error: error.message });
      }
    }
  );

  // Update driver
  fastify.put(
    '/:id',
    {
      preHandler: [authenticate, requirePermission('user', 'update')],
      schema: {
        description: 'Update driver',
        tags: ['Drivers'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
      try {
        const data = updateDriverSchema.parse(request.body);
        const updated = await driverService.update(
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

  // Get driver schedule (which bus at which time)
  fastify.get(
    '/:id/schedule',
    {
      preHandler: [authenticate, requirePermission('user', 'read')],
      schema: {
        description: 'Get driver schedule',
        tags: ['Drivers'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const schedule = await driverService.getSchedule(
          request.params.id,
          request.user!.organization_id
        );
        reply.send(schedule);
      } catch (error: any) {
        reply.code(error.message.includes('not found') ? 404 : 500).send({ error: error.message });
      }
    }
  );
}

