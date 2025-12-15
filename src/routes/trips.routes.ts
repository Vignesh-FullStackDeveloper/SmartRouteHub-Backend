import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { TripService } from '../services/trip.service';
import { authenticate } from '../middleware/auth';
import { hasPermission } from '../rbac/hasPermission';
import { PERMISSIONS } from '../rbac/permissions';
import { JWTUser } from '../types';

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
      preHandler: [authenticate],
      schema: {
        description: 'Start a new trip',
        tags: ['Trips'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        if (!hasPermission(user, PERMISSIONS.TRIP.CREATE)) {
          return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
        }

        const data = startTripSchema.parse(request.body);
        const trip = await tripService.start(
          data,
          user.id,
          user.organization_id!
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
      preHandler: [authenticate],
      schema: {
        description: 'Update trip location',
        tags: ['Trips'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        if (!hasPermission(user, PERMISSIONS.LOCATION.UPDATE)) {
          return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
        }

        // Additional check: drivers can only update their own trips
        if (user.role === 'driver') {
          const params = request.params as { id: string };
          const trip = await tripService.getById(params.id, user.organization_id!);
          if (trip.driver_id !== user.id) {
            return reply.code(403).send({ error: 'Forbidden: Can only update own trips' });
          }
        }

        const params = request.params as { id: string };
        const data = updateLocationSchema.parse(request.body);
        const trip = await tripService.updateLocation(
          params.id,
          data,
          user.organization_id!
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
      preHandler: [authenticate],
      schema: {
        description: 'End a trip',
        tags: ['Trips'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        if (!hasPermission(user, PERMISSIONS.TRIP.UPDATE)) {
          return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
        }

        // Additional check: drivers can only end their own trips
        if (user.role === 'driver') {
          const params = request.params as { id: string };
          const trip = await tripService.getById(params.id, user.organization_id!);
          if (trip.driver_id !== user.id) {
            return reply.code(403).send({ error: 'Forbidden: Can only end own trips' });
          }
        }

        const params = request.params as { id: string };
        const trip = await tripService.end(
          params.id,
          user.organization_id!
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
      preHandler: [authenticate],
      schema: {
        description: 'Get all active trips',
        tags: ['Trips'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        // Check permissions in descending order of authority
        if (hasPermission(user, PERMISSIONS.TRIP.GET_ALL)) {
          // Highest level: return full dataset
          const trips = await tripService.getActive(user.organization_id!);
          return reply.send(trips);
        }
        
        if (hasPermission(user, PERMISSIONS.TRIP.GET)) {
          // Restricted: return filtered dataset
          if (user.role === 'driver') {
            // Drivers can only see their own active trips
            const allTrips = await tripService.getActive(user.organization_id!);
            const driverTrips = allTrips.filter((trip: any) => trip.driver_id === user.id);
            return reply.send(driverTrips);
          }
          // For other roles with GET permission, return all active trips
          const trips = await tripService.getActive(user.organization_id!);
          return reply.send(trips);
        }
        
        return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
      } catch (error: any) {
        reply.code(500).send({ error: error.message });
      }
    }
  );

  // Get trip by ID
  fastify.get(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get trip by ID',
        tags: ['Trips'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        const params = request.params as { id: string };
        // Check permissions in descending order of authority
        if (hasPermission(user, PERMISSIONS.TRIP.GET_ALL)) {
          // Highest level: can get any trip
          const trip = await tripService.getById(
            params.id,
            user.organization_id!
          );
          return reply.send(trip);
        }
        
        if (hasPermission(user, PERMISSIONS.TRIP.GET)) {
          // Restricted: drivers can only get their own trips
          if (user.role === 'driver') {
            const trip = await tripService.getById(
              params.id,
              user.organization_id!
            );
            if (trip.driver_id !== user.id) {
              return reply.code(403).send({ error: 'Forbidden: Can only access own trips' });
            }
            return reply.send(trip);
          }
          // For other roles with GET permission, allow access
          const trip = await tripService.getById(
            params.id,
            user.organization_id!
          );
          return reply.send(trip);
        }
        
        return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
      } catch (error: any) {
        reply.code(error.message.includes('not found') ? 404 : 500).send({ error: error.message });
      }
    }
  );
}

