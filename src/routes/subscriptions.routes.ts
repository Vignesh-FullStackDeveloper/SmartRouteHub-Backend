import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { SubscriptionService } from '../services/subscription.service';
import { authenticate, requirePermission } from '../middleware/auth';

const createSubscriptionSchema = z.object({
  student_id: z.string().uuid(),
  valid_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount_paid: z.number().positive().optional(),
  payment_method: z.string().optional(),
  notes: z.string().optional(),
});

const updateSubscriptionSchema = createSubscriptionSchema.partial().extend({
  status: z.enum(['active', 'expired', 'cancelled']).optional(),
});

export async function subscriptionsRoutes(fastify: FastifyInstance) {
  const subscriptionService = new SubscriptionService();

  // Create subscription
  fastify.post(
    '/',
    {
      preHandler: [authenticate, requirePermission('student', 'update')],
      schema: {
        description: 'Create transport subscription for student',
        tags: ['Subscriptions'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = createSubscriptionSchema.parse(request.body);
        const subscription = await subscriptionService.create(
          data,
          request.user!.organization_id
        );
        reply.code(201).send(subscription);
      } catch (error: any) {
        const statusCode = error.message.includes('not found') ? 404 :
                          error.message.includes('Overlapping') ? 409 : 400;
        reply.code(statusCode).send({ error: error.message });
      }
    }
  );

  // Get student subscriptions
  fastify.get(
    '/student/:id',
    {
      preHandler: [authenticate, requirePermission('student', 'read')],
      schema: {
        description: 'Get all subscriptions for a student',
        tags: ['Subscriptions'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const subscriptions = await subscriptionService.getByStudent(
          request.params.id,
          request.user!.organization_id
        );
        reply.send(subscriptions);
      } catch (error: any) {
        reply.code(500).send({ error: error.message });
      }
    }
  );

  // Get active subscription
  fastify.get(
    '/student/:id/active',
    {
      preHandler: [authenticate, requirePermission('student', 'read')],
      schema: {
        description: 'Get active subscription for a student',
        tags: ['Subscriptions'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const subscription = await subscriptionService.getActive(
          request.params.id,
          request.user!.organization_id
        );
        
        if (!subscription) {
          reply.send({ 
            active: false,
            message: 'No active subscription found' 
          });
          return;
        }

        reply.send({
          active: true,
          subscription,
        });
      } catch (error: any) {
        reply.code(500).send({ error: error.message });
      }
    }
  );

  // Update subscription
  fastify.put(
    '/:id',
    {
      preHandler: [authenticate, requirePermission('student', 'update')],
      schema: {
        description: 'Update subscription',
        tags: ['Subscriptions'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
      try {
        const data = updateSubscriptionSchema.parse(request.body);
        const updated = await subscriptionService.update(
          request.params.id,
          data,
          request.user!.organization_id
        );
        reply.send(updated);
      } catch (error: any) {
        const statusCode = error.message.includes('not found') ? 404 :
                          error.message.includes('Overlapping') ? 409 : 400;
        reply.code(statusCode).send({ error: error.message });
      }
    }
  );

  // Get expiring subscriptions
  fastify.get(
    '/expiring',
    {
      preHandler: [authenticate, requirePermission('student', 'read')],
      schema: {
        description: 'Get subscriptions expiring soon',
        tags: ['Subscriptions'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            days: { type: 'number', default: 30 },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: { days?: number } }>, reply: FastifyReply) => {
      try {
        const subscriptions = await subscriptionService.getExpiring(
          request.user!.organization_id,
          request.query.days || 30
        );
        reply.send({
          expiring_count: subscriptions.length,
          subscriptions,
        });
      } catch (error: any) {
        reply.code(500).send({ error: error.message });
      }
    }
  );
}

