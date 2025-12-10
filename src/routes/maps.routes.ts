import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { MapsService } from '../services/maps.service';
import { authenticate, requirePermission } from '../middleware/auth';

const geocodeSchema = z.object({
  address: z.string().min(1),
});

const reverseGeocodeSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
});

const calculateRouteSchema = z.object({
  origin: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }),
  destination: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }),
  waypoints: z.array(z.object({
    latitude: z.number(),
    longitude: z.number(),
  })).optional(),
});

export async function mapsRoutes(fastify: FastifyInstance) {
  const mapsService = new MapsService();

  // Get route distance and duration
  fastify.post(
    '/route/calculate',
    {
      preHandler: [authenticate, requirePermission('route', 'read')],
      schema: {
        description: 'Calculate route distance and duration using Google Maps',
        tags: ['Maps'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = calculateRouteSchema.parse(request.body);
        const result = await mapsService.calculateRoute(data);
        reply.send(result);
      } catch (error: any) {
        const statusCode = error.message.includes('not configured') ? 500 : 400;
        reply.code(statusCode).send({ error: error.message });
      }
    }
  );

  // Geocode address
  fastify.post(
    '/geocode',
    {
      preHandler: [authenticate, requirePermission('route', 'read')],
      schema: {
        description: 'Geocode address to coordinates',
        tags: ['Maps'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = geocodeSchema.parse(request.body);
        const result = await mapsService.geocode(data.address);
        reply.send(result);
      } catch (error: any) {
        const statusCode = error.message.includes('not configured') ? 500 : 400;
        reply.code(statusCode).send({ error: error.message });
      }
    }
  );

  // Reverse geocode coordinates
  fastify.post(
    '/reverse-geocode',
    {
      preHandler: [authenticate, requirePermission('route', 'read')],
      schema: {
        description: 'Reverse geocode coordinates to address',
        tags: ['Maps'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = reverseGeocodeSchema.parse(request.body);
        const result = await mapsService.reverseGeocode(data.latitude, data.longitude);
        reply.send(result);
      } catch (error: any) {
        const statusCode = error.message.includes('not configured') ? 500 : 400;
        reply.code(statusCode).send({ error: error.message });
      }
    }
  );
}

