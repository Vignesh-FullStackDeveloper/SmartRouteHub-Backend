import { OrganizationService } from './organization.service';
import { DatabaseService } from './database.service';
import { Route, Stop } from '../types';
import { logger } from '../config/logger';

export class RouteService {
  private organizationService: OrganizationService;
  private databaseService: DatabaseService;

  constructor() {
    this.organizationService = new OrganizationService();
    this.databaseService = new DatabaseService();
  }

  async create(data: {
    name: string;
    start_time: string;
    end_time: string;
    estimated_duration_minutes?: number;
    total_distance_km?: number;
    assigned_bus_id?: string;
    route_polyline?: string;
    stops?: Array<{
      name: string;
      latitude: number;
      longitude: number;
      order: number;
      estimated_arrival_minutes?: number;
      address?: Record<string, any>;
    }>;
  }, organizationId: string): Promise<Route & { stops: Stop[] }> {
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);
    
    try {
      // Verify bus exists if assigned_bus_id is provided
      if (data.assigned_bus_id) {
        const bus = await orgDb('buses')
          .where({ id: data.assigned_bus_id })
          .first();
        if (!bus) {
          throw new Error('Bus not found or invalid');
        }
      }

      const trx = await orgDb.transaction();

      try {
        const [route] = await trx('routes')
          .insert({
            name: data.name,
            start_time: data.start_time,
            end_time: data.end_time,
            estimated_duration_minutes: data.estimated_duration_minutes || null,
            total_distance_km: data.total_distance_km || null,
            assigned_bus_id: data.assigned_bus_id || null,
            route_polyline: data.route_polyline || null,
            is_active: true,
          })
          .returning('*');

        // Sync bus.assigned_route_id if assigned_bus_id is set
        if (data.assigned_bus_id) {
          // Clear assignment from previous route if bus was assigned elsewhere
          const previousRoute = await trx('routes')
            .where({ assigned_bus_id: data.assigned_bus_id })
            .whereNot({ id: route.id })
            .first();
          if (previousRoute) {
            await trx('routes')
              .where({ id: previousRoute.id })
              .update({ assigned_bus_id: null });
          }

          // Update bus to point back to this route
          await trx('buses')
            .where({ id: data.assigned_bus_id })
            .update({ assigned_route_id: route.id });
        }

        let stops: Stop[] = [];
        if (data.stops && data.stops.length > 0) {
          const stopsToInsert = data.stops.map((stop) => ({
            route_id: route.id,
            name: stop.name,
            latitude: stop.latitude,
            longitude: stop.longitude,
            order: stop.order,
            estimated_arrival_minutes: stop.estimated_arrival_minutes || null,
            address: stop.address ? JSON.stringify(stop.address) : null,
          }));

          stops = await trx('stops')
            .insert(stopsToInsert)
            .returning('*')
            .then(results => results.map(s => ({
              ...s,
              address: s.address ? (typeof s.address === 'string' ? JSON.parse(s.address) : s.address) : null,
            })));
        }

        await trx.commit();

        logger.info({
          message: 'Route created',
          routeId: route.id,
          stopsCount: stops.length,
        });

        return {
          ...route,
          organization_id: organizationId,
          stops,
        } as Route & { stops: Stop[] };
      } catch (error) {
        await trx.rollback();
        throw error;
      }
    } finally {
      await orgDb.destroy();
    }
  }

  /**
   * Get all routes with basic filtering and pagination
   * For hierarchy filtering, use specific methods: getByBusId, getByStudentId, getByDriverId
   */
  async getAll(organizationId: string, filters?: {
    route_id?: string;
    is_active?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ data: (Route & { stops: Stop[] })[]; total: number }> {
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);
    
    try {
      let query = orgDb('routes').select('*');

      // Direct filtering only
      if (filters?.route_id) {
        query = query.where({ 'routes.id': filters.route_id });
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

      const routes = await query;
      const routesWithStops = await this.enrichRoutesWithStops(routes, organizationId, orgDb);

      return { data: routesWithStops as (Route & { stops: Stop[] })[], total };
    } finally {
      await orgDb.destroy();
    }
  }

  /**
   * Enrich routes with stops - Micro function
   */
  private async enrichRoutesWithStops(routes: any[], organizationId: string, orgDb: any): Promise<(Route & { stops: Stop[] })[]> {
    return Promise.all(
      routes.map(async (route) => {
        const stops = await orgDb('stops')
          .where({ route_id: route.id })
          .orderBy('order')
          .then((results: any[]) => results.map(s => ({
            ...s,
            address: s.address ? (typeof s.address === 'string' ? JSON.parse(s.address) : s.address) : null,
          })));

        // Auto-populate assigned_bus_id if null but a bus exists with assigned_route_id matching this route
        let assignedBusId = route.assigned_bus_id;
        if (!assignedBusId) {
          const bus = await orgDb('buses')
            .where({ assigned_route_id: route.id })
            .first();
          if (bus) {
            assignedBusId = bus.id;
          }
        }

        return {
          ...route,
          assigned_bus_id: assignedBusId,
          organization_id: organizationId,
          stops,
        };
      })
    );
  }

  async getById(id: string, organizationId: string): Promise<Route & { stops: Stop[] }> {
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);
    
    try {
      const route = await orgDb('routes')
        .where({ id })
        .first();
      
      if (!route) {
        throw new Error('Route not found');
      }

      const stops = await orgDb('stops')
        .where({ route_id: route.id })
        .orderBy('order')
        .then(results => results.map(s => ({
          ...s,
          address: s.address ? (typeof s.address === 'string' ? JSON.parse(s.address) : s.address) : null,
        })));

      // Auto-populate assigned_bus_id if null but a bus exists with assigned_route_id matching this route
      let assignedBusId = route.assigned_bus_id;
      if (!assignedBusId) {
        const bus = await orgDb('buses')
          .where({ assigned_route_id: route.id })
          .first();
        if (bus) {
          assignedBusId = bus.id;
        }
      }

      return {
        ...route,
        assigned_bus_id: assignedBusId,
        organization_id: organizationId,
        stops,
      } as Route & { stops: Stop[] };
    } finally {
      await orgDb.destroy();
    }
  }

  async update(
    id: string,
    data: Partial<Route> & {
      stops?: Array<{
        name: string;
        latitude: number;
        longitude: number;
        order: number;
        estimated_arrival_minutes?: number;
        address?: Record<string, any>;
      }>;
    },
    organizationId: string
  ): Promise<Route & { stops: Stop[] }> {
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);
    
    try {
      // Verify bus exists if assigned_bus_id is being updated
      if (data.assigned_bus_id) {
        const bus = await orgDb('buses')
          .where({ id: data.assigned_bus_id })
          .first();
        if (!bus) {
          throw new Error('Bus not found or invalid');
        }
      }

      const routeData = { ...data };
      const stops = routeData.stops;
      delete (routeData as any).stops;

      const trx = await orgDb.transaction();

      try {
        // Get current route to check for changes
        const currentRoute = await trx('routes')
          .where({ id })
          .first();

        if (!currentRoute) {
          await trx.rollback();
          throw new Error('Route not found');
        }

        const [updated] = await trx('routes')
          .where({ id })
          .update(routeData)
          .returning('*');

        if (!updated) {
          await trx.rollback();
          throw new Error('Route not found');
        }

        // Handle bidirectional sync for assigned_bus_id
        if ('assigned_bus_id' in routeData) {
          const newBusId = routeData.assigned_bus_id || null;
          const oldBusId = currentRoute.assigned_bus_id;

          if (newBusId !== oldBusId) {
            // Clear assignment from old bus if it exists
            if (oldBusId) {
              await trx('buses')
                .where({ id: oldBusId })
                .update({ assigned_route_id: null });
            }

            // Set assignment on new bus if provided
            if (newBusId) {
              // Clear assignment from previous route if bus was assigned elsewhere
              const previousRoute = await trx('routes')
                .where({ assigned_bus_id: newBusId })
                .whereNot({ id })
                .first();
              if (previousRoute) {
                await trx('routes')
                  .where({ id: previousRoute.id })
                  .update({ assigned_bus_id: null });
              }

              // Update bus to point back to this route
              await trx('buses')
                .where({ id: newBusId })
                .update({ assigned_route_id: id });
            }
          }
        }

        let updatedStops: Stop[] = [];
        if (stops !== undefined) {
          // Delete existing stops
          await trx('stops').where({ route_id: id }).del();

          // Insert new stops
          if (stops.length > 0) {
            const stopsToInsert = stops.map((stop) => ({
              route_id: id,
              name: stop.name,
              latitude: stop.latitude,
              longitude: stop.longitude,
              order: stop.order,
              estimated_arrival_minutes: stop.estimated_arrival_minutes || null,
              address: stop.address ? JSON.stringify(stop.address) : null,
            }));

            updatedStops = await trx('stops')
              .insert(stopsToInsert)
              .returning('*')
              .then(results => results.map(s => ({
                ...s,
                address: s.address ? (typeof s.address === 'string' ? JSON.parse(s.address) : s.address) : null,
              })));
          }
        } else {
          // Keep existing stops
          updatedStops = await trx('stops')
            .where({ route_id: id })
            .orderBy('order')
            .then(results => results.map(s => ({
              ...s,
              address: s.address ? (typeof s.address === 'string' ? JSON.parse(s.address) : s.address) : null,
            })));
        }

        await trx.commit();

        logger.info({
          message: 'Route updated',
          routeId: updated.id,
        });

        return {
          ...updated,
          organization_id: organizationId,
          stops: updatedStops,
        } as Route & { stops: Stop[] };
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
      const deleted = await orgDb('routes')
        .where({ id })
        .del();
      
      if (deleted === 0) {
        throw new Error('Route not found');
      }

      logger.info({
        message: 'Route deleted',
        routeId: id,
      });
    } finally {
      await orgDb.destroy();
    }
  }

  /**
   * Get routes by bus ID - Micro function
   * Finds routes where either route.assigned_bus_id = busId OR bus.assigned_route_id = route.id
   */
  async getByBusId(busId: string, organizationId: string, pagination?: {
    limit?: number;
    offset?: number;
  }): Promise<{ data: (Route & { stops: Stop[] })[]; total: number }> {
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);
    
    try {
      // Find routes where either:
      // 1. route.assigned_bus_id = busId (route has bus assigned)
      // 2. OR bus.assigned_route_id = route.id (bus is assigned to route)
      let query = orgDb('routes')
        .where(function() {
          this.where({ assigned_bus_id: busId })
            .orWhereIn('id', function() {
              this.select('assigned_route_id')
                .from('buses')
                .where({ id: busId })
                .whereNotNull('assigned_route_id');
            });
        });

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

      const routes = await query;
      const routesWithStops = await this.enrichRoutesWithStops(routes, organizationId, orgDb);

      return { data: routesWithStops as (Route & { stops: Stop[] })[], total };
    } finally {
      await orgDb.destroy();
    }
  }

  /**
   * Get route by student ID - Micro function
   * Uses hierarchy: student -> route (direct assignment)
   */
  async getByStudentId(studentId: string, organizationId: string): Promise<{ data: (Route & { stops: Stop[] })[]; total: number }> {
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);
    
    try {
      // Get student's route ID
      const student = await orgDb('students')
        .where({ id: studentId })
        .select('assigned_route_id')
        .first();
      
      if (!student?.assigned_route_id) {
        return { data: [], total: 0 };
      }

      // Get route with stops
      const route = await orgDb('routes')
        .where({ id: student.assigned_route_id })
        .first();

      if (!route) {
        return { data: [], total: 0 };
      }

      const stops = await orgDb('stops')
        .where({ route_id: route.id })
        .orderBy('order')
        .then((results: any[]) => results.map(s => ({
          ...s,
          address: s.address ? (typeof s.address === 'string' ? JSON.parse(s.address) : s.address) : null,
        })));

      // Auto-populate assigned_bus_id if null but a bus exists with assigned_route_id matching this route
      let assignedBusId = route.assigned_bus_id;
      if (!assignedBusId) {
        const bus = await orgDb('buses')
          .where({ assigned_route_id: route.id })
          .first();
        if (bus) {
          assignedBusId = bus.id;
        }
      }

      const routeWithStops = {
        ...route,
        assigned_bus_id: assignedBusId,
        organization_id: organizationId,
        stops,
      };

      return { data: [routeWithStops] as (Route & { stops: Stop[] })[], total: 1 };
    } finally {
      await orgDb.destroy();
    }
  }

  /**
   * Get routes by multiple student IDs - Micro function
   * Returns unique routes assigned to the given students
   */
  /**
   * Find route by stop ID (pickup point)
   * Returns the route that contains the given stop ID
   */
  async findByStopId(stopId: string, organizationId: string): Promise<Route & { stops: Stop[] } | null> {
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);
    
    try {
      // Find the stop first
      const stop = await orgDb('stops')
        .where({ id: stopId })
        .first();
      
      if (!stop) {
        return null;
      }

      // Get the route that contains this stop
      const route = await orgDb('routes')
        .where({ id: stop.route_id })
        .first();

      if (!route) {
        return null;
      }

      // Get all stops for this route
      const stops = await orgDb('stops')
        .where({ route_id: route.id })
        .orderBy('order')
        .then((results: any[]) => results.map(s => ({
          ...s,
          address: s.address ? (typeof s.address === 'string' ? JSON.parse(s.address) : s.address) : null,
        })));

      // Auto-populate assigned_bus_id if null but a bus exists with assigned_route_id matching this route
      let assignedBusId = route.assigned_bus_id;
      if (!assignedBusId) {
        const bus = await orgDb('buses')
          .where({ assigned_route_id: route.id })
          .first();
        if (bus) {
          assignedBusId = bus.id;
        }
      }

      return {
        ...route,
        assigned_bus_id: assignedBusId,
        organization_id: organizationId,
        stops,
      } as Route & { stops: Stop[] };
    } finally {
      await orgDb.destroy();
    }
  }

  async getRoutesByStudentIds(studentIds: string[], organizationId: string, pagination?: {
    limit?: number;
    offset?: number;
  }): Promise<{ data: (Route & { stops: Stop[] })[]; total: number }> {
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);
    
    try {
      // Get unique route IDs from students
      const students = await orgDb('students')
        .whereIn('id', studentIds)
        .whereNotNull('assigned_route_id')
        .select('assigned_route_id')
        .distinct();
      
      const routeIds = students.map(s => s.assigned_route_id).filter(Boolean);
      
      if (routeIds.length === 0) {
        return { data: [], total: 0 };
      }

      // Get routes with stops
      let query = orgDb('routes')
        .whereIn('routes.id', routeIds);

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

      const routes = await query;
      const routesWithStops = await this.enrichRoutesWithStops(routes, organizationId, orgDb);

      return { data: routesWithStops as (Route & { stops: Stop[] })[], total };
    } finally {
      await orgDb.destroy();
    }
  }

  /**
   * Get routes by driver ID - Micro function
   * Uses hierarchy: driver -> bus -> routes
   */
  async getByDriverId(driverId: string, organizationId: string, pagination?: {
    limit?: number;
    offset?: number;
  }): Promise<{ data: (Route & { stops: Stop[] })[]; total: number }> {
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);
    
    try {
      // Step 1: Get bus IDs for this driver
      const buses = await orgDb('buses')
        .where({ driver_id: driverId })
        .select('id');
      
      const busIds = buses.map(b => b.id).filter(Boolean);
      
      if (busIds.length === 0) {
        return { data: [], total: 0 };
      }

      // Step 2: Get routes for these buses
      // Find routes where either:
      // 1. route.assigned_bus_id is in busIds (route has bus assigned)
      // 2. OR bus.assigned_route_id = route.id AND bus.id is in busIds (bus is assigned to route)
      let query = orgDb('routes')
        .where(function() {
          this.whereIn('assigned_bus_id', busIds)
            .orWhereIn('id', function() {
              this.select('assigned_route_id')
                .from('buses')
                .whereIn('id', busIds)
                .whereNotNull('assigned_route_id');
            });
        });

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

      const routes = await query;
      const routesWithStops = await this.enrichRoutesWithStops(routes, organizationId, orgDb);

      return { data: routesWithStops as (Route & { stops: Stop[] })[], total };
    } finally {
      await orgDb.destroy();
    }
  }
}

