import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('location_tracking', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('trip_id').notNullable().references('id').inTable('trips').onDelete('CASCADE');
    table.decimal('latitude', 10, 8).notNullable();
    table.decimal('longitude', 11, 8).notNullable();
    table.decimal('speed_kmh', 5, 2).nullable();
    table.decimal('heading', 5, 2).nullable(); // Direction in degrees
    table.decimal('accuracy', 5, 2).nullable(); // GPS accuracy in meters
    table.timestamp('recorded_at').notNullable().defaultTo(knex.fn.now());
    
    table.index('trip_id');
    table.index('recorded_at');
    // Partition by date for better performance (optional, requires PostgreSQL 10+)
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('location_tracking');
}

