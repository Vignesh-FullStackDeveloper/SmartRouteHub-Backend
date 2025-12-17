import { TripRepository } from '../repositories/trip.repository';
import { BusRepository } from '../repositories/bus.repository';
import { RouteRepository } from '../repositories/route.repository';
import { NotificationService } from './notification.service';
import { LocationTrackingService } from './location-tracking.service';
import { Trip } from '../types';
import { logger } from '../config/logger';
import { db } from '../config/database';

export class TripService {
  private repository: TripRepository;
  private busRepository: BusRepository;
  private routeRepository: RouteRepository;
  private notificationService: NotificationService;
  private locationTrackingService: LocationTrackingService;

  constructor() {
    this.repository = new TripRepository();
    this.busRepository = new BusRepository();
    this.routeRepository = new RouteRepository();
    this.notificationService = new NotificationService();
    this.locationTrackingService = new LocationTrackingService();
  }

  async start(data: {
    bus_id: string;
    route_id: string;
    latitude: number;
    longitude: number;
  }, driverId: string, organizationId: string): Promise<Trip> {
    // Verify bus exists and belongs to organization
    const bus = await this.busRepository.findById(data.bus_id, organizationId);
    if (!bus) {
      throw new Error('Bus not found');
    }

    // Verify route exists
    const route = await this.routeRepository.findById(data.route_id, organizationId);
    if (!route) {
      throw new Error('Route not found');
    }

    // Check if driver is assigned to this bus
    if (bus.driver_id !== driverId) {
      throw new Error('Driver not assigned to this bus');
    }

    // Check if there's already an active trip for this bus
    const activeTrip = await this.repository.findActiveByBus(data.bus_id, organizationId);
    if (activeTrip) {
      throw new Error('Bus already has an active trip');
    }

    // Get passenger count
    const passengerCount = await this.repository.getPassengerCount(data.bus_id, organizationId);

    const trip = await this.repository.create({
      organization_id: organizationId,
      bus_id: data.bus_id,
      route_id: data.route_id,
      driver_id: driverId,
      status: 'in_progress',
      start_time: new Date(),
      current_latitude: data.latitude,
      current_longitude: data.longitude,
      last_update_time: new Date(),
      passenger_count: passengerCount,
    } as any);

    // Log initial location
    await this.repository.updateLocation(
      trip.id,
      data.latitude,
      data.longitude
    );

    // Get students assigned to this bus
    const students = await db('students')
      .where({
        assigned_bus_id: data.bus_id,
        organization_id: organizationId,
        is_active: true,
      })
      .select('id');

    const studentIds = students.map((s) => s.id);

    // Notify parents that bus has started
    if (studentIds.length > 0 && bus && route) {
      await this.notificationService.notifyBusStarted(
        organizationId,
        data.bus_id,
        data.route_id,
        trip.id,
        bus.bus_number,
        route.name,
        studentIds
      );
    }

    logger.info({
      message: 'Trip started',
      tripId: trip.id,
      busId: data.bus_id,
      driverId,
    });

    return trip;
  }

  async updateLocation(
    tripId: string,
    data: {
      latitude: number;
      longitude: number;
      speed_kmh?: number;
      heading?: number;
      accuracy?: number;
    },
    organizationId: string
  ): Promise<Trip> {
    // Verify trip exists
    const trip = await this.repository.findById(tripId, organizationId);
    if (!trip) {
      throw new Error('Trip not found');
    }

    if (trip.status !== 'in_progress') {
      throw new Error('Trip is not in progress');
    }

    const updated = await this.repository.updateLocation(
      tripId,
      data.latitude,
      data.longitude,
      data.speed_kmh,
      data.heading,
      data.accuracy
    );

    if (!updated) {
      throw new Error('Failed to update trip location');
    }

    // Process location update and check for notifications
    await this.locationTrackingService.processLocationUpdate(
      tripId,
      data.latitude,
      data.longitude
    );

    return updated;
  }

  async end(tripId: string, organizationId: string): Promise<Trip> {
    const trip = await this.repository.findById(tripId, organizationId);
    if (!trip) {
      throw new Error('Trip not found');
    }

    if (trip.status !== 'in_progress') {
      throw new Error('Trip is not in progress');
    }

    const ended = await this.repository.endTrip(tripId, organizationId);
    if (!ended) {
      throw new Error('Failed to end trip');
    }

    logger.info({
      message: 'Trip ended',
      tripId: ended.id,
    });

    return ended;
  }

  async getActive(organizationId: string): Promise<Trip[]> {
    return this.repository.findActive(organizationId);
  }

  async getById(tripId: string, organizationId: string): Promise<any> {
    const trip = await this.repository.getWithDetails(tripId, organizationId);
    if (!trip) {
      throw new Error('Trip not found');
    }
    return trip;
  }

  async getAll(organizationId: string, filters?: {
    status?: string;
    bus_id?: string;
    driver_id?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<any[]> {
    let query = db('trips')
      .where({ 'trips.organization_id': organizationId })
      .leftJoin('buses', 'trips.bus_id', 'buses.id')
      .leftJoin('routes', 'trips.route_id', 'routes.id')
      .leftJoin('users', 'trips.driver_id', 'users.id')
      .select(
        'trips.*',
        'buses.bus_number',
        'routes.name as route_name',
        'users.name as driver_name'
      )
      .orderBy('trips.start_time', 'desc');

    if (filters?.status) {
      query = query.where('trips.status', filters.status);
    }

    if (filters?.bus_id) {
      query = query.where('trips.bus_id', filters.bus_id);
    }

    if (filters?.driver_id) {
      query = query.where('trips.driver_id', filters.driver_id);
    }

    if (filters?.start_date) {
      query = query.where('trips.start_time', '>=', filters.start_date);
    }

    if (filters?.end_date) {
      query = query.where('trips.start_time', '<=', filters.end_date);
    }

    return query;
  }

  async delete(tripId: string, organizationId: string): Promise<void> {
    const trip = await this.repository.findById(tripId, organizationId);
    if (!trip) {
      throw new Error('Trip not found');
    }

    // Only allow deletion of completed trips
    if (trip.status === 'in_progress') {
      throw new Error('Cannot delete trip that is in progress. Please end the trip first.');
    }

    // Delete location tracking records first
    await db('location_tracking')
      .where({ trip_id: tripId })
      .delete();

    // Delete the trip
    const deleted = await this.repository.delete(tripId, organizationId);
    if (!deleted) {
      throw new Error('Failed to delete trip');
    }

    logger.info({
      message: 'Trip deleted',
      tripId,
    });
  }
}

