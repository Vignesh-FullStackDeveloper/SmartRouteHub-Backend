import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { StudentService } from '../services/student.service';
import { authenticate } from '../middleware/auth';
import { hasPermission } from '../rbac/hasPermission';
import { PERMISSIONS } from '../rbac/permissions';
import { JWTUser } from '../types';

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
            bus_id: { type: 'string' },
            route_id: { type: 'string' },
            class_grade: { type: 'string' },
            is_active: { type: 'boolean' },
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
          403: { type: 'object', properties: { error: { type: 'string' } } },
          500: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        // Check permissions in descending order of authority
        if (hasPermission(user, PERMISSIONS.STUDENT.GET_ALL)) {
          // Highest level: return full dataset
          const students = await studentService.getAll(user.organization_id!, request.query as any);
          return reply.send(students);
        }
        
        if (hasPermission(user, PERMISSIONS.STUDENT.GET)) {
          // Restricted: return filtered dataset (e.g., only own children for parents)
          if (user.role === 'parent') {
            const students = await studentService.getByParentId(user.id, user.organization_id!);
            return reply.send(students);
          }
          // For other roles with GET permission, return empty or limited data
          return reply.send([]);
        }
        
        return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
      } catch (error: any) {
        reply.code(500).send({ error: error.message });
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

