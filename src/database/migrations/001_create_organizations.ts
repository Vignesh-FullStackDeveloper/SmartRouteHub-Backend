import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('organizations', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name').notNullable();
    table.string('code').notNullable().unique();
    table.string('primary_color', 7).defaultTo('#2196F3');
    table.string('contact_email');
    table.string('contact_phone');
    table.text('address');
    table.string('logo_url');
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);
    
    table.index('code');
    table.index('is_active');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('organizations');
}

