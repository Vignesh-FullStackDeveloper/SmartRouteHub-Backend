import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { SubscriptionService } from '../services/subscription.service';
import { authenticate } from '../middleware/auth';
import { hasPermission } from '../rbac/hasPermission';
import { PERMISSIONS } from '../rbac/permissions';
import { JWTUser } from '../types';

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
      preHandler: [authenticate],
      schema: {
        description: 'Create transport subscription for student',
        tags: ['Subscriptions'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        if (!hasPermission(user, PERMISSIONS.STUDENT.UPDATE)) {
          return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
        }

        const data = createSubscriptionSchema.parse(request.body);
        const subscription = await subscriptionService.create(
          data,
          user.organization_id!
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
      preHandler: [authenticate],
      schema: {
        description: 'Get all subscriptions for a student',
        tags: ['Subscriptions'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        // Check permissions in descending order of authority
        if (hasPermission(user, PERMISSIONS.STUDENT.GET_ALL)) {
          // Highest level: can get subscriptions for any student
          const params = request.params as { id: string };
          const subscriptions = await subscriptionService.getByStudent(
            params.id,
            user.organization_id!
          );
          return reply.send(subscriptions);
        }
        
        if (hasPermission(user, PERMISSIONS.STUDENT.GET)) {
          // Restricted: parents can only get subscriptions for their own children
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
          const subscriptions = await subscriptionService.getByStudent(
            params.id,
            user.organization_id!
          );
          return reply.send(subscriptions);
        }
        
        return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
      } catch (error: any) {
        reply.code(500).send({ error: error.message });
      }
    }
  );

  // Get active subscription
  fastify.get(
    '/student/:id/active',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get active subscription for a student',
        tags: ['Subscriptions'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        // Check permissions in descending order of authority
        if (hasPermission(user, PERMISSIONS.STUDENT.GET_ALL)) {
          // Highest level: can get active subscription for any student
          const params = request.params as { id: string };
          const subscription = await subscriptionService.getActive(
            params.id,
            user.organization_id!
          );
          
          if (!subscription) {
            return reply.send({ 
              active: false,
              message: 'No active subscription found' 
            });
          }

          return reply.send({
            active: true,
            subscription,
          });
        }
        
        if (hasPermission(user, PERMISSIONS.STUDENT.GET)) {
          // Restricted: parents can only get active subscription for their own children
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
          const subscription = await subscriptionService.getActive(
            params.id,
            user.organization_id!
          );
          
          if (!subscription) {
            return reply.send({ 
              active: false,
              message: 'No active subscription found' 
            });
          }

          return reply.send({
            active: true,
            subscription,
          });
        }
        
        return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
      } catch (error: any) {
        reply.code(500).send({ error: error.message });
      }
    }
  );

  // Update subscription
  fastify.put(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Update subscription',
        tags: ['Subscriptions'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        if (!hasPermission(user, PERMISSIONS.STUDENT.UPDATE)) {
          return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
        }

        const data = updateSubscriptionSchema.parse(request.body);
        const params = request.params as { id: string };
        const updated = await subscriptionService.update(
          params.id,
          data,
          user.organization_id!
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
      preHandler: [authenticate],
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
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        if (!hasPermission(user, PERMISSIONS.STUDENT.GET_ALL)) {
          return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
        }

        const query = request.query as { days?: number };
        const subscriptions = await subscriptionService.getExpiring(
          user.organization_id!,
          query.days || 30
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

