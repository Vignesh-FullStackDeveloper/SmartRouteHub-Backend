import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { RouteService } from '../services/route.service';
import { BusService } from '../services/bus.service';
import { StudentService } from '../services/student.service';
import { authenticate } from '../middleware/auth';
import { hasPermission } from '../rbac/hasPermission';
import { PERMISSIONS } from '../rbac/permissions';
import { JWTUser } from '../types';
import { sendSuccess, sendError, parsePagination, getPaginationMeta } from '../utils/response.util';
import { logger } from '../config/logger';
import { extractRequestBodyData } from '../utils/request.util';

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
  const busService = new BusService();
  const studentService = new StudentService();

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

        const bodyData = extractRequestBodyData(request.body);
        const data = createRouteSchema.parse(bodyData);
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
            route_id: { type: 'string', format: 'uuid', description: 'Filter by route ID' },
            student_id: { type: 'string', format: 'uuid', description: 'Filter by student ID (hierarchy: student -> route)' },
            bus_id: { type: 'string', format: 'uuid', description: 'Filter by bus ID' },
            driver_id: { type: 'string', format: 'uuid', description: 'Filter by driver ID (hierarchy: driver -> bus -> route)' },
            is_active: { type: 'boolean', description: 'Filter by active status' },
            limit: { type: 'number', minimum: 1, description: 'Number of records to return (optional)' },
            offset: { type: 'number', minimum: 0, description: 'Number of records to skip (optional)' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
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
              pagination: {
                type: 'object',
                nullable: true,
                properties: {
                  total: { type: 'number' },
                  limit: { type: 'number' },
                  offset: { type: 'number' },
                  hasMore: { type: 'boolean' },
                },
              },
              message: { type: 'string', nullable: true },
            },
          },
          400: { type: 'object', properties: { success: { type: 'boolean' }, error: { type: 'string' }, details: { type: 'object' } } },
          403: { type: 'object', properties: { success: { type: 'boolean' }, error: { type: 'string' } } },
          500: { type: 'object', properties: { success: { type: 'boolean' }, error: { type: 'string' } } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        const query = request.query as any;
        
        // Parse pagination
        let pagination;
        try {
          pagination = parsePagination(query);
        } catch (error: any) {
          logger.warn({ message: 'Invalid pagination parameters', error: error.message, userId: user.id });
          return sendError(reply, 400, error.message);
        }

        // Build basic filters
        const basicFilters: any = {
          ...pagination,
        };
        if (query.route_id) basicFilters.route_id = query.route_id;
        if (query.is_active !== undefined) basicFilters.is_active = query.is_active === 'true' || query.is_active === true;

        // Check permissions in descending order of authority
        if (hasPermission(user, PERMISSIONS.ROUTE.GET_ALL) || user.role === 'admin') {
          // Admin role: use micro functions based on query params
          let result;
          
          if (query.student_id) {
            // Use micro function: getByStudentId
            result = await routeService.getByStudentId(query.student_id, user.organization_id!);
          } else if (query.bus_id) {
            // Use micro function: getByBusId
            result = await routeService.getByBusId(query.bus_id, user.organization_id!, pagination);
          } else if (query.driver_id) {
            // Use micro function: getByDriverId (uses bus internally)
            result = await routeService.getByDriverId(query.driver_id, user.organization_id!, pagination);
          } else {
            // Use basic getAll
            result = await routeService.getAll(user.organization_id!, basicFilters);
          }
          
          const paginationMeta = getPaginationMeta(result.total, pagination.limit, pagination.offset);
          logger.info({ 
            message: 'Routes retrieved', 
            userId: user.id, 
            role: user.role, 
            count: result.data.length,
            total: result.total 
          });
          return sendSuccess(reply, result.data, 'Routes retrieved successfully', paginationMeta);
        }
        
        if (hasPermission(user, PERMISSIONS.ROUTE.GET)) {
          // Restricted: return filtered dataset based on role
          if (user.role === 'driver') {
            // Drivers can see routes for their assigned bus - use micro function
            const result = await routeService.getByDriverId(user.id, user.organization_id!, pagination);
            const paginationMeta = getPaginationMeta(result.total, pagination.limit, pagination.offset);
            logger.info({ 
              message: 'Routes retrieved for driver', 
              userId: user.id, 
              count: result.data.length 
            });
            return sendSuccess(reply, result.data, 'Routes retrieved successfully', paginationMeta);
          } else if (user.role === 'parent') {
            // Parent: routes assigned to their children
            // Step 1: Get students for parent
            const studentsResult = await studentService.getByParentId(user.id, user.organization_id!);
            
            if (studentsResult.data.length === 0) {
              logger.info({ message: 'No students found for parent', userId: user.id });
              return sendSuccess(reply, [], 'No routes found', getPaginationMeta(0, pagination.limit, pagination.offset));
            }
            
            // Step 2: Get routes for these students - use micro function
            const studentIds = studentsResult.data.map(s => s.id);
            const result = await routeService.getRoutesByStudentIds(studentIds, user.organization_id!, pagination);
            const paginationMeta = getPaginationMeta(result.total, pagination.limit, pagination.offset);
            
            logger.info({ 
              message: 'Routes retrieved for parent', 
              userId: user.id, 
              count: result.data.length,
              total: result.total 
            });
            return sendSuccess(reply, result.data, 'Routes retrieved successfully', paginationMeta);
          }
          // For other roles with GET permission, return all routes (read-only access)
          const result = await routeService.getAll(user.organization_id!, basicFilters);
          const paginationMeta = getPaginationMeta(result.total, pagination.limit, pagination.offset);
          return sendSuccess(reply, result.data, 'Routes retrieved successfully', paginationMeta);
        }
        
        logger.warn({ message: 'Insufficient permissions to get routes', userId: user.id, role: user.role });
        return sendError(reply, 403, 'Forbidden: Insufficient permissions');
      } catch (error: any) {
        logger.error({ 
          message: 'Error retrieving routes', 
          error: error.message, 
          stack: error.stack,
          userId: (request.user as JWTUser)?.id 
        });
        return sendError(reply, 500, 'Internal server error', error.message);
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
        const params = request.params as { id: string };
        // Check permissions in descending order of authority
        if (hasPermission(user, PERMISSIONS.ROUTE.GET_ALL) || user.role === 'admin') {
          // Admin role: can get any route
          const route = await routeService.getById(params.id, user.organization_id!);
          return reply.send(route);
        }
        
        if (hasPermission(user, PERMISSIONS.ROUTE.GET)) {
          // Restricted: can get route if it's related to the user
          if (user.role === 'driver') {
            // Driver: can only get routes for their assigned bus
            const buses = await busService.getByDriverId(user.id, user.organization_id!);
            const routeIds = buses
              .filter(bus => bus.assigned_route_id)
              .map(bus => bus.assigned_route_id);
            
            if (!routeIds.includes(params.id)) {
              return reply.code(403).send({ error: 'Forbidden: Can only access routes for assigned bus' });
            }
            
            const route = await routeService.getById(params.id, user.organization_id!);
            return reply.send(route);
          } else if (user.role === 'parent') {
            // Parent: can only get routes assigned to their children
            const students = await studentService.getByParentId(user.id, user.organization_id!);
            const routeIds = students
              .filter(s => s.assigned_route_id)
              .map(s => s.assigned_route_id);
            
            if (!routeIds.includes(params.id)) {
              return reply.code(403).send({ error: 'Forbidden: Can only access routes for your children' });
            }
            
            const route = await routeService.getById(params.id, user.organization_id!);
            return reply.send(route);
          }
          // For other roles with GET permission, allow access
          const route = await routeService.getById(params.id, user.organization_id!);
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

        const bodyData = extractRequestBodyData(request.body);
        const data = updateRouteSchema.parse(bodyData);
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

