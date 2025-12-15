import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AnalyticsService } from '../services/analytics.service';
import { authenticate, requirePermission } from '../middleware/auth';
import { hasPermission } from '../rbac/hasPermission';
import { PERMISSIONS } from '../rbac/permissions';
import { JWTUser } from '../types';

export async function analyticsRoutes(fastify: FastifyInstance) {
  const analyticsService = new AnalyticsService();

  // Student travel history
  fastify.get(
    '/students/:id/travel-history',
    {
      preHandler: [authenticate, requirePermission('trip', 'read')],
      schema: {
        description: 'Get student travel history',
        tags: ['Analytics'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            start_date: { type: 'string', format: 'date' },
            end_date: { type: 'string', format: 'date' },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        // Check permissions in descending order of authority
        if (hasPermission(user, PERMISSIONS.TRIP.GET_ALL)) {
          // Highest level: can get travel history for any student
          const params = request.params as { id: string };
          const history = await analyticsService.getStudentTravelHistory(
            params.id,
            user.organization_id!,
            request.query as any
          );
          return reply.send(history);
        }
        
        if (hasPermission(user, PERMISSIONS.TRIP.GET)) {
          // Restricted: parents can only get travel history for their own children
          if (user.role === 'parent') {
            const { StudentService } = await import('../services/student.service');
            const studentService = new StudentService();
            const students = await studentService.getByParentId(user.id, user.organization_id!);
            const params = request.params as { id: string };
            const student = students.find(s => s.id === params.id);
            if (!student) {
              return reply.code(403).send({ error: 'Forbidden: Can only access own children' });
            }
          }
          const params = request.params as { id: string };
          const history = await analyticsService.getStudentTravelHistory(
            params.id,
            user.organization_id!,
            request.query as any
          );
          return reply.send(history);
        }
        
        return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
      } catch (error: any) {
        reply.code(error.message.includes('not found') ? 404 : 500).send({ error: error.message });
      }
    }
  );

  // Bus travel history
  fastify.get(
    '/buses/:id/travel-history',
    {
      preHandler: [authenticate, requirePermission('trip', 'read')],
      schema: {
        description: 'Get bus travel history',
        tags: ['Analytics'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            start_date: { type: 'string', format: 'date' },
            end_date: { type: 'string', format: 'date' },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        if (!hasPermission(user, PERMISSIONS.TRIP.GET)) {
          return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
        }

        const params = request.params as { id: string };
        const history = await analyticsService.getBusTravelHistory(
          params.id,
          user.organization_id!,
          request.query as any
        );
        reply.send(history);
      } catch (error: any) {
        reply.code(error.message.includes('not found') ? 404 : 500).send({ error: error.message });
      }
    }
  );

  // Driver travel history
  fastify.get(
    '/drivers/:id/travel-history',
    {
      preHandler: [authenticate, requirePermission('trip', 'read')],
      schema: {
        description: 'Get driver travel history',
        tags: ['Analytics'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            start_date: { type: 'string', format: 'date' },
            end_date: { type: 'string', format: 'date' },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        const params = request.params as { id: string };
        // Check permissions in descending order of authority
        if (hasPermission(user, PERMISSIONS.TRIP.GET_ALL)) {
          // Highest level: can get travel history for any driver
          const history = await analyticsService.getDriverTravelHistory(
            params.id,
            user.organization_id!,
            request.query as any
          );
          return reply.send(history);
        }
        
        if (hasPermission(user, PERMISSIONS.TRIP.GET)) {
          // Restricted: drivers can only get their own travel history
          if (user.role === 'driver' && params.id !== user.id) {
            return reply.code(403).send({ error: 'Forbidden: Can only access own travel history' });
          }
          const history = await analyticsService.getDriverTravelHistory(
            params.id,
            user.organization_id!,
            request.query as any
          );
          return reply.send(history);
        }
        
        return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
      } catch (error: any) {
        reply.code(error.message.includes('not found') ? 404 : 500).send({ error: error.message });
      }
    }
  );

  // Dashboard insights
  fastify.get(
    '/dashboard',
    {
      preHandler: [authenticate, requirePermission('trip', 'read')],
      schema: {
        description: 'Get dashboard insights',
        tags: ['Analytics'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        if (!hasPermission(user, PERMISSIONS.TRIP.GET_ALL)) {
          return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
        }

        const insights = await analyticsService.getDashboardInsights(user.organization_id!);
        reply.send(insights);
      } catch (error: any) {
        reply.code(500).send({ error: error.message });
      }
    }
  );
}

