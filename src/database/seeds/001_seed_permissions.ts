import { Knex } from 'knex';

/**
 * NOTE: This seed is now deprecated.
 * Permissions and role_permissions are no longer used.
 * 
 * The system now uses features and roles in organization-specific databases.
 * Features and roles should be created per organization as needed.
 * 
 * This seed is kept for backward compatibility but does nothing.
 */
export async function seed(_knex: Knex): Promise<void> {
  // Permissions and role_permissions are no longer used
  // Features and roles are now in organization databases
  // This seed is kept for backward compatibility
  console.log('Permissions seed skipped - using features/roles in organization databases instead');
}

