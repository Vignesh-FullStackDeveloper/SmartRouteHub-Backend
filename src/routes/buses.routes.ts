import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { BusService } from '../services/bus.service';
import { authenticate, requirePermission } from '../middleware/auth';

const createBusSchema = z.object({
  bus_number: z.string().min(1),
  capacity: z.number().int().positive(),
  driver_id: z.string().uuid().optional(),
  assigned_route_id: z.string().uuid().optional(),
  metadata: z.record(z.any()).optional(),
});

const updateBusSchema = createBusSchema.partial();

export async function busesRoutes(fastify: FastifyInstance) {
  const busService = new BusService();

  // Create bus
  fastify.post(
    '/',
    {
      preHandler: [authenticate, requirePermission('bus', 'create')],
      schema: {
        description: 'Create a new bus',
        tags: ['Buses'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = createBusSchema.parse(request.body);
        const bus = await busService.create(data, request.user!.organization_id);
        reply.code(201).send(bus);
      } catch (error: any) {
        const statusCode = error.message.includes('already exists') ? 409 : 400;
        reply.code(statusCode).send({ error: error.message });
      }
    }
  );

  // Get all buses
  fastify.get(
    '/',
    {
      preHandler: [authenticate, requirePermission('bus', 'read')],
      schema: {
        description: 'Get all buses',
        tags: ['Buses'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            is_active: { type: 'boolean' },
            driver_id: { type: 'string' },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
      try {
        const buses = await busService.getAll(request.user!.organization_id, request.query);
        reply.send(buses);
      } catch (error: any) {
        reply.code(500).send({ error: error.message });
      }
    }
  );

  // Get bus by ID
  fastify.get(
    '/:id',
    {
      preHandler: [authenticate, requirePermission('bus', 'read')],
      schema: {
        description: 'Get bus by ID',
        tags: ['Buses'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const bus = await busService.getById(request.params.id, request.user!.organization_id);
        reply.send(bus);
      } catch (error: any) {
        reply.code(error.message.includes('not found') ? 404 : 500).send({ error: error.message });
      }
    }
  );

  // Update bus
  fastify.put(
    '/:id',
    {
      preHandler: [authenticate, requirePermission('bus', 'update')],
      schema: {
        description: 'Update bus',
        tags: ['Buses'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
      try {
        const data = updateBusSchema.parse(request.body);
        const updated = await busService.update(
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

  // Delete bus
  fastify.delete(
    '/:id',
    {
      preHandler: [authenticate, requirePermission('bus', 'delete')],
      schema: {
        description: 'Delete bus',
        tags: ['Buses'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        await busService.delete(request.params.id, request.user!.organization_id);
        reply.send({ message: 'Bus deleted successfully' });
      } catch (error: any) {
        reply.code(error.message.includes('not found') ? 404 : 500).send({ error: error.message });
      }
    }
  );

  // Assign driver to bus
  fastify.post(
    '/:id/assign-driver',
    {
      preHandler: [authenticate, requirePermission('bus', 'update')],
      schema: {
        description: 'Assign driver to bus',
        tags: ['Buses'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['driver_id'],
          properties: {
            driver_id: { type: 'string' },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string }; Body: { driver_id: string } }>, reply: FastifyReply) => {
      try {
        const updated = await busService.assignDriver(
          request.params.id,
          request.body.driver_id,
          request.user!.organization_id
        );
        reply.send(updated);
      } catch (error: any) {
        const statusCode = error.message.includes('not found') ? 404 : 500;
        reply.code(statusCode).send({ error: error.message });
      }
    }
  );
}

