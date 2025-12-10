import knex, { Knex } from 'knex';
import { appConfig } from './index';
import { profileQuery } from '../middleware/profiling';
import { logger } from './logger';

// Build database configuration from appConfig
const dbConfig: Knex.Config = {
  client: 'pg',
  connection: {
    host: appConfig.database.host,
    port: appConfig.database.port,
    user: appConfig.database.user,
    password: appConfig.database.password,
    database: appConfig.database.database,
    ssl: appConfig.database.ssl,
  },
  pool: {
    min: appConfig.database.pool.min,
    max: appConfig.database.pool.max,
    acquireTimeoutMillis: 30000,
    createTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 100,
  },
  debug: appConfig.isDevelopment,
};

// Add query profiling in development/production
if (appConfig.profiling.enabled && appConfig.profiling.queryProfiling) {
  dbConfig.log = {
    warn: (message: string) => {
      logger.warn({ message: 'Knex warning', details: message });
    },
    error: (message: string) => {
      logger.error({ message: 'Knex error', details: message });
    },
    deprecate: (message: string) => {
      logger.warn({ message: 'Knex deprecation', details: message });
    },
    debug: (message: string) => {
      if (appConfig.isDevelopment) {
        logger.debug({ message: 'Knex debug', details: message });
      }
    },
  };
}

export const db: Knex = knex(dbConfig);

// Add query profiling using Knex query hooks
if (appConfig.profiling.enabled && appConfig.profiling.queryProfiling) {
  const queryTimes = new Map<string, number>();
  
  db.on('query', (queryData: any) => {
    queryTimes.set(queryData.__knexQueryUid, Date.now());
  });
  
  db.on('query-response', (response: any, queryData: any) => {
    const startTime = queryTimes.get(queryData.__knexQueryUid);
    if (startTime) {
      const duration = Date.now() - startTime;
      const sql = queryData.sql || '';
      profileQuery(sql, duration);
      queryTimes.delete(queryData.__knexQueryUid);
    }
  });
  
  db.on('query-error', (error: any, queryData: any) => {
    const startTime = queryTimes.get(queryData.__knexQueryUid);
    if (startTime) {
      const duration = Date.now() - startTime;
      const sql = queryData.sql || '';
      profileQuery(sql, duration);
      queryTimes.delete(queryData.__knexQueryUid);
    }
  });
}

// Test database connection
export async function testConnection(): Promise<boolean> {
  try {
    const startTime = Date.now();
    await db.raw('SELECT 1');
    const duration = Date.now() - startTime;
    
    logger.info({
      message: 'Database connection test successful',
      duration,
      config: {
        host: appConfig.database.host,
        port: appConfig.database.port,
        database: appConfig.database.database,
      },
    });
    
    return true;
  } catch (error: any) {
    logger.error({
      message: 'Database connection failed',
      error: error.message,
      config: {
        host: appConfig.database.host,
        port: appConfig.database.port,
        database: appConfig.database.database,
      },
    });
    return false;
  }
}

// Graceful shutdown
export async function closeConnection(): Promise<void> {
  try {
    await db.destroy();
    logger.info('Database connection closed');
  } catch (error: any) {
    logger.error({ message: 'Error closing database connection', error: error.message });
    throw error;
  }
}

// Get database statistics
export async function getDatabaseStats(): Promise<{
  pool: {
    min: number;
    max: number;
    used: number;
    free: number;
  };
  connection: {
    host: string;
    port: number;
    database: string;
  };
}> {
  const pool = (db.client as any).pool;
  return {
    pool: {
      min: appConfig.database.pool.min,
      max: appConfig.database.pool.max,
      used: pool ? pool.numUsed() : 0,
      free: pool ? pool.numFree() : 0,
    },
    connection: {
      host: appConfig.database.host,
      port: appConfig.database.port,
      database: appConfig.database.database,
    },
  };
}
