import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { StudentService } from '../services/student.service';
import { authenticate } from '../middleware/auth';
import { hasPermission } from '../rbac/hasPermission';
import { PERMISSIONS } from '../rbac/permissions';
import { JWTUser } from '../types';
import { commonSchemas, commonResponses } from '../schemas/common.schemas';
import { studentSchemas } from '../schemas/student.schemas';
import { sendErrorResponse } from '../utils/error-handler.util';
import { sendSuccess, sendError, parsePagination, getPaginationMeta } from '../utils/response.util';
import { logger } from '../config/logger';
import { extractRequestBodyData } from '../utils/request.util';

const createStudentSchema = z.object({
  name: z.string().min(1),
  class_grade: z.string().min(1),
  section: z.string().min(1),
  parent_id: z.string().uuid(),
  parent_contact: z.string().min(1).optional(), // Optional - will be auto-populated from parent if not provided
  pickup_point_id: z.string().uuid().optional(),
  assigned_bus_id: z.string().uuid().optional(),
  assigned_route_id: z.string().uuid().optional(), // Optional - will be auto-assigned from pickup_point_id if provided
  is_active: z.boolean().optional(),
});

const updateStudentSchema = z.object({
  name: z.string().min(1).optional(),
  class_grade: z.string().min(1).optional(),
  section: z.string().min(1).optional(),
  parent_id: z.string().uuid().optional(),
  parent_contact: z.string().min(1).optional(), // Optional - will be auto-populated from parent if parent_id is provided
  pickup_point_id: z.string().uuid().nullable().optional(), // Can be null to remove assignment
  assigned_bus_id: z.string().uuid().optional(),
  assigned_route_id: z.string().uuid().optional(), // Optional - will be auto-assigned from pickup_point_id if provided
  is_active: z.boolean().optional(),
});

