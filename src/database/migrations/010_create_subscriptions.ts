import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('subscriptions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('student_id').notNullable().references('id').inTable('students').onDelete('CASCADE');
    table.uuid('organization_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    table.date('valid_from').notNullable();
    table.date('valid_until').notNullable();
    table.enum('status', ['active', 'expired', 'cancelled']).defaultTo('active');
    table.decimal('amount_paid', 10, 2).nullable();
    table.string('payment_method').nullable();
    table.text('notes').nullable();
    table.timestamps(true, true);
    
    table.index('student_id');
    table.index('organization_id');
    table.index('valid_until');
    table.index('status');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('subscriptions');
}

