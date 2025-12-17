import { UserRepository } from '../repositories/user.repository';
import { AuthService } from './auth.service';
import { DatabaseService } from './database.service';
import { OrganizationService } from './organization.service';
import { StudentService } from './student.service';
import { User } from '../types';
import { logger } from '../config/logger';

export class UserService {
  private repository: UserRepository;
  private authService: AuthService;
  private databaseService: DatabaseService;
  private organizationService: OrganizationService;
  private studentService: StudentService;

  constructor() {
    this.repository = new UserRepository();
    this.authService = new AuthService();
    this.databaseService = new DatabaseService();
    this.organizationService = new OrganizationService();
    this.studentService = new StudentService();
  }

  async create(data: {
    name: string;
    email: string;
    phone?: string;
    password: string;
    role: 'admin' | 'driver' | 'parent';
    role_id?: string; // Custom role ID
    driver_id?: string;
  }, organizationId: string): Promise<User> {
    // Get organization code to access organization database
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);

    // Check if email already exists in organization database
    const existing = await orgDb('users').where({ email: data.email }).first();
    if (existing) {
      throw new Error('Email already exists');
    }

    // Check driver_id if role is driver
    if (data.role === 'driver' && data.driver_id) {
      const driverExists = await orgDb('users')
        .where({ driver_id: data.driver_id, role: 'driver' })
        .first();
      if (driverExists) {
        throw new Error('Driver ID already exists');
      }
    }

    const passwordHash = await this.authService.hashPassword(data.password);

    // Validate role_id if provided
    if (data.role_id) {
      const role = await orgDb('roles')
        .where({ id: data.role_id })
        .first();
      if (!role) {
        throw new Error('Role not found');
      }
    }

    // Create user directly in organization database (no organization_id column)
    const [user] = await orgDb('users')
      .insert({
        name: data.name,
        email: data.email,
        phone: data.phone,
        password_hash: passwordHash,
        driver_id: data.driver_id,
        role: data.role,
        role_id: data.role_id || null,
        is_active: true,
      })
      .returning('*');

    logger.info({
      message: 'User created',
      userId: user.id,
      role: user.role,
      organizationCode: organization.code,
    });

    // Return user with organization_id for consistency
    return {
      ...user,
      organization_id: organizationId,
    } as User;
  }

  async getAll(organizationId: string, filters?: {
    role?: string;
    is_active?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ data: User[]; total: number }> {
    // Get organization code to access organization database
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);

    let query = orgDb('users').select('*');

    if (filters?.role) {
      query = query.where({ role: filters.role });
    }

    if (filters?.is_active !== undefined) {
      query = query.where({ is_active: filters.is_active });
    }

    // Get total count before pagination
    const countQuery = query.clone().clearSelect().clearOrder().count('* as total').first();
    const countResult = await countQuery;
    const total = parseInt(countResult?.total as string) || 0;

    // Apply pagination if provided
    if (filters?.offset !== undefined) {
      query = query.offset(filters.offset);
    }
    if (filters?.limit !== undefined) {
      query = query.limit(filters.limit);
    }

    const users = await query;
    
    // Add organization_id to each user for consistency
    const data = users.map(user => ({
      ...user,
      organization_id: organizationId,
    })) as User[];

    return { data, total };
  }

  async getById(id: string, organizationId: string): Promise<User> {
    // Get organization code to access organization database
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);

    const user = await orgDb('users')
      .where({ id })
      .first();

    if (!user) {
      throw new Error('User not found');
    }

    // Add organization_id for consistency
    return {
      ...user,
      organization_id: organizationId,
    } as User;
  }

  async update(id: string, data: Partial<User>, organizationId: string): Promise<User> {
    // Get organization code to access organization database
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);

    // Check email uniqueness if being updated
    if (data.email) {
      const existing = await orgDb('users')
        .where({ email: data.email })
        .whereNot({ id })
        .first();
      if (existing) {
        throw new Error('Email already exists');
      }
    }

    // Validate role_id if being updated
    if (data.role_id !== undefined) {
      if (data.role_id) {
        const role = await orgDb('roles')
          .where({ id: data.role_id })
          .first();
        if (!role) {
          throw new Error('Role not found');
        }
      }
    }

    // Prepare update data (remove organization_id if present, as it's not in org DB)
    const updateData: any = { ...data };
    delete updateData.organization_id;

    // Update user directly in organization database
    const [updated] = await orgDb('users')
      .where({ id })
      .update(updateData)
      .returning('*');

    if (!updated) {
      throw new Error('User not found');
    }

    logger.info({
      message: 'User updated',
      userId: updated.id,
      organizationCode: organization.code,
    });

    // Return user with organization_id for consistency
    return {
      ...updated,
      organization_id: organizationId,
    } as User;
  }

  async delete(id: string, organizationId: string): Promise<void> {
    // Get organization code to access organization database
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);

    // Check if user exists
    const user = await orgDb('users')
      .where({ id })
      .first();

    if (!user) {
      throw new Error('User not found');
    }

    // If the user is a parent, delete all associated students first
    if (user.role === 'parent') {
      try {
        // Get all students with this parent_id
        const students = await this.studentService.getByParentId(id, organizationId);
        
        logger.info({
          message: 'Deleting students associated with parent',
          parentId: id,
          studentCount: students.length,
          organizationCode: organization.code,
        });

        // Delete each student
        for (const student of students) {
          await this.studentService.delete(student.id, organizationId);
        }

        logger.info({
          message: 'All students deleted for parent',
          parentId: id,
          deletedCount: students.length,
          organizationCode: organization.code,
        });
      } catch (error: any) {
        logger.error({
          message: 'Error deleting students for parent',
          parentId: id,
          error: error.message,
          stack: error.stack,
          organizationCode: organization.code,
        });
        throw new Error(`Failed to delete students for parent: ${error.message}`);
      }
    }

    // Delete user from organization database
    await orgDb('users')
      .where({ id })
      .delete();

    logger.info({
      message: 'User deleted',
      userId: id,
      userRole: user.role,
      organizationCode: organization.code,
    });
  }
}

