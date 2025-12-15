import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { BusService } from '../services/bus.service';
import { authenticate } from '../middleware/auth';
import { hasPermission } from '../rbac/hasPermission';
import { PERMISSIONS } from '../rbac/permissions';
import { JWTUser } from '../types';

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
      preHandler: [authenticate],
      schema: {
        description: 'Create a new bus',
        tags: ['Buses'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!hasPermission(request.user, PERMISSIONS.BUS.CREATE)) {
          return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
        }

        const data = createBusSchema.parse(request.body);
        const bus = await busService.create(data, request.user!.organization_id!);
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
      preHandler: [authenticate],
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
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        // Check permissions in descending order of authority
        if (hasPermission(user, PERMISSIONS.BUS.GET_ALL)) {
          // Highest level: return full dataset
          const buses = await busService.getAll(user.organization_id!, request.query as any);
          return reply.send(buses);
        }
        
        if (hasPermission(user, PERMISSIONS.BUS.GET)) {
          // Restricted: return filtered dataset
          if (user.role === 'driver') {
            // Drivers can only see their own bus
            const buses = await busService.getByDriverId(user.id, user.organization_id!);
            return reply.send(buses);
          }
          // For other roles with GET permission, return all buses (read-only access)
          const buses = await busService.getAll(user.organization_id!, request.query as any);
          return reply.send(buses);
        }
        
        return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
      } catch (error: any) {
        reply.code(500).send({ error: error.message });
      }
    }
  );

  // Get bus by ID
  fastify.get(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get bus by ID',
        tags: ['Buses'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        const params = request.params as { id: string };
        // Check permissions in descending order of authority
        if (hasPermission(user, PERMISSIONS.BUS.GET_ALL)) {
          // Highest level: can get any bus
          const bus = await busService.getById(params.id, user.organization_id!);
          return reply.send(bus);
        }
        
        if (hasPermission(user, PERMISSIONS.BUS.GET)) {
          // Restricted: drivers can only get their own bus
          if (user.role === 'driver') {
            const buses = await busService.getByDriverId(user.id, user.organization_id!);
            const bus = buses.find(b => b.id === params.id);
            if (!bus) {
              return reply.code(403).send({ error: 'Forbidden: Can only access own bus' });
            }
            return reply.send(bus);
          }
          // For other roles with GET permission, allow access
          const bus = await busService.getById(params.id, user.organization_id!);
          return reply.send(bus);
        }
        
        return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
      } catch (error: any) {
        reply.code(error.message.includes('not found') ? 404 : 500).send({ error: error.message });
      }
    }
  );

  // Update bus
  fastify.put(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Update bus',
        tags: ['Buses'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        const params = request.params as { id: string };
        if (!hasPermission(user, PERMISSIONS.BUS.UPDATE)) {
          return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
        }

        const data = updateBusSchema.parse(request.body);
        const updated = await busService.update(
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

  // Delete bus
  fastify.delete(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Delete bus',
        tags: ['Buses'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        const params = request.params as { id: string };
        if (!hasPermission(user, PERMISSIONS.BUS.DELETE)) {
          return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
        }

        await busService.delete(params.id, user.organization_id!);
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
      preHandler: [authenticate],
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
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        const params = request.params as { id: string };
        const body = request.body as { driver_id: string };
        if (!hasPermission(user, PERMISSIONS.BUS.UPDATE)) {
          return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
        }

        const updated = await busService.assignDriver(
          params.id,
          body.driver_id,
          user.organization_id!
        );
        reply.send(updated);
      } catch (error: any) {
        const statusCode = error.message.includes('not found') ? 404 : 500;
        reply.code(statusCode).send({ error: error.message });
      }
    }
  );
}

