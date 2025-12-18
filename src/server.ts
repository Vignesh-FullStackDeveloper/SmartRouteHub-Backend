import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { appConfig } from './config';
import { testConnection, closeConnection, getDatabaseStats } from './config/database';
import { logger, loggerStream } from './config/logger';
import { errorHandler } from './middleware/error-handler';
import { requestProfiling, getProfilingStats, getMemoryProfile } from './middleware/profiling';
import { DatabaseInitService } from './services/database-init.service';

// Import routes
import { authRoutes } from './routes/auth.routes';
import { organizationsRoutes } from './routes/organizations.routes';
import { studentsRoutes } from './routes/students.routes';
import { busesRoutes } from './routes/buses.routes';
import { routesRoutes } from './routes/routes.routes';
import { driversRoutes } from './routes/drivers.routes';
import { tripsRoutes } from './routes/trips.routes';
import { analyticsRoutes } from './routes/analytics.routes';
import { assignmentsRoutes } from './routes/assignments.routes';
import { subscriptionsRoutes } from './routes/subscriptions.routes';
import { usersRoutes } from './routes/users.routes';
import { mapsRoutes } from './routes/maps.routes';
import { superadminRoutes } from './routes/superadmin.routes';
import { notificationsRoutes } from './routes/notifications.routes';
import { permissionsRoutes } from './routes/permissions.routes';
import { rolesRoutes } from './routes/roles.routes';
import { connectRedis, disconnectRedis, testRedisConnection } from './config/redis';

async function buildServer() {
  const fastify = Fastify({
    logger: {
      stream: loggerStream,
      level: appConfig.logging.level,
    },
    requestIdLogLabel: 'reqId',
    genReqId: () => Date.now().toString(),
  });

  // Register profiling middleware
  if (appConfig.profiling.enabled && appConfig.profiling.requestProfiling) {
    fastify.addHook('onRequest', requestProfiling);
  }

  // Register plugins
  await fastify.register(helmet, {
    contentSecurityPolicy: false,
  });

  await fastify.register(cors, {
    origin: appConfig.cors.origin,
    credentials: true,
  });

  await fastify.register(jwt, {
    secret: appConfig.jwt.secret,
    sign: {
      expiresIn: appConfig.jwt.expiresIn,
    },
  });

  await fastify.register(rateLimit, {
    max: appConfig.rateLimit.max,
    timeWindow: appConfig.rateLimit.timeWindow,
  });

  // Swagger documentation
  await fastify.register(swagger, {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: 'SmartRouteHub API',
        description: `Production-grade API for School Bus Tracking System
        
## Getting Started

### 1. Get Authentication Token

**For Superadmin (in Organization):**
\`\`\`bash
POST /api/auth/login
{
  "data": {
    "email": "superadmin@smartroutehub.com",
    "password": "SuperAdmin@123",
    "organizationCode": "ORG001"
  }
}
\`\`\`

**For Regular Users:**
\`\`\`bash
POST /api/auth/login
{
  "data": {
    "email": "user@example.com",
    "password": "your-password",
    "organizationCode": "ORG001"
  }
}
\`\`\`

### 2. Use the Token

Click the "Authorize" button above and enter: \`Bearer <your-token>\`

**Note:** In development, you can set \`SWAGGER_DISABLE_AUTH=true\` in \`.env.local\` to make organizationCode optional for superadmin login.`,
        version: '1.0.0',
        contact: {
          name: 'API Support',
          email: 'support@smartroutehub.com',
        },
      },
      servers: [
        {
          url: `http://localhost:${appConfig.port}`,
          description: appConfig.isProduction ? 'Production server' : 'Development server',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
        schemas: {
          // Common schemas will be auto-registered from route files
          // This is a placeholder - schemas are defined in route files
        },
      },
      tags: [
        { name: 'Authentication', description: 'Authentication endpoints' },
        { name: 'Organizations', description: 'Organization management' },
        { name: 'Students', description: 'Student management' },
        { name: 'Buses', description: 'Bus management' },
        { name: 'Routes', description: 'Route management' },
        { name: 'Drivers', description: 'Driver management' },
        { name: 'Trips', description: 'Trip management and tracking' },
        { name: 'Analytics', description: 'Analytics and insights' },
        { name: 'Assignments', description: 'Student-bus-route assignments' },
        { name: 'Subscriptions', description: 'Transport subscription management' },
        { name: 'Users', description: 'User management' },
        { name: 'Maps', description: 'Google Maps integration' },
        { name: 'SuperAdmin', description: 'Superadmin operations' },
        { name: 'Notifications', description: 'Real-time notifications' },
        { name: 'Roles', description: 'Role and permission management' },
        { name: 'Permissions', description: 'Permission management' },
      ],
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  });

  // Set error handler
  fastify.setErrorHandler(errorHandler);

  // Health check
  fastify.get('/health', async () => {
    const dbConnected = await testConnection();
    const redisConnected = await testRedisConnection();
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: appConfig.env,
      database: dbConnected ? 'connected' : 'disconnected',
      redis: redisConnected ? 'connected' : 'disconnected',
    };
  });

  // Profiling endpoint (only in development/staging)
  if (!appConfig.isProduction || appConfig.profiling.enabled) {
    fastify.get('/api/profiling/stats', {
      schema: {
        description: 'Get profiling statistics',
        tags: ['Profiling'],
        security: appConfig.isProduction ? [{ bearerAuth: [] }] : [],
      },
    }, async (request, reply) => {
      if (appConfig.isProduction) {
        // In production, require authentication
        try {
          await request.jwtVerify();
        } catch (err) {
          reply.code(401).send({ error: 'Unauthorized' });
          return;
        }
      }

      const stats = getProfilingStats();
      const memory = getMemoryProfile();
      const dbStats = await getDatabaseStats();

      return {
        profiling: {
          enabled: appConfig.profiling.enabled,
          requestProfiling: appConfig.profiling.requestProfiling,
          queryProfiling: appConfig.profiling.queryProfiling,
          memoryProfiling: appConfig.profiling.memoryProfiling,
        },
        requests: stats,
        memory,
        database: dbStats,
        timestamp: new Date().toISOString(),
      };
    });
  }

  // Register routes
  await fastify.register(authRoutes, { prefix: '/api/auth' });
  await fastify.register(organizationsRoutes, { prefix: '/api/organizations' });
  await fastify.register(studentsRoutes, { prefix: '/api/students' });
  await fastify.register(busesRoutes, { prefix: '/api/buses' });
  await fastify.register(routesRoutes, { prefix: '/api/routes' });
  await fastify.register(driversRoutes, { prefix: '/api/drivers' });
  await fastify.register(tripsRoutes, { prefix: '/api/trips' });
  await fastify.register(analyticsRoutes, { prefix: '/api/analytics' });
  await fastify.register(assignmentsRoutes, { prefix: '/api/assignments' });
  await fastify.register(subscriptionsRoutes, { prefix: '/api/subscriptions' });
  await fastify.register(usersRoutes, { prefix: '/api/users' });
  await fastify.register(mapsRoutes, { prefix: '/api/maps' });
  await fastify.register(superadminRoutes, { prefix: '/api/superadmin' });
  await fastify.register(notificationsRoutes, { prefix: '/api/notifications' });
  await fastify.register(permissionsRoutes, { prefix: '/api/permissions' });
  await fastify.register(rolesRoutes, { prefix: '/api/roles' });

  return fastify;
}

