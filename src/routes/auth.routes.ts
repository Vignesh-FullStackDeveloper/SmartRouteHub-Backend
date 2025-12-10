import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AuthService } from '../services/auth.service';
import { OrganizationService } from '../services/organization.service';
import { authenticate } from '../middleware/auth';
import { logger } from '../config/logger';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  organizationCode: z.string().optional(), // Optional for superadmin
});

export async function authRoutes(fastify: FastifyInstance) {
  const authService = new AuthService();
  const organizationService = new OrganizationService();

  // Login
  fastify.post(
    '/login',
    {
      schema: {
        description: 'User login',
        tags: ['Authentication'],
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 6 },
            organizationCode: { type: 'string', description: 'Optional for superadmin login' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  name: { type: 'string' },
                  role: { type: 'string', enum: ['superadmin', 'admin', 'driver', 'parent'] },
                  organization_id: { type: 'string', nullable: true },
                },
              },
              token: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = loginSchema.parse(request.body);
        
        let organizationId: string | undefined;
        
        // Get organization by code (if provided)
        let organizationCode: string | undefined;
        if (body.organizationCode) {
          try {
            const organization = await organizationService.getByCode(body.organizationCode);
            organizationId = organization.id;
            organizationCode = organization.code;
            logger.debug({
              message: 'Organization found for login',
              code: body.organizationCode,
              id: organization.id,
            });
          } catch (error: any) {
            logger.error({
              message: 'Organization lookup failed during login',
              code: body.organizationCode,
              error: error.message,
            });
            throw error;
          }
        }
        
        // Login user (organizationId is optional for superadmin)
        const { user, token: _ } = await authService.login(
          body.email,
          body.password,
          organizationId,
          organizationCode
        );

        // Use organizationId from the lookup, not from user object
        // (organization database users don't have organization_id field)
        const jwtUser = {
          id: user.id,
          organization_id: organizationId || (user as any).organization_id || null,
          email: user.email,
          role: user.role,
        };

        const token = fastify.jwt.sign(jwtUser);

        logger.info({
          message: 'User logged in',
          userId: user.id,
          email: user.email,
          role: user.role,
        });

        reply.send({
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            organization_id: organizationId || (user as any).organization_id || null,
          },
          token,
        });
      } catch (error: any) {
        logger.error({ error: error.message, body: request.body });
        reply.code(401).send({ error: error.message || 'Login failed' });
      }
    }
  );

  // Verify token
  fastify.get(
    '/verify',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Verify JWT token',
        tags: ['Authentication'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              valid: { type: 'boolean' },
              user: { type: 'object' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      reply.send({
        valid: true,
        user: request.user,
      });
    }
  );

  // Logout (client-side token removal, but we log it)
  fastify.post(
    '/logout',
    {
      preHandler: [authenticate],
      schema: {
        description: 'User logout',
        tags: ['Authentication'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      logger.info({
        message: 'User logged out',
        userId: request.user?.id,
      });
      reply.send({ message: 'Logged out successfully' });
    }
  );
}

