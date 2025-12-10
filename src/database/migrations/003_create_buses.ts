import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('buses', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('organization_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    table.string('bus_number').notNullable();
    table.integer('capacity').notNullable();
    table.uuid('driver_id').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.uuid('assigned_route_id').nullable();
    table.boolean('is_active').defaultTo(true);
    table.jsonb('metadata').nullable(); // For additional bus details
    table.timestamps(true, true);
    
    table.unique(['organization_id', 'bus_number']);
    table.index('organization_id');
    table.index('driver_id');
    table.index('is_active');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('buses');
}

