import { SubscriptionRepository } from '../repositories/subscription.repository';
import { StudentRepository } from '../repositories/student.repository';
import { Subscription } from '../types';
import { logger } from '../config/logger';

export class SubscriptionService {
  private repository: SubscriptionRepository;
  private studentRepository: StudentRepository;

  constructor() {
    this.repository = new SubscriptionRepository();
    this.studentRepository = new StudentRepository();
  }

  async create(data: {
    student_id: string;
    valid_from: string;
    valid_until: string;
    amount_paid?: number;
    payment_method?: string;
    notes?: string;
  }, organizationId: string): Promise<Subscription> {
    // Verify student exists
    const student = await this.studentRepository.findById(data.student_id, organizationId);
    if (!student) {
      throw new Error('Student not found');
    }

    // Check for overlapping subscriptions
    const overlapping = await this.repository.checkOverlapping(
      data.student_id,
      data.valid_from,
      data.valid_until
    );

    if (overlapping) {
      throw new Error('Overlapping subscription exists');
    }

    const subscription = await this.repository.create({
      ...data,
      organization_id: organizationId,
      status: 'active',
    } as any);

    logger.info({
      message: 'Subscription created',
      subscriptionId: subscription.id,
      studentId: data.student_id,
    });

    return subscription;
  }

  async getByStudent(studentId: string, organizationId: string): Promise<Subscription[]> {
    // Verify student exists
    await this.studentRepository.findById(studentId, organizationId);
    return this.repository.findByStudentId(studentId, organizationId);
  }

  async getActive(studentId: string, organizationId: string): Promise<Subscription | null> {
    // Verify student exists
    await this.studentRepository.findById(studentId, organizationId);
    return this.repository.findActive(studentId, organizationId);
  }

  async update(
    id: string,
    data: Partial<Subscription>,
    organizationId: string
  ): Promise<Subscription> {
    // Check overlapping if dates are being updated
    if (data.valid_from || data.valid_until) {
      const existing = await this.repository.findById(id, organizationId);
      if (!existing) {
        throw new Error('Subscription not found');
      }

      const validFrom = data.valid_from || existing.valid_from.toISOString().split('T')[0];
      const validUntil = data.valid_until || existing.valid_until.toISOString().split('T')[0];

      const overlapping = await this.repository.checkOverlapping(
        existing.student_id,
        validFrom,
        validUntil,
        id
      );

      if (overlapping) {
        throw new Error('Overlapping subscription exists');
      }
    }

    const updated = await this.repository.update(id, data, organizationId);
    if (!updated) {
      throw new Error('Subscription not found');
    }

    logger.info({
      message: 'Subscription updated',
      subscriptionId: updated.id,
    });

    return updated;
  }

  async getExpiring(organizationId: string, days: number = 30): Promise<Subscription[]> {
    return this.repository.findExpiring(organizationId, days);
  }
}