export async function studentsRoutes(fastify: FastifyInstance) {
  const studentService = new StudentService();

  // Create student
  fastify.post(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Create a new student. Requires parent_id (mandatory). Only users with student:create permission can create students.',
        tags: ['Students'],
        security: [{ bearerAuth: [] }],
        summary: 'Create student',
        body: studentSchemas.CreateStudentRequest,
        response: {
          201: {
            description: 'Student created successfully',
            content: {
              'application/json': {
                schema: studentSchemas.Student,
              },
            },
          },
          400: commonResponses[400],
          401: commonResponses[401],
          403: commonResponses[403],
          404: {
            description: 'Not Found - Parent not found',
            content: {
              'application/json': {
                schema: commonSchemas.ErrorResponse,
              },
            },
          },
          500: commonResponses[500],
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

        const bodyData = extractRequestBodyData(request.body);
        const data = createStudentSchema.parse(bodyData);
        const student = await studentService.create(data, user.organization_id);
        reply.code(201).send(student);
      } catch (error: any) {
        sendErrorResponse(reply, error);
      }
    }
  );

  // Get all students
  fastify.get(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get all students with optional filtering. Parents see only their children. Admins see all students.',
        tags: ['Students'],
        security: [{ bearerAuth: [] }],
        summary: 'List students',
        querystring: studentSchemas.StudentQuery,
        response: {
          200: {
            description: 'List of students',
            content: {
              'application/json': {
                schema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                        additionalProperties: true,
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
              },
            },
          },
          400: { type: 'object', properties: { success: { type: 'boolean' }, error: { type: 'string' }, details: { type: 'object' } } },
          401: commonResponses[401],
          403: { type: 'object', properties: { success: { type: 'boolean' }, error: { type: 'string' } } },
          500: { type: 'object', properties: { success: { type: 'boolean' }, error: { type: 'string' } } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        if (!user.organization_id) {
          return reply.code(400).send({ error: 'Organization ID is required' });
        }
        
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
        if (query.route_id) basicFilters.route_id = query.route_id;
        if (query.class_grade) basicFilters.class_grade = query.class_grade;
        if (query.is_active !== undefined) basicFilters.is_active = query.is_active === 'true' || query.is_active === true;

        // Check permissions in descending order of authority
        if (hasPermission(user, PERMISSIONS.STUDENT.GET_ALL)) {
          // Highest level: return full dataset with pagination
          const result = await studentService.getAll(user.organization_id!, basicFilters);
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
          // Restricted: return filtered dataset (e.g., only own children for parents)
          if (user.role === 'parent') {
            // For parents, get their children (no pagination needed as it's typically small)
            const students = await studentService.getByParentId(user.id, user.organization_id!);
            return reply.send(students);
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
        sendErrorResponse(reply, error);
      }
    }
  );

  // Get student by ID
  fastify.get(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get a specific student by ID. Parents can only access their own children.',
        tags: ['Students'],
        security: [{ bearerAuth: [] }],
        summary: 'Get student by ID',
        params: commonSchemas.UUIDParam,
        response: {
          200: {
            description: 'Student details',
            content: {
              'application/json': {
                schema: studentSchemas.Student,
              },
            },
          },
          400: commonResponses[400],
          401: commonResponses[401],
          403: commonResponses[403],
          404: commonResponses[404],
          500: commonResponses[500],
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        if (!user.organization_id) {
          return reply.code(400).send({ error: 'Organization ID is required' });
        }
        const params = request.params as { id: string };
        // Check permissions in descending order of authority
        if (hasPermission(user, PERMISSIONS.STUDENT.GET_ALL)) {
          // Highest level: can get any student
          const student = await studentService.getById(params.id, user.organization_id!);
          return reply.send(student);
        }
        
        if (hasPermission(user, PERMISSIONS.STUDENT.GET)) {
          // Restricted: can only get own children (for parents)
          if (user.role === 'parent') {
            const students = await studentService.getByParentId(user.id, user.organization_id!);
            const student = students.find(s => s.id === params.id);
            if (!student) {
              return reply.code(403).send({ error: 'Forbidden: Can only access own children' });
            }
            return reply.send(student);
          }
          return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
        }
        
        return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
      } catch (error: any) {
        sendErrorResponse(reply, error);
      }
    }
  );

  // Update student
  fastify.put(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Update student information. parent_id is required. Parents can only update their own children.',
        tags: ['Students'],
        security: [{ bearerAuth: [] }],
        summary: 'Update student',
        params: commonSchemas.UUIDParam,
        body: studentSchemas.UpdateStudentRequest,
        response: {
          200: {
            description: 'Student updated successfully',
            content: {
              'application/json': {
                schema: studentSchemas.Student,
              },
            },
          },
          400: commonResponses[400],
          401: commonResponses[401],
          403: commonResponses[403],
          404: commonResponses[404],
          500: commonResponses[500],
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        if (!user.organization_id) {
          return reply.code(400).send({ error: 'Organization ID is required' });
        }
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

        const bodyData = extractRequestBodyData(request.body);
        const data = updateStudentSchema.parse(bodyData);
        const updated = await studentService.update(
          params.id,
          data,
          user.organization_id!
        );
        reply.send(updated);
      } catch (error: any) {
        sendErrorResponse(reply, error);
      }
    }
  );

  // Delete student
  fastify.delete(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Delete a student. Requires student:delete permission.',
        tags: ['Students'],
        security: [{ bearerAuth: [] }],
        summary: 'Delete student',
        params: commonSchemas.UUIDParam,
        response: {
          200: {
            description: 'Student deleted successfully',
            content: {
              'application/json': {
                schema: {
            type: 'object',
            properties: {
                    success: { type: 'boolean' },
              message: { type: 'string' },
            },
                  required: ['success', 'message'],
                },
              },
            },
          },
          400: commonResponses[400],
          401: commonResponses[401],
          403: commonResponses[403],
          404: commonResponses[404],
          500: commonResponses[500],
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        if (!user.organization_id) {
          return reply.code(400).send({ error: 'Organization ID is required' });
        }
        const params = request.params as { id: string };
        if (!hasPermission(user, PERMISSIONS.STUDENT.DELETE)) {
          return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
        }

        await studentService.delete(params.id, user.organization_id!);
        reply.send({ success: true, message: 'Student deleted successfully' });
      } catch (error: any) {
        sendErrorResponse(reply, error);
      }
    }
  );

  // Get student pickup location
  fastify.get(
    '/:id/pickup-location',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get student pickup location details including coordinates and address. Parents can only access their own children\'s pickup locations.',
        tags: ['Students'],
        security: [{ bearerAuth: [] }],
        summary: 'Get student pickup location',
        params: commonSchemas.UUIDParam,
        response: {
          200: {
            description: 'Student pickup location details',
            content: {
              'application/json': {
                schema: {
            type: 'object',
            properties: {
              student: {
                type: 'object',
                properties: {
                        id: { type: 'string', format: 'uuid' },
                  name: { type: 'string' },
                        pickup_point_id: { type: 'string', format: 'uuid', nullable: true },
                },
                      required: ['id', 'name'],
              },
              pickup_location: {
                type: 'object',
                nullable: true,
                properties: {
                        id: { type: 'string', format: 'uuid' },
                  name: { type: 'string' },
                  latitude: { type: 'number' },
                  longitude: { type: 'number' },
                        address: { type: 'object', additionalProperties: true },
                      },
                    },
                  },
                  required: ['student'],
                },
              },
            },
          },
          400: commonResponses[400],
          401: commonResponses[401],
          403: commonResponses[403],
          404: commonResponses[404],
          500: commonResponses[500],
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        if (!user.organization_id) {
          return reply.code(400).send({ error: 'Organization ID is required' });
        }
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
        sendErrorResponse(reply, error);
      }
    }
  );
}

