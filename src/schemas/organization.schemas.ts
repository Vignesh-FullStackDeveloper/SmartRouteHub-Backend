/**
 * Organization-specific Swagger schemas
 */

export const organizationSchemas = {
  CreateOrganizationRequest: {
    type: 'object',
    required: ['data'],
    properties: {
      data: {
        type: 'object',
        required: ['name', 'code'],
        properties: {
          name: {
            type: 'string',
            minLength: 1,
            maxLength: 100,
            description: 'Organization name',
          },
          code: {
            type: 'string',
            minLength: 1,
            maxLength: 50,
            pattern: '^[a-z0-9_]+$',
            description: 'Unique organization code (lowercase letters, numbers, underscores only)',
          },
          primary_color: {
            type: 'string',
            pattern: '^#[0-9A-F]{6}$',
            description: 'Primary brand color in hex format',
            default: '#2196F3',
          },
          contact_email: {
            type: 'string',
            format: 'email',
            nullable: true,
            description: 'Organization contact email',
          },
          contact_phone: {
            type: 'string',
            nullable: true,
            description: 'Organization contact phone',
          },
          address: {
            type: 'string',
            nullable: true,
            description: 'Organization address',
          },
          admin: {
            type: 'object',
            description: 'Optional: Create admin user along with organization',
            properties: {
              name: {
                type: 'string',
                minLength: 1,
                description: 'Admin user name',
              },
              email: {
                type: 'string',
                format: 'email',
                description: 'Admin user email',
              },
              password: {
                type: 'string',
                minLength: 6,
                description: 'Admin user password (minimum 6 characters)',
              },
              phone: {
                type: 'string',
                nullable: true,
                description: 'Admin user phone',
              },
            },
            required: ['name', 'email', 'password'],
          },
        },
      },
    },
  },

  UpdateOrganizationRequest: {
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
            description: 'Organization name',
          },
          code: {
            type: 'string',
            minLength: 1,
            maxLength: 50,
            pattern: '^[a-z0-9_]+$',
            description: 'Unique organization code',
          },
          primary_color: {
            type: 'string',
            pattern: '^#[0-9A-F]{6}$',
            description: 'Primary brand color',
          },
          contact_email: {
            type: 'string',
            format: 'email',
            nullable: true,
            description: 'Contact email',
          },
          contact_phone: {
            type: 'string',
            nullable: true,
            description: 'Contact phone',
          },
          address: {
            type: 'string',
            nullable: true,
            description: 'Organization address',
          },
          is_active: {
            type: 'boolean',
            description: 'Whether the organization is active',
          },
        },
      },
    },
  },

  Organization: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
        description: 'Organization UUID',
      },
      name: {
        type: 'string',
        description: 'Organization name',
      },
      code: {
        type: 'string',
        description: 'Organization code',
      },
      primary_color: {
        type: 'string',
        description: 'Primary brand color',
      },
      contact_email: {
        type: 'string',
        format: 'email',
        nullable: true,
        description: 'Contact email',
      },
      contact_phone: {
        type: 'string',
        nullable: true,
        description: 'Contact phone',
      },
      address: {
        type: 'string',
        nullable: true,
        description: 'Organization address',
      },
      logo_url: {
        type: 'string',
        nullable: true,
        description: 'Logo URL',
      },
      is_active: {
        type: 'boolean',
        description: 'Whether the organization is active',
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
    required: ['id', 'name', 'code', 'primary_color', 'is_active', 'created_at', 'updated_at'],
  },

  OrganizationWithAdmin: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
        description: 'Organization UUID',
      },
      name: {
        type: 'string',
        description: 'Organization name',
      },
      code: {
        type: 'string',
        description: 'Organization code',
      },
      primary_color: {
        type: 'string',
        description: 'Primary brand color',
      },
      contact_email: {
        type: 'string',
        format: 'email',
        nullable: true,
        description: 'Contact email',
      },
      contact_phone: {
        type: 'string',
        nullable: true,
        description: 'Contact phone',
      },
      address: {
        type: 'string',
        nullable: true,
        description: 'Organization address',
      },
      logo_url: {
        type: 'string',
        nullable: true,
        description: 'Logo URL',
      },
      is_active: {
        type: 'boolean',
        description: 'Whether the organization is active',
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
      admin: {
        type: 'object',
        nullable: true,
        description: 'Admin user details (only present if admin was created)',
        properties: {
          user: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              email: { type: 'string' },
              name: { type: 'string' },
              role: { type: 'string', enum: ['admin'] },
              organization_id: { type: 'string', format: 'uuid' },
            },
          },
          token: {
            type: 'string',
            description: 'JWT token for the admin user',
          },
        },
      },
    },
    required: ['id', 'name', 'code', 'primary_color', 'is_active', 'created_at', 'updated_at'],
  },
};

