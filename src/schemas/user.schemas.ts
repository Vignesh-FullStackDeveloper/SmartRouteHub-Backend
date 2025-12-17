/**
 * User-specific Swagger schemas
 */

export const userSchemas = {
  CreateUserRequest: {
    type: 'object',
    required: ['data'],
    properties: {
      data: {
        type: 'object',
        required: ['name', 'email', 'password', 'role'],
        properties: {
          name: {
        type: 'string',
        minLength: 1,
        maxLength: 100,
        description: 'User full name',
      },
      email: {
        type: 'string',
        format: 'email',
        description: 'User email address (must be unique within organization)',
      },
      phone: {
        type: 'string',
        nullable: true,
        description: 'User phone number',
      },
      password: {
        type: 'string',
        minLength: 6,
        description: 'User password (minimum 6 characters)',
      },
      role: {
        type: 'string',
        enum: ['admin', 'driver', 'parent'],
        description: 'User role',
      },
      role_id: {
        type: 'string',
        format: 'uuid',
        nullable: true,
        description: 'Custom role UUID (optional, for custom permissions)',
      },
          driver_id: {
            type: 'string',
            nullable: true,
            description: 'Driver ID (required if role is driver)',
          },
        },
      },
    },
  },

  UpdateUserRequest: {
    type: 'object',
    required: ['data'],
    properties: {
      data: {
        type: 'object',
        properties: {
          name: {
        type: 'string',
        minLength: 1,
        maxLength: 100,
        description: 'User full name',
      },
      email: {
        type: 'string',
        format: 'email',
        description: 'User email address',
      },
      phone: {
        type: 'string',
        nullable: true,
        description: 'User phone number',
      },
      is_active: {
        type: 'boolean',
        description: 'Whether the user is active',
      },
          role_id: {
            type: 'string',
            format: 'uuid',
            nullable: true,
            description: 'Custom role UUID',
          },
        },
      },
    },
  },

  User: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
        description: 'User UUID',
      },
      organization_id: {
        type: 'string',
        format: 'uuid',
        nullable: true,
        description: 'Organization UUID',
      },
      email: {
        type: 'string',
        format: 'email',
        description: 'User email',
      },
      phone: {
        type: 'string',
        nullable: true,
        description: 'User phone number',
      },
      name: {
        type: 'string',
        description: 'User full name',
      },
      role: {
        type: 'string',
        enum: ['superadmin', 'admin', 'driver', 'parent'],
        description: 'User role',
      },
      role_id: {
        type: 'string',
        format: 'uuid',
        nullable: true,
        description: 'Custom role UUID',
      },
      driver_id: {
        type: 'string',
        nullable: true,
        description: 'Driver ID',
      },
      is_active: {
        type: 'boolean',
        description: 'Whether the user is active',
      },
      last_login: {
        type: 'string',
        format: 'date-time',
        nullable: true,
        description: 'Last login timestamp',
      },
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
    required: ['id', 'email', 'name', 'role', 'is_active', 'created_at', 'updated_at'],
  },

  UserList: {
    type: 'array',
    items: {
      type: 'object',
      additionalProperties: true,
    },
  },

  UserQuery: {
    type: 'object',
    properties: {
      role: {
        type: 'string',
        enum: ['admin', 'driver', 'parent'],
        description: 'Filter by role',
      },
      is_active: {
        type: 'boolean',
        description: 'Filter by active status',
      },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 100,
        description: 'Number of records to return (optional)',
      },
      offset: {
        type: 'integer',
        minimum: 0,
        description: 'Number of records to skip (optional)',
      },
    },
  },
};

