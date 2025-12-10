import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('notifications', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('organization_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    table.uuid('student_id').nullable().references('id').inTable('students').onDelete('CASCADE');
    table.uuid('parent_id').nullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('bus_id').notNullable();
    table.uuid('route_id').notNullable();
    table.uuid('trip_id').notNullable();
    table.enum('type', [
      'bus_started',
      'bus_near_student',
      'bus_arrived_school',
      'bus_near_pickup',
      'trip_completed',
    ]).notNullable();
    table.string('title').notNullable();
    table.text('message').notNullable();
    table.jsonb('data').nullable();
    table.boolean('read').defaultTo(false);
    table.timestamps(true, true);
    
    table.index('parent_id');
    table.index('student_id');
    table.index('organization_id');
    table.index('trip_id');
    table.index(['parent_id', 'read']);
    table.index(['parent_id', 'created_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('notifications');
}

