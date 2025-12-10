import { Knex } from 'knex';
import { db } from '../config/database';

export abstract class BaseRepository<T> {
  protected tableName: string;
  protected db: Knex;

  constructor(tableName: string) {
    this.tableName = tableName;
    this.db = db;
  }

  async findById(id: string, organizationId?: string): Promise<T | null> {
    const query = this.db(this.tableName).where({ id });
    if (organizationId) {
      query.where({ organization_id: organizationId });
    }
    return query.first() || null;
  }

  async findAll(organizationId?: string, filters?: Record<string, any>): Promise<T[]> {
    const query = this.db(this.tableName);
    if (organizationId) {
      query.where({ organization_id: organizationId });
    }
    if (filters) {
      query.where(filters);
    }
    return query;
  }

  async create(data: Partial<T>): Promise<T> {
    const [record] = await this.db(this.tableName)
      .insert(data)
      .returning('*');
    return record;
  }

  async update(id: string, data: Partial<T>, organizationId?: string): Promise<T | null> {
    const query = this.db(this.tableName).where({ id });
    if (organizationId) {
      query.where({ organization_id: organizationId });
    }
    const [updated] = await query.update(data).returning('*');
    return updated || null;
  }

  async delete(id: string, organizationId?: string): Promise<boolean> {
    const query = this.db(this.tableName).where({ id });
    if (organizationId) {
      query.where({ organization_id: organizationId });
    }
    const deleted = await query.del();
    return deleted > 0;
  }

  async exists(id: string, organizationId?: string): Promise<boolean> {
    const query = this.db(this.tableName).where({ id });
    if (organizationId) {
      query.where({ organization_id: organizationId });
    }
    const result = await query.count('* as count').first();
    return parseInt(result?.count as string) > 0;
  }
}

