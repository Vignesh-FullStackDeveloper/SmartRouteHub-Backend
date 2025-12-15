import { OrganizationRepository } from '../repositories/organization.repository';
import { DatabaseService } from './database.service';
import { Organization } from '../types';
import { logger } from '../config/logger';
import { AuthService } from './auth.service';
import knex, { Knex } from 'knex';
import { appConfig } from '../config';
import { PERMISSIONS } from '../rbac/permissions';

export class OrganizationService {
  private repository: OrganizationRepository;
  private databaseService: DatabaseService;
  private authService: AuthService;

  constructor() {
    this.repository = new OrganizationRepository();
    this.databaseService = new DatabaseService();
    this.authService = new AuthService();
  }

  async create(data: {
    name: string;
    code: string;
    primary_color?: string;
    contact_email?: string;
    contact_phone?: string;
    address?: string;
    admin?: {
      name: string;
      email: string;
      password: string;
      phone?: string;
    };
  }): Promise<Organization & { admin?: { user: any; token: string } }> {
    // Check if code already exists
    const exists = await this.repository.checkCodeExists(data.code);
    if (exists) {
      throw new Error('Organization code already exists');
    }

    // Extract admin data before creating organization (don't store it in org table)
    const { admin, ...orgData } = data;
    
    logger.info({
      message: 'Creating organization',
      code: data.code,
      name: data.name,
      hasAdmin: !!admin,
      adminEmail: admin?.email,
    });
    
    const organization = await this.repository.create({
      ...orgData,
      primary_color: orgData.primary_color || '#2196F3',
      is_active: true,
    } as any);

    // Automatically create database and tables for the organization
    try {
      await this.databaseService.createOrganizationDatabase(
        organization.id,
        organization.code
      );
      logger.info({
        message: 'Organization database created successfully',
        organizationId: organization.id,
        code: organization.code,
      });

      // Seed default permissions and create organization_admin role
      // This MUST succeed before creating admin user
      await this.initializeOrganizationPermissions(organization.code);
      logger.info({
        message: 'Organization permissions initialized successfully',
        organizationId: organization.id,
        code: organization.code,
      });
    } catch (error: any) {
      logger.error({
        message: 'Failed to create organization database or initialize permissions',
        error: error.message,
        stack: error.stack,
        organizationId: organization.id,
      });
      // If database/permissions setup fails, we should fail organization creation
      // because admin user creation will fail anyway
      throw new Error(`Failed to set up organization database: ${error.message}`);
    }

    // Create admin user if provided
    let adminResult: { user: any; token: string } | undefined;
    if (admin) {
      logger.info({
        message: 'Creating admin user',
        organizationId: organization.id,
        organizationCode: organization.code,
        adminEmail: admin.email,
        adminName: admin.name,
      });
      
      try {
        adminResult = await this.createAdminUser(organization.id, organization.code, admin);
        logger.info({
          message: 'Admin user created successfully',
          organizationId: organization.id,
          adminEmail: admin.email,
          userId: adminResult.user.id,
        });
      } catch (error: any) {
        logger.error({
          message: 'Failed to create admin user',
          error: error.message,
          stack: error.stack,
          organizationId: organization.id,
          adminEmail: admin.email,
        });
        // If admin creation fails, we should fail organization creation
        // because the organization is incomplete without an admin
        throw new Error(`Failed to create admin user: ${error.message}`);
      }
    } else {
      logger.warn({
        message: 'No admin data provided for organization creation',
        organizationId: organization.id,
        code: organization.code,
      });
    }

    logger.info({
      message: 'Organization created',
      organizationId: organization.id,
      code: organization.code,
    });

    return {
      ...organization,
      ...(adminResult && { admin: adminResult }),
    };
  }

