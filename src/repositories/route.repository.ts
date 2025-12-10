import { db } from '../config/database';
import { Route, Stop } from '../types';
import { BaseRepository } from './base.repository';

export class RouteRepository extends BaseRepository<Route> {
  constructor() {
    super('routes');
  }

  async createWithStops(routeData: Partial<Route>, stops: Partial<Stop>[]): Promise<Route & { stops: Stop[] }> {
    const trx = await db.transaction();

    try {
      const [route] = await trx('routes')
        .insert(routeData)
        .returning('*');

      if (stops && stops.length > 0) {
        await trx('stops').insert(
          stops.map((stop) => ({
            ...stop,
            route_id: route.id,
          }))
        );
      }

      await trx.commit();

      const routeStops = await db('stops')
        .where({ route_id: route.id })
        .orderBy('order');

      return { ...route, stops: routeStops };
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  async updateWithStops(
    routeId: string,
    routeData: Partial<Route>,
    stops: Partial<Stop>[] | null,
    organizationId: string
  ): Promise<Route & { stops: Stop[] }> {
    const trx = await db.transaction();

    try {
      const [updated] = await trx('routes')
        .where({ id: routeId, organization_id: organizationId })
        .update(routeData)
        .returning('*');

      if (!updated) {
        await trx.rollback();
        throw new Error('Route not found');
      }

      if (stops !== null) {
        // Delete existing stops
        await trx('stops').where({ route_id: routeId }).del();

        // Insert new stops
        if (stops.length > 0) {
          await trx('stops').insert(
            stops.map((stop) => ({
              ...stop,
              route_id: routeId,
            }))
          );
        }
      }

      await trx.commit();

      const routeStops = await db('stops')
        .where({ route_id: routeId })
        .orderBy('order');

      return { ...updated, stops: routeStops };
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  async getWithStops(routeId: string, organizationId: string): Promise<(Route & { stops: Stop[] }) | null> {
    const route = await this.findById(routeId, organizationId);
    if (!route) {
      return null;
    }

    const stops = await db('stops')
      .where({ route_id: routeId })
      .orderBy('order');

    return { ...route, stops };
  }

  async getAllWithStops(organizationId: string, filters?: Record<string, any>): Promise<(Route & { stops: Stop[] })[]> {
    const query = db('routes').where({ organization_id: organizationId });
    if (filters) {
      query.where(filters);
    }
    const routes = await query;

    const routesWithStops = await Promise.all(
      routes.map(async (route) => {
        const stops = await db('stops')
          .where({ route_id: route.id })
          .orderBy('order');
        return { ...route, stops };
      })
    );

    return routesWithStops;
  }
}

