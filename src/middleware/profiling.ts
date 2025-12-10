import { FastifyRequest, FastifyReply } from 'fastify';
import { appConfig } from '../config';
import { logger } from '../config/logger';

interface ProfilingData {
  method: string;
  url: string;
  statusCode: number;
  responseTime: number;
  timestamp: string;
  memory?: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  queryCount?: number;
  queryTime?: number;
}

// Store profiling data per request
const requestProfiles = new Map<string, ProfilingData>();

// Memory profiling
function getMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
    external: Math.round(usage.external / 1024 / 1024), // MB
    rss: Math.round(usage.rss / 1024 / 1024), // MB
  };
}

// Request profiling middleware
export async function requestProfiling(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!appConfig.profiling.enabled || !appConfig.profiling.requestProfiling) {
    return;
  }

  const startTime = Date.now();
  const requestId = request.id as string;
  const startMemory = appConfig.profiling.memoryProfiling ? getMemoryUsage() : undefined;

  // Track query count and time
  let queryCount = 0;
  let queryTime = 0;

  // Store initial profiling data
  requestProfiles.set(requestId, {
    method: request.method,
    url: request.url,
    statusCode: 0,
    responseTime: 0,
    timestamp: new Date().toISOString(),
    memory: startMemory,
    queryCount: 0,
    queryTime: 0,
  });

  // Hook into reply finish using Node.js response event
  reply.raw.on('finish', () => {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    const endMemory = appConfig.profiling.memoryProfiling ? getMemoryUsage() : undefined;

    const profile: ProfilingData = {
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      responseTime,
      timestamp: new Date().toISOString(),
      memory: endMemory,
      queryCount,
      queryTime,
    };

    // Log slow requests
    if (responseTime > appConfig.profiling.slowRequestThreshold) {
      logger.warn({
        message: 'Slow request detected',
        ...profile,
        threshold: appConfig.profiling.slowRequestThreshold,
      });
    }

    // Log profiling data in development
    if (appConfig.isDevelopment) {
      logger.debug({
        message: 'Request profiling',
        ...profile,
      });
    }

    // Store profile
    requestProfiles.set(requestId, profile);

    // Clean up after 5 minutes
    setTimeout(() => {
      requestProfiles.delete(requestId);
    }, 5 * 60 * 1000);
  });
}

// Database query profiling
export function profileQuery(query: string, duration: number): void {
  if (!appConfig.profiling.enabled || !appConfig.profiling.queryProfiling) {
    return;
  }

  if (duration > appConfig.profiling.slowQueryThreshold) {
    logger.warn({
      message: 'Slow query detected',
      query: query.substring(0, 200), // Limit query length
      duration,
      threshold: appConfig.profiling.slowQueryThreshold,
    });
  }

  if (appConfig.isDevelopment) {
    logger.debug({
      message: 'Query profiling',
      query: query.substring(0, 200),
      duration,
    });
  }
}

// Get profiling statistics
export function getProfilingStats(): {
  totalRequests: number;
  averageResponseTime: number;
  slowRequests: number;
  memoryUsage: ReturnType<typeof getMemoryUsage>;
} {
  const profiles = Array.from(requestProfiles.values());
  const totalRequests = profiles.length;
  const averageResponseTime =
    totalRequests > 0
      ? profiles.reduce((sum, p) => sum + p.responseTime, 0) / totalRequests
      : 0;
  const slowRequests = profiles.filter(
    (p) => p.responseTime > appConfig.profiling.slowRequestThreshold
  ).length;

  return {
    totalRequests,
    averageResponseTime: Math.round(averageResponseTime),
    slowRequests,
    memoryUsage: getMemoryUsage(),
  };
}

// Memory profiling endpoint data
export function getMemoryProfile() {
  if (!appConfig.profiling.enabled || !appConfig.profiling.memoryProfiling) {
    return null;
  }

  const usage = process.memoryUsage();
  return {
    heap: {
      used: Math.round(usage.heapUsed / 1024 / 1024),
      total: Math.round(usage.heapTotal / 1024 / 1024),
      percentage: Math.round((usage.heapUsed / usage.heapTotal) * 100),
    },
    external: Math.round(usage.external / 1024 / 1024),
    rss: Math.round(usage.rss / 1024 / 1024),
    uptime: Math.round(process.uptime()),
  };
}

