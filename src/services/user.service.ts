import { UserRepository } from '../repositories/user.repository';
import { AuthService } from './auth.service';
import { User } from '../types';
import { logger } from '../config/logger';

export class UserService {
  private repository: UserRepository;
  private authService: AuthService;

  constructor() {
    this.repository = new UserRepository();
    this.authService = new AuthService();
  }

  async create(data: {
    name: string;
    email: string;
    phone?: string;
    password: string;
    role: 'admin' | 'driver' | 'parent';
    driver_id?: string;
  }, organizationId: string): Promise<User> {
    // Check if email already exists
    const emailExists = await this.repository.checkEmailExists(data.email, organizationId);
    if (emailExists) {
      throw new Error('Email already exists');
    }

    // Check driver_id if role is driver
    if (data.role === 'driver' && data.driver_id) {
      const driverExists = await this.repository.findByDriverId(data.driver_id, organizationId);
      if (driverExists) {
        throw new Error('Driver ID already exists');
      }
    }

    const passwordHash = await this.authService.hashPassword(data.password);

    const user = await this.repository.create({
      name: data.name,
      email: data.email,
      phone: data.phone,
      password_hash: passwordHash,
      driver_id: data.driver_id,
      role: data.role,
      organization_id: organizationId,
      is_active: true,
    } as any);

    logger.info({
      message: 'User created',
      userId: user.id,
      role: user.role,
    });

    return user;
  }

  async getAll(organizationId: string, filters?: {
    role?: string;
    is_active?: boolean;
  }): Promise<User[]> {
    if (filters?.role) {
      return this.repository.findByRole(filters.role, organizationId, {
        is_active: filters.is_active,
      });
    }
    return this.repository.findAll(organizationId, filters);
  }

  async getById(id: string, organizationId: string): Promise<User> {
    const user = await this.repository.findById(id, organizationId);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  async update(id: string, data: Partial<User>, organizationId: string): Promise<User> {
    // Check email uniqueness if being updated
    if (data.email) {
      const emailExists = await this.repository.checkEmailExists(data.email, organizationId, id);
      if (emailExists) {
        throw new Error('Email already exists');
      }
    }

    const updated = await this.repository.update(id, data, organizationId);
    if (!updated) {
      throw new Error('User not found');
    }

    logger.info({
      message: 'User updated',
      userId: updated.id,
    });

    return updated;
  }
}

