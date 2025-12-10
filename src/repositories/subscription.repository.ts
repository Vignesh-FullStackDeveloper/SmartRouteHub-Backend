import { db } from '../config/database';
import { Subscription } from '../types';
import { BaseRepository } from './base.repository';

export class SubscriptionRepository extends BaseRepository<Subscription> {
  constructor() {
    super('subscriptions');
  }

  async findByStudentId(studentId: string, organizationId: string): Promise<Subscription[]> {
    return this.db('subscriptions')
      .where({ student_id: studentId, organization_id: organizationId })
      .orderBy('valid_from', 'desc');
  }

  async findActive(studentId: string, organizationId: string): Promise<Subscription | null> {
    const today = new Date().toISOString().split('T')[0];
    
    return this.db('subscriptions')
      .where({
        student_id: studentId,
        organization_id: organizationId,
        status: 'active',
      })
      .where('valid_from', '<=', today)
      .where('valid_until', '>=', today)
      .orderBy('valid_until', 'desc')
      .first() || null;
  }

  async findExpiring(organizationId: string, days: number = 30): Promise<Subscription[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    const futureDateStr = futureDate.toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];

    return this.db('subscriptions')
      .where({
        organization_id: organizationId,
        status: 'active',
      })
      .whereBetween('valid_until', [today, futureDateStr])
      .join('students', 'subscriptions.student_id', 'students.id')
      .select(
        'subscriptions.*',
        'students.name as student_name',
        'students.class_grade',
        'students.section'
      )
      .orderBy('valid_until', 'asc');
  }

  async checkOverlapping(
    studentId: string,
    validFrom: string,
    validUntil: string,
    excludeId?: string
  ): Promise<boolean> {
    const query = this.db('subscriptions')
      .where({ student_id: studentId, status: 'active' })
      .where(function() {
        this.whereBetween('valid_from', [validFrom, validUntil])
          .orWhereBetween('valid_until', [validFrom, validUntil])
          .orWhere(function() {
            this.where('valid_from', '<=', validFrom)
              .where('valid_until', '>=', validUntil);
          });
      });

    if (excludeId) {
      query.whereNot({ id: excludeId });
    }

    const result = await query.count('* as count').first();
    return parseInt(result?.count as string) > 0;
  }
}

