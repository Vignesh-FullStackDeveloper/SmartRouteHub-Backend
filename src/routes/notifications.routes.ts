import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { NotificationService } from '../services/notification.service';
import { authenticate } from '../middleware/auth';
import { getRedisSubscriber } from '../config/redis';
import { db } from '../config/database';
import { JWTUser } from '../types';

export async function notificationsRoutes(fastify: FastifyInstance) {
  const notificationService = new NotificationService();

  // Get parent notifications
  fastify.get(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get notifications for logged-in parent',
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            unread_only: { type: 'boolean' },
            limit: { type: 'number', default: 50 },
            offset: { type: 'number', default: 0 },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        if (!user || user.role !== 'parent' || !user.organization_id) {
          return reply.code(403).send({ error: 'Access denied' });
        }

        // Get parent user ID from database
        const parent = await db('users')
          .where({ email: user.email, organization_id: user.organization_id })
          .first();

        if (!parent) {
          return reply.code(404).send({ error: 'Parent not found' });
        }

        const query = request.query as { unread_only?: boolean; limit?: number; offset?: number };
        const result = await notificationService.getParentNotifications(
          parent.id,
          user.organization_id,
          {
            unreadOnly: query.unread_only,
            limit: query.limit,
            offset: query.offset,
          }
        );

        reply.send(result);
      } catch (error: any) {
        reply.code(500).send({ error: error.message });
      }
    }
  );

  // Get unread count
  fastify.get(
    '/unread-count',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get unread notification count',
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        if (!user || user.role !== 'parent' || !user.organization_id) {
          return reply.code(403).send({ error: 'Access denied' });
        }

        const parent = await db('users')
          .where({ email: user.email, organization_id: user.organization_id })
          .first();

        if (!parent) {
          reply.code(404).send({ error: 'Parent not found' });
          return;
        }

        const count = await notificationService.getUnreadCount(
          parent.id,
          user.organization_id
        );

        reply.send({ unread_count: count });
      } catch (error: any) {
        reply.code(500).send({ error: error.message });
      }
    }
  );

  // Mark notification as read
  fastify.patch(
    '/:id/read',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Mark notification as read',
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        if (!user || user.role !== 'parent' || !user.organization_id) {
          return reply.code(403).send({ error: 'Access denied' });
        }

        const parent = await db('users')
          .where({ email: user.email, organization_id: user.organization_id })
          .first();

        if (!parent) {
          reply.code(404).send({ error: 'Parent not found' });
          return;
        }

        const params = request.params as { id: string };
        await notificationService.markAsRead(params.id, parent.id);
        reply.send({ message: 'Notification marked as read' });
      } catch (error: any) {
        reply.code(500).send({ error: error.message });
      }
    }
  );

  // Mark all notifications as read
  fastify.patch(
    '/read-all',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Mark all notifications as read',
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        if (!user || user.role !== 'parent' || !user.organization_id) {
          return reply.code(403).send({ error: 'Access denied' });
        }

        const parent = await db('users')
          .where({ email: user.email, organization_id: user.organization_id })
          .first();

        if (!parent) {
          reply.code(404).send({ error: 'Parent not found' });
          return;
        }

        await notificationService.markAllAsRead(parent.id, request.user.organization_id);
        reply.send({ message: 'All notifications marked as read' });
      } catch (error: any) {
        reply.code(500).send({ error: error.message });
      }
    }
  );

  // Real-time notification stream (SSE)
  fastify.get(
    '/stream',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Real-time notification stream (Server-Sent Events)',
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        if (!user || user.role !== 'parent' || !user.organization_id) {
          return reply.code(403).send({ error: 'Access denied' });
        }

        const parent = await db('users')
          .where({ email: user.email, organization_id: user.organization_id })
          .first();

        if (!parent) {
          reply.code(404).send({ error: 'Parent not found' });
          return;
        }

        // Set up SSE headers
        reply.raw.setHeader('Content-Type', 'text/event-stream');
        reply.raw.setHeader('Cache-Control', 'no-cache');
        reply.raw.setHeader('Connection', 'keep-alive');
        reply.raw.setHeader('X-Accel-Buffering', 'no');

        const subscriber = getRedisSubscriber();
        const channel = `notifications:parent:${parent.id}`;

        // Subscribe to parent-specific notifications
        await subscriber.subscribe(channel);

        const messageHandler = (ch: string, message: string) => {
          if (ch === channel) {
            reply.raw.write(`data: ${message}\n\n`);
          }
        };

        subscriber.on('message', messageHandler);

        // Send initial connection message
        reply.raw.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

        // Handle client disconnect
        request.raw.on('close', () => {
          subscriber.unsubscribe(channel);
          subscriber.removeListener('message', messageHandler);
          reply.raw.end();
        });

        // Keep connection alive
        const keepAlive = setInterval(() => {
          reply.raw.write(`: keepalive\n\n`);
        }, 30000);

        request.raw.on('close', () => {
          clearInterval(keepAlive);
        });
      } catch (error: any) {
        reply.code(500).send({ error: error.message });
      }
    }
  );
}

