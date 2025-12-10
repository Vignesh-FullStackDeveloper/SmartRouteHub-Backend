import { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../config/database';
import { JWTUser } from '../types';

declare module 'fastify' {
  interface FastifyRequest {
    user?: JWTUser;
  }
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    await request.jwtVerify();
    const user = request.user as JWTUser;
    
    // Verify user still exists and is active
    // For superadmin, organization_id can be null
    const query = db('users').where({ id: user.id, is_active: true });
    if (user.organization_id) {
      query.where({ organization_id: user.organization_id });
    }
    const dbUser = await query.first();
    
    if (!dbUser) {
      reply.code(401).send({ error: 'User not found or inactive' });
      return;
    }
    
    request.user = {
      id: user.id,
      organization_id: user.organization_id,
      email: user.email,
      role: user.role,
    };
  } catch (err) {
    reply.code(401).send({ error: 'Unauthorized' });
  }
}

export function requireRole(
  roles: string[]
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      reply.code(401).send({ error: 'Unauthorized' });
      return;
    }
    
    // Superadmin has access to everything
    if (request.user.role === 'superadmin') {
      return;
    }
    
    if (!roles.includes(request.user.role)) {
      reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
      return;
    }
  };
}

export function requirePermission(
  resource: string,
  action: string
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      reply.code(401).send({ error: 'Unauthorized' });
      return;
    }
    
    const permission = await db('role_permissions')
      .join('permissions', 'role_permissions.permission_id', 'permissions.id')
      .where({
        'role_permissions.role': request.user.role,
        'permissions.resource': resource,
        'permissions.action': action,
      })
      .first();
    
    if (!permission) {
      reply.code(403).send({ 
        error: `Forbidden: No permission to ${action} ${resource}` 
      });
      return;
    }
  };
}