  /**
   * Create admin user in organization database
   */
  private async createAdminUser(
    organizationId: string,
    organizationCode: string,
    adminData: {
      name: string;
      email: string;
      password: string;
      phone?: string;
    }
  ): Promise<{ user: any; token: string }> {
    // Use DatabaseService to get organization database connection
    const orgDb = this.databaseService.getOrganizationDatabase(organizationCode);

    try {
      // Check if email already exists
      const existing = await orgDb('users').where({ email: adminData.email }).first();
      if (existing) {
        throw new Error('Admin email already exists');
      }

      // Hash password
      const passwordHash = await this.authService.hashPassword(adminData.password);

      // Get organization_admin role
      const orgAdminRole = await orgDb('roles')
        .where({ name: 'organization_admin' })
        .first();

      if (!orgAdminRole) {
        logger.error({
          message: 'Organization admin role not found',
          organizationCode,
          organizationId,
        });
        throw new Error('Organization admin role not found. Please ensure permissions were initialized.');
      }

      logger.debug({
        message: 'Found organization_admin role',
        roleId: orgAdminRole.id,
        organizationCode,
      });

      // Create admin user with organization_admin role
      const [user] = await orgDb('users')
        .insert({
          email: adminData.email,
          name: adminData.name,
          phone: adminData.phone,
          password_hash: passwordHash,
          role: 'admin',
          role_id: orgAdminRole.id, // Assign organization_admin role
          is_active: true,
        })
        .returning('*');

      logger.info({
        message: 'Admin user inserted successfully',
        userId: user.id,
        email: user.email,
        roleId: user.role_id,
        organizationCode,
      });

      // Generate JWT token
      // Note: We need to import Fastify instance or use a different approach
      // For now, we'll return the user and let the route generate the token
      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organization_id: organizationId,
        },
        token: '', // Will be set in the route
      };
    } catch (error: any) {
      logger.error({
        message: 'Error in createAdminUser',
        error: error.message,
        stack: error.stack,
        organizationCode,
        adminEmail: adminData.email,
      });
      throw error;
    }
  }

  async getById(id: string, organizationId?: string): Promise<Organization> {
    const organization = await this.repository.findById(id, organizationId);
    if (!organization) {
      throw new Error('Organization not found');
    }
    return organization;
  }

  async getByCode(code: string): Promise<Organization> {
    const organization = await this.repository.findByCode(code);
    if (!organization) {
      logger.warn({
        message: 'Organization not found by code',
        code,
      });
      throw new Error(`Organization not found with code: ${code}`);
    }
    return organization;
  }

  async checkCodeAvailable(code: string): Promise<boolean> {
    const exists = await this.repository.checkCodeExists(code);
    return !exists;
  }

  async update(id: string, data: Partial<Organization>, organizationId?: string): Promise<Organization> {
    // Check code uniqueness if code is being updated
    if (data.code) {
      const exists = await this.repository.checkCodeExists(data.code, id);
      if (exists) {
        throw new Error('Organization code already exists');
      }
    }

    const updated = await this.repository.update(id, data, organizationId);
    if (!updated) {
      throw new Error('Organization not found');
    }

    logger.info({
      message: 'Organization updated',
      organizationId: updated.id,
    });

    return updated;
  }

  /**
   * Initialize default permissions and organization_admin role for a new organization
   */
  private async initializeOrganizationPermissions(organizationCode: string): Promise<void> {
    // Use DatabaseService to get organization database connection
    const orgDb = this.databaseService.getOrganizationDatabase(organizationCode);

    try {
      // Define all default permissions (using unique codes only)
      // Note: GET_ALL and GET map to the same code, so we only include one
      const defaultPermissions = [
        // Student permissions
        { name: 'View Students', code: PERMISSIONS.STUDENT.GET, description: 'View students (all or individual)' },
        { name: 'Create Student', code: PERMISSIONS.STUDENT.CREATE, description: 'Create new student' },
        { name: 'Update Student', code: PERMISSIONS.STUDENT.UPDATE, description: 'Update student information' },
        { name: 'Delete Student', code: PERMISSIONS.STUDENT.DELETE, description: 'Delete student' },
        
        // Bus permissions
        { name: 'View Buses', code: PERMISSIONS.BUS.GET, description: 'View buses (all or individual)' },
        { name: 'Create Bus', code: PERMISSIONS.BUS.CREATE, description: 'Create new bus' },
        { name: 'Update Bus', code: PERMISSIONS.BUS.UPDATE, description: 'Update bus information' },
        { name: 'Delete Bus', code: PERMISSIONS.BUS.DELETE, description: 'Delete bus' },
        
        // Route permissions
        { name: 'View Routes', code: PERMISSIONS.ROUTE.GET, description: 'View routes (all or individual)' },
        { name: 'Create Route', code: PERMISSIONS.ROUTE.CREATE, description: 'Create new route' },
        { name: 'Update Route', code: PERMISSIONS.ROUTE.UPDATE, description: 'Update route information' },
        { name: 'Delete Route', code: PERMISSIONS.ROUTE.DELETE, description: 'Delete route' },
        
        // Trip permissions
        { name: 'View Trips', code: PERMISSIONS.TRIP.GET, description: 'View trips (all or individual)' },
        { name: 'Create Trip', code: PERMISSIONS.TRIP.CREATE, description: 'Start new trip' },
        { name: 'Update Trip', code: PERMISSIONS.TRIP.UPDATE, description: 'Update trip information' },
        { name: 'Delete Trip', code: PERMISSIONS.TRIP.DELETE, description: 'Cancel trip' },
        
        // Location permissions
        { name: 'View Location', code: PERMISSIONS.LOCATION.GET, description: 'View bus location' },
        { name: 'Update Location', code: PERMISSIONS.LOCATION.UPDATE, description: 'Update bus location' },
        
        // Organization permissions
        { name: 'View Organization', code: PERMISSIONS.ORGANIZATION.GET, description: 'View organization details' },
        { name: 'Update Organization', code: PERMISSIONS.ORGANIZATION.UPDATE, description: 'Update organization information' },
        
        // User/Driver permissions
        { name: 'View Users', code: PERMISSIONS.USER.GET, description: 'View users (all or individual)' },
        { name: 'Create User', code: PERMISSIONS.USER.CREATE, description: 'Create new user' },
        { name: 'Update User', code: PERMISSIONS.USER.UPDATE, description: 'Update user information' },
        { name: 'Delete User', code: PERMISSIONS.USER.DELETE, description: 'Delete user' },
        
        // Permission permissions
        { name: 'Create Permission', code: PERMISSIONS.PERMISSION.CREATE, description: 'Create new permission' },
        { name: 'View Permission', code: PERMISSIONS.PERMISSION.GET, description: 'View permissions' },
        { name: 'Delete Permission', code: PERMISSIONS.PERMISSION.DELETE, description: 'Delete permission' },
        
        // Role permissions
        { name: 'Create Role', code: PERMISSIONS.ROLE.CREATE, description: 'Create new role' },
        { name: 'View Role', code: PERMISSIONS.ROLE.GET, description: 'View roles' },
        { name: 'Update Role', code: PERMISSIONS.ROLE.UPDATE, description: 'Update role' },
        { name: 'Delete Role', code: PERMISSIONS.ROLE.DELETE, description: 'Delete role' },
      ];

      // Check which permissions already exist
      const existingPermissions = await orgDb('permissions')
        .whereIn('code', defaultPermissions.map(p => p.code))
        .select('id', 'code');

      const existingCodes = new Set(existingPermissions.map((p: any) => p.code));
      const permissionsToInsert = defaultPermissions.filter(p => !existingCodes.has(p.code));

      let insertedPermissions: any[] = [];

      // Insert only new permissions
      if (permissionsToInsert.length > 0) {
        insertedPermissions = await orgDb('permissions')
          .insert(permissionsToInsert)
          .returning('*');

        logger.info({
          message: 'New permissions created',
          organizationCode,
          newCount: insertedPermissions.length,
          existingCount: existingPermissions.length,
        });
      } else {
        logger.info({
          message: 'All permissions already exist',
          organizationCode,
          existingCount: existingPermissions.length,
        });
      }

      // Get all permissions (existing + newly inserted)
      const allPermissions = await orgDb('permissions')
        .whereIn('code', defaultPermissions.map(p => p.code))
        .select('*');

      // Get all permission IDs
      const permissionIds = allPermissions.map((p: any) => p.id);

      // Check if organization_admin role already exists
      let orgAdminRole = await orgDb('roles')
        .where({ name: 'organization_admin' })
        .first();

      if (!orgAdminRole) {
        // Create organization_admin role with all permissions
        const [newRole] = await orgDb('roles')
          .insert({
            name: 'organization_admin',
            description: 'Organization administrator with full access to all permissions',
            permission_ids: JSON.stringify(permissionIds),
          })
          .returning('*');
        orgAdminRole = newRole;

        logger.info({
          message: 'Organization admin role created',
          organizationCode,
          roleId: orgAdminRole.id,
          permissionCount: permissionIds.length,
        });
      } else {
        // Update existing role with all permissions (in case new permissions were added)
        await orgDb('roles')
          .where({ id: orgAdminRole.id })
          .update({
            permission_ids: JSON.stringify(permissionIds),
          });

        logger.info({
          message: 'Organization admin role updated with all permissions',
          organizationCode,
          roleId: orgAdminRole.id,
          permissionCount: permissionIds.length,
        });
      }

    } catch (error: any) {
      logger.error({
        message: 'Failed to initialize organization permissions',
        error: error.message,
        stack: error.stack,
        organizationCode,
      });
      throw error;
    }
  }
}

