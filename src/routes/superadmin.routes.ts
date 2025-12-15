import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { SuperAdminService } from '../services/superadmin.service';
import { authenticate } from '../middleware/auth';
import { JWTUser } from '../types';

export async function superadminRoutes(fastify: FastifyInstance) {
  const superAdminService = new SuperAdminService();

  // Get all organizations (superadmin only)
  fastify.get(
    '/organizations',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get all organizations (superadmin only)',
        tags: ['SuperAdmin'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        if (user.role !== 'superadmin') {
          return reply.code(403).send({ error: 'Forbidden: Superadmin access required' });
        }

        const organizations = await superAdminService.getAllOrganizations();
        reply.send({
          count: organizations.length,
          organizations,
        });
      } catch (error: any) {
        reply.code(500).send({ error: error.message });
      }
    }
  );

  // Get organization details with statistics
  fastify.get(
    '/organizations/:id',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get organization details with statistics (superadmin only)',
        tags: ['SuperAdmin'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        if (user.role !== 'superadmin') {
          return reply.code(403).send({ error: 'Forbidden: Superadmin access required' });
        }

        const params = request.params as { id: string };
        const details = await superAdminService.getOrganizationDetails(params.id);
        reply.send(details);
      } catch (error: any) {
        reply.code(error.message.includes('not found') ? 404 : 500).send({ error: error.message });
      }
    }
  );

  // Get system-wide statistics
  fastify.get(
    '/statistics',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get system-wide statistics (superadmin only)',
        tags: ['SuperAdmin'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as JWTUser;
        if (user.role !== 'superadmin') {
          return reply.code(403).send({ error: 'Forbidden: Superadmin access required' });
        }

        const stats = await superAdminService.getSystemStatistics();
        reply.send(stats);
      } catch (error: any) {
        reply.code(500).send({ error: error.message });
      }
    }
  );
}

