import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { StudentService } from '../services/student.service';
import { authenticate, requirePermission } from '../middleware/auth';

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
      preHandler: [authenticate, requirePermission('student', 'create')],
      schema: {
        description: 'Create a new student',
        tags: ['Students'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = createStudentSchema.parse(request.body);
        const student = await studentService.create(data, request.user!.organization_id);
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
      preHandler: [authenticate, requirePermission('student', 'read')],
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
    async (request: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
      try {
        const students = await studentService.getAll(request.user!.organization_id, request.query);
        reply.send(students);
      } catch (error: any) {
        reply.code(500).send({ error: error.message });
      }
    }
  );

  // Get student by ID
  fastify.get(
    '/:id',
    {
      preHandler: [authenticate, requirePermission('student', 'read')],
      schema: {
        description: 'Get student by ID',
        tags: ['Students'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const student = await studentService.getById(request.params.id, request.user!.organization_id);
        reply.send(student);
      } catch (error: any) {
        reply.code(error.message.includes('not found') ? 404 : 500).send({ error: error.message });
      }
    }
  );

  // Update student
  fastify.put(
    '/:id',
    {
      preHandler: [authenticate, requirePermission('student', 'update')],
      schema: {
        description: 'Update student',
        tags: ['Students'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
      try {
        const data = updateStudentSchema.parse(request.body);
        const updated = await studentService.update(
          request.params.id,
          data,
          request.user!.organization_id
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
      preHandler: [authenticate, requirePermission('student', 'delete')],
      schema: {
        description: 'Delete student',
        tags: ['Students'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        await studentService.delete(request.params.id, request.user!.organization_id);
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
      preHandler: [authenticate, requirePermission('student', 'read')],
      schema: {
        description: 'Get student pickup location',
        tags: ['Students'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const result = await studentService.getPickupLocation(
          request.params.id,
          request.user!.organization_id
        );
        reply.send(result);
      } catch (error: any) {
        reply.code(error.message.includes('not found') ? 404 : 500).send({ error: error.message });
      }
    }
  );
}

