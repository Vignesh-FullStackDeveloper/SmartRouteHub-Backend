import { db } from '../config/database';
import { Student } from '../types';
import { BaseRepository } from './base.repository';

export class StudentRepository extends BaseRepository<Student> {
  constructor() {
    super('students');
  }

  async findByParentId(parentId: string, organizationId: string): Promise<Student[]> {
    return this.db('students')
      .where({ parent_id: parentId, organization_id: organizationId });
  }

  async findByBusId(busId: string, organizationId: string): Promise<Student[]> {
    return this.db('students')
      .where({ assigned_bus_id: busId, organization_id: organizationId, is_active: true });
  }

  async findByRouteId(routeId: string, organizationId: string): Promise<Student[]> {
    return this.db('students')
      .where({ assigned_route_id: routeId, organization_id: organizationId });
  }

  async getBusCapacity(busId: string, organizationId: string): Promise<number> {
    const result = await this.db('students')
      .where({ assigned_bus_id: busId, organization_id: organizationId, is_active: true })
      .count('* as count')
      .first();
    return parseInt(result?.count as string) || 0;
  }

  async assignToBus(studentIds: string[], busId: string, organizationId: string): Promise<number> {
    return this.db('students')
      .whereIn('id', studentIds)
      .where({ organization_id: organizationId })
      .update({ assigned_bus_id: busId });
  }

  async assignToRoute(studentIds: string[], routeId: string, organizationId: string): Promise<number> {
    return this.db('students')
      .whereIn('id', studentIds)
      .where({ organization_id: organizationId })
      .update({ assigned_route_id: routeId });
  }

  async getWithPickupLocation(studentId: string, organizationId: string): Promise<any> {
    const student = await this.findById(studentId, organizationId);
    if (!student || !student.pickup_point_id) {
      return { student, pickup_location: null };
    }

    const stop = await db('stops').where({ id: student.pickup_point_id }).first();
    return {
      student,
      pickup_location: stop ? {
        id: stop.id,
        name: stop.name,
        latitude: stop.latitude,
        longitude: stop.longitude,
        address: stop.address,
      } : null,
    };
  }
}

