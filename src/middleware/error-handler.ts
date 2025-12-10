import { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../config/logger';

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  // Log error
  logger.error({
    error: {
      message: error.message,
      stack: error.stack,
      code: error.code,
      statusCode: error.statusCode,
    },
    request: {
      method: request.method,
      url: request.url,
      headers: request.headers,
      body: request.body,
      user: request.user,
    },
  });

  // Handle specific error types
  if (error.validation) {
    reply.code(400).send({
      error: 'Validation Error',
      details: error.validation,
    });
    return;
  }

  if (error.statusCode) {
    reply.code(error.statusCode).send({
      error: error.message,
    });
    return;
  }

  // Default 500 error
  reply.code(500).send({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal Server Error' 
      : error.message,
  });
}

