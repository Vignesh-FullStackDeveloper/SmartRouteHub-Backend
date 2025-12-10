import { db } from '../config/database';
import { NotificationService, NotificationType } from './notification.service';
import { logger } from '../config/logger';

interface Location {
  latitude: number;
  longitude: number;
}

export class LocationTrackingService {
  private notificationService: NotificationService;
  private readonly NEAR_STUDENT_DISTANCE = 500; // meters
  private readonly NEAR_SCHOOL_DISTANCE = 200; // meters
  private readonly CHECK_INTERVAL = 30; // seconds

  constructor() {
    this.notificationService = new NotificationService();
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  /**
   * Check if bus is near student pickup location
   */
  async checkBusNearStudents(
    tripId: string,
    busLatitude: number,
    busLongitude: number
  ): Promise<void> {
    try {
      const trip = await db('trips')
        .where({ id: tripId })
        .first();

      if (!trip || trip.status !== 'in_progress') {
        return;
      }

      // Get all students assigned to this bus
      const students = await db('students')
        .where({
          assigned_bus_id: trip.bus_id,
          organization_id: trip.organization_id,
          is_active: true,
        })
        .select('id', 'name', 'pickup_point_id');

      // Get route stops (school location is usually the last stop)
      const routeStops = await db('stops')
        .where({ route_id: trip.route_id })
        .orderBy('order');

      if (routeStops.length === 0) {
        return;
      }

      const schoolLocation = routeStops[routeStops.length - 1];

      // Check if bus is near school
      const distanceToSchool = this.calculateDistance(
        busLatitude,
        busLongitude,
        parseFloat(schoolLocation.latitude.toString()),
        parseFloat(schoolLocation.longitude.toString())
      );

      if (distanceToSchool <= this.NEAR_SCHOOL_DISTANCE) {
        // Check if we already notified for this trip
        const alreadyNotified = await db('notifications')
          .where({
            trip_id: tripId,
            type: NotificationType.BUS_ARRIVED_SCHOOL,
          })
          .first();

        if (!alreadyNotified) {
          const studentIds = students.map((s) => s.id);
          await this.notificationService.notifyBusArrivedSchool(
            trip.organization_id,
            trip.bus_id,
            trip.route_id,
            tripId,
            studentIds
          );
        }
        return;
      }

      // Check if bus is near any student pickup location
      for (const student of students) {
        if (!student.pickup_point_id) {
          continue;
        }

        const stop = await db('stops')
          .where({ id: student.pickup_point_id })
          .first();

        if (!stop) {
          continue;
        }

        const distance = this.calculateDistance(
          busLatitude,
          busLongitude,
          parseFloat(stop.latitude.toString()),
          parseFloat(stop.longitude.toString())
        );

        if (distance <= this.NEAR_STUDENT_DISTANCE) {
          // Check if we already notified for this student in this trip
          const alreadyNotified = await db('notifications')
            .where({
              trip_id: tripId,
              student_id: student.id,
              type: NotificationType.BUS_NEAR_STUDENT,
            })
            .first();

          if (!alreadyNotified) {
            // Estimate arrival time based on distance and average bus speed
            // Assuming average speed of 30 km/h = 8.33 m/s
            const averageSpeed = 8.33; // m/s
            const estimatedSeconds = distance / averageSpeed;
            const estimatedMinutes = Math.ceil(estimatedSeconds / 60);

            await this.notificationService.notifyBusNearStudent(
              trip.organization_id,
              trip.bus_id,
              trip.route_id,
              tripId,
              student.id,
              distance,
              estimatedMinutes
            );
          }
        }
      }
    } catch (error: any) {
      logger.error({
        message: 'Error checking bus near students',
        error: error.message,
        tripId,
      });
    }
  }

  /**
   * Process location update and trigger notifications
   */
  async processLocationUpdate(
    tripId: string,
    latitude: number,
    longitude: number
  ): Promise<void> {
    await this.checkBusNearStudents(tripId, latitude, longitude);
  }
}

