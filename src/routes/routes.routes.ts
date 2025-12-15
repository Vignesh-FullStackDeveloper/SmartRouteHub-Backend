import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { RouteService } from '../services/route.service';
import { authenticate } from '../middleware/auth';
import { hasPermission } from '../rbac/hasPermission';
import { PERMISSIONS } from '../rbac/permissions';
import { JWTUser } from '../types';

const createRouteSchema = z.object({
  name: z.string().min(1),
  start_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  end_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  estimated_duration_minutes: z.number().int().positive().optional(),
  total_distance_km: z.number().positive().optional(),
  assigned_bus_id: z.string().uuid().optional(),
  route_polyline: z.string().optional(),
  stops: z.array(z.object({
    name: z.string(),
    latitude: z.number(),
    longitude: z.number(),
    order: z.number().int().positive(),
    estimated_arrival_minutes: z.number().int().optional(),
    address: z.record(z.any()).optional(),
  })).optional(),
});

const updateRouteSchema = createRouteSchema.partial();

export async function routesRoutes(fastify: FastifyInstance) {
  const routeService = new RouteService();

  // Create route
  fastify.post(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Create a new route with stops',
        tags: ['Routes'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        if (!hasPermission(user, PERMISSIONS.ROUTE.CREATE)) {
          return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
        }

        const data = createRouteSchema.parse(request.body);
        const route = await routeService.create(data, user.organization_id!);
        reply.code(201).send(route);
      } catch (error: any) {
        reply.code(400).send({ error: error.message });
      }
    }
  );

  // Get all routes
  fastify.get(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get all routes',
        tags: ['Routes'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            is_active: { type: 'boolean' },
            bus_id: { type: 'string' },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        // Check permissions in descending order of authority
        if (hasPermission(user, PERMISSIONS.ROUTE.GET_ALL)) {
          // Highest level: return full dataset
          const routes = await routeService.getAll(user.organization_id!, request.query as any);
          return reply.send(routes);
        }
        
        if (hasPermission(user, PERMISSIONS.ROUTE.GET)) {
          // Restricted: return filtered dataset (e.g., only routes for driver's bus)
          if (user.role === 'driver') {
            // Drivers can see routes for their assigned bus
            const routes = await routeService.getAll(user.organization_id!, request.query as any);
            return reply.send(routes);
          }
          // For other roles with GET permission, return all routes (read-only access)
          const routes = await routeService.getAll(user.organization_id!, request.query as any);
          return reply.send(routes);
        }
        
        return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
      } catch (error: any) {
        reply.code(500).send({ error: error.message });
      }
    }
  );

  // Get route by ID
  fastify.get(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get route by ID with stops',
        tags: ['Routes'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        // Check permissions in descending order of authority
        if (hasPermission(user, PERMISSIONS.ROUTE.GET_ALL)) {
          // Highest level: can get any route
          const route = await routeService.getById((request.params as any).id, user.organization_id!);
          return reply.send(route);
        }
        
        if (hasPermission(user, PERMISSIONS.ROUTE.GET)) {
          // Restricted: can get route (read-only access for drivers/parents)
          const route = await routeService.getById((request.params as any).id, user.organization_id!);
          return reply.send(route);
        }
        
        return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
      } catch (error: any) {
        reply.code(error.message.includes('not found') ? 404 : 500).send({ error: error.message });
      }
    }
  );

  // Update route
  fastify.put(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Update route',
        tags: ['Routes'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        if (!hasPermission(user, PERMISSIONS.ROUTE.UPDATE)) {
          return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
        }

        const data = updateRouteSchema.parse(request.body);
        const route = await routeService.update(
          (request.params as any).id,
          data,
          user.organization_id!
        );
        reply.send(route);
      } catch (error: any) {
        const statusCode = error.message.includes('not found') ? 404 : 400;
        reply.code(statusCode).send({ error: error.message });
      }
    }
  );

  // Delete route
  fastify.delete(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Delete route',
        tags: ['Routes'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        if (!hasPermission(user, PERMISSIONS.ROUTE.DELETE)) {
          return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
        }

        await routeService.delete((request.params as any).id, user.organization_id!);
        reply.send({ message: 'Route deleted successfully' });
      } catch (error: any) {
        reply.code(error.message.includes('not found') ? 404 : 500).send({ error: error.message });
      }
    }
  );

  // Assign students to route
  fastify.post(
    '/:id/assign-students',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Assign students to route',
        tags: ['Routes'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['student_ids'],
          properties: {
            student_ids: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        if (!hasPermission(user, PERMISSIONS.ROUTE.UPDATE)) {
          return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
        }

        const params = request.params as { id: string };
        const body = request.body as { student_ids: string[] };
        const { AssignmentService } = await import('../services/assignment.service');
        const assignmentService = new AssignmentService();
        const result = await assignmentService.assignStudentsToRoute(
          body.student_ids,
          params.id,
          undefined,
          user.organization_id!
        );
        reply.send({ 
          message: 'Students assigned successfully',
          count: result.count,
        });
      } catch (error: any) {
        reply.code(error.message.includes('not found') ? 404 : 500).send({ error: error.message });
      }
    }
  );
}

