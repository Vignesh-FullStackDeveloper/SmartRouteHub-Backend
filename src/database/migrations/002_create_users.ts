import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('organization_id').nullable().references('id').inTable('organizations').onDelete('CASCADE');
    table.string('email').notNullable();
    table.string('phone');
    table.string('name').notNullable();
    table.string('password_hash').notNullable();
    table.enum('role', ['superadmin', 'admin', 'driver', 'parent']).notNullable();
    table.string('driver_id').nullable();
    table.boolean('is_active').defaultTo(true);
    table.timestamp('last_login').nullable();
    table.timestamps(true, true);
    
    table.unique(['organization_id', 'email']); // organization_id can be null for superadmin
    table.index('organization_id');
    table.index('email');
    table.index('role');
    table.index('is_active');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('users');
}

