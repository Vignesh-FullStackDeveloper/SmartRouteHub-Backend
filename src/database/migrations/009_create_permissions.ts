import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Permissions table
  await knex.schema.createTable('permissions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name').notNullable().unique();
    table.string('resource').notNullable(); // e.g., 'student', 'bus', 'route'
    table.string('action').notNullable(); // e.g., 'create', 'read', 'update', 'delete'
    table.text('description').nullable();
    table.timestamps(true, true);
    
    table.unique(['resource', 'action']);
    table.index('resource');
  });

  // Role permissions junction table
  await knex.schema.createTable('role_permissions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('role').notNullable(); // 'admin', 'driver', 'parent'
    table.uuid('permission_id').notNullable().references('id').inTable('permissions').onDelete('CASCADE');
    table.timestamps(true, true);
    
    table.unique(['role', 'permission_id']);
    table.index('role');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('role_permissions');
  await knex.schema.dropTableIfExists('permissions');
}

