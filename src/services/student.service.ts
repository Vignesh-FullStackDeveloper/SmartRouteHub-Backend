import { OrganizationService } from './organization.service';
import { DatabaseService } from './database.service';
import { Student } from '../types';
import { logger } from '../config/logger';

export class StudentService {
  private organizationService: OrganizationService;
  private databaseService: DatabaseService;

  constructor() {
    this.organizationService = new OrganizationService();
    this.databaseService = new DatabaseService();
  }

  async create(data: {
    name: string;
    class_grade: string;
    section: string;
    parent_id?: string;
    parent_contact: string;
    pickup_point_id?: string;
    assigned_bus_id?: string;
    assigned_route_id?: string;
    is_active?: boolean;
  }, organizationId: string): Promise<Student> {
    // Students are stored in the organization database, not the main database
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);
    
    try {
      // Verify parent exists and belongs to organization if parent_id is provided
      if (data.parent_id) {
        const parent = await orgDb('users')
          .where({ id: data.parent_id, role: 'parent' })
          .first();
        
        if (!parent) {
          throw new Error('Parent not found or invalid');
        }
      }

      // Create student in organization database
      const [student] = await orgDb('students')
        .insert({
          name: data.name,
          class_grade: data.class_grade,
          section: data.section,
          parent_id: data.parent_id || null,
          parent_contact: data.parent_contact,
          pickup_point_id: data.pickup_point_id || null,
          assigned_bus_id: data.assigned_bus_id || null,
          assigned_route_id: data.assigned_route_id || null,
          is_active: data.is_active !== undefined ? data.is_active : true,
        })
        .returning('*');

      logger.info({
        message: 'Student created',
        studentId: student.id,
        organizationId,
      });

      // Add organization_id for consistency with the Student type
      return {
        ...student,
        organization_id: organizationId,
      } as Student;
    } finally {
      await orgDb.destroy();
    }
  }

  /**
   * Get all students with basic filtering and pagination
   * For hierarchy filtering, use specific methods: getByParentId, getByRouteId, getByBusId
   */
  async getAll(organizationId: string, filters?: {
    student_id?: string;
    class_grade?: string;
    is_active?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ data: Student[]; total: number }> {
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);
    
    try {
      let query = orgDb('students').select('*');

      // Direct filtering only
      if (filters?.student_id) {
        query = query.where({ id: filters.student_id });
      }
      if (filters?.class_grade) {
        query = query.where({ class_grade: filters.class_grade });
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

      const students = await query;
      
      // Add organization_id to each student for consistency
      const data = students.map(student => ({
        ...student,
        organization_id: organizationId,
      })) as Student[];

      return { data, total };
    } finally {
      await orgDb.destroy();
    }
  }

  async getById(id: string, organizationId: string): Promise<Student> {
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);
    
    try {
      const student = await orgDb('students')
        .where({ id })
        .first();
      
      if (!student) {
        throw new Error('Student not found');
      }
      
      return {
        ...student,
        organization_id: organizationId,
      } as Student;
    } finally {
      await orgDb.destroy();
    }
  }

  async update(id: string, data: Partial<Student>, organizationId: string): Promise<Student> {
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);
    
    try {
      const [updated] = await orgDb('students')
        .where({ id })
        .update(data)
        .returning('*');
      
      if (!updated) {
        throw new Error('Student not found');
      }

      logger.info({
        message: 'Student updated',
        studentId: updated.id,
      });

      return {
        ...updated,
        organization_id: organizationId,
      } as Student;
    } finally {
      await orgDb.destroy();
    }
  }

  async delete(id: string, organizationId: string): Promise<void> {
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);
    
    try {
      const deleted = await orgDb('students')
        .where({ id })
        .del();
      
      if (deleted === 0) {
        throw new Error('Student not found');
      }

      logger.info({
        message: 'Student deleted',
        studentId: id,
      });
    } finally {
      await orgDb.destroy();
    }
  }

  async getPickupLocation(id: string, organizationId: string): Promise<any> {
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);
    
    try {
      const student = await orgDb('students')
        .where({ id })
        .first();
      
      if (!student) {
        throw new Error('Student not found');
      }
      
      if (!student.pickup_point_id) {
        return { student: { ...student, organization_id: organizationId }, pickup_location: null };
      }

      const stop = await orgDb('stops')
        .where({ id: student.pickup_point_id })
        .first();
      
      return {
        student: { ...student, organization_id: organizationId },
        pickup_location: stop ? {
          id: stop.id,
          name: stop.name,
          latitude: stop.latitude,
          longitude: stop.longitude,
          address: stop.address,
        } : null,
      };
    } finally {
      await orgDb.destroy();
    }
  }

  async assignToBus(studentIds: string[], busId: string, organizationId: string): Promise<number> {
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);
    
    try {
      const updated = await orgDb('students')
        .whereIn('id', studentIds)
        .update({ assigned_bus_id: busId });
      
      return updated;
    } finally {
      await orgDb.destroy();
    }
  }

  async assignToRoute(studentIds: string[], routeId: string, organizationId: string): Promise<number> {
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);
    
    try {
      const updated = await orgDb('students')
        .whereIn('id', studentIds)
        .update({ assigned_route_id: routeId });
      
      return updated;
    } finally {
      await orgDb.destroy();
    }
  }

  /**
   * Get students by parent ID - Micro function
   */
  async getByParentId(parentId: string, organizationId: string, pagination?: {
    limit?: number;
    offset?: number;
  }): Promise<{ data: Student[]; total: number }> {
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);
    
    try {
      let query = orgDb('students').where({ parent_id: parentId });

      // Get total count
      const countResult = await query.clone().count('* as total').first();
      const total = parseInt(countResult?.total as string) || 0;

      // Apply pagination if provided
      if (pagination?.offset !== undefined) {
        query = query.offset(pagination.offset);
      }
      if (pagination?.limit !== undefined) {
        query = query.limit(pagination.limit);
      }

      const students = await query;
      
      const data = students.map(student => ({
        ...student,
        organization_id: organizationId,
      })) as Student[];

      return { data, total };
    } finally {
      await orgDb.destroy();
    }
  }

  /**
   * Get students by route ID - Micro function
   */
  async getByRouteId(routeId: string, organizationId: string, pagination?: {
    limit?: number;
    offset?: number;
  }): Promise<{ data: Student[]; total: number }> {
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);
    
    try {
      let query = orgDb('students').where({ assigned_route_id: routeId });

      // Get total count
      const countResult = await query.clone().count('* as total').first();
      const total = parseInt(countResult?.total as string) || 0;

      // Apply pagination if provided
      if (pagination?.offset !== undefined) {
        query = query.offset(pagination.offset);
      }
      if (pagination?.limit !== undefined) {
        query = query.limit(pagination.limit);
      }

      const students = await query;
      
      const data = students.map(student => ({
        ...student,
        organization_id: organizationId,
      })) as Student[];

      return { data, total };
    } finally {
      await orgDb.destroy();
    }
  }

  /**
   * Get students by bus ID - Micro function
   * This uses routes: Get all routes of the bus, then get students from those routes
   */
  async getByBusId(busId: string, organizationId: string, pagination?: {
    limit?: number;
    offset?: number;
  }): Promise<{ data: Student[]; total: number }> {
    const organization = await this.organizationService.getById(organizationId);
    const orgDb = this.databaseService.getOrganizationDatabase(organization.code);
    
    try {
      // Step 1: Get all routes assigned to this bus
      const routes = await orgDb('routes')
        .where({ assigned_bus_id: busId })
        .select('id');
      
      const routeIds = routes.map(r => r.id).filter(Boolean);
      
      if (routeIds.length === 0) {
        return { data: [], total: 0 };
      }

      // Step 2: Get students assigned to these routes
      let query = orgDb('students')
        .whereIn('assigned_route_id', routeIds)
        .orWhere({ assigned_bus_id: busId }); // Also include direct bus assignment

      // Get total count
      const countResult = await query.clone().count('* as total').first();
      const total = parseInt(countResult?.total as string) || 0;

      // Apply pagination if provided
      if (pagination?.offset !== undefined) {
        query = query.offset(pagination.offset);
      }
      if (pagination?.limit !== undefined) {
        query = query.limit(pagination.limit);
      }

      const students = await query;
      
      // Remove duplicates
      const uniqueStudents = Array.from(
        new Map(students.map(s => [s.id, s])).values()
      );
      
      const data = uniqueStudents.map(student => ({
        ...student,
        organization_id: organizationId,
      })) as Student[];

      return { data, total };
    } finally {
      await orgDb.destroy();
    }
  }
}

