/**
 * Driver-specific Swagger schemas
 */

export const driverSchemas = {
  CreateDriverRequest: {
    type: 'object',
    required: ['data'],
    properties: {
      data: {
        type: 'object',
        required: ['name', 'email', 'password', 'driver_id'],
        properties: {
          name: {
            type: 'string',
            minLength: 1,
            maxLength: 100,
            description: 'Driver full name',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'Driver email address (must be unique within organization)',
          },
          phone: {
            type: 'string',
            nullable: true,
            description: 'Driver phone number',
          },
          password: {
            type: 'string',
            minLength: 6,
            description: 'Driver password (minimum 6 characters)',
          },
          driver_id: {
            type: 'string',
            minLength: 1,
            description: 'Unique driver identifier (e.g., license number)',
          },
        },
      },
    },
  },

  UpdateDriverRequest: {
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
            description: 'Driver full name',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'Driver email address',
          },
          phone: {
            type: 'string',
            nullable: true,
            description: 'Driver phone number',
          },
          driver_id: {
            type: 'string',
            minLength: 1,
            description: 'Driver identifier',
          },
          is_active: {
            type: 'boolean',
            description: 'Whether the driver is active',
          },
          assigned_bus_id: {
            type: 'string',
            format: 'uuid',
            nullable: true,
            description: 'UUID of assigned bus',
          },
          assigned_route_id: {
            type: 'string',
            format: 'uuid',
            nullable: true,
            description: 'UUID of assigned route',
          },
        },
      },
    },
  },

  Driver: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
        description: 'Driver UUID',
      },
      organization_id: {
        type: 'string',
        format: 'uuid',
        description: 'Organization UUID',
      },
      name: {
        type: 'string',
        description: 'Driver full name',
      },
      email: {
        type: 'string',
        format: 'email',
        description: 'Driver email',
      },
      phone: {
        type: 'string',
        nullable: true,
        description: 'Driver phone number',
      },
      driver_id: {
        type: 'string',
        description: 'Driver identifier',
      },
      role: {
        type: 'string',
        enum: ['driver'],
        description: 'User role',
      },
      is_active: {
        type: 'boolean',
        description: 'Whether the driver is active',
      },
      assigned_bus_id: {
        type: 'string',
        format: 'uuid',
        nullable: true,
        description: 'Assigned bus UUID',
      },
      assigned_route_id: {
        type: 'string',
        format: 'uuid',
        nullable: true,
        description: 'Assigned route UUID',
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
    required: ['id', 'organization_id', 'name', 'email', 'driver_id', 'role', 'is_active', 'created_at', 'updated_at'],
  },

  DriverList: {
    type: 'array',
    items: {
      type: 'object',
      additionalProperties: true,
    },
  },

  DriverQuery: {
    type: 'object',
    properties: {
      bus_id: {
        type: 'string',
        format: 'uuid',
        description: 'Filter by bus ID',
      },
      route_id: {
        type: 'string',
        format: 'uuid',
        description: 'Filter by route ID',
      },
      student_id: {
        type: 'string',
        format: 'uuid',
        description: 'Filter by student ID (returns driver for student\'s bus)',
      },
      has_bus: {
        type: 'boolean',
        description: 'Filter drivers with/without assigned bus',
      },
      is_active: {
        type: 'boolean',
        description: 'Filter by active status',
      },
    },
  },
};

