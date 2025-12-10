import { db } from '../config/database';
import { OrganizationRepository } from '../repositories/organization.repository';
import { DatabaseService } from './database.service';
import { logger } from '../config/logger';

export class SuperAdminService {
  private organizationRepository: OrganizationRepository;
  private databaseService: DatabaseService;

  constructor() {
    this.organizationRepository = new OrganizationRepository();
    this.databaseService = new DatabaseService();
  }

  /**
   * Get all organizations (superadmin only)
   */
  async getAllOrganizations(): Promise<any[]> {
    const organizations = await this.organizationRepository.findAll();

    // Enrich with database status
    const orgsWithDbStatus = await Promise.all(
      organizations.map(async (org) => {
        const dbExists = await this.databaseService.organizationDatabaseExists(org.code);
        return {
          ...org,
          database: {
            exists: dbExists,
            name: dbExists ? `smartroutehub_${org.code.toLowerCase().replace(/[^a-z0-9]/g, '_')}` : null,
          },
        };
      })
    );

    return orgsWithDbStatus;
  }

  /**
   * Get organization details with all statistics
   */
  async getOrganizationDetails(organizationId: string): Promise<any> {
    const organization = await this.organizationRepository.findById(organizationId);
    if (!organization) {
      throw new Error('Organization not found');
    }

    // Get statistics from main database
    const [usersCount] = await db('users')
      .where({ organization_id: organizationId })
      .count('* as count');

    const [studentsCount] = await db('students')
      .where({ organization_id: organizationId })
      .count('* as count');

    const [busesCount] = await db('buses')
      .where({ organization_id: organizationId })
      .count('* as count');

    const [routesCount] = await db('routes')
      .where({ organization_id: organizationId })
      .count('* as count');

    const [activeTripsCount] = await db('trips')
      .where({ organization_id: organizationId, status: 'in_progress' })
      .count('* as count');

    // Check database status
    const dbExists = await this.databaseService.organizationDatabaseExists(organization.code);

    return {
      organization,
      statistics: {
        users: parseInt(usersCount?.count as string) || 0,
        students: parseInt(studentsCount?.count as string) || 0,
        buses: parseInt(busesCount?.count as string) || 0,
        routes: parseInt(routesCount?.count as string) || 0,
        active_trips: parseInt(activeTripsCount?.count as string) || 0,
      },
      database: {
        exists: dbExists,
        name: dbExists ? `smartroutehub_${organization.code.toLowerCase().replace(/[^a-z0-9]/g, '_')}` : null,
      },
    };
  }

  /**
   * Get system-wide statistics
   */
  async getSystemStatistics(): Promise<any> {
    const [totalOrganizations] = await db('organizations')
      .count('* as count');

    const [totalUsers] = await db('users')
      .whereNotNull('organization_id')
      .count('* as count');

    const [totalStudents] = await db('students')
      .count('* as count');

    const [totalBuses] = await db('buses')
      .count('* as count');

    const [activeTrips] = await db('trips')
      .where({ status: 'in_progress' })
      .count('* as count');

    return {
      organizations: parseInt(totalOrganizations?.count as string) || 0,
      users: parseInt(totalUsers?.count as string) || 0,
      students: parseInt(totalStudents?.count as string) || 0,
      buses: parseInt(totalBuses?.count as string) || 0,
      active_trips: parseInt(activeTrips?.count as string) || 0,
    };
  }
}

