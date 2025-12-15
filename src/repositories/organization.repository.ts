import { db } from '../config/database';
import { Organization } from '../types';
import { BaseRepository } from './base.repository';

export class OrganizationRepository extends BaseRepository<Organization> {
  constructor() {
    super('organizations');
  }

  // Override findById - organizations table doesn't have organization_id column
  async findById(id: string, organizationId?: string): Promise<Organization | null> {
    // Ignore organizationId parameter since organizations table doesn't have that column
    return this.db('organizations').where({ id }).first() || null;
  }

  // Override update - organizations table doesn't have organization_id column
  async update(id: string, data: Partial<Organization>, organizationId?: string): Promise<Organization | null> {
    // Ignore organizationId parameter since organizations table doesn't have that column
    const [updated] = await this.db('organizations').where({ id }).update(data).returning('*');
    return updated || null;
  }

  async findByCode(code: string): Promise<Organization | null> {
    return this.db('organizations').where({ code }).first() || null;
  }

  async findByCodeOrId(identifier: string): Promise<Organization | null> {
    return this.db('organizations')
      .where({ code: identifier })
      .orWhere({ id: identifier })
      .first() || null;
  }

  async checkCodeExists(code: string, excludeId?: string): Promise<boolean> {
    const query = this.db('organizations').where({ code });
    if (excludeId) {
      query.whereNot({ id: excludeId });
    }
    const result = await query.count('* as count').first();
    return parseInt(result?.count as string) > 0;
  }
}

