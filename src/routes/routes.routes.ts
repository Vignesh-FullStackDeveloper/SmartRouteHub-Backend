import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { RouteService } from '../services/route.service';
import { authenticate, requirePermission } from '../middleware/auth';

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
      preHandler: [authenticate, requirePermission('route', 'create')],
      schema: {
        description: 'Create a new route with stops',
        tags: ['Routes'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = createRouteSchema.parse(request.body);
        const route = await routeService.create(data, request.user!.organization_id);
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
      preHandler: [authenticate, requirePermission('route', 'read')],
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
    async (request: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
      try {
        const routes = await routeService.getAll(request.user!.organization_id, request.query);
        reply.send(routes);
      } catch (error: any) {
        reply.code(500).send({ error: error.message });
      }
    }
  );

  // Get route by ID
  fastify.get(
    '/:id',
    {
      preHandler: [authenticate, requirePermission('route', 'read')],
      schema: {
        description: 'Get route by ID with stops',
        tags: ['Routes'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const route = await routeService.getById(request.params.id, request.user!.organization_id);
        reply.send(route);
      } catch (error: any) {
        reply.code(error.message.includes('not found') ? 404 : 500).send({ error: error.message });
      }
    }
  );

  // Update route
  fastify.put(
    '/:id',
    {
      preHandler: [authenticate, requirePermission('route', 'update')],
      schema: {
        description: 'Update route',
        tags: ['Routes'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
      try {
        const data = updateRouteSchema.parse(request.body);
        const route = await routeService.update(
          request.params.id,
          data,
          request.user!.organization_id
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
      preHandler: [authenticate, requirePermission('route', 'delete')],
      schema: {
        description: 'Delete route',
        tags: ['Routes'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        await routeService.delete(request.params.id, request.user!.organization_id);
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
      preHandler: [authenticate, requirePermission('route', 'update')],
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
    async (request: FastifyRequest<{ Params: { id: string }; Body: { student_ids: string[] } }>, reply: FastifyReply) => {
      try {
        const { AssignmentService } = await import('../services/assignment.service');
        const assignmentService = new AssignmentService();
        const result = await assignmentService.assignStudentsToRoute(
          request.body.student_ids,
          request.params.id,
          undefined,
          request.user!.organization_id
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

