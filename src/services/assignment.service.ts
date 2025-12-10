import { StudentRepository } from '../repositories/student.repository';
import { BusRepository } from '../repositories/bus.repository';
import { RouteRepository } from '../repositories/route.repository';
import { logger } from '../config/logger';

export class AssignmentService {
  private studentRepository: StudentRepository;
  private busRepository: BusRepository;
  private routeRepository: RouteRepository;

  constructor() {
    this.studentRepository = new StudentRepository();
    this.busRepository = new BusRepository();
    this.routeRepository = new RouteRepository();
  }

  async assignStudentsToRoute(
    studentIds: string[],
    routeId: string,
    busId: string | undefined,
    organizationId: string
  ): Promise<{ count: number }> {
    // Verify route exists
    const route = await this.routeRepository.findById(routeId, organizationId);
    if (!route) {
      throw new Error('Route not found');
    }

    // Verify bus if provided
    if (busId) {
      const bus = await this.busRepository.findById(busId, organizationId);
      if (!bus) {
        throw new Error('Bus not found');
      }
    }

    const count = await this.studentRepository.assignToRoute(studentIds, routeId, organizationId);
    
    if (busId) {
      await this.studentRepository.assignToBus(studentIds, busId, organizationId);
    }

    logger.info({
      message: 'Students assigned to route',
      routeId,
      busId,
      studentCount: count,
    });

    return { count };
  }

  async assignStudentsToBus(
    studentIds: string[],
    busId: string,
    organizationId: string
  ): Promise<{ count: number }> {
    // Verify bus exists
    const bus = await this.busRepository.findById(busId, organizationId);
    if (!bus) {
      throw new Error('Bus not found');
    }

    // Check capacity
    const currentCount = await this.studentRepository.getBusCapacity(busId, organizationId);
    const newCount = studentIds.length;
    const total = currentCount + newCount;

    if (total > bus.capacity) {
      throw new Error(
        `Bus capacity exceeded. Capacity: ${bus.capacity}, Current: ${currentCount}, New: ${newCount}`
      );
    }

    const count = await this.studentRepository.assignToBus(studentIds, busId, organizationId);

    logger.info({
      message: 'Students assigned to bus',
      busId,
      studentCount: count,
    });

    return { count };
  }

  async getRouteAssignments(routeId: string, organizationId: string): Promise<any> {
    // Verify route exists
    await this.routeRepository.findById(routeId, organizationId);

    const students = await this.studentRepository.findByRouteId(routeId, organizationId);
    
    // Enrich with bus info
    const studentsWithBus = await Promise.all(
      students.map(async (student) => {
        if (student.assigned_bus_id) {
          const bus = await this.busRepository.findById(student.assigned_bus_id, organizationId);
          return {
            ...student,
            assigned_bus_number: bus?.bus_number,
          };
        }
        return student;
      })
    );

    return {
      route_id: routeId,
      students: studentsWithBus,
      count: studentsWithBus.length,
    };
  }

  async getBusAssignments(busId: string, organizationId: string): Promise<any> {
    // Verify bus exists
    await this.busRepository.findById(busId, organizationId);

    const students = await this.studentRepository.findByBusId(busId, organizationId);
    
    // Enrich with route info
    const studentsWithRoute = await Promise.all(
      students.map(async (student) => {
        if (student.assigned_route_id) {
          const route = await this.routeRepository.findById(student.assigned_route_id, organizationId);
          return {
            ...student,
            assigned_route_name: route?.name,
          };
        }
        return student;
      })
    );

    return {
      bus_id: busId,
      students: studentsWithRoute,
      count: studentsWithRoute.length,
    };
  }
}

