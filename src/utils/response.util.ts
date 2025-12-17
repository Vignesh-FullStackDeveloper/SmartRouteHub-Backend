import { FastifyReply } from 'fastify';

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  message?: string;
}

export interface StandardResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  details?: any;
  code?: string;
}

/**
 * Send a successful response with optional pagination
 */
export function sendSuccess<T>(
  reply: FastifyReply,
  data: T[] | T,
  message?: string,
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  }
): void {
  if (Array.isArray(data) && pagination) {
    const response: PaginatedResponse<T> = {
      success: true,
      data,
      pagination,
      ...(message && { message }),
    };
    reply.send(response);
  } else {
    const response: StandardResponse<T> = {
      success: true,
      data: data as T,
      ...(message && { message }),
    };
    reply.send(response);
  }
}

/**
 * Send an error response
 */
export function sendError(
  reply: FastifyReply,
  statusCode: number,
  error: string,
  details?: any,
  code?: string
): void {
  const response: ErrorResponse = {
    success: false,
    error,
    ...(details && { details }),
    ...(code && { code }),
  };
  reply.code(statusCode).send(response);
}

/**
 * Parse pagination parameters from query string
 */
export function parsePagination(query: any): PaginationParams {
  const limit = query.limit ? parseInt(query.limit, 10) : undefined;
  const offset = query.offset ? parseInt(query.offset, 10) : undefined;

  // Validate pagination parameters
  if (limit !== undefined && (isNaN(limit) || limit < 1)) {
    throw new Error('Invalid limit parameter. Must be a positive integer.');
  }
  if (offset !== undefined && (isNaN(offset) || offset < 0)) {
    throw new Error('Invalid offset parameter. Must be a non-negative integer.');
  }

  return { limit, offset };
}

/**
 * Apply pagination to a query (deprecated - use service-level pagination)
 * @deprecated Use pagination in services instead
 */
export async function applyPagination<T>(
  query: any,
  pagination?: PaginationParams
): Promise<{ data: T[]; total: number }> {
  if (!pagination || (pagination.limit === undefined && pagination.offset === undefined)) {
    // No pagination - return all results
    const data = await query;
    return { data, total: data.length };
  }

  // Get total count before pagination
  const countQuery = query.clone().clearSelect().clearOrder().count('* as total').first();
  const countResult = await countQuery;
  const total = parseInt(countResult?.total as string) || 0;

  // Apply pagination
  if (pagination.offset !== undefined) {
    query.offset(pagination.offset);
  }
  if (pagination.limit !== undefined) {
    query.limit(pagination.limit);
  }

  const data = await query;

  return { data, total };
}

/**
 * Calculate pagination metadata
 */
export function getPaginationMeta(
  total: number,
  limit?: number,
  offset?: number
): {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
} | undefined {
  if (limit === undefined && offset === undefined) {
    return undefined; // No pagination
  }

  const finalLimit = limit ?? total;
  const finalOffset = offset ?? 0;

  return {
    total,
    limit: finalLimit,
    offset: finalOffset,
    hasMore: finalOffset + finalLimit < total,
  };
}

