import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { appConfig } from './index';

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Create transports
const transports: winston.transport[] = [
  // Console transport
  new winston.transports.Console({
    format: appConfig.isProduction ? logFormat : consoleFormat,
    level: appConfig.logging.level,
  }),
  // Daily rotate file transport for all logs
  new DailyRotateFile({
    filename: path.join(appConfig.logging.filePath, 'application-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    format: logFormat,
    level: appConfig.logging.level,
  }),
  // Error log file
  new DailyRotateFile({
    filename: path.join(appConfig.logging.filePath, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '30d',
    format: logFormat,
    level: 'error',
  }),
  // Access log file
  new DailyRotateFile({
    filename: path.join(appConfig.logging.filePath, 'access-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    format: logFormat,
  }),
];

// Create logger instance
export const logger = winston.createLogger({
  level: appConfig.logging.level,
  format: logFormat,
  transports,
  exceptionHandlers: [
    new DailyRotateFile({
      filename: path.join(appConfig.logging.filePath, 'exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
    }),
  ],
  rejectionHandlers: [
    new DailyRotateFile({
      filename: path.join(appConfig.logging.filePath, 'rejections-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
    }),
  ],
});

// Stream for Fastify
export const loggerStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};
