import { BusRepository } from '../repositories/bus.repository';
import { RouteRepository } from '../repositories/route.repository';
import { OrganizationService } from './organization.service';
import { DatabaseService } from './database.service';
import { AuthService } from './auth.service';
import { User } from '../types';
import { logger } from '../config/logger';

export class DriverService {
  private busRepository: BusRepository;
  private routeRepository: RouteRepository;
  private organizationService: OrganizationService;
  private databaseService: DatabaseService;
  private authService: AuthService;

  constructor() {
    this.busRepository = new BusRepository();
    this.routeRepository = new RouteRepository();
    this.organizationService = new OrganizationService();
    this.databaseService = new DatabaseService();
    this.authService = new AuthService();
  }

  async create(data: {
    name: string;
    email: string;
    phone?: string;
    password: string;
    driver_id: string;
  }, organizationId: string): Promise<User> {
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);
    
    try {
      // Check if email already exists
      const existingEmail = await orgDb('users')
        .where({ email: data.email })
        .first();
      if (existingEmail) {
        throw new Error('Email already exists');
      }

      // Check if driver_id already exists
      const existingDriver = await orgDb('users')
        .where({ driver_id: data.driver_id, role: 'driver' })
        .first();
      if (existingDriver) {
        throw new Error('Driver ID already exists');
      }

      const passwordHash = await this.authService.hashPassword(data.password);

      const [driver] = await orgDb('users')
        .insert({
          name: data.name,
          email: data.email,
          phone: data.phone || null,
          password_hash: passwordHash,
          driver_id: data.driver_id,
          role: 'driver',
          is_active: true,
        })
        .returning('*');

      logger.info({
        message: 'Driver created',
        driverId: driver.id,
        driver_id: data.driver_id,
      });

      return {
        ...driver,
        organization_id: organizationId,
      } as User;
    } finally {
      await orgDb.destroy();
    }
  }

  /**
   * Get all drivers with basic filtering and pagination
   * For hierarchy filtering, use specific methods: getByBusId, getByStudentId, getByRouteId
   */
  async getAll(organizationId: string, filters?: {
    driver_id?: string;
    is_active?: boolean;
    has_bus?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ data: any[]; total: number }> {
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);
    
    try {
      let query = orgDb('users').where({ role: 'driver' });

      // Direct filtering only
      if (filters?.driver_id) {
        query = query.where({ 'users.id': filters.driver_id });
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

      const drivers = await query;
      
      // Add organization_id to each driver for consistency
      let driversWithOrg = drivers.map(driver => ({
        ...driver,
        organization_id: organizationId,
      }));

      if (filters?.has_bus !== undefined) {
        const driversWithBus = await Promise.all(
          driversWithOrg.map(async (driver) => {
            const bus = await this.busRepository.findByDriverId(driver.id, organizationId);
            return { ...driver, has_bus: !!bus };
          })
        );

        const filtered = driversWithBus.filter((d) =>
          filters.has_bus ? d.has_bus : !d.has_bus
        );
        return { data: filtered, total: filtered.length };
      }

      return { data: driversWithOrg, total };
    } finally {
      await orgDb.destroy();
    }
  }

  /**
   * Get driver by bus ID - Micro function
   * Uses hierarchy: bus -> driver
   */
  async getByBusId(busId: string, organizationId: string): Promise<{ data: any[]; total: number }> {
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);
    
    try {
      // Get bus's driver ID
      const bus = await orgDb('buses')
        .where({ id: busId })
        .select('driver_id')
        .first();
      
      if (!bus?.driver_id) {
        return { data: [], total: 0 };
      }

      // Get driver
      const driver = await orgDb('users')
        .where({ id: bus.driver_id, role: 'driver' })
        .first();
      
      if (!driver) {
        return { data: [], total: 0 };
      }

      const driverWithOrg = {
        ...driver,
        organization_id: organizationId,
      };

      return { data: [driverWithOrg], total: 1 };
    } finally {
      await orgDb.destroy();
    }
  }

  /**
   * Get driver by student ID - Micro function
   * Uses hierarchy: student -> bus -> driver
   */
  async getByStudentId(studentId: string, organizationId: string): Promise<{ data: any[]; total: number }> {
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);
    
    try {
      // Step 1: Get student's bus ID
      const student = await orgDb('students')
        .where({ id: studentId })
        .select('assigned_bus_id')
        .first();
      
      if (!student?.assigned_bus_id) {
        return { data: [], total: 0 };
      }

      // Step 2: Get bus's driver ID
      const bus = await orgDb('buses')
        .where({ id: student.assigned_bus_id })
        .select('driver_id')
        .first();
      
      if (!bus?.driver_id) {
        return { data: [], total: 0 };
      }

      // Step 3: Get driver
      const driver = await orgDb('users')
        .where({ id: bus.driver_id, role: 'driver' })
        .first();
      
      if (!driver) {
        return { data: [], total: 0 };
      }

      const driverWithOrg = {
        ...driver,
        organization_id: organizationId,
      };

      return { data: [driverWithOrg], total: 1 };
    } finally {
      await orgDb.destroy();
    }
  }

  /**
   * Get driver by route ID - Micro function
   * Uses hierarchy: route -> bus -> driver
   */
  async getByRouteId(routeId: string, organizationId: string): Promise<{ data: any[]; total: number }> {
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);
    
    try {
      // Step 1: Get route's bus ID
      const route = await orgDb('routes')
        .where({ id: routeId })
        .select('assigned_bus_id')
        .first();
      
      if (!route?.assigned_bus_id) {
        return { data: [], total: 0 };
      }

      // Step 2: Get bus's driver ID
      const bus = await orgDb('buses')
        .where({ id: route.assigned_bus_id })
        .select('driver_id')
        .first();
      
      if (!bus?.driver_id) {
        return { data: [], total: 0 };
      }

      // Step 3: Get driver
      const driver = await orgDb('users')
        .where({ id: bus.driver_id, role: 'driver' })
        .first();
      
      if (!driver) {
        return { data: [], total: 0 };
      }

      const driverWithOrg = {
        ...driver,
        organization_id: organizationId,
      };

      return { data: [driverWithOrg], total: 1 };
    } finally {
      await orgDb.destroy();
    }
  }

  async getById(id: string, organizationId: string): Promise<any> {
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);
    
    try {
      const driver = await orgDb('users')
        .where({ 'users.id': id, 'users.role': 'driver' })
        .leftJoin('buses', 'users.id', 'buses.driver_id')
        .leftJoin('routes', 'buses.assigned_route_id', 'routes.id')
        .select(
          'users.*',
          'buses.id as assigned_bus_id',
          'buses.bus_number as assigned_bus_number',
          'routes.id as assigned_route_id',
          'routes.name as assigned_route_name'
        )
        .first();
      
      if (!driver) {
        throw new Error('Driver not found');
      }
      
      return {
        ...driver,
        organization_id: organizationId,
      };
    } finally {
      await orgDb.destroy();
    }
  }

  async update(id: string, data: Partial<User>, organizationId: string): Promise<User> {
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);
    
    try {
      // Check email uniqueness if being updated
      if (data.email) {
        const existingEmail = await orgDb('users')
          .where({ email: data.email })
          .whereNot({ id })
          .first();
        if (existingEmail) {
          throw new Error('Email already exists');
        }
      }

      const [updated] = await orgDb('users')
        .where({ id, role: 'driver' })
        .update(data)
        .returning('*');
      
      if (!updated) {
        throw new Error('Driver not found');
      }

      logger.info({
        message: 'Driver updated',
        driverId: updated.id,
      });

      return {
        ...updated,
        organization_id: organizationId,
      } as User;
    } finally {
      await orgDb.destroy();
    }
  }

  async getSchedule(id: string, organizationId: string): Promise<any> {
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);
    
    try {
      const driver = await orgDb('users')
        .where({ id, role: 'driver' })
        .first();
      
      if (!driver) {
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
        ? await this.routeRepository.findById(bus.assigned_route_id, organizationId)
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
    } finally {
      await orgDb.destroy();
    }
  }

  async delete(id: string, organizationId: string): Promise<void> {
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);
    
    try {
      const driver = await orgDb('users')
        .where({ id, role: 'driver' })
        .first();
      
      if (!driver) {
        throw new Error('Driver not found');
      }

      // Check if driver is assigned to a bus
      const bus = await this.busRepository.findByDriverId(driver.id, organizationId);
      if (bus) {
        throw new Error('Cannot delete driver: Driver is assigned to a bus. Please unassign the bus first.');
      }

      const deleted = await orgDb('users')
        .where({ id, role: 'driver' })
        .del();
      
      if (deleted === 0) {
        throw new Error('Failed to delete driver');
      }

      logger.info({
        message: 'Driver deleted',
        driverId: id,
      });
    } finally {
      await orgDb.destroy();
    }
  }
}

