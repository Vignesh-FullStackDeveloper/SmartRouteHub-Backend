import { db } from '../config/database';
import { Bus } from '../types';
import { BaseRepository } from './base.repository';

export class BusRepository extends BaseRepository<Bus> {
  constructor() {
    super('buses');
  }

  async findByBusNumber(busNumber: string, organizationId: string): Promise<Bus | null> {
    return this.db('buses')
      .where({ bus_number: busNumber, organization_id: organizationId })
      .first() || null;
  }

  async findByDriverId(driverId: string, organizationId: string): Promise<Bus | null> {
    return this.db('buses')
      .where({ driver_id: driverId, organization_id: organizationId })
      .first() || null;
  }

  async checkBusNumberExists(busNumber: string, organizationId: string, excludeId?: string): Promise<boolean> {
    const query = this.db('buses').where({ bus_number: busNumber, organization_id: organizationId });
    if (excludeId) {
      query.whereNot({ id: excludeId });
    }
    const result = await query.count('* as count').first();
    return parseInt(result?.count as string) > 0;
  }

  async getWithDriverAndRoute(busId: string, organizationId: string): Promise<any> {
    return this.db('buses')
      .where({ 'buses.id': busId, 'buses.organization_id': organizationId })
      .leftJoin('users', 'buses.driver_id', 'users.id')
      .leftJoin('routes', 'buses.assigned_route_id', 'routes.id')
      .select(
        'buses.*',
        'users.name as driver_name',
        'users.email as driver_email',
        'routes.name as route_name'
      )
      .first();
  }

  async assignDriver(busId: string, driverId: string, organizationId: string): Promise<Bus | null> {
    return this.update(busId, { driver_id: driverId }, organizationId);
  }
}

