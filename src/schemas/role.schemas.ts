/**
 * Role-specific Swagger schemas
 */

export const roleSchemas = {
  CreateRoleRequest: {
    type: 'object',
    required: ['data'],
    properties: {
      data: {
        type: 'object',
        required: ['name', 'permissionIds'],
        properties: {
          name: {
            type: 'string',
            minLength: 1,
            maxLength: 100,
            description: 'Role name (must be unique within organization)',
          },
          description: {
            type: 'string',
            maxLength: 500,
            description: 'Role description',
          },
          permissionIds: {
            type: 'array',
            minItems: 0,
            items: {
              type: 'string',
              format: 'uuid',
            },
            description: 'Array of permission UUIDs to assign to this role',
          },
        },
      },
    },
  },

  UpdateRoleRequest: {
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
            description: 'Role name (must be unique within organization)',
          },
          description: {
            type: 'string',
            maxLength: 500,
            description: 'Role description',
          },
          permissionIds: {
            type: 'array',
            minItems: 0,
            items: {
              type: 'string',
              format: 'uuid',
            },
            description: 'Array of permission UUIDs to assign to this role',
          },
        },
      },
    },
  },

  Permission: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
        description: 'Permission UUID',
      },
      name: {
        type: 'string',
        description: 'Permission name',
      },
      code: {
        type: 'string',
        description: 'Permission code',
      },
      description: {
        type: 'string',
        description: 'Permission description',
      },
    },
    required: ['id', 'name', 'code'],
  },

  Role: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
        description: 'Role UUID',
      },
      name: {
        type: 'string',
        description: 'Role name',
      },
      description: {
        type: 'string',
        nullable: true,
        description: 'Role description',
      },
      type: {
        type: 'string',
        enum: ['default', 'custom'],
        description: 'Role type: default (system) or custom (user-created)',
      },
      allow_delete: {
        type: 'boolean',
        description: 'Whether the role can be deleted',
      },
      permissions: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: true,
        },
        description: 'List of permissions assigned to this role',
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
    required: ['id', 'name', 'type', 'allow_delete', 'permissions', 'created_at', 'updated_at'],
  },

  RoleList: {
    type: 'array',
    items: {
      type: 'object',
      additionalProperties: true,
    },
  },

  RoleQuery: {
    type: 'object',
    properties: {
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

  DeleteRoleResponse: {
    type: 'object',
    properties: {
      success: {
        type: 'boolean',
      },
      message: {
        type: 'string',
      },
    },
    required: ['success', 'message'],
  },
};

