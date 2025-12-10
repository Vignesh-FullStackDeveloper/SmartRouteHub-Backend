import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Migration 002 already includes 'superadmin' in the enum definition
  // This migration is kept for backward compatibility with databases
  // that were created before 'superadmin' was added to the enum
  
  // Check if superadmin already exists, if not, add it
  await knex.raw(`
    DO $$ 
    DECLARE
      enum_type_name text;
      superadmin_exists boolean;
    BEGIN
      -- Find the enum type name for the role column
      SELECT t.typname INTO enum_type_name
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      JOIN information_schema.columns c ON c.udt_name = t.typname
      WHERE c.table_name = 'users' AND c.column_name = 'role'
      LIMIT 1;
      
      -- Check if superadmin exists in the enum
      SELECT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = enum_type_name
        AND e.enumlabel = 'superadmin'
      ) INTO superadmin_exists;
      
      -- If enum type exists and superadmin is not in it, add it
      IF enum_type_name IS NOT NULL AND NOT superadmin_exists THEN
        EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS ''superadmin''', enum_type_name);
      END IF;
      
      -- If it's a text column with check constraint, update the constraint
      IF enum_type_name IS NULL THEN
        ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
        ALTER TABLE users 
        ADD CONSTRAINT users_role_check 
        CHECK (role IN ('superadmin', 'admin', 'driver', 'parent'));
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        -- Silently fail if enum already has superadmin or other issues
        NULL;
    END $$;
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Revert to original enum
  await knex.raw(`
    ALTER TABLE users 
    DROP CONSTRAINT IF EXISTS users_role_check;
  `);
  
  await knex.raw(`
    ALTER TABLE users 
    ADD CONSTRAINT users_role_check 
    CHECK (role IN ('admin', 'driver', 'parent'));
  `);
}

