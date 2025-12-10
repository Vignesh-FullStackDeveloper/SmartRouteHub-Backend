import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('stops', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('route_id').notNullable().references('id').inTable('routes').onDelete('CASCADE');
    table.string('name').notNullable();
    table.decimal('latitude', 10, 8).notNullable();
    table.decimal('longitude', 11, 8).notNullable();
    table.integer('order').notNullable(); // Stop order in route
    table.integer('estimated_arrival_minutes').nullable(); // Minutes from route start
    table.jsonb('address').nullable(); // Full address details
    table.timestamps(true, true);
    
    table.index('route_id');
    table.unique(['route_id', 'order']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('stops');
}

