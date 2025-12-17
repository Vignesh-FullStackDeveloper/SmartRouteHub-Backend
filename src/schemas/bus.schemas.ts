/**
 * Bus-specific Swagger schemas
 */

export const busSchemas = {
  CreateBusRequest: {
    type: 'object',
    required: ['data'],
    properties: {
      data: {
        type: 'object',
        required: ['bus_number', 'capacity'],
        properties: {
          bus_number: {
            type: 'string',
            minLength: 1,
            maxLength: 50,
            description: 'Unique bus number/identifier',
          },
          capacity: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            description: 'Maximum passenger capacity',
          },
          driver_id: {
            type: 'string',
            format: 'uuid',
            nullable: true,
            description: 'UUID of assigned driver',
          },
          assigned_route_id: {
            type: 'string',
            format: 'uuid',
            nullable: true,
            description: 'UUID of assigned route',
          },
          is_active: {
            type: 'boolean',
            default: true,
            description: 'Whether the bus is active',
          },
          metadata: {
            type: 'object',
            additionalProperties: true,
            nullable: true,
            description: 'Additional bus metadata (e.g., make, model, year)',
          },
        },
      },
    },
  },

  UpdateBusRequest: {
    type: 'object',
    required: ['data'],
    properties: {
      data: {
        type: 'object',
        properties: {
          bus_number: {
            type: 'string',
            minLength: 1,
            maxLength: 50,
            description: 'Bus number/identifier',
          },
          capacity: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            description: 'Maximum passenger capacity',
          },
          driver_id: {
            type: 'string',
            format: 'uuid',
            nullable: true,
            description: 'UUID of assigned driver',
          },
          assigned_route_id: {
            type: 'string',
            format: 'uuid',
            nullable: true,
            description: 'UUID of assigned route',
          },
          is_active: {
            type: 'boolean',
            description: 'Whether the bus is active',
          },
          metadata: {
            type: 'object',
            additionalProperties: true,
            nullable: true,
            description: 'Additional bus metadata',
          },
        },
      },
    },
  },

  Bus: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
        description: 'Bus UUID',
      },
      organization_id: {
        type: 'string',
        format: 'uuid',
        description: 'Organization UUID',
      },
      bus_number: {
        type: 'string',
        description: 'Bus number/identifier',
      },
      capacity: {
        type: 'integer',
        description: 'Maximum passenger capacity',
      },
      driver_id: {
        type: 'string',
        format: 'uuid',
        nullable: true,
        description: 'Assigned driver UUID',
      },
      assigned_route_id: {
        type: 'string',
        format: 'uuid',
        nullable: true,
        description: 'Assigned route UUID',
      },
      is_active: {
        type: 'boolean',
        description: 'Whether the bus is active',
      },
      metadata: {
        type: 'object',
        additionalProperties: true,
        nullable: true,
        description: 'Additional bus metadata',
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
    required: ['id', 'organization_id', 'bus_number', 'capacity', 'is_active', 'created_at', 'updated_at'],
  },

  BusList: {
    type: 'array',
    items: {
      type: 'object',
      additionalProperties: true,
    },
  },

  BusQuery: {
    type: 'object',
    properties: {
      route_id: {
        type: 'string',
        format: 'uuid',
        description: 'Filter by route ID',
      },
      driver_id: {
        type: 'string',
        format: 'uuid',
        description: 'Filter by driver ID',
      },
      student_id: {
        type: 'string',
        format: 'uuid',
        description: 'Filter by student ID (returns bus assigned to student)',
      },
      is_active: {
        type: 'boolean',
        description: 'Filter by active status',
      },
    },
  },
};

