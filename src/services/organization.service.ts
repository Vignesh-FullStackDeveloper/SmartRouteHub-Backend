import { OrganizationRepository } from '../repositories/organization.repository';
import { DatabaseService } from './database.service';
import { Organization } from '../types';
import { logger } from '../config/logger';
import { AuthService } from './auth.service';
import knex from 'knex';
import { appConfig } from '../config';

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
    } catch (error: any) {
      logger.error({
        message: 'Failed to create organization database',
        error: error.message,
        organizationId: organization.id,
      });
      // Don't fail organization creation if database creation fails
      // Log the error but continue
    }

    // Create admin user if provided
    let adminResult: { user: any; token: string } | undefined;
    if (admin) {
      try {
        adminResult = await this.createAdminUser(organization.id, organization.code, admin);
        logger.info({
          message: 'Admin user created for organization',
          organizationId: organization.id,
          adminEmail: admin.email,
        });
      } catch (error: any) {
        logger.error({
          message: 'Failed to create admin user',
          error: error.message,
          organizationId: organization.id,
        });
        // Don't fail organization creation if admin creation fails
      }
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
    const dbName = `smartroutehub_${organizationCode.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    
    // Connect to organization database
    const orgDb = knex({
      client: 'pg',
      connection: {
        host: appConfig.database.host,
        port: appConfig.database.port,
        user: appConfig.database.user,
        password: appConfig.database.password,
        database: dbName,
        ssl: appConfig.database.ssl,
      },
    });

    try {
      // Check if email already exists
      const existing = await orgDb('users').where({ email: adminData.email }).first();
      if (existing) {
        throw new Error('Admin email already exists');
      }

      // Hash password
      const passwordHash = await this.authService.hashPassword(adminData.password);

      // Create admin user
      const [user] = await orgDb('users')
        .insert({
          email: adminData.email,
          name: adminData.name,
          phone: adminData.phone,
          password_hash: passwordHash,
          role: 'admin',
          is_active: true,
        })
        .returning('*');

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
    } finally {
      await orgDb.destroy();
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
}

