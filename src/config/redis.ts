import Redis from 'ioredis';
import { appConfig } from './index';
import { logger } from './logger';

let redisClient: Redis | null = null;
let redisSubscriber: Redis | null = null;
let redisPublisher: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      host: appConfig.redis.host,
      port: appConfig.redis.port,
      password: appConfig.redis.password,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
    });

    redisClient.on('connect', () => {
      logger.info({
        message: 'Redis client connected',
        host: appConfig.redis.host,
        port: appConfig.redis.port,
      });
    });

    redisClient.on('error', (error) => {
      logger.error({
        message: 'Redis client error',
        error: error.message,
      });
    });

    redisClient.on('close', () => {
      logger.warn({ message: 'Redis client connection closed' });
    });

    redisClient.on('reconnecting', () => {
      logger.info({ message: 'Redis client reconnecting' });
    });
  }

  return redisClient;
}

export function getRedisSubscriber(): Redis {
  if (!redisSubscriber) {
    redisSubscriber = new Redis({
      host: appConfig.redis.host,
      port: appConfig.redis.port,
      password: appConfig.redis.password,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
    });

    redisSubscriber.on('connect', () => {
      logger.info({ message: 'Redis subscriber connected' });
    });

    redisSubscriber.on('error', (error) => {
      logger.error({
        message: 'Redis subscriber error',
        error: error.message,
      });
    });
  }

  return redisSubscriber;
}

export function getRedisPublisher(): Redis {
  if (!redisPublisher) {
    redisPublisher = new Redis({
      host: appConfig.redis.host,
      port: appConfig.redis.port,
      password: appConfig.redis.password,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
    });

    redisPublisher.on('connect', () => {
      logger.info({ message: 'Redis publisher connected' });
    });

    redisPublisher.on('error', (error) => {
      logger.error({
        message: 'Redis publisher error',
        error: error.message,
      });
    });
  }

  return redisPublisher;
}

export async function connectRedis(): Promise<void> {
  try {
    const client = getRedisClient();
    await client.connect();
    logger.info({ message: 'Redis connected successfully' });
  } catch (error: any) {
    logger.error({
      message: 'Failed to connect to Redis',
      error: error.message,
    });
    throw error;
  }
}

export async function disconnectRedis(): Promise<void> {
  try {
    if (redisClient) {
      await redisClient.quit();
      redisClient = null;
    }
    if (redisSubscriber) {
      await redisSubscriber.quit();
      redisSubscriber = null;
    }
    if (redisPublisher) {
      await redisPublisher.quit();
      redisPublisher = null;
    }
    logger.info({ message: 'Redis disconnected' });
  } catch (error: any) {
    logger.error({
      message: 'Error disconnecting Redis',
      error: error.message,
    });
  }
}

export async function testRedisConnection(): Promise<boolean> {
  try {
    const client = getRedisClient();
    await client.ping();
    return true;
  } catch (error) {
    return false;
  }
}

