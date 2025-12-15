import { Knex } from 'knex';
import { DatabaseService } from './database.service';
import { PermissionService } from './permission.service';
import { Role, Permission } from '../types';
import { logger } from '../config/logger';

export class RoleService {
  private databaseService: DatabaseService;
  private permissionService: PermissionService;

  constructor() {
    this.databaseService = new DatabaseService();
    this.permissionService = new PermissionService();
  }

  /**
   * Get organization database connection
   */
  private getOrgDb(organizationCode: string): Knex {
    return this.databaseService.getOrganizationDatabase(organizationCode);
  }

  /**
   * Create a new role with permissions (Organization Admin only)
   */
  async create(organizationCode: string, data: {
    name: string;
    description?: string;
    permissionIds: string[]; // Permission IDs to assign to this role
  }): Promise<Role & { permissions: Permission[] }> {
    const db = this.getOrgDb(organizationCode);

    // Check if role name already exists in this organization
    const existing = await db('roles')
      .where({ name: data.name })
      .first();

    if (existing) {
      throw new Error('Role name already exists in this organization');
    }

    // Verify all permissions exist in the organization
    if (data.permissionIds.length > 0) {
      for (const permissionId of data.permissionIds) {
        const permission = await this.permissionService.getById(organizationCode, permissionId);
        if (!permission) {
          throw new Error(`Permission with ID ${permissionId} not found`);
        }
      }
    }

    // Create role with permission_ids array
    const [role] = await db('roles')
      .insert({
        name: data.name,
        description: data.description,
        permission_ids: JSON.stringify(data.permissionIds || []),
      })
      .returning('*');

    // Fetch role with permissions
    const roleWithPermissions = await this.getById(organizationCode, role.id);

    logger.info({
      message: 'Role created',
      roleId: role.id,
      organizationCode,
      name: role.name,
    });

    return roleWithPermissions!;
  }

  /**
   * Update role permissions (Organization Admin only)
   */
  async update(
    organizationCode: string,
    id: string,
    data: {
      name?: string;
      description?: string;
      permissionIds?: string[]; // Update permission assignments
    }
  ): Promise<Role & { permissions: Permission[] }> {
    const db = this.getOrgDb(organizationCode);

    // Check if role exists
    const existing = await db('roles')
      .where({ id })
      .first();

    if (!existing) {
      throw new Error('Role not found');
    }

    // Check name uniqueness if name is being updated
    if (data.name && data.name !== existing.name) {
      const nameExists = await db('roles')
        .where({ name: data.name })
        .whereNot({ id })
        .first();

      if (nameExists) {
        throw new Error('Role name already exists in this organization');
      }
    }

    // Verify permissions if being updated
    if (data.permissionIds !== undefined) {
      for (const permissionId of data.permissionIds) {
        const permission = await this.permissionService.getById(organizationCode, permissionId);
        if (!permission) {
          throw new Error(`Permission with ID ${permissionId} not found`);
        }
      }
    }

    // Update role
    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.permissionIds !== undefined) {
      updateData.permission_ids = JSON.stringify(data.permissionIds);
    }

    if (Object.keys(updateData).length > 0) {
      await db('roles').where({ id }).update(updateData);
    }

    // Fetch updated role with permissions
    const updatedRole = await this.getById(organizationCode, id);

    logger.info({
      message: 'Role updated',
      roleId: id,
      organizationCode,
    });

    return updatedRole!;
  }

  /**
   * Get all roles in an organization
   */
  async getByOrganization(organizationCode: string): Promise<(Role & { permissions: Permission[] })[]> {
    const db = this.getOrgDb(organizationCode);
    const roles = await db('roles')
      .orderBy('name', 'asc');

    // Fetch permissions for each role
    const rolesWithPermissions = await Promise.all(
      roles.map(async (role) => {
        const permissions = await this.getRolePermissions(db, role);
        return { ...role, permissions };
      })
    );

    return rolesWithPermissions;
  }

  /**
   * Get role by ID
   */
  async getById(organizationCode: string, id: string): Promise<(Role & { permissions: Permission[] }) | null> {
    const db = this.getOrgDb(organizationCode);
    const role = await db('roles')
      .where({ id })
      .first();

    if (!role) {
      return null;
    }

    const permissions = await this.getRolePermissions(db, role);
    return { ...role, permissions };
  }

  /**
   * Delete a role (only if not assigned to any users)
   */
  async delete(organizationCode: string, id: string): Promise<void> {
    const db = this.getOrgDb(organizationCode);

    // Check if role is assigned to any users
    const userCount = await db('users')
      .where({ role_id: id })
      .count('* as count')
      .first();

    if (userCount && parseInt(userCount.count as string) > 0) {
      throw new Error('Cannot delete role: It is assigned to one or more users');
    }

    // Delete role
    await db('roles').where({ id }).delete();

    logger.info({
      message: 'Role deleted',
      roleId: id,
      organizationCode,
    });
  }

  /**
   * Get permissions assigned to a role
   */
  private async getRolePermissions(db: Knex, role: any): Promise<Permission[]> {
    const permissionIds = Array.isArray(role.permission_ids) 
      ? role.permission_ids 
      : (typeof role.permission_ids === 'string' ? JSON.parse(role.permission_ids) : []);

    if (permissionIds.length === 0) {
      return [];
    }

    return db('permissions')
      .whereIn('id', permissionIds)
      .select('*')
      .orderBy('name', 'asc');
  }
}

