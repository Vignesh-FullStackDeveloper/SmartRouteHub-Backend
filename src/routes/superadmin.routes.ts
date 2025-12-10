import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { SuperAdminService } from '../services/superadmin.service';
import { authenticate, requireRole } from '../middleware/auth';

export async function superadminRoutes(fastify: FastifyInstance) {
  const superAdminService = new SuperAdminService();

  // Get all organizations (superadmin only)
  fastify.get(
    '/organizations',
    {
      preHandler: [authenticate, requireRole(['superadmin'])],
      schema: {
        description: 'Get all organizations (superadmin only)',
        tags: ['SuperAdmin'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
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
      preHandler: [authenticate, requireRole(['superadmin'])],
      schema: {
        description: 'Get organization details with statistics (superadmin only)',
        tags: ['SuperAdmin'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const details = await superAdminService.getOrganizationDetails(request.params.id);
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
      preHandler: [authenticate, requireRole(['superadmin'])],
      schema: {
        description: 'Get system-wide statistics (superadmin only)',
        tags: ['SuperAdmin'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const stats = await superAdminService.getSystemStatistics();
        reply.send(stats);
      } catch (error: any) {
        reply.code(500).send({ error: error.message });
      }
    }
  );
}

