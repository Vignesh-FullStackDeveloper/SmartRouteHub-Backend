import { OrganizationService } from './organization.service';
import { DatabaseService } from './database.service';
import { Bus } from '../types';
import { logger } from '../config/logger';

export class BusService {
  private organizationService: OrganizationService;
  private databaseService: DatabaseService;

  constructor() {
    this.organizationService = new OrganizationService();
    this.databaseService = new DatabaseService();
  }

  async create(data: {
    bus_number: string;
    capacity: number;
    driver_id?: string;
    assigned_route_id?: string;
    metadata?: Record<string, any>;
    is_active?: boolean;
  }, organizationId: string): Promise<Bus> {
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);
    
    try {
      // Check if bus number already exists
      const existing = await orgDb('buses')
        .where({ bus_number: data.bus_number })
        .first();
      if (existing) {
        throw new Error('Bus number already exists');
      }

      // Verify driver exists if driver_id is provided
      if (data.driver_id) {
        const driver = await orgDb('users')
          .where({ id: data.driver_id, role: 'driver' })
          .first();
        if (!driver) {
          throw new Error('Driver not found or invalid');
        }
      }

      const [bus] = await orgDb('buses')
        .insert({
          bus_number: data.bus_number,
          capacity: data.capacity,
          driver_id: data.driver_id || null,
          assigned_route_id: data.assigned_route_id || null,
          metadata: data.metadata ? JSON.stringify(data.metadata) : null,
          is_active: data.is_active !== undefined ? data.is_active : true,
        })
        .returning('*');

      logger.info({
        message: 'Bus created',
        busId: bus.id,
        busNumber: bus.bus_number,
      });

      return {
        ...bus,
        organization_id: organizationId,
        metadata: bus.metadata ? (typeof bus.metadata === 'string' ? JSON.parse(bus.metadata) : bus.metadata) : null,
      } as Bus;
    } finally {
      await orgDb.destroy();
    }
  }

  async getAll(organizationId: string, filters?: {
    is_active?: boolean;
    driver_id?: string;
  }): Promise<any[]> {
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);
    
    try {
      let query = orgDb('buses').select('*');

      if (filters?.is_active !== undefined) {
        query = query.where({ is_active: filters.is_active });
      }
      if (filters?.driver_id) {
        query = query.where({ driver_id: filters.driver_id });
      }

      const buses = await query;
      
      // Enrich with driver and route information
      const busesWithDetails = await Promise.all(
        buses.map(async (bus) => {
          const busWithDetails = await orgDb('buses')
            .where({ 'buses.id': bus.id })
            .leftJoin('users', 'buses.driver_id', 'users.id')
            .leftJoin('routes', 'buses.assigned_route_id', 'routes.id')
            .select(
              'buses.*',
              'users.name as driver_name',
              'users.email as driver_email',
              'routes.name as route_name'
            )
            .first();
          
          return {
            ...busWithDetails,
            organization_id: organizationId,
            metadata: busWithDetails.metadata ? (typeof busWithDetails.metadata === 'string' ? JSON.parse(busWithDetails.metadata) : busWithDetails.metadata) : null,
          };
        })
      );

      return busesWithDetails;
    } finally {
      await orgDb.destroy();
    }
  }

  async getById(id: string, organizationId: string): Promise<any> {
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);
    
    try {
      const bus = await orgDb('buses')
        .where({ 'buses.id': id })
        .leftJoin('users', 'buses.driver_id', 'users.id')
        .leftJoin('routes', 'buses.assigned_route_id', 'routes.id')
        .select(
          'buses.*',
          'users.name as driver_name',
          'users.email as driver_email',
          'routes.name as route_name'
        )
        .first();
      
      if (!bus) {
        throw new Error('Bus not found');
      }
      
      return {
        ...bus,
        organization_id: organizationId,
        metadata: bus.metadata ? (typeof bus.metadata === 'string' ? JSON.parse(bus.metadata) : bus.metadata) : null,
      };
    } finally {
      await orgDb.destroy();
    }
  }

  async getByDriverId(driverId: string, organizationId: string): Promise<any[]> {
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);
    
    try {
      const bus = await orgDb('buses')
        .where({ driver_id: driverId })
        .first();
      
      if (!bus) {
        return [];
      }
      
      const busWithDetails = await orgDb('buses')
        .where({ 'buses.id': bus.id })
        .leftJoin('users', 'buses.driver_id', 'users.id')
        .leftJoin('routes', 'buses.assigned_route_id', 'routes.id')
        .select(
          'buses.*',
          'users.name as driver_name',
          'users.email as driver_email',
          'routes.name as route_name'
        )
        .first();
      
      return [{
        ...busWithDetails,
        organization_id: organizationId,
        metadata: busWithDetails.metadata ? (typeof busWithDetails.metadata === 'string' ? JSON.parse(busWithDetails.metadata) : busWithDetails.metadata) : null,
      }];
    } finally {
      await orgDb.destroy();
    }
  }

  async update(id: string, data: Partial<Bus>, organizationId: string): Promise<Bus> {
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);
    
    try {
      if (data.bus_number) {
        const existing = await orgDb('buses')
          .where({ bus_number: data.bus_number })
          .whereNot({ id })
          .first();
        if (existing) {
          throw new Error('Bus number already exists');
        }
      }

      // Verify driver exists if driver_id is being updated
      if (data.driver_id) {
        const driver = await orgDb('users')
          .where({ id: data.driver_id, role: 'driver' })
          .first();
        if (!driver) {
          throw new Error('Driver not found or invalid');
        }
      }

      const updateData: any = { ...data };
      if (updateData.metadata && typeof updateData.metadata === 'object') {
        updateData.metadata = JSON.stringify(updateData.metadata);
      }

      const [updated] = await orgDb('buses')
        .where({ id })
        .update(updateData)
        .returning('*');
      
      if (!updated) {
        throw new Error('Bus not found');
      }

      logger.info({
        message: 'Bus updated',
        busId: updated.id,
      });

      return {
        ...updated,
        organization_id: organizationId,
        metadata: updated.metadata ? (typeof updated.metadata === 'string' ? JSON.parse(updated.metadata) : updated.metadata) : null,
      } as Bus;
    } finally {
      await orgDb.destroy();
    }
  }

  async delete(id: string, organizationId: string): Promise<void> {
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);
    
    try {
      const deleted = await orgDb('buses')
        .where({ id })
        .del();
      
      if (deleted === 0) {
        throw new Error('Bus not found');
      }

      logger.info({
        message: 'Bus deleted',
        busId: id,
      });
    } finally {
      await orgDb.destroy();
    }
  }

  async assignDriver(busId: string, driverId: string, organizationId: string): Promise<Bus> {
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);
    
    try {
      // Verify driver exists
      const driver = await orgDb('users')
        .where({ id: driverId, role: 'driver' })
        .first();
      if (!driver) {
        throw new Error('Driver not found or invalid');
      }

      const [updated] = await orgDb('buses')
        .where({ id: busId })
        .update({ driver_id: driverId })
        .returning('*');
      
      if (!updated) {
        throw new Error('Bus not found');
      }

      logger.info({
        message: 'Driver assigned to bus',
        busId,
        driverId,
      });

      return {
        ...updated,
        organization_id: organizationId,
        metadata: updated.metadata ? (typeof updated.metadata === 'string' ? JSON.parse(updated.metadata) : updated.metadata) : null,
      } as Bus;
    } finally {
      await orgDb.destroy();
    }
  }
}

