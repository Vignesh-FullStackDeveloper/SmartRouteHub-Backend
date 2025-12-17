/**
 * Student-specific Swagger schemas
 */

export const studentSchemas = {
  CreateStudentRequest: {
    type: 'object',
    required: ['data'],
    properties: {
      data: {
        type: 'object',
        required: ['name', 'class_grade', 'section', 'parent_id', 'parent_contact'],
        properties: {
          name: {
        type: 'string',
        minLength: 1,
        maxLength: 100,
        description: 'Student full name',
      },
          class_grade: {
            type: 'string',
            minLength: 1,
            maxLength: 50,
            description: 'Class or grade level',
          },
          section: {
            type: 'string',
            minLength: 1,
            maxLength: 10,
            description: 'Section identifier',
          },
          parent_id: {
            type: 'string',
            format: 'uuid',
            description: 'UUID of the parent user (required)',
          },
          parent_contact: {
            type: 'string',
            minLength: 1,
            description: 'Parent contact number',
          },
          pickup_point_id: {
            type: 'string',
            format: 'uuid',
            nullable: true,
            description: 'UUID of the pickup point/stop',
          },
          assigned_bus_id: {
            type: 'string',
            format: 'uuid',
            nullable: true,
            description: 'UUID of the assigned bus',
          },
          assigned_route_id: {
            type: 'string',
            format: 'uuid',
            nullable: true,
            description: 'UUID of the assigned route',
          },
          is_active: {
            type: 'boolean',
            default: true,
            description: 'Whether the student is active',
          },
        },
      },
    },
  },

  UpdateStudentRequest: {
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
            description: 'Student full name',
          },
          class_grade: {
            type: 'string',
            minLength: 1,
            maxLength: 50,
            description: 'Class or grade level',
          },
          section: {
            type: 'string',
            minLength: 1,
            maxLength: 10,
            description: 'Section identifier',
          },
          parent_id: {
            type: 'string',
            format: 'uuid',
            description: 'UUID of the parent user (required on update)',
          },
          parent_contact: {
            type: 'string',
            minLength: 1,
            description: 'Parent contact number',
          },
          pickup_point_id: {
            type: 'string',
            format: 'uuid',
            nullable: true,
            description: 'UUID of the pickup point/stop',
          },
          assigned_bus_id: {
            type: 'string',
            format: 'uuid',
            nullable: true,
            description: 'UUID of the assigned bus',
          },
          assigned_route_id: {
            type: 'string',
            format: 'uuid',
            nullable: true,
            description: 'UUID of the assigned route',
          },
          is_active: {
            type: 'boolean',
            description: 'Whether the student is active',
          },
        },
      },
    },
  },

  Student: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
        description: 'Student UUID',
      },
      organization_id: {
        type: 'string',
        format: 'uuid',
        description: 'Organization UUID',
      },
      name: {
        type: 'string',
        description: 'Student full name',
      },
      class_grade: {
        type: 'string',
        description: 'Class or grade level',
      },
      section: {
        type: 'string',
        description: 'Section identifier',
      },
      parent_id: {
        type: 'string',
        format: 'uuid',
        description: 'Parent user UUID',
      },
      parent_contact: {
        type: 'string',
        description: 'Parent contact number',
      },
      pickup_point_id: {
        type: 'string',
        format: 'uuid',
        nullable: true,
        description: 'Pickup point UUID',
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
      is_active: {
        type: 'boolean',
        description: 'Whether the student is active',
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
    required: ['id', 'organization_id', 'name', 'class_grade', 'section', 'parent_id', 'parent_contact', 'is_active', 'created_at', 'updated_at'],
  },

  StudentList: {
    type: 'array',
    items: {
      type: 'object',
      additionalProperties: true,
    },
  },

  StudentQuery: {
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
      class_grade: {
        type: 'string',
        description: 'Filter by class/grade',
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

