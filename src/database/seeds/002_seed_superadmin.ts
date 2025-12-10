import { Knex } from 'knex';
import bcrypt from 'bcryptjs';

export async function seed(knex: Knex): Promise<void> {
  // Check if superadmin already exists
  const existing = await knex('users')
    .where({ email: 'superadmin@smartroutehub.com' })
    .first();

  if (existing) {
    console.log('Superadmin already exists, skipping seed');
    return;
  }

  // Create superadmin user (no organization_id required)
  const passwordHash = await bcrypt.hash('SuperAdmin@123', 10);

  await knex('users').insert({
    id: '00000000-0000-0000-0000-000000000000',
    organization_id: null, // Superadmin doesn't belong to any organization
    email: 'superadmin@smartroutehub.com',
    name: 'Super Admin',
    password_hash: passwordHash,
    role: 'superadmin',
    is_active: true,
  });

  console.log('Superadmin created:');
  console.log('  Email: superadmin@smartroutehub.com');
  console.log('  Password: SuperAdmin@123');
  console.log('  ⚠️  Please change the password after first login!');
}

