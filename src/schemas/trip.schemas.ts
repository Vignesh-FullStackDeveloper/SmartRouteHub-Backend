/**
 * Trip-specific Swagger schemas
 */

export const tripSchemas = {
  StartTripRequest: {
    type: 'object',
    required: ['data'],
    properties: {
      data: {
        type: 'object',
        required: ['bus_id', 'route_id', 'latitude', 'longitude'],
        properties: {
          bus_id: {
            type: 'string',
            format: 'uuid',
            description: 'UUID of the bus for this trip',
          },
          route_id: {
            type: 'string',
            format: 'uuid',
            description: 'UUID of the route for this trip',
          },
          latitude: {
            type: 'number',
            minimum: -90,
            maximum: 90,
            description: 'Starting latitude coordinate',
          },
          longitude: {
            type: 'number',
            minimum: -180,
            maximum: 180,
            description: 'Starting longitude coordinate',
          },
        },
      },
    },
  },

  UpdateLocationRequest: {
    type: 'object',
    required: ['data'],
    properties: {
      data: {
        type: 'object',
        required: ['latitude', 'longitude'],
        properties: {
          latitude: {
            type: 'number',
            minimum: -90,
            maximum: 90,
            description: 'Current latitude coordinate',
          },
          longitude: {
            type: 'number',
            minimum: -180,
            maximum: 180,
            description: 'Current longitude coordinate',
          },
          speed_kmh: {
            type: 'number',
            minimum: 0,
            nullable: true,
            description: 'Current speed in km/h',
          },
          heading: {
            type: 'number',
            minimum: 0,
            maximum: 360,
            nullable: true,
            description: 'Direction of travel in degrees (0-360)',
          },
          accuracy: {
            type: 'number',
            minimum: 0,
            nullable: true,
            description: 'GPS accuracy in meters',
          },
        },
      },
    },
  },

  Trip: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
        description: 'Trip UUID',
      },
      organization_id: {
        type: 'string',
        format: 'uuid',
        description: 'Organization UUID',
      },
      bus_id: {
        type: 'string',
        format: 'uuid',
        description: 'Bus UUID',
      },
      route_id: {
        type: 'string',
        format: 'uuid',
        description: 'Route UUID',
      },
      driver_id: {
        type: 'string',
        format: 'uuid',
        description: 'Driver UUID',
      },
      status: {
        type: 'string',
        enum: ['not_started', 'in_progress', 'completed', 'cancelled'],
        description: 'Trip status',
      },
      start_time: {
        type: 'string',
        format: 'date-time',
        nullable: true,
        description: 'Trip start timestamp',
      },
      end_time: {
        type: 'string',
        format: 'date-time',
        nullable: true,
        description: 'Trip end timestamp',
      },
      current_latitude: {
        type: 'number',
        nullable: true,
        description: 'Current latitude',
      },
      current_longitude: {
        type: 'number',
        nullable: true,
        description: 'Current longitude',
      },
      speed_kmh: {
        type: 'number',
        nullable: true,
        description: 'Current speed in km/h',
      },
      last_update_time: {
        type: 'string',
        format: 'date-time',
        nullable: true,
        description: 'Last location update timestamp',
      },
      passenger_count: {
        type: 'integer',
        description: 'Number of passengers on board',
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
    required: ['id', 'organization_id', 'bus_id', 'route_id', 'driver_id', 'status', 'passenger_count', 'created_at', 'updated_at'],
  },

  TripList: {
    type: 'array',
    items: {
      type: 'object',
      additionalProperties: true,
    },
  },

  TripQuery: {
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
      driver_id: {
        type: 'string',
        format: 'uuid',
        description: 'Filter by driver ID',
      },
      status: {
        type: 'string',
        enum: ['not_started', 'in_progress', 'completed', 'cancelled'],
        description: 'Filter by trip status',
      },
    },
  },
};

