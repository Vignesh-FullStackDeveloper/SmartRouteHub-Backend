import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { RouteService } from '../services/route.service';
import { authenticate } from '../middleware/auth';
import { hasPermission } from '../rbac/hasPermission';
import { PERMISSIONS } from '../rbac/permissions';
import { JWTUser } from '../types';

// Helper function to normalize time format (HH:MM:SS or HH:MM -> HH:MM)
const normalizeTime = (time: string): string => {
  if (!time || typeof time !== 'string') {
    return time;
  }
  // If it's already in HH:MM format, return as is
  if (/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
    return time;
  }
  // If it's in HH:MM:SS format, extract HH:MM
  const match = time.match(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]/);
  if (match) {
    return match[0];
  }
  return time;
};

// Time validation that accepts both HH:MM and HH:MM:SS
const timeSchema = z.string().refine(
  (val) => /^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/.test(val),
  { message: 'Time must be in HH:MM or HH:MM:SS format (e.g., 07:00 or 07:00:00)' }
).transform(normalizeTime);

// Optional time schema - validates and transforms when provided, allows undefined
// Use union to explicitly handle both string and undefined cases
const optionalTimeSchema = z.union([
  timeSchema,
  z.undefined(),
  z.null(),
  z.literal('')
]).transform((val) => {
  // Transform: convert null/empty to undefined, normalize time strings
  if (val === null || val === '' || val === undefined) {
    return undefined;
  }
  return normalizeTime(val);
}).optional();

