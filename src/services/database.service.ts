import { Knex } from 'knex';
import { appConfig } from '../config';
import { logger } from '../config/logger';
import knex from 'knex';

export class DatabaseService {
  /**
   * Create a new database for an organization
   */
  async createOrganizationDatabase(organizationId: string, organizationCode: string): Promise<void> {
    // Connect to postgres database (default database)
    const adminDb = knex({
      client: 'pg',
      connection: {
        host: appConfig.database.host,
        port: appConfig.database.port,
        user: appConfig.database.user,
        password: appConfig.database.password,
        database: 'postgres', // Connect to default postgres database
      },
    });

    try {
      const dbName = `smartroutehub_${organizationCode.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

      // Check if database already exists
      const dbExists = await adminDb.raw(
        `SELECT 1 FROM pg_database WHERE datname = ?`,
        [dbName]
      );

      if (dbExists.rows.length > 0) {
        logger.warn({
          message: 'Database already exists',
          database: dbName,
          organizationId,
        });
        return;
      }

      // Create database
      await adminDb.raw(`CREATE DATABASE ??`, [dbName]);

      logger.info({
        message: 'Organization database created',
        database: dbName,
        organizationId,
        organizationCode,
      });

      // Now create tables in the new database
      await this.createOrganizationTables(dbName, organizationId);
    } catch (error: any) {
      logger.error({
        message: 'Failed to create organization database',
        error: error.message,
        organizationId,
      });
      throw new Error(`Failed to create database: ${error.message}`);
    } finally {
      await adminDb.destroy();
    }
  }

  /**
   * Create all tables in organization database
   */
  private async createOrganizationTables(dbName: string, organizationId: string): Promise<void> {
    const orgDb = knex({
      client: 'pg',
      connection: {
        host: appConfig.database.host,
        port: appConfig.database.port,
        user: appConfig.database.user,
        password: appConfig.database.password,
        database: dbName,
        ssl: appConfig.database.ssl,
      },
      pool: {
        min: appConfig.database.pool.min,
        max: appConfig.database.pool.max,
      },
    });

    try {
      // Create all tables using migrations
      // Note: In production, you might want to run migrations instead
      await this.runMigrations(orgDb, dbName);
    } catch (error: any) {
      logger.error({
        message: 'Failed to create organization tables',
        error: error.message,
        database: dbName,
      });
      throw error;
    } finally {
      await orgDb.destroy();
    }
  }

  /**
   * Run migrations on organization database
   */
  private async runMigrations(db: Knex, dbName: string): Promise<void> {
    // Create users table
    await db.schema.createTable('users', (table) => {
      table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
      table.string('email').notNullable();
      table.string('phone');
      table.string('name').notNullable();
      table.string('password_hash').notNullable();
      table.enum('role', ['admin', 'driver', 'parent']).notNullable();
      table.string('driver_id').nullable();
      table.boolean('is_active').defaultTo(true);
      table.timestamp('last_login').nullable();
      table.timestamps(true, true);
      
      table.unique(['email']);
      table.index('email');
      table.index('role');
      table.index('is_active');
    });

    // Create buses table
    await db.schema.createTable('buses', (table) => {
      table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
      table.string('bus_number').notNullable();
      table.integer('capacity').notNullable();
      table.uuid('driver_id').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.uuid('assigned_route_id').nullable();
      table.boolean('is_active').defaultTo(true);
      table.jsonb('metadata').nullable();
      table.timestamps(true, true);
      
      table.unique(['bus_number']);
      table.index('driver_id');
      table.index('is_active');
    });

    // Create students table
    await db.schema.createTable('students', (table) => {
      table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
      table.string('name').notNullable();
      table.string('class_grade').notNullable();
      table.string('section').notNullable();
      table.uuid('parent_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.string('parent_contact').notNullable();
      table.uuid('pickup_point_id').nullable();
      table.uuid('assigned_bus_id').nullable().references('id').inTable('buses').onDelete('SET NULL');
      table.uuid('assigned_route_id').nullable();
      table.boolean('is_active').defaultTo(true);
      table.timestamps(true, true);
      
      table.index('parent_id');
      table.index('assigned_bus_id');
      table.index('assigned_route_id');
      table.index('is_active');
    });

    // Create routes table
    await db.schema.createTable('routes', (table) => {
      table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
      table.string('name').notNullable();
      table.time('start_time').notNullable();
      table.time('end_time').notNullable();
      table.integer('estimated_duration_minutes').nullable();
      table.decimal('total_distance_km', 10, 2).nullable();
      table.uuid('assigned_bus_id').nullable().references('id').inTable('buses').onDelete('SET NULL');
      table.boolean('is_active').defaultTo(true);
      table.text('route_polyline').nullable();
      table.timestamps(true, true);
      
      table.index('assigned_bus_id');
      table.index('is_active');
    });

    // Create stops table
    await db.schema.createTable('stops', (table) => {
      table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
      table.uuid('route_id').notNullable().references('id').inTable('routes').onDelete('CASCADE');
      table.string('name').notNullable();
      table.decimal('latitude', 10, 8).notNullable();
      table.decimal('longitude', 11, 8).notNullable();
      table.integer('order').notNullable();
      table.integer('estimated_arrival_minutes').nullable();
      table.jsonb('address').nullable();
      table.timestamps(true, true);
      
      table.index('route_id');
      table.index(['route_id', 'order']);
    });

    // Create trips table
    await db.schema.createTable('trips', (table) => {
      table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
      table.uuid('bus_id').notNullable().references('id').inTable('buses').onDelete('CASCADE');
      table.uuid('route_id').notNullable().references('id').inTable('routes').onDelete('CASCADE');
      table.uuid('driver_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.enum('status', ['not_started', 'in_progress', 'completed', 'cancelled']).defaultTo('not_started');
      table.timestamp('start_time').nullable();
      table.timestamp('end_time').nullable();
      table.decimal('current_latitude', 10, 8).nullable();
      table.decimal('current_longitude', 11, 8).nullable();
      table.decimal('speed_kmh', 5, 2).nullable();
      table.timestamp('last_update_time').nullable();
      table.integer('passenger_count').defaultTo(0);
      table.timestamps(true, true);
      
      table.index('bus_id');
      table.index('route_id');
      table.index('driver_id');
      table.index('status');
    });

    // Create location_tracking table
    await db.schema.createTable('location_tracking', (table) => {
      table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
      table.uuid('trip_id').notNullable().references('id').inTable('trips').onDelete('CASCADE');
      table.decimal('latitude', 10, 8).notNullable();
      table.decimal('longitude', 11, 8).notNullable();
      table.decimal('speed_kmh', 5, 2).nullable();
      table.decimal('heading', 5, 2).nullable();
      table.decimal('accuracy', 5, 2).nullable();
      table.timestamp('recorded_at').defaultTo(db.fn.now());
      
      table.index('trip_id');
      table.index('recorded_at');
    });

    // Create subscriptions table
    await db.schema.createTable('subscriptions', (table) => {
      table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
      table.uuid('student_id').notNullable().references('id').inTable('students').onDelete('CASCADE');
      table.date('valid_from').notNullable();
      table.date('valid_until').notNullable();
      table.enum('status', ['active', 'expired', 'cancelled']).defaultTo('active');
      table.decimal('amount_paid', 10, 2).nullable();
      table.string('payment_method').nullable();
      table.text('notes').nullable();
      table.timestamps(true, true);
      
      table.index('student_id');
      table.index('status');
      table.index(['valid_from', 'valid_until']);
    });

    // Create permissions table - organization-specific permissions
    await db.schema.createTable('permissions', (table) => {
      table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
      table.string('name').notNullable(); // e.g., 'View Buses', 'View Pupils'
      table.string('code').notNullable(); // e.g., 'view_buses', 'view_pupils'
      table.text('description').nullable();
      table.timestamps(true, true);
      
      table.unique('code'); // Permission codes must be unique within organization
      table.index('code');
    });

    // Create roles table - custom roles per organization
    await db.schema.createTable('roles', (table) => {
      table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
      table.string('name').notNullable(); // e.g., 'Fleet Manager', 'Route Coordinator'
      table.text('description').nullable();
      table.jsonb('permission_ids').notNullable().defaultTo('[]'); // Array of permission IDs
      table.timestamps(true, true);
      
      table.unique('name'); // Role names must be unique within organization
      table.index('name');
    });

    // Add role_id to users table to link users to custom roles
    await db.schema.alterTable('users', (table) => {
      table.uuid('role_id').nullable().references('id').inTable('roles').onDelete('SET NULL');
      table.index('role_id');
    });

    logger.info({
      message: 'Organization tables created',
      database: dbName,
    });
  }

  /**
   * Get database connection for an organization
   */
  getOrganizationDatabase(organizationCode: string): Knex {
    const dbName = `smartroutehub_${organizationCode.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    
    return knex({
      client: 'pg',
      connection: {
        host: appConfig.database.host,
        port: appConfig.database.port,
        user: appConfig.database.user,
        password: appConfig.database.password,
        database: dbName,
        ssl: appConfig.database.ssl,
      },
      pool: {
        min: appConfig.database.pool.min,
        max: appConfig.database.pool.max,
      },
    });
  }

  /**
   * Check if organization database exists
   */
  async organizationDatabaseExists(organizationCode: string): Promise<boolean> {
    const adminDb = knex({
      client: 'pg',
      connection: {
        host: appConfig.database.host,
        port: appConfig.database.port,
        user: appConfig.database.user,
        password: appConfig.database.password,
        database: 'postgres',
      },
    });

    try {
      const dbName = `smartroutehub_${organizationCode.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      const result = await adminDb.raw(
        `SELECT 1 FROM pg_database WHERE datname = ?`,
        [dbName]
      );
      return result.rows.length > 0;
    } finally {
      await adminDb.destroy();
    }
  }
}

