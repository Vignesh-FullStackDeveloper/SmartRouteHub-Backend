import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('students', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('organization_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    table.string('name').notNullable();
    table.string('class_grade').notNullable();
    table.string('section').notNullable();
    table.uuid('parent_id').nullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('parent_contact').notNullable();
    table.uuid('pickup_point_id').nullable();
    table.uuid('assigned_bus_id').nullable().references('id').inTable('buses').onDelete('SET NULL');
    table.uuid('assigned_route_id').nullable();
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);
    
    table.index('organization_id');
    table.index('parent_id');
    table.index('assigned_bus_id');
    table.index('is_active');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('students');
}

