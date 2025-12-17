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

  async getAll(organizationId: string, filters?: {
    is_active?: boolean;
    bus_id?: string;
  }): Promise<(Route & { stops: Stop[] })[]> {
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);
    
    try {
      let query = orgDb('routes').select('*');

      if (filters?.is_active !== undefined) {
        query = query.where({ is_active: filters.is_active });
      }
      if (filters?.bus_id) {
        query = query.where({ assigned_bus_id: filters.bus_id });
      }

      const routes = await query;

      const routesWithStops = await Promise.all(
        routes.map(async (route) => {
          const stops = await orgDb('stops')
            .where({ route_id: route.id })
            .orderBy('order')
            .then(results => results.map(s => ({
              ...s,
              address: s.address ? (typeof s.address === 'string' ? JSON.parse(s.address) : s.address) : null,
            })));

          return {
            ...route,
            organization_id: organizationId,
            stops,
          };
        })
      );

      return routesWithStops as (Route & { stops: Stop[] })[];
    } finally {
      await orgDb.destroy();
    }
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

      return {
        ...route,
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
        const [updated] = await trx('routes')
          .where({ id })
          .update(routeData)
          .returning('*');

        if (!updated) {
          await trx.rollback();
          throw new Error('Route not found');
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
}

