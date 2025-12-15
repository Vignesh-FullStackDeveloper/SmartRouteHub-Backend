import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AuthService } from '../services/auth.service';
import { OrganizationService } from '../services/organization.service';
import { DatabaseService } from '../services/database.service';
import { authenticate } from '../middleware/auth';
import { logger } from '../config/logger';
import { JWTUser } from '../types';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  organizationCode: z.string().optional(), // Optional for superadmin
});

export async function authRoutes(fastify: FastifyInstance) {
  const authService = new AuthService();
  const organizationService = new OrganizationService();
  const databaseService = new DatabaseService();

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
                  permissions: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Array of permission codes (e.g., "student:read", "bus:create")',
                  },
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
        
        const { user, token: _ } = await authService.login(
          body.email,
          body.password,
          organizationId,
          organizationCode
        );

        // Fetch user permissions based on their role
        let permissions: string[] = [];
        
        if (user.role === 'superadmin') {
          // Superadmin has all permissions (empty array means all permissions)
          permissions = [];
        } else if (organizationId && organizationCode) {
          // For organization users, fetch permissions from their role
          try {
            const orgDb = databaseService.getOrganizationDatabase(organizationCode);
            
            // Get user from organization database to check role_id
            const dbUser = await orgDb('users')
              .where({ id: user.id, is_active: true })
              .first();
            
            if (dbUser && dbUser.role_id) {
              // Get role and its permissions
              const role = await orgDb('roles')
                .where({ id: dbUser.role_id })
                .first();
              
              if (role) {
                // Parse permission_ids (could be JSON string or array)
                const permissionIds = Array.isArray(role.permission_ids) 
                  ? role.permission_ids 
                  : (typeof role.permission_ids === 'string' ? JSON.parse(role.permission_ids) : []);
                
                if (permissionIds.length > 0) {
                  // Fetch permission codes
                  const permissionRecords = await orgDb('permissions')
                    .whereIn('id', permissionIds)
                    .select('code');
                  
                  permissions = permissionRecords.map((p: any) => p.code);
                }
              }
            } else if (dbUser && dbUser.role === 'admin' && !dbUser.role_id) {
              // Admin without role_id gets all permissions from organization
              const allPermissions = await orgDb('permissions').select('code');
              permissions = allPermissions.map((p: any) => p.code);
            }
          } catch (error: any) {
            logger.error({
              message: 'Failed to fetch user permissions during login',
              error: error.message,
              userId: user.id,
              organizationCode,
            });
            // Continue with empty permissions if there's an error
            permissions = [];
          }
        }
       
        const jwtUser = {
          id: user.id,
          organization_id: user.role === 'superadmin' ? null : (organizationId || (user as any).organization_id || null),
          email: user.email,
          role: user.role,
        };

        const token = fastify.jwt.sign(jwtUser);

        logger.info({
          message: 'User logged in',
          userId: user.id,
          email: user.email,
          role: user.role,
          permissionCount: permissions.length,
        });

        reply.send({
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            organization_id: organizationId || (user as any).organization_id || null,
            permissions,
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
      const user = request.user as JWTUser;
      logger.info({
        message: 'User logged out',
        userId: user?.id,
      });
      reply.send({ message: 'Logged out successfully' });
    }
  );
}

