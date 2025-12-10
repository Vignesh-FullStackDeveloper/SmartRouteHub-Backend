import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('routes', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('organization_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    table.string('name').notNullable();
    table.time('start_time').notNullable();
    table.time('end_time').notNullable();
    table.integer('estimated_duration_minutes').nullable(); // Duration in minutes
    table.decimal('total_distance_km', 10, 2).nullable(); // Total route distance
    table.uuid('assigned_bus_id').nullable().references('id').inTable('buses').onDelete('SET NULL');
    table.boolean('is_active').defaultTo(true);
    table.jsonb('route_polyline').nullable(); // Google Maps polyline
    table.timestamps(true, true);
    
    table.index('organization_id');
    table.index('assigned_bus_id');
    table.index('is_active');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('routes');
}

