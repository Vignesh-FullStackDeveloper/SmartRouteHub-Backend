import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AnalyticsService } from '../services/analytics.service';
import { authenticate, requirePermission } from '../middleware/auth';

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
    async (request: FastifyRequest<{ Params: { id: string }; Querystring: any }>, reply: FastifyReply) => {
      try {
        const history = await analyticsService.getStudentTravelHistory(
          request.params.id,
          request.user!.organization_id,
          request.query
        );
        reply.send(history);
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
    async (request: FastifyRequest<{ Params: { id: string }; Querystring: any }>, reply: FastifyReply) => {
      try {
        const history = await analyticsService.getBusTravelHistory(
          request.params.id,
          request.user!.organization_id,
          request.query
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
    async (request: FastifyRequest<{ Params: { id: string }; Querystring: any }>, reply: FastifyReply) => {
      try {
        const history = await analyticsService.getDriverTravelHistory(
          request.params.id,
          request.user!.organization_id,
          request.query
        );
        reply.send(history);
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
        const insights = await analyticsService.getDashboardInsights(request.user!.organization_id);
        reply.send(insights);
      } catch (error: any) {
        reply.code(500).send({ error: error.message });
      }
    }
  );
}

