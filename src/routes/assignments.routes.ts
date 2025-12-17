import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AssignmentService } from '../services/assignment.service';
import { authenticate } from '../middleware/auth';
import { hasPermission } from '../rbac/hasPermission';
import { PERMISSIONS } from '../rbac/permissions';
import { JWTUser } from '../types';

const assignStudentsToRouteSchema = z.object({
  student_ids: z.array(z.string().uuid()),
  route_id: z.string().uuid(),
  bus_id: z.string().uuid().optional(),
});

const assignStudentsToBusSchema = z.object({
  student_ids: z.array(z.string().uuid()),
  bus_id: z.string().uuid(),
});

export async function assignmentsRoutes(fastify: FastifyInstance) {
  const assignmentService = new AssignmentService();

  // Assign students to route and optionally bus
  fastify.post(
    '/students-to-route',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Assign students to a route',
        tags: ['Assignments'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['student_ids', 'route_id'],
          properties: {
            student_ids: {
              type: 'array',
              items: { type: 'string', format: 'uuid' },
            },
            route_id: { type: 'string', format: 'uuid' },
            bus_id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              route_id: { type: 'string' },
              bus_id: { type: 'string' },
              student_count: { type: 'integer' },
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

        const data = assignStudentsToRouteSchema.parse(request.body);
        const result = await assignmentService.assignStudentsToRoute(
          data.student_ids,
          data.route_id,
          data.bus_id,
          user.organization_id
        );
        reply.send({
          message: 'Students assigned successfully',
          route_id: data.route_id,
          bus_id: data.bus_id,
          student_count: result.count,
        });
      } catch (error: any) {
        const statusCode = error.message.includes('not found') ? 404 :
                          error.message.includes('capacity') ? 400 : 400;
        reply.code(statusCode).send({ error: error.message });
      }
    }
  );

  // Assign students to bus
  fastify.post(
    '/students-to-bus',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Assign students to a bus',
        tags: ['Assignments'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        if (!user.organization_id) {
          return reply.code(400).send({ error: 'Organization ID is required' });
        }
        if (!hasPermission(user, PERMISSIONS.BUS.UPDATE)) {
          return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
        }

        const data = assignStudentsToBusSchema.parse(request.body);
        const result = await assignmentService.assignStudentsToBus(
          data.student_ids,
          data.bus_id,
          user.organization_id
        );
        reply.send({
          message: 'Students assigned successfully',
          bus_id: data.bus_id,
          student_count: result.count,
        });
      } catch (error: any) {
        if (error.name === 'ZodError') {
          return reply.code(400).send({ error: 'Validation error', details: error.errors });
        }
        const statusCode = error.message.includes('not found') ? 404 :
                          error.message.includes('capacity') ? 400 : 400;
        reply.code(statusCode).send({ error: error.message });
      }
    }
  );

  // Get route assignments (which students in which route)
  fastify.get(
    '/route/:id/students',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get all students assigned to a route',
        tags: ['Assignments'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        if (!user.organization_id) {
          return reply.code(400).send({ error: 'Organization ID is required' });
        }
        if (!hasPermission(user, PERMISSIONS.ROUTE.GET)) {
          return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
        }

        const params = request.params as { id: string };
        const result = await assignmentService.getRouteAssignments(
          params.id,
          user.organization_id
        );
        reply.send(result);
      } catch (error: any) {
        reply.code(error.message.includes('not found') ? 404 : 500).send({ error: error.message });
      }
    }
  );

  // Get bus assignments (which students in which bus)
  fastify.get(
    '/bus/:id/students',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get all students assigned to a bus',
        tags: ['Assignments'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        if (!user.organization_id) {
          return reply.code(400).send({ error: 'Organization ID is required' });
        }
        if (!hasPermission(user, PERMISSIONS.BUS.GET)) {
          return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
        }

        const params = request.params as { id: string };
        const result = await assignmentService.getBusAssignments(
          params.id,
          user.organization_id
        );
        reply.send(result);
      } catch (error: any) {
        reply.code(error.message.includes('not found') ? 404 : 500).send({ error: error.message });
      }
    }
  );

  // Unassign students from route
  fastify.post(
    '/route/:id/unassign-students',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Unassign students from a route',
        tags: ['Assignments'],
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

        const params = request.params as { id: string };
        const unassignSchema = z.object({
          student_ids: z.array(z.string().uuid()),
        });
        const body = unassignSchema.parse(request.body);
        const result = await assignmentService.unassignStudentsFromRoute(
          body.student_ids,
          params.id,
          user.organization_id
        );
        reply.send({
          message: 'Students unassigned successfully',
          route_id: params.id,
          student_count: result.count,
        });
      } catch (error: any) {
        if (error.name === 'ZodError') {
          return reply.code(400).send({ error: 'Validation error', details: error.errors });
        }
        reply.code(error.message.includes('not found') ? 404 : 500).send({ error: error.message });
      }
    }
  );

  // Unassign students from bus
  fastify.post(
    '/bus/:id/unassign-students',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Unassign students from a bus',
        tags: ['Assignments'],
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
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        if (!user.organization_id) {
          return reply.code(400).send({ error: 'Organization ID is required' });
        }
        if (!hasPermission(user, PERMISSIONS.BUS.UPDATE)) {
          return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
        }

        const params = request.params as { id: string };
        const unassignSchema = z.object({
          student_ids: z.array(z.string().uuid()),
        });
        const body = unassignSchema.parse(request.body);
        const result = await assignmentService.unassignStudentsFromBus(
          body.student_ids,
          params.id,
          user.organization_id
        );
        reply.send({
          message: 'Students unassigned successfully',
          bus_id: params.id,
          student_count: result.count,
        });
      } catch (error: any) {
        if (error.name === 'ZodError') {
          return reply.code(400).send({ error: 'Validation error', details: error.errors });
        }
        reply.code(error.message.includes('not found') ? 404 : 500).send({ error: error.message });
      }
    }
  );
}

