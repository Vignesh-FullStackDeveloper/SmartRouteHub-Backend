import { Knex } from 'knex';
import { appConfig } from '../config';
import { logger } from '../config/logger';
import knex from 'knex';

/**
 * Database Initialization Service
 * Handles automatic database creation, migrations, and seeding
 */
export class DatabaseInitService {
  /**
   * Ensure main database exists, create if it doesn't
   */
  async ensureMainDatabase(): Promise<void> {
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
      const dbName = appConfig.database.database;

      // Check if database exists
      const result = await adminDb.raw(
        `SELECT 1 FROM pg_database WHERE datname = ?`,
        [dbName]
      );

      if (result.rows.length === 0) {
        logger.info({ message: 'Main database does not exist, creating...', database: dbName });
        
        // Create database (using Knex identifier placeholder)
        await adminDb.raw(`CREATE DATABASE ??`, [dbName]);
        
        logger.info({ message: 'Main database created successfully', database: dbName });
      } else {
        logger.debug({ message: 'Main database already exists', database: dbName });
      }
    } catch (error: any) {
      logger.error({
        message: 'Failed to ensure main database exists',
        error: error.message,
        database: appConfig.database.database,
      });
      throw error;
    } finally {
      await adminDb.destroy();
    }
  }

  /**
   * Run migrations on main database
   */
  async runMigrations(): Promise<void> {
    try {
      logger.info({ message: 'Running database migrations...' });
      
      // Create Knex instance for migrations
      const migrationKnex = knex({
        client: 'pg',
        connection: {
          host: appConfig.database.host,
          port: appConfig.database.port,
          user: appConfig.database.user,
          password: appConfig.database.password,
          database: appConfig.database.database,
          ssl: appConfig.database.ssl,
        },
        migrations: {
          tableName: 'knex_migrations',
          directory: './src/database/migrations',
          extension: 'ts',
        },
      });
      
      // Run migrations
      const [batchNo, log] = await migrationKnex.migrate.latest();
      
      if (log.length === 0) {
        logger.info({ message: 'Database is up to date, no migrations to run' });
      } else {
        logger.info({
          message: 'Migrations completed successfully',
          batch: batchNo,
          migrations: log,
        });
      }
      
      await migrationKnex.destroy();
    } catch (error: any) {
      logger.error({
        message: 'Failed to run migrations',
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Run seeds on main database
   */
  async runSeeds(): Promise<void> {
    try {
      logger.info({ message: 'Running database seeds...' });
      
      // Create Knex instance for seeds
      const seedKnex = knex({
        client: 'pg',
        connection: {
          host: appConfig.database.host,
          port: appConfig.database.port,
          user: appConfig.database.user,
          password: appConfig.database.password,
          database: appConfig.database.database,
          ssl: appConfig.database.ssl,
        },
        seeds: {
          directory: './src/database/seeds',
          extension: 'ts',
        },
      });
      
      // Run seeds
      const seedFiles = await seedKnex.seed.run();
      
      if (seedFiles.length === 0) {
        logger.info({ message: 'No seeds to run' });
      } else {
        logger.info({
          message: 'Seeds completed successfully',
          seedFiles,
        });
      }
      
      await seedKnex.destroy();
    } catch (error: any) {
      logger.error({
        message: 'Failed to run seeds',
        error: error.message,
      });
      // Don't throw - seeds are optional
      logger.warn({ message: 'Continuing without seeds' });
    }
  }

  /**
   * Initialize database: create, migrate, and seed
   */
  async initialize(): Promise<void> {
    try {
      // Step 1: Ensure main database exists
      await this.ensureMainDatabase();
      
      // Step 2: Run migrations
      await this.runMigrations();
      
      // Step 3: Run seeds (optional, won't fail if error)
      await this.runSeeds();
      
      logger.info({ message: 'Database initialization completed successfully' });
    } catch (error: any) {
      logger.error({
        message: 'Database initialization failed',
        error: error.message,
      });
      throw error;
    }
  }
}

