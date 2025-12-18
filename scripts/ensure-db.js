const { Client } = require('pg');
require('dotenv').config({ path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local' });
require('dotenv').config({ path: '.env' });

async function ensureDatabase() {
  const dbName = process.env.DB_NAME || 'smartroutehub';
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: 'postgres', // Connect to default postgres database
  });

  try {
    await client.connect();
    
    // Check if database exists
    const result = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName]
    );

    if (result.rows.length === 0) {
      console.log(`Database "${dbName}" does not exist, creating...`);
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Database "${dbName}" created successfully`);
    } else {
      console.log(`Database "${dbName}" already exists`);
    }
    
    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('Failed to ensure database:', error.message);
    await client.end().catch(() => {});
    process.exit(1);
  }
}

ensureDatabase();

