import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { BusService } from '../services/bus.service';
import { StudentService } from '../services/student.service';
import { authenticate } from '../middleware/auth';
import { hasPermission } from '../rbac/hasPermission';
import { PERMISSIONS } from '../rbac/permissions';
import { JWTUser } from '../types';
import { sendSuccess, sendError, parsePagination, getPaginationMeta } from '../utils/response.util';
import { logger } from '../config/logger';
import { extractRequestBodyData } from '../utils/request.util';

const createBusSchema = z.object({
  bus_number: z.string().min(1),
  capacity: z.number().int().positive(),
  driver_id: z.string().uuid().optional(),
  assigned_route_id: z.string().uuid().optional(),
  metadata: z.record(z.any()).optional(),
  is_active: z.boolean().optional(),
});

const updateBusSchema = createBusSchema.partial();

export async function busesRoutes(fastify: FastifyInstance) {
  const busService = new BusService();
  const studentService = new StudentService();

  // Create bus
  fastify.post(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Create a new bus. Payload should be wrapped in a "data" object.',
        tags: ['Buses'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['data'],
          properties: {
            data: {
              type: 'object',
              required: ['bus_number', 'capacity'],
              properties: {
                bus_number: { type: 'string' },
                capacity: { type: 'integer', minimum: 1 },
                driver_id: { type: 'string', format: 'uuid' },
                assigned_route_id: { type: 'string', format: 'uuid' },
                metadata: { type: 'object' },
                is_active: { type: 'boolean', description: 'Optional: Defaults to true if not provided' },
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
              bus_number: { type: 'string' },
              capacity: { type: 'integer' },
              driver_id: { type: 'string' },
              assigned_route_id: { type: 'string' },
              is_active: { type: 'boolean' },
              metadata: { type: 'object' },
              created_at: { type: 'string', format: 'date-time' },
              updated_at: { type: 'string', format: 'date-time' },
            },
          },
          400: { type: 'object', properties: { error: { type: 'string' } } },
          403: { type: 'object', properties: { error: { type: 'string' } } },
          409: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!hasPermission(request.user, PERMISSIONS.BUS.CREATE)) {
          return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
        }

        const bodyData = extractRequestBodyData(request.body);
        const data = createBusSchema.parse(bodyData);
        const bus = await busService.create(data, request.user!.organization_id!);
        reply.code(201).send(bus);
      } catch (error: any) {
        if (error.name === 'ZodError') {
          return reply.code(400).send({ error: 'Validation error', details: error.errors });
        }
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
            bus_id: { type: 'string', format: 'uuid', description: 'Filter by bus ID' },
            student_id: { type: 'string', format: 'uuid', description: 'Filter by student ID (hierarchy: student -> bus)' },
            route_id: { type: 'string', format: 'uuid', description: 'Filter by route ID' },
            driver_id: { type: 'string', format: 'uuid', description: 'Filter by driver ID' },
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
                    bus_number: { type: 'string' },
                    capacity: { type: 'integer' },
                    driver_id: { type: 'string' },
                    assigned_route_id: { type: 'string' },
                    is_active: { type: 'boolean' },
                    metadata: { type: 'object' },
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
        if (query.bus_id) basicFilters.bus_id = query.bus_id;
        if (query.is_active !== undefined) basicFilters.is_active = query.is_active === 'true' || query.is_active === true;

        // Check permissions in descending order of authority
        if (hasPermission(user, PERMISSIONS.BUS.GET_ALL) || user.role === 'admin') {
          // Admin role: use micro functions based on query params
          let result;
          
          if (query.student_id) {
            // Use micro function: getByStudentId
            result = await busService.getByStudentId(query.student_id, user.organization_id!);
          } else if (query.route_id) {
            // Use micro function: getByRouteId
            result = await busService.getByRouteId(query.route_id, user.organization_id!, pagination);
          } else if (query.driver_id) {
            // Use micro function: getByDriverId
            result = await busService.getByDriverId(query.driver_id, user.organization_id!, pagination);
          } else {
            // Use basic getAll
            result = await busService.getAll(user.organization_id!, basicFilters);
          }
          
          const paginationMeta = getPaginationMeta(result.total, pagination.limit, pagination.offset);
          logger.info({ 
            message: 'Buses retrieved', 
            userId: user.id, 
            role: user.role, 
            count: result.data.length,
            total: result.total 
          });
          return sendSuccess(reply, result.data, 'Buses retrieved successfully', paginationMeta);
        }
        
        if (hasPermission(user, PERMISSIONS.BUS.GET)) {
          // Restricted: return filtered dataset based on role
          if (user.role === 'driver') {
            // Drivers can only see their own bus - use micro function
            const result = await busService.getByDriverId(user.id, user.organization_id!, pagination);
            const paginationMeta = getPaginationMeta(result.total, pagination.limit, pagination.offset);
            logger.info({ 
              message: 'Buses retrieved for driver', 
              userId: user.id, 
              count: result.data.length 
            });
            return sendSuccess(reply, result.data, 'Buses retrieved successfully', paginationMeta);
          } else if (user.role === 'parent') {
            // Parent: buses assigned to their children
            // Step 1: Get students for parent
            const studentsResult = await studentService.getByParentId(user.id, user.organization_id!);
            
            if (studentsResult.data.length === 0) {
              logger.info({ message: 'No students found for parent', userId: user.id });
              return sendSuccess(reply, [], 'No buses found', getPaginationMeta(0, pagination.limit, pagination.offset));
            }
            
            // Step 2: Get buses for these students - use micro function
            const studentIds = studentsResult.data.map(s => s.id);
            const result = await busService.getBusesByStudentIds(studentIds, user.organization_id!, pagination);
            const paginationMeta = getPaginationMeta(result.total, pagination.limit, pagination.offset);
            
            logger.info({ 
              message: 'Buses retrieved for parent', 
              userId: user.id, 
              count: result.data.length,
              total: result.total 
            });
            return sendSuccess(reply, result.data, 'Buses retrieved successfully', paginationMeta);
          }
          // For other roles with GET permission, return all buses (read-only access)
          const result = await busService.getAll(user.organization_id!, basicFilters);
          const paginationMeta = getPaginationMeta(result.total, pagination.limit, pagination.offset);
          return sendSuccess(reply, result.data, 'Buses retrieved successfully', paginationMeta);
        }
        
        logger.warn({ message: 'Insufficient permissions to get buses', userId: user.id, role: user.role });
        return sendError(reply, 403, 'Forbidden: Insufficient permissions');
      } catch (error: any) {
        logger.error({ 
          message: 'Error retrieving buses', 
          error: error.message, 
          stack: error.stack,
          userId: (request.user as JWTUser)?.id 
        });
        return sendError(reply, 500, 'Internal server error', error.message);
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
              bus_number: { type: 'string' },
              capacity: { type: 'integer' },
              driver_id: { type: 'string' },
              assigned_route_id: { type: 'string' },
              is_active: { type: 'boolean' },
              metadata: { type: 'object' },
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
          } else if (user.role === 'parent') {
            // Parent: can only get buses assigned to their children
            const students = await studentService.getByParentId(user.id, user.organization_id!);
            const busIds = students
              .filter(s => s.assigned_bus_id)
              .map(s => s.assigned_bus_id);
            
            if (!busIds.includes(params.id)) {
              return reply.code(403).send({ error: 'Forbidden: Can only access buses for your children' });
            }
            
            const bus = await busService.getById(params.id, user.organization_id!);
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
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          properties: {
            bus_number: { type: 'string' },
            capacity: { type: 'integer', minimum: 1 },
            driver_id: { type: 'string', format: 'uuid' },
            assigned_route_id: { type: 'string', format: 'uuid' },
            metadata: { type: 'object' },
            is_active: { type: 'boolean' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              organization_id: { type: 'string' },
              bus_number: { type: 'string' },
              capacity: { type: 'integer' },
              driver_id: { type: 'string' },
              assigned_route_id: { type: 'string' },
              is_active: { type: 'boolean' },
              metadata: { type: 'object' },
              created_at: { type: 'string', format: 'date-time' },
              updated_at: { type: 'string', format: 'date-time' },
            },
          },
          400: { type: 'object', properties: { error: { type: 'string' } } },
          403: { type: 'object', properties: { error: { type: 'string' } } },
          404: { type: 'object', properties: { error: { type: 'string' } } },
          409: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        const params = request.params as { id: string };
        if (!hasPermission(user, PERMISSIONS.BUS.UPDATE)) {
          return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
        }

        const bodyData = extractRequestBodyData(request.body);
        const data = updateBusSchema.parse(bodyData);
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
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['driver_id'],
          properties: {
            driver_id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              organization_id: { type: 'string' },
              bus_number: { type: 'string' },
              capacity: { type: 'integer' },
              driver_id: { type: 'string' },
              assigned_route_id: { type: 'string' },
              is_active: { type: 'boolean' },
              metadata: { type: 'object' },
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

