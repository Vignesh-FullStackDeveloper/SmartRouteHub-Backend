import { db } from '../config/database';
import { User } from '../types';
import { BaseRepository } from './base.repository';

export class UserRepository extends BaseRepository<User> {
  constructor() {
    super('users');
  }

  async findByEmail(email: string, organizationId: string): Promise<User | null> {
    if (!organizationId) {
      // For superadmin lookup
      return this.db('users')
        .where({ email, role: 'superadmin' })
        .first() || null;
    }
    
    return this.db('users')
      .where({ email, organization_id: organizationId })
      .first() || null;
  }

  async findByDriverId(driverId: string, organizationId: string): Promise<User | null> {
    return this.db('users')
      .where({ driver_id: driverId, organization_id: organizationId, role: 'driver' })
      .first() || null;
  }

  async findByRole(role: string, organizationId: string, filters?: Record<string, any>): Promise<User[]> {
    const query = this.db('users').where({ role, organization_id: organizationId });
    if (filters) {
      query.where(filters);
    }
    return query;
  }

  async checkEmailExists(email: string, organizationId: string, excludeId?: string): Promise<boolean> {
    const query = this.db('users').where({ email, organization_id: organizationId });
    if (excludeId) {
      query.whereNot({ id: excludeId });
    }
    const result = await query.count('* as count').first();
    return parseInt(result?.count as string) > 0;
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.db('users')
      .where({ id: userId })
      .update({ last_login: db.fn.now() });
  }

  async getWithBusAndRoute(userId: string, organizationId: string): Promise<any> {
    return this.db('users')
      .where({ 'users.id': userId, 'users.organization_id': organizationId })
      .leftJoin('buses', 'users.id', 'buses.driver_id')
      .leftJoin('routes', 'buses.assigned_route_id', 'routes.id')
      .select(
        'users.*',
        'buses.id as assigned_bus_id',
        'buses.bus_number as assigned_bus_number',
        'routes.id as assigned_route_id',
        'routes.name as assigned_route_name'
      )
      .first();
  }
}

