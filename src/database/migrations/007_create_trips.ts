import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('trips', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('organization_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    table.uuid('bus_id').notNullable().references('id').inTable('buses').onDelete('CASCADE');
    table.uuid('route_id').notNullable().references('id').inTable('routes').onDelete('CASCADE');
    table.uuid('driver_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.enum('status', ['not_started', 'in_progress', 'completed', 'cancelled']).defaultTo('not_started');
    table.timestamp('start_time').nullable();
    table.timestamp('end_time').nullable();
    table.decimal('current_latitude', 10, 8).nullable();
    table.decimal('current_longitude', 11, 8).nullable();
    table.decimal('speed_kmh', 5, 2).nullable();
    table.timestamp('last_update_time').nullable();
    table.integer('passenger_count').defaultTo(0);
    table.jsonb('location_history').nullable(); // Array of location points
    table.timestamps(true, true);
    
    table.index('organization_id');
    table.index('bus_id');
    table.index('route_id');
    table.index('driver_id');
    table.index('status');
    table.index('last_update_time');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('trips');
}

