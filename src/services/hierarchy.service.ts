import { OrganizationService } from './organization.service';
import { DatabaseService } from './database.service';
import { logger } from '../config/logger';

/**
 * Hierarchy Service - Micro functions for traversing entity relationships
 * Hierarchy: parent -> students -> routes -> bus -> driver
 */
export class HierarchyService {
  private organizationService: OrganizationService;
  private databaseService: DatabaseService;

  constructor() {
    this.organizationService = new OrganizationService();
    this.databaseService = new DatabaseService();
  }

  /**
   * Get student's bus ID
   */
  async getBusIdByStudentId(studentId: string, organizationId: string): Promise<string | null> {
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);
    
    try {
      const student = await orgDb('students')
        .where({ id: studentId })
        .select('assigned_bus_id')
        .first();
      
      return student?.assigned_bus_id || null;
    } catch (error: any) {
      logger.error({ message: 'Error getting bus ID by student ID', error: error.message, studentId });
      throw error;
    } finally {
      await orgDb.destroy();
    }
  }

  /**
   * Get student's route ID
   */
  async getRouteIdByStudentId(studentId: string, organizationId: string): Promise<string | null> {
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);
    
    try {
      const student = await orgDb('students')
        .where({ id: studentId })
        .select('assigned_route_id')
        .first();
      
      return student?.assigned_route_id || null;
    } catch (error: any) {
      logger.error({ message: 'Error getting route ID by student ID', error: error.message, studentId });
      throw error;
    } finally {
      await orgDb.destroy();
    }
  }

  /**
   * Get bus's route IDs
   */
  async getRouteIdsByBusId(busId: string, organizationId: string): Promise<string[]> {
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);
    
    try {
      const routes = await orgDb('routes')
        .where({ assigned_bus_id: busId })
        .select('id');
      
      return routes.map(r => r.id).filter(Boolean);
    } catch (error: any) {
      logger.error({ message: 'Error getting route IDs by bus ID', error: error.message, busId });
      throw error;
    } finally {
      await orgDb.destroy();
    }
  }

  /**
   * Get bus's driver ID
   */
  async getDriverIdByBusId(busId: string, organizationId: string): Promise<string | null> {
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);
    
    try {
      const bus = await orgDb('buses')
        .where({ id: busId })
        .select('driver_id')
        .first();
      
      return bus?.driver_id || null;
    } catch (error: any) {
      logger.error({ message: 'Error getting driver ID by bus ID', error: error.message, busId });
      throw error;
    } finally {
      await orgDb.destroy();
    }
  }

  /**
   * Get route's bus ID
   */
  async getBusIdByRouteId(routeId: string, organizationId: string): Promise<string | null> {
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);
    
    try {
      const route = await orgDb('routes')
        .where({ id: routeId })
        .select('assigned_bus_id')
        .first();
      
      return route?.assigned_bus_id || null;
    } catch (error: any) {
      logger.error({ message: 'Error getting bus ID by route ID', error: error.message, routeId });
      throw error;
    } finally {
      await orgDb.destroy();
    }
  }

  /**
   * Get student IDs by parent ID
   */
  async getStudentIdsByParentId(parentId: string, organizationId: string): Promise<string[]> {
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);
    
    try {
      const students = await orgDb('students')
        .where({ parent_id: parentId })
        .select('id');
      
      return students.map(s => s.id).filter(Boolean);
    } catch (error: any) {
      logger.error({ message: 'Error getting student IDs by parent ID', error: error.message, parentId });
      throw error;
    } finally {
      await orgDb.destroy();
    }
  }

  /**
   * Get student IDs by route ID
   */
  async getStudentIdsByRouteId(routeId: string, organizationId: string): Promise<string[]> {
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);
    
    try {
      const students = await orgDb('students')
        .where({ assigned_route_id: routeId })
        .select('id');
      
      return students.map(s => s.id).filter(Boolean);
    } catch (error: any) {
      logger.error({ message: 'Error getting student IDs by route ID', error: error.message, routeId });
      throw error;
    } finally {
      await orgDb.destroy();
    }
  }

  /**
   * Get student IDs by bus ID
   */
  async getStudentIdsByBusId(busId: string, organizationId: string): Promise<string[]> {
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);
    
    try {
      const students = await orgDb('students')
        .where({ assigned_bus_id: busId })
        .select('id');
      
      return students.map(s => s.id).filter(Boolean);
    } catch (error: any) {
      logger.error({ message: 'Error getting student IDs by bus ID', error: error.message, busId });
      throw error;
    } finally {
      await orgDb.destroy();
    }
  }

  /**
   * Get bus IDs by driver ID
   */
  async getBusIdsByDriverId(driverId: string, organizationId: string): Promise<string[]> {
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);
    
    try {
      const buses = await orgDb('buses')
        .where({ driver_id: driverId })
        .select('id');
      
      return buses.map(b => b.id).filter(Boolean);
    } catch (error: any) {
      logger.error({ message: 'Error getting bus IDs by driver ID', error: error.message, driverId });
      throw error;
    } finally {
      await orgDb.destroy();
    }
  }
}

