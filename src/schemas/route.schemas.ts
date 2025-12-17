/**
 * Route-specific Swagger schemas
 */

export const routeSchemas = {
  CreateRouteRequest: {
    type: 'object',
    required: ['data'],
    properties: {
      data: {
        type: 'object',
        required: ['name', 'start_time', 'end_time'],
        properties: {
          name: {
            type: 'string',
            minLength: 1,
            maxLength: 100,
            description: 'Route name',
          },
          start_time: {
            type: 'string',
            format: 'time',
            description: 'Route start time (HH:mm format)',
          },
          end_time: {
            type: 'string',
            format: 'time',
            description: 'Route end time (HH:mm format)',
          },
          estimated_duration_minutes: {
            type: 'integer',
            minimum: 0,
            nullable: true,
            description: 'Estimated duration in minutes',
          },
          total_distance_km: {
            type: 'number',
            minimum: 0,
            nullable: true,
            description: 'Total route distance in kilometers',
          },
          assigned_bus_id: {
            type: 'string',
            format: 'uuid',
            nullable: true,
            description: 'UUID of assigned bus',
          },
          is_active: {
            type: 'boolean',
            default: true,
            description: 'Whether the route is active',
          },
          route_polyline: {
            type: 'string',
            nullable: true,
            description: 'Encoded polyline string for route path',
          },
          stops: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: true,
            },
            description: 'Array of route stops',
          },
        },
      },
    },
  },

  UpdateRouteRequest: {
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
            description: 'Route name',
          },
          start_time: {
            type: 'string',
            format: 'time',
            description: 'Route start time',
          },
          end_time: {
            type: 'string',
            format: 'time',
            description: 'Route end time',
          },
          estimated_duration_minutes: {
            type: 'integer',
            minimum: 0,
            nullable: true,
            description: 'Estimated duration in minutes',
          },
          total_distance_km: {
            type: 'number',
            minimum: 0,
            nullable: true,
            description: 'Total route distance in kilometers',
          },
          assigned_bus_id: {
            type: 'string',
            format: 'uuid',
            nullable: true,
            description: 'UUID of assigned bus',
          },
          is_active: {
            type: 'boolean',
            description: 'Whether the route is active',
          },
          route_polyline: {
            type: 'string',
            nullable: true,
            description: 'Encoded polyline string',
          },
          stops: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: true,
            },
            description: 'Array of route stops',
          },
        },
      },
    },
  },

  Route: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
        description: 'Route UUID',
      },
      organization_id: {
        type: 'string',
        format: 'uuid',
        description: 'Organization UUID',
      },
      name: {
        type: 'string',
        description: 'Route name',
      },
      start_time: {
        type: 'string',
        description: 'Route start time',
      },
      end_time: {
        type: 'string',
        description: 'Route end time',
      },
      estimated_duration_minutes: {
        type: 'integer',
        nullable: true,
        description: 'Estimated duration in minutes',
      },
      total_distance_km: {
        type: 'number',
        nullable: true,
        description: 'Total distance in kilometers',
      },
      assigned_bus_id: {
        type: 'string',
        format: 'uuid',
        nullable: true,
        description: 'Assigned bus UUID',
      },
      is_active: {
        type: 'boolean',
        description: 'Whether the route is active',
      },
      route_polyline: {
        type: 'string',
        nullable: true,
        description: 'Encoded polyline string',
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
    required: ['id', 'organization_id', 'name', 'start_time', 'end_time', 'is_active', 'created_at', 'updated_at'],
  },

  RouteList: {
    type: 'array',
    items: {
      type: 'object',
      additionalProperties: true,
    },
  },

  RouteQuery: {
    type: 'object',
    properties: {
      bus_id: {
        type: 'string',
        format: 'uuid',
        description: 'Filter by bus ID',
      },
      driver_id: {
        type: 'string',
        format: 'uuid',
        description: 'Filter by driver ID (returns routes for driver\'s bus)',
      },
      student_id: {
        type: 'string',
        format: 'uuid',
        description: 'Filter by student ID (returns routes assigned to student)',
      },
      is_active: {
        type: 'boolean',
        description: 'Filter by active status',
      },
    },
  },
};

