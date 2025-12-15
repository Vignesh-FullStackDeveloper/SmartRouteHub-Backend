import { BusRepository } from '../repositories/bus.repository';
import { Bus } from '../types';
import { logger } from '../config/logger';

export class BusService {
  private repository: BusRepository;

  constructor() {
    this.repository = new BusRepository();
  }

  async create(data: {
    bus_number: string;
    capacity: number;
    driver_id?: string;
    assigned_route_id?: string;
    metadata?: Record<string, any>;
  }, organizationId: string): Promise<Bus> {
    const exists = await this.repository.checkBusNumberExists(data.bus_number, organizationId);
    if (exists) {
      throw new Error('Bus number already exists');
    }

    const bus = await this.repository.create({
      ...data,
      organization_id: organizationId,
      is_active: true,
    } as any);

    logger.info({
      message: 'Bus created',
      busId: bus.id,
      busNumber: bus.bus_number,
    });

    return bus;
  }

  async getAll(organizationId: string, filters?: {
    is_active?: boolean;
    driver_id?: string;
  }): Promise<any[]> {
    const buses = await this.repository.findAll(organizationId, filters);
    
    return Promise.all(
      buses.map(async (bus) => {
        if (bus.driver_id) {
          return this.repository.getWithDriverAndRoute(bus.id, organizationId);
        }
        return bus;
      })
    );
  }

  async getById(id: string, organizationId: string): Promise<any> {
    const bus = await this.repository.getWithDriverAndRoute(id, organizationId);
    if (!bus) {
      throw new Error('Bus not found');
    }
    return bus;
  }

  async getByDriverId(driverId: string, organizationId: string): Promise<any[]> {
    const bus = await this.repository.findByDriverId(driverId, organizationId);
    if (!bus) {
      return [];
    }
    return [await this.repository.getWithDriverAndRoute(bus.id, organizationId)];
  }

  async update(id: string, data: Partial<Bus>, organizationId: string): Promise<Bus> {
    if (data.bus_number) {
      const exists = await this.repository.checkBusNumberExists(data.bus_number, organizationId, id);
      if (exists) {
        throw new Error('Bus number already exists');
      }
    }

    const updated = await this.repository.update(id, data, organizationId);
    if (!updated) {
      throw new Error('Bus not found');
    }

    logger.info({
      message: 'Bus updated',
      busId: updated.id,
    });

    return updated;
  }

  async delete(id: string, organizationId: string): Promise<void> {
    const deleted = await this.repository.delete(id, organizationId);
    if (!deleted) {
      throw new Error('Bus not found');
    }

    logger.info({
      message: 'Bus deleted',
      busId: id,
    });
  }

  async assignDriver(busId: string, driverId: string, organizationId: string): Promise<Bus> {
    const updated = await this.repository.assignDriver(busId, driverId, organizationId);
    if (!updated) {
      throw new Error('Bus not found');
    }

    logger.info({
      message: 'Driver assigned to bus',
      busId,
      driverId,
    });

    return updated;
  }
}

