import { Knex } from 'knex';
import { DatabaseService } from './database.service';
import { Permission } from '../types';
import { logger } from '../config/logger';

export class PermissionService {
  private databaseService: DatabaseService;

  constructor() {
    this.databaseService = new DatabaseService();
  }

  /**
   * Get organization database connection
   */
  private getOrgDb(organizationCode: string): Knex {
    return this.databaseService.getOrganizationDatabase(organizationCode);
  }

  /**
   * Create a new permission (Organization Admin only)
   */
  async create(organizationCode: string, data: {
    name: string;
    code: string;
    description?: string;
  }): Promise<Permission> {
    const db = this.getOrgDb(organizationCode);

    // Check if code already exists
    const existing = await db('permissions').where({ code: data.code }).first();
    if (existing) {
      throw new Error('Permission code already exists');
    }

    // Check if name already exists
    const existingName = await db('permissions').where({ name: data.name }).first();
    if (existingName) {
      throw new Error('Permission name already exists');
    }

    // Create permission
    const [permission] = await db('permissions')
      .insert({
        name: data.name,
        code: data.code,
        description: data.description,
      })
      .returning('*');

    logger.info({
      message: 'Permission created',
      permissionId: permission.id,
      code: permission.code,
      organizationCode,
    });

    return permission;
  }

  /**
   * Get all permissions for an organization
   */
  async getAll(organizationCode: string): Promise<Permission[]> {
    const db = this.getOrgDb(organizationCode);
    return db('permissions').orderBy('name', 'asc');
  }

  /**
   * Get permission by ID
   */
  async getById(organizationCode: string, id: string): Promise<Permission | null> {
    const db = this.getOrgDb(organizationCode);
    return db('permissions').where({ id }).first();
  }

  /**
   * Delete a permission (only if not assigned to any roles)
   */
  async delete(organizationCode: string, id: string): Promise<void> {
    const db = this.getOrgDb(organizationCode);

    // Check if permission is assigned to any roles (check permission_ids array in roles table)
    const roles = await db('roles').select('id', 'name', 'permission_ids');
    const rolesUsingPermission = roles.filter((role: any) => {
      const permissionIds = Array.isArray(role.permission_ids) ? role.permission_ids : [];
      return permissionIds.includes(id);
    });

    if (rolesUsingPermission.length > 0) {
      throw new Error(`Cannot delete permission: It is assigned to role(s): ${rolesUsingPermission.map((r: any) => r.name).join(', ')}`);
    }

    // Delete permission
    await db('permissions').where({ id }).delete();

    logger.info({
      message: 'Permission deleted',
      permissionId: id,
      organizationCode,
    });
  }
}
