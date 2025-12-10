import { db } from '../config/database';
import { Trip, LocationTracking } from '../types';
import { BaseRepository } from './base.repository';

export class TripRepository extends BaseRepository<Trip> {
  constructor() {
    super('trips');
  }

  async findActive(organizationId: string): Promise<Trip[]> {
    return this.db('trips')
      .where({ organization_id: organizationId, status: 'in_progress' })
      .leftJoin('buses', 'trips.bus_id', 'buses.id')
      .leftJoin('routes', 'trips.route_id', 'routes.id')
      .leftJoin('users', 'trips.driver_id', 'users.id')
      .select(
        'trips.*',
        'buses.bus_number',
        'routes.name as route_name',
        'users.name as driver_name'
      );
  }

  async findActiveByBus(busId: string, organizationId: string): Promise<Trip | null> {
    return this.db('trips')
      .where({
        bus_id: busId,
        organization_id: organizationId,
        status: 'in_progress',
      })
      .first() || null;
  }

  async findActiveByDriver(driverId: string, organizationId: string): Promise<Trip | null> {
    return this.db('trips')
      .where({
        driver_id: driverId,
        organization_id: organizationId,
        status: 'in_progress',
      })
      .first() || null;
  }

  async updateLocation(
    tripId: string,
    latitude: number,
    longitude: number,
    speed?: number,
    heading?: number,
    accuracy?: number
  ): Promise<Trip | null> {
    const trx = await db.transaction();

    try {
      // Update trip
      const [updated] = await trx('trips')
        .where({ id: tripId })
        .update({
          current_latitude: latitude,
          current_longitude: longitude,
          speed_kmh: speed,
          last_update_time: db.fn.now(),
        })
        .returning('*');

      // Log location
      await trx('location_tracking').insert({
        trip_id: tripId,
        latitude,
        longitude,
        speed_kmh: speed,
        heading,
        accuracy,
        recorded_at: db.fn.now(),
      });

      await trx.commit();
      return updated || null;
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  async getLocationHistory(tripId: string, limit: number = 100): Promise<LocationTracking[]> {
    return this.db('location_tracking')
      .where({ trip_id: tripId })
      .orderBy('recorded_at', 'desc')
      .limit(limit);
  }

  async getWithDetails(tripId: string, organizationId: string): Promise<any> {
    const trip = await this.db('trips')
      .where({ 'trips.id': tripId, 'trips.organization_id': organizationId })
      .leftJoin('buses', 'trips.bus_id', 'buses.id')
      .leftJoin('routes', 'trips.route_id', 'routes.id')
      .leftJoin('users', 'trips.driver_id', 'users.id')
      .select(
        'trips.*',
        'buses.bus_number',
        'routes.name as route_name',
        'users.name as driver_name'
      )
      .first();

    if (!trip) {
      return null;
    }

    const locationHistory = await this.getLocationHistory(tripId);
    return { ...trip, location_history: locationHistory };
  }

  async endTrip(tripId: string, organizationId: string): Promise<Trip | null> {
    return this.update(
      tripId,
      {
        status: 'completed',
        end_time: db.fn.now() as any,
      },
      organizationId
    );
  }

  async getPassengerCount(busId: string, organizationId: string): Promise<number> {
    const result = await db('students')
      .where({ assigned_bus_id: busId, organization_id: organizationId, is_active: true })
      .count('* as count')
      .first();
    return parseInt(result?.count as string) || 0;
  }
}