async function start() {
  try {
    // Initialize database (create if not exists, run migrations, seed)
    if (appConfig.autoInitDb) {
      logger.info('Initializing database (auto-create, migrations, seeds)...');
      try {
        const dbInitService = new DatabaseInitService();
        await dbInitService.initialize();
        logger.info('Database initialization completed');
      } catch (error: any) {
        logger.warn({
          message: 'Database auto-initialization failed, continuing with connection test',
          error: error.message,
        });
      }
    }

    // Test database connection
    logger.info('Testing database connection...');
    const dbConnected = await testConnection();
    if (!dbConnected) {
      logger.error('Failed to connect to database. Exiting...');
      process.exit(1);
    }
    logger.info('Database connected successfully');

    // Connect to Redis
    try {
      logger.info('Connecting to Redis...');
      await connectRedis();
      const redisConnected = await testRedisConnection();
      if (redisConnected) {
        logger.info('Redis connected successfully');
      } else {
        logger.warn('Redis connection failed, notifications may not work');
      }
    } catch (error: any) {
      logger.warn({
        message: 'Redis connection failed, continuing without Redis',
        error: error.message,
      });
    }

    // Build and start server
    const server = await buildServer();
    
    await server.listen({ port: appConfig.port, host: appConfig.host });
    
    logger.info({
      message: `Server started successfully`,
      port: appConfig.port,
      host: appConfig.host,
      environment: appConfig.env,
      docs: `http://${appConfig.host}:${appConfig.port}/docs`,
      profiling: {
        enabled: appConfig.profiling.enabled,
        statsEndpoint: appConfig.isProduction ? '/api/profiling/stats (auth required)' : '/api/profiling/stats',
      },
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info({ message: `Received ${signal}, shutting down gracefully...` });
      
      try {
        await server.close();
        await closeConnection();
        await disconnectRedis();
        logger.info('Server closed successfully');
        process.exit(0);
      } catch (error) {
        logger.error({ error, message: 'Error during shutdown' });
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error: any) {
    logger.error({ 
      error: {
        message: error?.message,
        stack: error?.stack,
        code: error?.code,
        name: error?.name,
        ...error
      }, 
      message: 'Failed to start server' 
    });
    process.exit(1);
  }
}

start();

