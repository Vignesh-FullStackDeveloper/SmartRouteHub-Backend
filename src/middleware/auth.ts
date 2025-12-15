import { FastifyRequest, FastifyReply } from 'fastify';
import { JWTUser } from '../types';
import { DatabaseService } from '../services/database.service';
import { OrganizationService } from '../services/organization.service';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: JWTUser;
  }
}

const databaseService = new DatabaseService();
const organizationService = new OrganizationService();

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    await request.jwtVerify();
    const user = request.user as JWTUser;
    console.log('user ####', user);
    let permissions: string[] = [];
    
    if (user.role === 'superadmin') {
      // Superadmin has all permissions
      request.user = {
        id: user.id,
        organization_id: user.organization_id,
        email: user.email,
        role: user.role,
        permissions: [],
      };
      return;
    }
    
    // For organization users, get permissions from their role in organization database
    if (user.organization_id) {
      try {
        // Get organization code
        const organization = await organizationService.getById(user.organization_id);
        const orgDb = databaseService.getOrganizationDatabase(organization.code);
        
        // Get user from organization database
        const dbUser = await orgDb('users')
          .where({ id: user.id, is_active: true })
          .first();
        
        if (!dbUser) {
          reply.code(401).send({ error: 'User not found or inactive' });
          return;
        }
        
        // Get permissions from user's assigned role
        if (dbUser.role_id) {
          const role = await orgDb('roles')
            .where({ id: dbUser.role_id })
            .first();
          
          if (role) {
            // Get permission IDs from role's permission_ids array
            const permissionIds = Array.isArray(role.permission_ids) 
              ? role.permission_ids 
              : (typeof role.permission_ids === 'string' ? JSON.parse(role.permission_ids) : []);
            
            if (permissionIds.length > 0) {
              const permissionRecords = await orgDb('permissions')
                .whereIn('id', permissionIds)
                .select('code');
              
              permissions = permissionRecords.map((p: any) => p.code);
            }
          }
        } else {
          // User must have a role assigned to access permissions
          // Return empty permissions - they must have a role_id
          permissions = [];
        }
      } catch (error: any) {
        // If organization database doesn't exist or error, return empty permissions
        permissions = [];
      }
    }
    
    request.user = {
      id: user.id,
      organization_id: user.organization_id,
      email: user.email,
      role: user.role,
      permissions,
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
    
    // Superadmin has all permissions
    if (request.user.role === 'superadmin') {
      return;
    }
    
    // Check if user has the required permission (permission code)
    const permissionName = `${resource}:${action}`;
    const hasPermission = request.user.permissions?.includes(permissionName);
    
    if (!hasPermission) {
      reply.code(403).send({ 
        error: `Forbidden: No permission to ${action} ${resource}` 
      });
      return;
    }
  };
}

