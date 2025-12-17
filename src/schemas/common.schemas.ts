/**
 * Common Swagger/OpenAPI schemas for reuse across all routes
 * Production-grade schema definitions
 */

export const commonSchemas = {
  // Pagination
  PaginationQuery: {
    type: 'object',
    properties: {
      page: {
        type: 'integer',
        minimum: 1,
        default: 1,
        description: 'Page number (1-indexed)',
      },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 100,
        default: 20,
        description: 'Number of items per page',
      },
      offset: {
        type: 'integer',
        minimum: 0,
        default: 0,
        description: 'Number of items to skip',
      },
    },
  },

  PaginationMeta: {
    type: 'object',
    properties: {
      total: { type: 'integer', description: 'Total number of items' },
      page: { type: 'integer', description: 'Current page number' },
      limit: { type: 'integer', description: 'Items per page' },
      offset: { type: 'integer', description: 'Items skipped' },
      totalPages: { type: 'integer', description: 'Total number of pages' },
      hasNext: { type: 'boolean', description: 'Whether there is a next page' },
      hasPrev: { type: 'boolean', description: 'Whether there is a previous page' },
    },
    required: ['total', 'page', 'limit', 'offset', 'totalPages', 'hasNext', 'hasPrev'],
  },

  // Error Responses
  ErrorResponse: {
    type: 'object',
    properties: {
      error: {
        type: 'string',
        description: 'Error message',
      },
      details: {
        type: 'object',
        description: 'Additional error details',
        additionalProperties: true,
      },
      code: {
        type: 'string',
        description: 'Error code',
      },
    },
    required: ['error'],
  },

  ValidationErrorResponse: {
    type: 'object',
    properties: {
      error: {
        type: 'string',
        description: 'Validation error message',
      },
      details: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            field: { type: 'string' },
            message: { type: 'string' },
            code: { type: 'string' },
          },
        },
      },
    },
    required: ['error', 'details'],
  },

  // Success Response
  SuccessResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
      data: { type: 'object', additionalProperties: true },
    },
    required: ['success', 'message'],
  },

  // UUID Parameter
  UUIDParam: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
        description: 'Resource UUID',
      },
    },
    required: ['id'],
  },

  // Timestamps
  Timestamps: {
    type: 'object',
    properties: {
      created_at: {
        type: 'string',
        format: 'date-time',
        description: 'Creation timestamp',
      },
      updated_at: {
        type: 'string',
        format: 'date-time',
        description: 'Last update timestamp',
      },
    },
  },

  // Organization Code Query (for superadmin)
  OrganizationCodeQuery: {
    type: 'object',
    properties: {
      organizationCode: {
        type: 'string',
        description: 'Organization code (required for superadmin operations)',
      },
    },
  },
};

export const commonResponses = {
  200: {
    description: 'Success',
    content: {
      'application/json': {
        schema: {
          type: 'object',
        },
      },
    },
  },

  201: {
    description: 'Created successfully',
    content: {
      'application/json': {
        schema: {
          type: 'object',
        },
      },
    },
  },

  400: {
    description: 'Bad Request - Invalid input or validation error',
    content: {
      'application/json': {
        schema: commonSchemas.ErrorResponse,
      },
    },
  },

  401: {
    description: 'Unauthorized - Authentication required',
    content: {
      'application/json': {
        schema: commonSchemas.ErrorResponse,
      },
    },
  },

  403: {
    description: 'Forbidden - Insufficient permissions',
    content: {
      'application/json': {
        schema: commonSchemas.ErrorResponse,
      },
    },
  },

  404: {
    description: 'Not Found - Resource does not exist',
    content: {
      'application/json': {
        schema: commonSchemas.ErrorResponse,
      },
    },
  },

  409: {
    description: 'Conflict - Resource already exists',
    content: {
      'application/json': {
        schema: commonSchemas.ErrorResponse,
      },
    },
  },

  500: {
    description: 'Internal Server Error',
    content: {
      'application/json': {
        schema: commonSchemas.ErrorResponse,
      },
    },
  },
};

