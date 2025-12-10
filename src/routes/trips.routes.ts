import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { TripService } from '../services/trip.service';
import { authenticate, requirePermission } from '../middleware/auth';

const startTripSchema = z.object({
  bus_id: z.string().uuid(),
  route_id: z.string().uuid(),
  latitude: z.number(),
  longitude: z.number(),
});

const updateLocationSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  speed_kmh: z.number().optional(),
  heading: z.number().optional(),
  accuracy: z.number().optional(),
});

export async function tripsRoutes(fastify: FastifyInstance) {
  const tripService = new TripService();

  // Start trip
  fastify.post(
    '/start',
    {
      preHandler: [authenticate, requirePermission('trip', 'create')],
      schema: {
        description: 'Start a new trip',
        tags: ['Trips'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = startTripSchema.parse(request.body);
        const trip = await tripService.start(
          data,
          request.user!.id,
          request.user!.organization_id
        );
        reply.code(201).send(trip);
      } catch (error: any) {
        const statusCode = error.message.includes('not found') ? 404 :
                          error.message.includes('not assigned') ? 403 :
                          error.message.includes('already has') ? 409 : 400;
        reply.code(statusCode).send({ error: error.message });
      }
    }
  );

  // Update trip location
  fastify.post(
    '/:id/location',
    {
      preHandler: [authenticate, requirePermission('location', 'update')],
      schema: {
        description: 'Update trip location',
        tags: ['Trips'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
      try {
        const data = updateLocationSchema.parse(request.body);
        const trip = await tripService.updateLocation(
          request.params.id,
          data,
          request.user!.organization_id
        );
        reply.send(trip);
      } catch (error: any) {
        const statusCode = error.message.includes('not found') ? 404 :
                          error.message.includes('not in progress') ? 400 : 400;
        reply.code(statusCode).send({ error: error.message });
      }
    }
  );

  // End trip
  fastify.post(
    '/:id/end',
    {
      preHandler: [authenticate, requirePermission('trip', 'update')],
      schema: {
        description: 'End a trip',
        tags: ['Trips'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const trip = await tripService.end(
          request.params.id,
          request.user!.organization_id
        );
        reply.send(trip);
      } catch (error: any) {
        const statusCode = error.message.includes('not found') ? 404 :
                          error.message.includes('not in progress') ? 400 : 500;
        reply.code(statusCode).send({ error: error.message });
      }
    }
  );

  // Get active trips
  fastify.get(
    '/active',
    {
      preHandler: [authenticate, requirePermission('trip', 'read')],
      schema: {
        description: 'Get all active trips',
        tags: ['Trips'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const trips = await tripService.getActive(request.user!.organization_id);
        reply.send(trips);
      } catch (error: any) {
        reply.code(500).send({ error: error.message });
      }
    }
  );

  // Get trip by ID
  fastify.get(
    '/:id',
    {
      preHandler: [authenticate, requirePermission('trip', 'read')],
      schema: {
        description: 'Get trip by ID',
        tags: ['Trips'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const trip = await tripService.getById(
          request.params.id,
          request.user!.organization_id
        );
        reply.send(trip);
      } catch (error: any) {
        reply.code(error.message.includes('not found') ? 404 : 500).send({ error: error.message });
      }
    }
  );
}

