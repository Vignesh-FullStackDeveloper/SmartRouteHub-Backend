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
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        if (!hasPermission(user, PERMISSIONS.ROUTE.UPDATE)) {
          return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
        }

        const data = assignStudentsToRouteSchema.parse(request.body);
        const result = await assignmentService.assignStudentsToRoute(
          data.student_ids,
          data.route_id,
          data.bus_id,
          user.organization_id!
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
        if (!hasPermission(user, PERMISSIONS.BUS.UPDATE)) {
          return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
        }

        const data = assignStudentsToBusSchema.parse(request.body);
        const result = await assignmentService.assignStudentsToBus(
          data.student_ids,
          data.bus_id,
          user.organization_id!
        );
        reply.send({
          message: 'Students assigned successfully',
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
        if (!hasPermission(user, PERMISSIONS.ROUTE.GET)) {
          return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
        }

        const params = request.params as { id: string };
        const result = await assignmentService.getRouteAssignments(
          params.id,
          user.organization_id!
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
        if (!hasPermission(user, PERMISSIONS.BUS.GET)) {
          return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
        }

        const params = request.params as { id: string };
        const result = await assignmentService.getBusAssignments(
          params.id,
          user.organization_id!
        );
        reply.send(result);
      } catch (error: any) {
        reply.code(error.message.includes('not found') ? 404 : 500).send({ error: error.message });
      }
    }
  );
}

