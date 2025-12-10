import { db } from '../config/database';
import { TripRepository } from '../repositories/trip.repository';
import { StudentRepository } from '../repositories/student.repository';
import { BusRepository } from '../repositories/bus.repository';
import { UserRepository } from '../repositories/user.repository';
import { logger } from '../config/logger';

export class AnalyticsService {
  private tripRepository: TripRepository;
  private studentRepository: StudentRepository;
  private busRepository: BusRepository;
  private userRepository: UserRepository;

  constructor() {
    this.tripRepository = new TripRepository();
    this.studentRepository = new StudentRepository();
    this.busRepository = new BusRepository();
    this.userRepository = new UserRepository();
  }

  async getStudentTravelHistory(
    studentId: string,
    organizationId: string,
    filters?: { start_date?: string; end_date?: string }
  ): Promise<any> {
    const student = await this.studentRepository.findById(studentId, organizationId);
    if (!student) {
      throw new Error('Student not found');
    }

    if (!student.assigned_bus_id) {
      return {
        student_id: studentId,
        student_name: student.name,
        travel_history: [],
        total_trips: 0,
      };
    }

    let query = db('trips')
      .join('buses', 'trips.bus_id', 'buses.id')
      .join('routes', 'trips.route_id', 'routes.id')
      .join('users', 'trips.driver_id', 'users.id')
      .where('buses.id', student.assigned_bus_id)
      .where('trips.organization_id', organizationId)
      .where('trips.status', 'completed')
      .select(
        'trips.id',
        'trips.start_time',
        'trips.end_time',
        'buses.bus_number',
        'routes.name as route_name',
        'users.name as driver_name',
        'users.driver_id',
        db.raw('EXTRACT(EPOCH FROM (trips.end_time - trips.start_time))/60 as duration_minutes')
      )
      .orderBy('trips.start_time', 'desc');

    if (filters?.start_date) {
      query.where('trips.start_time', '>=', filters.start_date);
    }
    if (filters?.end_date) {
      query.where('trips.start_time', '<=', filters.end_date);
    }

    const history = await query;

    return {
      student_id: studentId,
      student_name: student.name,
      travel_history: history,
      total_trips: history.length,
    };
  }

  async getBusTravelHistory(
    busId: string,
    organizationId: string,
    filters?: { start_date?: string; end_date?: string }
  ): Promise<any> {
    const bus = await this.busRepository.findById(busId, organizationId);
    if (!bus) {
      throw new Error('Bus not found');
    }

    let query = db('trips')
      .join('routes', 'trips.route_id', 'routes.id')
      .join('users', 'trips.driver_id', 'users.id')
      .where('trips.bus_id', busId)
      .where('trips.organization_id', organizationId)
      .where('trips.status', 'completed')
      .select(
        'trips.id',
        'trips.start_time',
        'trips.end_time',
        'trips.passenger_count',
        'routes.name as route_name',
        'users.name as driver_name',
        'users.driver_id',
        db.raw('EXTRACT(EPOCH FROM (trips.end_time - trips.start_time))/60 as duration_minutes')
      )
      .orderBy('trips.start_time', 'desc');

    if (filters?.start_date) {
      query.where('trips.start_time', '>=', filters.start_date);
    }
    if (filters?.end_date) {
      query.where('trips.start_time', '<=', filters.end_date);
    }

    const history = await query;

    return {
      bus_id: busId,
      bus_number: bus.bus_number,
      travel_history: history,
      total_trips: history.length,
    };
  }

  async getDriverTravelHistory(
    driverId: string,
    organizationId: string,
    filters?: { start_date?: string; end_date?: string }
  ): Promise<any> {
    const driver = await this.userRepository.findById(driverId, organizationId);
    if (!driver || driver.role !== 'driver') {
      throw new Error('Driver not found');
    }

    let query = db('trips')
      .join('buses', 'trips.bus_id', 'buses.id')
      .join('routes', 'trips.route_id', 'routes.id')
      .where('trips.driver_id', driverId)
      .where('trips.organization_id', organizationId)
      .where('trips.status', 'completed')
      .select(
        'trips.id',
        'trips.start_time',
        'trips.end_time',
        'trips.passenger_count',
        'buses.bus_number',
        'routes.name as route_name',
        db.raw('EXTRACT(EPOCH FROM (trips.end_time - trips.start_time))/60 as duration_minutes')
      )
      .orderBy('trips.start_time', 'desc');

    if (filters?.start_date) {
      query.where('trips.start_time', '>=', filters.start_date);
    }
    if (filters?.end_date) {
      query.where('trips.start_time', '<=', filters.end_date);
    }

    const history = await query;

    return {
      driver_id: driverId,
      driver_name: driver.name,
      travel_history: history,
      total_trips: history.length,
    };
  }

  async getDashboardInsights(organizationId: string): Promise<any> {
    const [totalBuses] = await db('buses')
      .where({ organization_id: organizationId, is_active: true })
      .count('* as count');

    const [totalStudents] = await db('students')
      .where({ organization_id: organizationId, is_active: true })
      .count('* as count');

    const [activeTrips] = await db('trips')
      .where({ organization_id: organizationId, status: 'in_progress' })
      .count('* as count');

    const [driversOnline] = await db('users')
      .where({ organization_id: organizationId, role: 'driver', is_active: true })
      .count('* as count');

    const recentTrips = await db('trips')
      .where({ organization_id: organizationId })
      .join('buses', 'trips.bus_id', 'buses.id')
      .join('routes', 'trips.route_id', 'routes.id')
      .select(
        'trips.id',
        'trips.status',
        'trips.start_time',
        'buses.bus_number',
        'routes.name as route_name'
      )
      .orderBy('trips.start_time', 'desc')
      .limit(10);

    return {
      stats: {
        total_buses: parseInt(totalBuses?.count as string) || 0,
        total_students: parseInt(totalStudents?.count as string) || 0,
        active_trips: parseInt(activeTrips?.count as string) || 0,
        drivers_online: parseInt(driversOnline?.count as string) || 0,
      },
      recent_trips: recentTrips,
    };
  }
}

