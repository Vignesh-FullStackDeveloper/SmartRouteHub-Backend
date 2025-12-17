/**
 * Production-grade error handling utilities
 * Provides consistent error responses across all routes
 */

import { FastifyReply } from 'fastify';

export interface ApiError {
  message: string;
  code?: string;
  statusCode?: number;
  details?: any;
}

export class AppError extends Error {
  statusCode: number;
  code?: string;
  details?: any;

  constructor(message: string, statusCode: number = 500, code?: string, details?: any) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Send standardized error response
 */
export function sendErrorResponse(reply: FastifyReply, error: Error | AppError | any): void {
  let statusCode = 500;
  let message = 'Internal server error';
  let code: string | undefined;
  let details: any = undefined;

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
    code = error.code;
    details = error.details;
  } else if (error instanceof Error) {
    message = error.message;
    
    // Determine status code based on error message patterns
    if (error.message.includes('not found')) {
      statusCode = 404;
      code = 'NOT_FOUND';
    } else if (error.message.includes('already exists') || error.message.includes('duplicate')) {
      statusCode = 409;
      code = 'CONFLICT';
    } else if (error.message.includes('permission') || error.message.includes('forbidden') || error.message.includes('Cannot delete default role')) {
      statusCode = 403;
      code = 'FORBIDDEN';
    } else if (error.message.includes('unauthorized') || error.message.includes('authentication')) {
      statusCode = 401;
      code = 'UNAUTHORIZED';
    } else if (error.message.includes('validation') || error.name === 'ZodError') {
      statusCode = 400;
      code = 'VALIDATION_ERROR';
      if (error.errors) {
        details = error.errors.map((err: any) => ({
          field: err.path?.join('.') || 'unknown',
          message: err.message,
          code: err.code,
        }));
      }
    } else if (error.message.includes('required') || error.message.includes('missing')) {
      statusCode = 400;
      code = 'BAD_REQUEST';
    }
  }

  reply.code(statusCode).send({
    error: message,
    ...(code && { code }),
    ...(details && { details }),
  });
}

/**
 * Create standardized success response
 */
export function sendSuccessResponse(
  reply: FastifyReply,
  data: any,
  message: string = 'Success',
  statusCode: number = 200
): void {
  reply.code(statusCode).send({
    success: true,
    message,
    data,
  });
}

/**
 * Common error creators
 */
export const Errors = {
  notFound: (resource: string, id?: string) => 
    new AppError(`${resource} not found${id ? ` with ID: ${id}` : ''}`, 404, 'NOT_FOUND'),
  
  alreadyExists: (resource: string, field: string = 'name') => 
    new AppError(`${resource} with this ${field} already exists`, 409, 'CONFLICT'),
  
  forbidden: (message: string = 'Forbidden: Insufficient permissions') => 
    new AppError(message, 403, 'FORBIDDEN'),
  
  unauthorized: (message: string = 'Unauthorized') => 
    new AppError(message, 401, 'UNAUTHORIZED'),
  
  badRequest: (message: string, details?: any) => 
    new AppError(message, 400, 'BAD_REQUEST', details),
  
  validation: (message: string, details?: any) => 
    new AppError(message, 400, 'VALIDATION_ERROR', details),
  
  internal: (message: string = 'Internal server error') => 
    new AppError(message, 500, 'INTERNAL_ERROR'),
};

