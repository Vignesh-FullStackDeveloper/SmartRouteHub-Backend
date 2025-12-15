import * as dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load environment variables based on NODE_ENV
const env = process.env.NODE_ENV || 'development';
const envFile = env === 'production' ? '.env.production' : '.env.local';

// Load .env file
dotenv.config({ path: path.resolve(process.cwd(), envFile) });
// Also load base .env if it exists
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Configuration schema validation
const configSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.string().default('3000'),
  HOST: z.string().default('0.0.0.0'),
  
  // Database
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.string().default('5432'),
  DB_USER: z.string().default('postgres'),
  DB_PASSWORD: z.string().default('password'),
  DB_NAME: z.string().default('smartroutehub'),
  DB_SSL: z.string().optional(),
  DB_POOL_MIN: z.string().default('2'),
  DB_POOL_MAX: z.string().default('10'),
  
  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  
  // CORS
  CORS_ORIGIN: z.string().default('*'),
  
  // Rate Limiting
  RATE_LIMIT_MAX: z.string().default('100'),
  RATE_LIMIT_TIME_WINDOW: z.string().default('60000'),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FILE_PATH: z.string().default('./logs'),
  
  // Google Maps
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  
  // Profiling
  ENABLE_PROFILING: z.string().default('true'),
  PROFILING_SLOW_QUERY_THRESHOLD: z.string().default('1000'), // milliseconds
  PROFILING_SLOW_REQUEST_THRESHOLD: z.string().default('5000'), // milliseconds
  ENABLE_QUERY_PROFILING: z.string().default('true'),
  ENABLE_REQUEST_PROFILING: z.string().default('true'),
  ENABLE_MEMORY_PROFILING: z.string().default('true'),
  
  // Redis
  REDIS_HOST: z.string().default('127.0.0.1'),
  REDIS_PORT: z.string().default('6379'),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.string().default('0'),
  
  // Development
  SWAGGER_DISABLE_AUTH: z.string().default('false'), // Set to 'true' to disable auth in Swagger UI (dev only)
  AUTO_INIT_DB: z.string().default('true'), // Auto-create database and run migrations on startup
});

// Parse and validate environment variables
function getConfig() {
  try {
    const rawConfig = {
      NODE_ENV: process.env.NODE_ENV || 'development',
      PORT: process.env.PORT || '3000',
      HOST: process.env.HOST || '0.0.0.0',
      DB_HOST: process.env.DB_HOST || 'localhost',
      DB_PORT: process.env.DB_PORT || '5432',
      DB_USER: process.env.DB_USER || 'postgres',
      DB_PASSWORD: process.env.DB_PASSWORD || 'password',
      DB_NAME: process.env.DB_NAME || 'smartroutehub',
      DB_SSL: process.env.DB_SSL,
      DB_POOL_MIN: process.env.DB_POOL_MIN || '2',
      DB_POOL_MAX: process.env.DB_POOL_MAX || '10',
      JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key-change-in-production-min-32-chars',
      JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
      CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
      RATE_LIMIT_MAX: process.env.RATE_LIMIT_MAX || '100',
      RATE_LIMIT_TIME_WINDOW: process.env.RATE_LIMIT_TIME_WINDOW || '60000',
      LOG_LEVEL: process.env.LOG_LEVEL || 'info',
      LOG_FILE_PATH: process.env.LOG_FILE_PATH || './logs',
      GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,
      ENABLE_PROFILING: process.env.ENABLE_PROFILING || 'true',
      PROFILING_SLOW_QUERY_THRESHOLD: process.env.PROFILING_SLOW_QUERY_THRESHOLD || '1000',
      PROFILING_SLOW_REQUEST_THRESHOLD: process.env.PROFILING_SLOW_REQUEST_THRESHOLD || '5000',
      ENABLE_QUERY_PROFILING: process.env.ENABLE_QUERY_PROFILING || 'true',
      ENABLE_REQUEST_PROFILING: process.env.ENABLE_REQUEST_PROFILING || 'true',
      ENABLE_MEMORY_PROFILING: process.env.ENABLE_MEMORY_PROFILING || 'true',
      REDIS_HOST: process.env.REDIS_HOST || '127.0.0.1',
      REDIS_PORT: process.env.REDIS_PORT || '6379',
      REDIS_PASSWORD: process.env.REDIS_PASSWORD,
      REDIS_DB: process.env.REDIS_DB || '0',
      SWAGGER_DISABLE_AUTH: process.env.SWAGGER_DISABLE_AUTH || 'false',
      AUTO_INIT_DB: process.env.AUTO_INIT_DB || 'true',
    };

    return configSchema.parse(rawConfig);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Configuration validation failed:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      process.exit(1);
    }
    throw error;
  }
}

const config = getConfig();

// Export typed configuration
export const appConfig = {
  // Server
  env: config.NODE_ENV,
  port: parseInt(config.PORT),
  host: config.HOST,
  isDevelopment: config.NODE_ENV === 'development',
  isProduction: config.NODE_ENV === 'production',
  isStaging: config.NODE_ENV === 'staging',
  
  // Database
  database: {
    host: config.DB_HOST,
    port: parseInt(config.DB_PORT),
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    database: config.DB_NAME,
    ssl: config.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    pool: {
      min: parseInt(config.DB_POOL_MIN),
      max: parseInt(config.DB_POOL_MAX),
    },
  },
  
  // JWT
  jwt: {
    secret: config.JWT_SECRET,
    expiresIn: config.JWT_EXPIRES_IN,
  },
  
  // CORS
  cors: {
    origin: config.CORS_ORIGIN.split(',').map((o) => o.trim()),
  },
  
  // Rate Limiting
  rateLimit: {
    max: parseInt(config.RATE_LIMIT_MAX),
    timeWindow: parseInt(config.RATE_LIMIT_TIME_WINDOW),
  },
  
  // Logging
  logging: {
    level: config.LOG_LEVEL,
    filePath: config.LOG_FILE_PATH,
  },
  
  // Google Maps
  googleMaps: {
    apiKey: config.GOOGLE_MAPS_API_KEY || '',
  },
  
  // Profiling
  profiling: {
    enabled: config.ENABLE_PROFILING === 'true',
    slowQueryThreshold: parseInt(config.PROFILING_SLOW_QUERY_THRESHOLD),
    slowRequestThreshold: parseInt(config.PROFILING_SLOW_REQUEST_THRESHOLD),
    queryProfiling: config.ENABLE_QUERY_PROFILING === 'true',
    requestProfiling: config.ENABLE_REQUEST_PROFILING === 'true',
    memoryProfiling: config.ENABLE_MEMORY_PROFILING === 'true',
  },
  
  // Redis
  redis: {
    host: config.REDIS_HOST,
    port: parseInt(config.REDIS_PORT),
    password: config.REDIS_PASSWORD,
    db: parseInt(config.REDIS_DB),
  },
  
  // Development
  swaggerDisableAuth: config.SWAGGER_DISABLE_AUTH === 'true',
  autoInitDb: config.AUTO_INIT_DB === 'true',
};

export default appConfig;

