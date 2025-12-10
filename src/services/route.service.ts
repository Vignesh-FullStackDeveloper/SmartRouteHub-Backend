import { RouteRepository } from '../repositories/route.repository';
import { Route, Stop } from '../types';
import { logger } from '../config/logger';

export class RouteService {
  private repository: RouteRepository;

  constructor() {
    this.repository = new RouteRepository();
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
    const routeData = {
      ...data,
      organization_id: organizationId,
      is_active: true,
    };
    delete (routeData as any).stops;

    const route = await this.repository.createWithStops(
      routeData as any,
      data.stops || []
    );

    logger.info({
      message: 'Route created',
      routeId: route.id,
      stopsCount: route.stops.length,
    });

    return route;
  }

  async getAll(organizationId: string, filters?: {
    is_active?: boolean;
    bus_id?: string;
  }): Promise<(Route & { stops: Stop[] })[]> {
    return this.repository.getAllWithStops(organizationId, filters);
  }

  async getById(id: string, organizationId: string): Promise<Route & { stops: Stop[] }> {
    const route = await this.repository.getWithStops(id, organizationId);
    if (!route) {
      throw new Error('Route not found');
    }
    return route;
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
    const routeData = { ...data };
    const stops = routeData.stops;
    delete (routeData as any).stops;

    const route = await this.repository.updateWithStops(
      id,
      routeData as any,
      stops !== undefined ? stops : null,
      organizationId
    );

    logger.info({
      message: 'Route updated',
      routeId: route.id,
    });

    return route;
  }

  async delete(id: string, organizationId: string): Promise<void> {
    const deleted = await this.repository.delete(id, organizationId);
    if (!deleted) {
      throw new Error('Route not found');
    }

    logger.info({
      message: 'Route deleted',
      routeId: id,
    });
  }
}

