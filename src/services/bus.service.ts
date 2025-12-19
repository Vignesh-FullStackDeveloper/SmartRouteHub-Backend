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

      // Verify route exists if assigned_route_id is provided
      if (data.assigned_route_id) {
        const route = await orgDb('routes')
          .where({ id: data.assigned_route_id })
          .first();
        if (!route) {
          throw new Error('Route not found or invalid');
        }
      }

      const trx = await orgDb.transaction();

      try {
        const [bus] = await trx('buses')
          .insert({
            bus_number: data.bus_number,
            capacity: data.capacity,
            driver_id: data.driver_id || null,
            assigned_route_id: data.assigned_route_id || null,
            metadata: data.metadata ? JSON.stringify(data.metadata) : null,
            is_active: data.is_active !== undefined ? data.is_active : true,
          })
          .returning('*');

        // Sync route.assigned_bus_id if assigned_route_id is set
        if (data.assigned_route_id) {
          // Clear assignment from previous bus if route was assigned elsewhere
          const previousBus = await trx('buses')
            .where({ assigned_route_id: data.assigned_route_id })
            .whereNot({ id: bus.id })
            .first();
          if (previousBus) {
            await trx('buses')
              .where({ id: previousBus.id })
              .update({ assigned_route_id: null });
          }

          // Update route to point back to this bus
          await trx('routes')
            .where({ id: data.assigned_route_id })
            .update({ assigned_bus_id: bus.id });
        }

        await trx.commit();

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
      } catch (error) {
        await trx.rollback();
        throw error;
      }
    } finally {
      await orgDb.destroy();
    }
  }

  /**
   * Get all buses with basic filtering and pagination
   * For hierarchy filtering, use specific methods: getByDriverId, getByRouteId, getByStudentId
   */
  async getAll(organizationId: string, filters?: {
    bus_id?: string;
    is_active?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ data: any[]; total: number }> {
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);
    
    try {
      let query = orgDb('buses').select('*');

      // Direct filtering only
      if (filters?.bus_id) {
        query = query.where({ 'buses.id': filters.bus_id });
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

      const buses = await query;
      
      // Enrich with driver and route information
      const busesWithDetails = await this.enrichBusesWithDetails(buses, organizationId, orgDb);

      return { data: busesWithDetails, total };
    } finally {
      await orgDb.destroy();
    }
  }

  /**
   * Enrich buses with driver and route details - Micro function
   */
  private async enrichBusesWithDetails(buses: any[], organizationId: string, orgDb: any): Promise<any[]> {
    return Promise.all(
      buses.map(async (bus) => {
        const busWithDetails = await orgDb('buses')
          .where({ 'buses.id': bus.id })
          .leftJoin('users', 'buses.driver_id', 'users.id')
          .leftJoin('routes', 'buses.assigned_route_id', 'routes.id')
          .select(
            'buses.*',
            'users.name as driver_name',
            'users.email as driver_email',
            'users.id as driver_user_id',
            'routes.name as route_name',
            'routes.id as route_id'
          )
          .first();
        
        return {
          ...busWithDetails,
          organization_id: organizationId,
          metadata: busWithDetails.metadata ? (typeof busWithDetails.metadata === 'string' ? JSON.parse(busWithDetails.metadata) : busWithDetails.metadata) : null,
        };
      })
    );
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

  /**
   * Get buses by driver ID - Micro function
   */
  async getByDriverId(driverId: string, organizationId: string, pagination?: {
    limit?: number;
    offset?: number;
  }): Promise<{ data: any[]; total: number }> {
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);
    
    try {
      let query = orgDb('buses').where({ driver_id: driverId });

      // Get total count
      const countResult = await query.clone().count('* as total').first();
      const total = parseInt(countResult?.total as string) || 0;

      // Apply pagination if provided
      if (pagination?.offset !== undefined) {
        query = query.offset(pagination.offset);
      }
      if (pagination?.limit !== undefined) {
        query = query.limit(pagination.limit);
      }

      const buses = await query;
      const busesWithDetails = await this.enrichBusesWithDetails(buses, organizationId, orgDb);
      
      return { data: busesWithDetails, total };
    } finally {
      await orgDb.destroy();
    }
  }

  /**
   * Get bus by student ID - Micro function
   * Uses hierarchy: student -> bus (direct assignment)
   */
  async getByStudentId(studentId: string, organizationId: string): Promise<{ data: any[]; total: number }> {
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);
    
    try {
      // Get student's bus ID
      const student = await orgDb('students')
        .where({ id: studentId })
        .select('assigned_bus_id')
        .first();
      
      if (!student?.assigned_bus_id) {
        return { data: [], total: 0 };
      }

      // Get bus with details
      const bus = await orgDb('buses')
        .where({ 'buses.id': student.assigned_bus_id })
        .leftJoin('users', 'buses.driver_id', 'users.id')
        .leftJoin('routes', 'buses.assigned_route_id', 'routes.id')
        .select(
          'buses.*',
          'users.name as driver_name',
          'users.email as driver_email',
          'users.id as driver_user_id',
          'routes.name as route_name',
          'routes.id as route_id'
        )
        .first();
      
      if (!bus) {
        return { data: [], total: 0 };
      }

      const busWithDetails = {
        ...bus,
        organization_id: organizationId,
        metadata: bus.metadata ? (typeof bus.metadata === 'string' ? JSON.parse(bus.metadata) : bus.metadata) : null,
      };

      return { data: [busWithDetails], total: 1 };
    } finally {
      await orgDb.destroy();
    }
  }

  /**
   * Get buses by route ID - Micro function
   */
  async getByRouteId(routeId: string, organizationId: string, pagination?: {
    limit?: number;
    offset?: number;
  }): Promise<{ data: any[]; total: number }> {
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);
    
    try {
      let query = orgDb('buses').where({ assigned_route_id: routeId });

      // Get total count
      const countResult = await query.clone().count('* as total').first();
      const total = parseInt(countResult?.total as string) || 0;

      // Apply pagination if provided
      if (pagination?.offset !== undefined) {
        query = query.offset(pagination.offset);
      }
      if (pagination?.limit !== undefined) {
        query = query.limit(pagination.limit);
      }

      const buses = await query;
      const busesWithDetails = await this.enrichBusesWithDetails(buses, organizationId, orgDb);
      
      return { data: busesWithDetails, total };
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

      // Verify route exists if assigned_route_id is being updated
      if (data.assigned_route_id !== undefined) {
        if (data.assigned_route_id) {
          const route = await orgDb('routes')
            .where({ id: data.assigned_route_id })
            .first();
          if (!route) {
            throw new Error('Route not found or invalid');
          }
        }
      }

      const trx = await orgDb.transaction();

      try {
        // Get current bus to check for changes
        const currentBus = await trx('buses')
          .where({ id })
          .first();

        if (!currentBus) {
          await trx.rollback();
          throw new Error('Bus not found');
        }

        const updateData: any = { ...data };
        if (updateData.metadata && typeof updateData.metadata === 'object') {
          updateData.metadata = JSON.stringify(updateData.metadata);
        }

        const [updated] = await trx('buses')
          .where({ id })
          .update(updateData)
          .returning('*');
        
        if (!updated) {
          await trx.rollback();
          throw new Error('Bus not found');
        }

        // Handle bidirectional sync for assigned_route_id
        if ('assigned_route_id' in data) {
          const newRouteId = data.assigned_route_id || null;
          const oldRouteId = currentBus.assigned_route_id;

          if (newRouteId !== oldRouteId) {
            // Clear assignment from old route if it exists
            if (oldRouteId) {
              await trx('routes')
                .where({ id: oldRouteId })
                .update({ assigned_bus_id: null });
            }

            // Set assignment on new route if provided
            if (newRouteId) {
              // Clear assignment from previous bus if route was assigned elsewhere
              const previousBus = await trx('buses')
                .where({ assigned_route_id: newRouteId })
                .whereNot({ id })
                .first();
              if (previousBus) {
                await trx('buses')
                  .where({ id: previousBus.id })
                  .update({ assigned_route_id: null });
              }

              // Update route to point back to this bus
              await trx('routes')
                .where({ id: newRouteId })
                .update({ assigned_bus_id: id });
            }
          }
        }

        await trx.commit();

        logger.info({
          message: 'Bus updated',
          busId: updated.id,
        });

        return {
          ...updated,
          organization_id: organizationId,
          metadata: updated.metadata ? (typeof updated.metadata === 'string' ? JSON.parse(updated.metadata) : updated.metadata) : null,
        } as Bus;
      } catch (error) {
        await trx.rollback();
        throw error;
      }
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

  /**
   * Get buses by multiple student IDs - Micro function
   * Returns unique buses assigned to the given students
   */
  async getBusesByStudentIds(studentIds: string[], organizationId: string, pagination?: {
    limit?: number;
    offset?: number;
  }): Promise<{ data: any[]; total: number }> {
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);
    
    try {
      // Get unique bus IDs from students
      const students = await orgDb('students')
        .whereIn('id', studentIds)
        .whereNotNull('assigned_bus_id')
        .select('assigned_bus_id')
        .distinct();
      
      const busIds = students.map(s => s.assigned_bus_id).filter(Boolean);
      
      if (busIds.length === 0) {
        return { data: [], total: 0 };
      }

      // Get buses with details
      let query = orgDb('buses')
        .whereIn('buses.id', busIds)
        .leftJoin('users', 'buses.driver_id', 'users.id')
        .leftJoin('routes', 'buses.assigned_route_id', 'routes.id')
        .select(
          'buses.*',
          'users.name as driver_name',
          'users.email as driver_email',
          'users.id as driver_user_id',
          'routes.name as route_name',
          'routes.id as route_id'
        );

      // Get total count
      const countResult = await query.clone().count('* as total').first();
      const total = parseInt(countResult?.total as string) || 0;

      // Apply pagination if provided
      if (pagination?.offset !== undefined) {
        query = query.offset(pagination.offset);
      }
      if (pagination?.limit !== undefined) {
        query = query.limit(pagination.limit);
      }

      const buses = await query;

      const data = buses.map(bus => ({
        ...bus,
        organization_id: organizationId,
        metadata: bus.metadata ? (typeof bus.metadata === 'string' ? JSON.parse(bus.metadata) : bus.metadata) : null,
      }));

      return { data, total };
    } finally {
      await orgDb.destroy();
    }
  }
}

