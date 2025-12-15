import { StudentRepository } from '../repositories/student.repository';
import { UserRepository } from '../repositories/user.repository';
import { Student } from '../types';
import { logger } from '../config/logger';

export class StudentService {
  private repository: StudentRepository;
  private userRepository: UserRepository;

  constructor() {
    this.repository = new StudentRepository();
    this.userRepository = new UserRepository();
  }

  async create(data: {
    name: string;
    class_grade: string;
    section: string;
    parent_id: string;
    parent_contact: string;
    pickup_point_id?: string;
    assigned_bus_id?: string;
    assigned_route_id?: string;
  }, organizationId: string): Promise<Student> {
    // Verify parent exists and belongs to organization
    const parent = await this.userRepository.findById(data.parent_id, organizationId);
    if (!parent || parent.role !== 'parent') {
      throw new Error('Parent not found or invalid');
    }

    const student = await this.repository.create({
      ...data,
      organization_id: organizationId,
      is_active: true,
    } as any);

    logger.info({
      message: 'Student created',
      studentId: student.id,
      organizationId,
    });

    return student;
  }

  async getAll(organizationId: string, filters?: {
    bus_id?: string;
    route_id?: string;
    class_grade?: string;
    is_active?: boolean;
  }): Promise<Student[]> {
    if (filters?.bus_id) {
      return this.repository.findByBusId(filters.bus_id, organizationId);
    }
    if (filters?.route_id) {
      return this.repository.findByRouteId(filters.route_id, organizationId);
    }
    return this.repository.findAll(organizationId, filters);
  }

  async getById(id: string, organizationId: string): Promise<Student> {
    const student = await this.repository.findById(id, organizationId);
    if (!student) {
      throw new Error('Student not found');
    }
    return student;
  }

  async update(id: string, data: Partial<Student>, organizationId: string): Promise<Student> {
    const updated = await this.repository.update(id, data, organizationId);
    if (!updated) {
      throw new Error('Student not found');
    }

    logger.info({
      message: 'Student updated',
      studentId: updated.id,
    });

    return updated;
  }

  async delete(id: string, organizationId: string): Promise<void> {
    const deleted = await this.repository.delete(id, organizationId);
    if (!deleted) {
      throw new Error('Student not found');
    }

    logger.info({
      message: 'Student deleted',
      studentId: id,
    });
  }

  async getPickupLocation(id: string, organizationId: string): Promise<any> {
    const result = await this.repository.getWithPickupLocation(id, organizationId);
    if (!result.student) {
      throw new Error('Student not found');
    }
    return result;
  }

  async assignToBus(studentIds: string[], busId: string, organizationId: string): Promise<number> {
    return this.repository.assignToBus(studentIds, busId, organizationId);
  }

  async assignToRoute(studentIds: string[], routeId: string, organizationId: string): Promise<number> {
    return this.repository.assignToRoute(studentIds, routeId, organizationId);
  }

  async getByParentId(parentId: string, organizationId: string): Promise<Student[]> {
    return this.repository.findByParentId(parentId, organizationId);
  }
}

