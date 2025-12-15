import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { StudentService } from '../services/student.service';
import { authenticate } from '../middleware/auth';
import { hasPermission } from '../rbac/hasPermission';
import { PERMISSIONS } from '../rbac/permissions';

const createStudentSchema = z.object({
  name: z.string().min(1),
  class_grade: z.string().min(1),
  section: z.string().min(1),
  parent_id: z.string().uuid(),
  parent_contact: z.string().min(1),
  pickup_point_id: z.string().uuid().optional(),
  assigned_bus_id: z.string().uuid().optional(),
  assigned_route_id: z.string().uuid().optional(),
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
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!hasPermission(request.user, PERMISSIONS.STUDENT.CREATE)) {
          return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
        }

        const data = createStudentSchema.parse(request.body);
        const student = await studentService.create(data, request.user!.organization_id!);
        reply.code(201).send(student);
      } catch (error: any) {
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

