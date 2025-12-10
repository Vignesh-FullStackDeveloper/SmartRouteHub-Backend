import { UserRepository } from '../repositories/user.repository';
import { BusRepository } from '../repositories/bus.repository';
import { RouteRepository } from '../repositories/route.repository';
import { AuthService } from './auth.service';
import { User } from '../types';
import { logger } from '../config/logger';

export class DriverService {
  private userRepository: UserRepository;
  private busRepository: BusRepository;
  private routeRepository: RouteRepository;
  private authService: AuthService;

  constructor() {
    this.userRepository = new UserRepository();
    this.busRepository = new BusRepository();
    this.routeRepository = new RouteRepository();
    this.authService = new AuthService();
  }

  async create(data: {
    name: string;
    email: string;
    phone?: string;
    password: string;
    driver_id: string;
  }, organizationId: string): Promise<User> {
    // Check if email already exists
    const emailExists = await this.userRepository.checkEmailExists(data.email, organizationId);
    if (emailExists) {
      throw new Error('Email already exists');
    }

    // Check if driver_id already exists
    const driverExists = await this.userRepository.findByDriverId(data.driver_id, organizationId);
    if (driverExists) {
      throw new Error('Driver ID already exists');
    }

    const passwordHash = await this.authService.hashPassword(data.password);

    const driver = await this.userRepository.create({
      name: data.name,
      email: data.email,
      phone: data.phone,
      password_hash: passwordHash,
      driver_id: data.driver_id,
      role: 'driver',
      organization_id: organizationId,
      is_active: true,
    } as any);

    logger.info({
      message: 'Driver created',
      driverId: driver.id,
      driver_id: data.driver_id,
    });

    return driver;
  }

  async getAll(organizationId: string, filters?: {
    is_active?: boolean;
    has_bus?: boolean;
  }): Promise<any[]> {
    const drivers = await this.userRepository.findByRole('driver', organizationId, {
      is_active: filters?.is_active,
    });

    if (filters?.has_bus !== undefined) {
      const driversWithBus = await Promise.all(
        drivers.map(async (driver) => {
          const bus = await this.busRepository.findByDriverId(driver.id, organizationId);
          return { ...driver, has_bus: !!bus };
        })
      );

      return driversWithBus.filter((d) =>
        filters.has_bus ? d.has_bus : !d.has_bus
      );
    }

    return drivers;
  }

  async getById(id: string, organizationId: string): Promise<any> {
    const driver = await this.userRepository.getWithBusAndRoute(id, organizationId);
    if (!driver) {
      throw new Error('Driver not found');
    }
    return driver;
  }

  async update(id: string, data: Partial<User>, organizationId: string): Promise<User> {
    // Check email uniqueness if being updated
    if (data.email) {
      const emailExists = await this.userRepository.checkEmailExists(data.email, organizationId, id);
      if (emailExists) {
        throw new Error('Email already exists');
      }
    }

    const updated = await this.userRepository.update(id, data, organizationId);
    if (!updated) {
      throw new Error('Driver not found');
    }

    logger.info({
      message: 'Driver updated',
      driverId: updated.id,
    });

    return updated;
  }

  async getSchedule(id: string, organizationId: string): Promise<any> {
    const driver = await this.userRepository.findById(id, organizationId);
    if (!driver || driver.role !== 'driver') {
      throw new Error('Driver not found');
    }

    const bus = await this.busRepository.findByDriverId(driver.id, organizationId);
    if (!bus) {
      return {
        driver_id: driver.id,
        driver_name: driver.name,
        bus: null,
        route: null,
        message: 'No bus assigned',
      };
    }

    const route = bus.assigned_route_id
      ? await this.routeRepository.getById(bus.assigned_route_id, organizationId)
      : null;

    return {
      driver_id: driver.id,
      driver_name: driver.name,
      bus: {
        id: bus.id,
        bus_number: bus.bus_number,
        capacity: bus.capacity,
      },
      route: route ? {
        id: route.id,
        name: route.name,
        start_time: route.start_time,
        end_time: route.end_time,
        estimated_duration_minutes: route.estimated_duration_minutes,
      } : null,
    };
  }
}