const createRouteSchema = z.object({
  name: z.string().min(1),
  start_time: timeSchema,
  end_time: timeSchema,
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

// Update schema with optional fields that still validate and transform when provided
const updateRouteSchema = z.object({
  name: z.string().min(1).optional(),
  start_time: optionalTimeSchema,
  end_time: optionalTimeSchema,
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
        body: {
          type: 'object',
          required: ['name', 'start_time', 'end_time'],
          properties: {
            name: { type: 'string' },
            start_time: { type: 'string', pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$', description: 'Time in HH:MM or HH:MM:SS format (e.g., 07:00 or 07:00:00)' },
            end_time: { type: 'string', pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$', description: 'Time in HH:MM or HH:MM:SS format (e.g., 20:30 or 20:30:00)' },
            estimated_duration_minutes: { type: 'integer', minimum: 1 },
            total_distance_km: { type: 'number', minimum: 0 },
            assigned_bus_id: { type: 'string', format: 'uuid' },
            route_polyline: { type: 'string' },
            stops: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  latitude: { type: 'number' },
                  longitude: { type: 'number' },
                  order: { type: 'integer', minimum: 1 },
                  estimated_arrival_minutes: { type: 'integer' },
                  address: { type: 'object' },
                },
              },
            },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              organization_id: { type: 'string' },
              name: { type: 'string' },
              start_time: { type: 'string' },
              end_time: { type: 'string' },
              estimated_duration_minutes: { type: 'integer' },
              total_distance_km: { type: 'number' },
              assigned_bus_id: { type: 'string' },
              route_polyline: { type: 'string' },
              is_active: { type: 'boolean' },
              stops: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    route_id: { type: 'string' },
                    name: { type: 'string' },
                    latitude: { type: 'number' },
                    longitude: { type: 'number' },
                    order: { type: 'integer' },
                    estimated_arrival_minutes: { type: 'integer' },
                    address: { type: 'object' },
                    created_at: { type: 'string', format: 'date-time' },
                    updated_at: { type: 'string', format: 'date-time' },
                  },
                },
              },
              created_at: { type: 'string', format: 'date-time' },
              updated_at: { type: 'string', format: 'date-time' },
            },
          },
          400: { type: 'object', properties: { error: { type: 'string' } } },
          403: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        if (!user.organization_id) {
          return reply.code(400).send({ error: 'Organization ID is required' });
        }
        if (!hasPermission(user, PERMISSIONS.ROUTE.CREATE)) {
          return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
        }

        const data = createRouteSchema.parse(request.body);
        const route = await routeService.create(data, user.organization_id);
        reply.code(201).send(route);
      } catch (error: any) {
        if (error.name === 'ZodError') {
          return reply.code(400).send({ error: 'Validation error', details: error.errors });
        }
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
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                organization_id: { type: 'string' },
                name: { type: 'string' },
                start_time: { type: 'string' },
                end_time: { type: 'string' },
                estimated_duration_minutes: { type: 'integer' },
                total_distance_km: { type: 'number' },
                assigned_bus_id: { type: 'string' },
                route_polyline: { type: 'string' },
                is_active: { type: 'boolean' },
                stops: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      route_id: { type: 'string' },
                      name: { type: 'string' },
                      latitude: { type: 'number' },
                      longitude: { type: 'number' },
                      order: { type: 'integer' },
                      estimated_arrival_minutes: { type: 'integer' },
                      address: { type: 'object' },
                      created_at: { type: 'string', format: 'date-time' },
                      updated_at: { type: 'string', format: 'date-time' },
                    },
                  },
                },
                created_at: { type: 'string', format: 'date-time' },
                updated_at: { type: 'string', format: 'date-time' },
              },
            },
          },
          403: { type: 'object', properties: { error: { type: 'string' } } },
          500: { type: 'object', properties: { error: { type: 'string' } } },
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
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              organization_id: { type: 'string' },
              name: { type: 'string' },
              start_time: { type: 'string' },
              end_time: { type: 'string' },
              estimated_duration_minutes: { type: 'integer' },
              total_distance_km: { type: 'number' },
              assigned_bus_id: { type: 'string' },
              route_polyline: { type: 'string' },
              is_active: { type: 'boolean' },
              stops: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    latitude: { type: 'number' },
                    longitude: { type: 'number' },
                    order: { type: 'integer' },
                  },
                },
              },
              created_at: { type: 'string', format: 'date-time' },
              updated_at: { type: 'string', format: 'date-time' },
            },
          },
          403: { type: 'object', properties: { error: { type: 'string' } } },
          404: { type: 'object', properties: { error: { type: 'string' } } },
          500: { type: 'object', properties: { error: { type: 'string' } } },
        },
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
            start_time: { type: 'string', pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$', description: 'Time in HH:MM or HH:MM:SS format (e.g., 07:00 or 07:00:00)' },
            end_time: { type: 'string', pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$', description: 'Time in HH:MM or HH:MM:SS format (e.g., 20:30 or 20:30:00)' },
            estimated_duration_minutes: { type: 'integer', minimum: 1 },
            total_distance_km: { type: 'number', minimum: 0 },
            assigned_bus_id: { type: 'string', format: 'uuid' },
            route_polyline: { type: 'string' },
            stops: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  latitude: { type: 'number' },
                  longitude: { type: 'number' },
                  order: { type: 'integer', minimum: 1 },
                  estimated_arrival_minutes: { type: 'integer' },
                  address: { type: 'object' },
                },
              },
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              organization_id: { type: 'string' },
              name: { type: 'string' },
              start_time: { type: 'string' },
              end_time: { type: 'string' },
              estimated_duration_minutes: { type: 'integer' },
              total_distance_km: { type: 'number' },
              assigned_bus_id: { type: 'string' },
              route_polyline: { type: 'string' },
              is_active: { type: 'boolean' },
              stops: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    route_id: { type: 'string' },
                    name: { type: 'string' },
                    latitude: { type: 'number' },
                    longitude: { type: 'number' },
                    order: { type: 'integer' },
                    estimated_arrival_minutes: { type: 'integer' },
                    address: { type: 'object' },
                    created_at: { type: 'string', format: 'date-time' },
                    updated_at: { type: 'string', format: 'date-time' },
                  },
                },
              },
              created_at: { type: 'string', format: 'date-time' },
              updated_at: { type: 'string', format: 'date-time' },
            },
          },
          400: { type: 'object', properties: { error: { type: 'string' } } },
          403: { type: 'object', properties: { error: { type: 'string' } } },
          404: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        if (!user.organization_id) {
          return reply.code(400).send({ error: 'Organization ID is required' });
        }
        if (!hasPermission(user, PERMISSIONS.ROUTE.UPDATE)) {
          return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
        }

        const data = updateRouteSchema.parse(request.body);
        const route = await routeService.update(
          (request.params as any).id,
          data,
          user.organization_id
        );
        reply.send(route);
      } catch (error: any) {
        if (error.name === 'ZodError' || error.issues) {
          const zodError = error.name === 'ZodError' ? error : { errors: error.issues };
          console.error('Route update validation error:', JSON.stringify(zodError.errors || zodError.issues, null, 2));
          console.error('Request body:', JSON.stringify(request.body, null, 2));
          return reply.code(400).send({ 
            error: 'Validation error', 
            details: (zodError.errors || zodError.issues || []).map((e: any) => ({
              path: (e.path || []).join('.'),
              message: e.message,
              code: e.code,
            }))
          });
        }
        console.error('Route update error:', error.message, error.stack);
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
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
            },
          },
          403: { type: 'object', properties: { error: { type: 'string' } } },
          404: { type: 'object', properties: { error: { type: 'string' } } },
          500: { type: 'object', properties: { error: { type: 'string' } } },
        },
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
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['student_ids'],
          properties: {
            student_ids: {
              type: 'array',
              items: { type: 'string', format: 'uuid' },
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              count: { type: 'integer' },
            },
          },
          403: { type: 'object', properties: { error: { type: 'string' } } },
          404: { type: 'object', properties: { error: { type: 'string' } } },
          500: { type: 'object', properties: { error: { type: 'string' } } },
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

