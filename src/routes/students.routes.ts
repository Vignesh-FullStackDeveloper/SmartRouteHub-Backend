import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { StudentService } from '../services/student.service';
import { BusService } from '../services/bus.service';
import { authenticate } from '../middleware/auth';
import { hasPermission } from '../rbac/hasPermission';
import { PERMISSIONS } from '../rbac/permissions';
import { JWTUser } from '../types';
import { sendSuccess, sendError, parsePagination, getPaginationMeta } from '../utils/response.util';
import { logger } from '../config/logger';

const createStudentSchema = z.object({
  name: z.string().min(1),
  class_grade: z.string().min(1),
  section: z.string().min(1),
  parent_id: z.string().uuid().optional(),
  parent_contact: z.string().min(1),
  pickup_point_id: z.string().uuid().optional(),
  assigned_bus_id: z.string().uuid().optional(),
  assigned_route_id: z.string().uuid().optional(),
  is_active: z.boolean().optional(),
});

const updateStudentSchema = createStudentSchema.partial();

export async function studentsRoutes(fastify: FastifyInstance) {
  const studentService = new StudentService();
  const busService = new BusService();

  // Create student
  fastify.post(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Create a new student',
        tags: ['Students'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['name', 'class_grade', 'section', 'parent_contact'],
          properties: {
            name: { type: 'string' },
            class_grade: { type: 'string' },
            section: { type: 'string' },
            parent_id: { type: 'string', format: 'uuid', description: 'Optional: Parent user ID' },
            parent_contact: { type: 'string' },
            pickup_point_id: { type: 'string', format: 'uuid' },
            assigned_bus_id: { type: 'string', format: 'uuid' },
            assigned_route_id: { type: 'string', format: 'uuid' },
            is_active: { type: 'boolean', description: 'Optional: Defaults to true if not provided' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              organization_id: { type: 'string' },
              name: { type: 'string' },
              class_grade: { type: 'string' },
              section: { type: 'string' },
              parent_id: { type: 'string' },
              parent_contact: { type: 'string' },
              pickup_point_id: { type: 'string' },
              assigned_bus_id: { type: 'string' },
              assigned_route_id: { type: 'string' },
              is_active: { type: 'boolean' },
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
        if (!hasPermission(user, PERMISSIONS.STUDENT.CREATE)) {
          return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
        }

        const data = createStudentSchema.parse(request.body);
        const student = await studentService.create(data, user.organization_id);
        reply.code(201).send(student);
      } catch (error: any) {
        if (error.name === 'ZodError') {
          return reply.code(400).send({ error: 'Validation error', details: error.errors });
        }
        const statusCode = error.message.includes('not found') ? 404 : 400;
        reply.code(statusCode).send({ error: error.message });
      }
    }
  );

  // Get all students
  fastify.get(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get all students',
        tags: ['Students'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            student_id: { type: 'string', format: 'uuid', description: 'Filter by student ID' },
            parent_id: { type: 'string', format: 'uuid', description: 'Filter by parent ID' },
            bus_id: { type: 'string', format: 'uuid', description: 'Filter by bus ID' },
            route_id: { type: 'string', format: 'uuid', description: 'Filter by route ID' },
            class_grade: { type: 'string', description: 'Filter by class grade' },
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
                    class_grade: { type: 'string' },
                    section: { type: 'string' },
                    parent_id: { type: 'string' },
                    parent_contact: { type: 'string' },
                    pickup_point_id: { type: 'string' },
                    assigned_bus_id: { type: 'string' },
                    assigned_route_id: { type: 'string' },
                    is_active: { type: 'boolean' },
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
        if (query.student_id) basicFilters.student_id = query.student_id;
        if (query.class_grade) basicFilters.class_grade = query.class_grade;
        if (query.is_active !== undefined) basicFilters.is_active = query.is_active === 'true' || query.is_active === true;

        // Check permissions in descending order of authority
        if (hasPermission(user, PERMISSIONS.STUDENT.GET_ALL) || user.role === 'admin') {
          // Admin role: use micro functions based on query params
          let result;
          
          if (query.parent_id) {
            // Use micro function: getByParentId
            result = await studentService.getByParentId(query.parent_id, user.organization_id!, pagination);
          } else if (query.route_id) {
            // Use micro function: getByRouteId
            result = await studentService.getByRouteId(query.route_id, user.organization_id!, pagination);
          } else if (query.bus_id) {
            // Use micro function: getByBusId (uses routes internally)
            result = await studentService.getByBusId(query.bus_id, user.organization_id!, pagination);
          } else {
            // Use basic getAll
            result = await studentService.getAll(user.organization_id!, basicFilters);
          }
          
          const paginationMeta = getPaginationMeta(result.total, pagination.limit, pagination.offset);
          logger.info({ 
            message: 'Students retrieved', 
            userId: user.id, 
            role: user.role, 
            count: result.data.length,
            total: result.total 
          });
          return sendSuccess(reply, result.data, 'Students retrieved successfully', paginationMeta);
        }
        
        if (hasPermission(user, PERMISSIONS.STUDENT.GET)) {
          // Restricted: return filtered dataset based on role
          if (user.role === 'parent') {
            // Parent: only their own children - use micro function
            const result = await studentService.getByParentId(user.id, user.organization_id!, pagination);
            const paginationMeta = getPaginationMeta(result.total, pagination.limit, pagination.offset);
            logger.info({ 
              message: 'Students retrieved for parent', 
              userId: user.id, 
              count: result.data.length 
            });
            return sendSuccess(reply, result.data, 'Students retrieved successfully', paginationMeta);
          } else if (user.role === 'driver') {
            // Driver: students assigned to their bus/route
            // Step 1: Get buses for driver
            const busesResult = await busService.getByDriverId(user.id, user.organization_id!);
            
            if (busesResult.data.length === 0) {
              logger.info({ message: 'No buses assigned to driver', userId: user.id });
              return sendSuccess(reply, [], 'No students found', getPaginationMeta(0, pagination.limit, pagination.offset));
            }
            
            // Step 2: Get students from all buses (uses routes internally)
            const allStudents: any[] = [];
            for (const bus of busesResult.data) {
              const busStudentsResult = await studentService.getByBusId(bus.id, user.organization_id!);
              allStudents.push(...busStudentsResult.data);
            }
            
            // Remove duplicates
            const uniqueStudents = Array.from(
              new Map(allStudents.map(s => [s.id, s])).values()
            );

            // Apply pagination manually
            let paginatedStudents = uniqueStudents;
            let total = uniqueStudents.length;
            if (pagination.offset !== undefined || pagination.limit !== undefined) {
              const start = pagination.offset || 0;
              const end = pagination.limit ? start + pagination.limit : undefined;
              paginatedStudents = uniqueStudents.slice(start, end);
            }
            const paginationMeta = getPaginationMeta(total, pagination.limit, pagination.offset);
            
            logger.info({ 
              message: 'Students retrieved for driver', 
              userId: user.id, 
              count: paginatedStudents.length,
              total 
            });
            return sendSuccess(reply, paginatedStudents, 'Students retrieved successfully', paginationMeta);
          }
          // For other roles with GET permission, return empty
          return sendSuccess(reply, [], 'No students found', getPaginationMeta(0, pagination.limit, pagination.offset));
        }
        
        logger.warn({ message: 'Insufficient permissions to get students', userId: user.id, role: user.role });
        return sendError(reply, 403, 'Forbidden: Insufficient permissions');
      } catch (error: any) {
        logger.error({ 
          message: 'Error retrieving students', 
          error: error.message, 
          stack: error.stack,
          userId: (request.user as JWTUser)?.id 
        });
        return sendError(reply, 500, 'Internal server error', error.message);
      }
    }
  );

  // Get student by ID
  fastify.get(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get student by ID',
        tags: ['Students'],
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
              class_grade: { type: 'string' },
              section: { type: 'string' },
              parent_id: { type: 'string' },
              parent_contact: { type: 'string' },
              pickup_point_id: { type: 'string' },
              assigned_bus_id: { type: 'string' },
              assigned_route_id: { type: 'string' },
              is_active: { type: 'boolean' },
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
        if (hasPermission(user, PERMISSIONS.STUDENT.GET_ALL)) {
          // Highest level: can get any student
          const student = await studentService.getById(params.id, user.organization_id!);
          return reply.send(student);
        }
        
        if (hasPermission(user, PERMISSIONS.STUDENT.GET)) {
          // Restricted: can only get students related to the user
          if (user.role === 'parent') {
            const students = await studentService.getByParentId(user.id, user.organization_id!);
            const student = students.find(s => s.id === params.id);
            if (!student) {
              return reply.code(403).send({ error: 'Forbidden: Can only access own children' });
            }
            return reply.send(student);
          } else if (user.role === 'driver') {
            // Driver: can only get students assigned to their bus
            const buses = await busService.getByDriverId(user.id, user.organization_id!);
            if (buses.length === 0) {
              return reply.code(403).send({ error: 'Forbidden: No bus assigned' });
            }
            
            const allStudents: any[] = [];
            for (const bus of buses) {
              const busStudents = await studentService.getByBusId(bus.id, user.organization_id!);
              allStudents.push(...busStudents);
            }
            
            const student = allStudents.find(s => s.id === params.id);
            if (!student) {
              return reply.code(403).send({ error: 'Forbidden: Can only access students in assigned bus' });
            }
            return reply.send(student);
          }
          return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
        }
        
        return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
      } catch (error: any) {
        reply.code(error.message.includes('not found') ? 404 : 500).send({ error: error.message });
      }
    }
  );

  // Update student
  fastify.put(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Update student',
        tags: ['Students'],
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
            class_grade: { type: 'string' },
            section: { type: 'string' },
            parent_id: { type: 'string', format: 'uuid' },
            parent_contact: { type: 'string' },
            pickup_point_id: { type: 'string', format: 'uuid' },
            assigned_bus_id: { type: 'string', format: 'uuid' },
            assigned_route_id: { type: 'string', format: 'uuid' },
            is_active: { type: 'boolean' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              organization_id: { type: 'string' },
              name: { type: 'string' },
              class_grade: { type: 'string' },
              section: { type: 'string' },
              parent_id: { type: 'string' },
              parent_contact: { type: 'string' },
              pickup_point_id: { type: 'string' },
              assigned_bus_id: { type: 'string' },
              assigned_route_id: { type: 'string' },
              is_active: { type: 'boolean' },
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
        const params = request.params as { id: string };
        if (!hasPermission(user, PERMISSIONS.STUDENT.UPDATE)) {
          return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
        }

        // Additional check: parents can only update their own children
        if (user.role === 'parent') {
          const students = await studentService.getByParentId(user.id, user.organization_id!);
          const student = students.find(s => s.id === params.id);
          if (!student) {
            return reply.code(403).send({ error: 'Forbidden: Can only update own children' });
          }
        }

        const data = updateStudentSchema.parse(request.body);
        const updated = await studentService.update(
          params.id,
          data,
          user.organization_id!
        );
        reply.send(updated);
      } catch (error: any) {
        const statusCode = error.message.includes('not found') ? 404 : 400;
        reply.code(statusCode).send({ error: error.message });
      }
    }
  );

  // Delete student
  fastify.delete(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Delete student',
        tags: ['Students'],
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
        if (!hasPermission(user, PERMISSIONS.STUDENT.DELETE)) {
          return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
        }

        await studentService.delete(params.id, user.organization_id!);
        reply.send({ message: 'Student deleted successfully' });
      } catch (error: any) {
        reply.code(error.message.includes('not found') ? 404 : 500).send({ error: error.message });
      }
    }
  );

  // Get student pickup location
  fastify.get(
    '/:id/pickup-location',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get student pickup location',
        tags: ['Students'],
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
              student: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  pickup_point_id: { type: 'string' },
                },
              },
              pickup_location: {
                type: 'object',
                nullable: true,
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  latitude: { type: 'number' },
                  longitude: { type: 'number' },
                  address: { type: 'object' },
                },
              },
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
        if (hasPermission(user, PERMISSIONS.STUDENT.GET_ALL)) {
          // Highest level: can get any student's pickup location
          const result = await studentService.getPickupLocation(
            params.id,
            user.organization_id!
          );
          return reply.send(result);
        }
        
        if (hasPermission(user, PERMISSIONS.STUDENT.GET)) {
          // Restricted: can only get own children's pickup location
          if (user.role === 'parent') {
            const students = await studentService.getByParentId(user.id, user.organization_id!);
            const student = students.find(s => s.id === params.id);
            if (!student) {
              return reply.code(403).send({ error: 'Forbidden: Can only access own children' });
            }
            const result = await studentService.getPickupLocation(
              params.id,
              user.organization_id!
            );
            return reply.send(result);
          }
          return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
        }
        
        return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
      } catch (error: any) {
        reply.code(error.message.includes('not found') ? 404 : 500).send({ error: error.message });
      }
    }
  );
}

