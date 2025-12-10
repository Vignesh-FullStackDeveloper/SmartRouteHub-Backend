import { db } from '../config/database';
import { Organization } from '../types';
import { BaseRepository } from './base.repository';

export class OrganizationRepository extends BaseRepository<Organization> {
  constructor() {
    super('organizations');
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

