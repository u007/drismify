// Example usage of database adapters

import { createAdapter, createAdapterFromDatasource } from '../adapters';

async function testSQLiteAdapter() {
  console.log('Testing SQLite adapter...');
  
  // Create a SQLite adapter
  const adapter = createAdapter('sqlite', {
    filename: ':memory:' // Use in-memory database for testing
  });

  try {
    // Connect to the database
    await adapter.connect();
    console.log('Connected to SQLite database');

    // Create a table
    await adapter.executeRaw(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL
      )
    `);
    console.log('Created users table');

    // Insert data
    await adapter.executeRaw(`
      INSERT INTO users (name, email) VALUES (?, ?)
    `, ['John Doe', 'john@example.com']);
    console.log('Inserted user');

    // Query data
    const result = await adapter.execute('SELECT * FROM users');
    console.log('Query result:', result.data);

    // Execute a transaction
    await adapter.transaction(async (tx) => {
      await tx.executeRaw(`
        INSERT INTO users (name, email) VALUES (?, ?)
      `, ['Jane Doe', 'jane@example.com']);
      
      await tx.executeRaw(`
        UPDATE users SET name = ? WHERE email = ?
      `, ['John Smith', 'john@example.com']);
    });
    console.log('Transaction completed');

    // Query data again
    const updatedResult = await adapter.execute('SELECT * FROM users');
    console.log('Updated query result:', updatedResult.data);

    // Disconnect
    await adapter.disconnect();
    console.log('Disconnected from SQLite database');
  } catch (error) {
    console.error('Error:', error);
  }
}

async function testTursoAdapter() {
  console.log('Testing TursoDB adapter...');
  
  // Create a TursoDB adapter from datasource configuration
  const adapter = createAdapterFromDatasource({
    provider: 'turso',
    url: process.env.TURSO_DATABASE_URL || 'libsql://localhost:8080',
    authToken: process.env.TURSO_AUTH_TOKEN
  });

  try {
    // Connect to the database
    await adapter.connect();
    console.log('Connected to TursoDB database');

    // Create a table
    await adapter.executeRaw(`
      CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        published BOOLEAN DEFAULT FALSE
      )
    `);
    console.log('Created posts table');

    // Insert data
    await adapter.executeRaw(`
      INSERT INTO posts (title, content, published) VALUES (?, ?, ?)
    `, ['Hello World', 'This is my first post', true]);
    console.log('Inserted post');

    // Query data
    const result = await adapter.execute('SELECT * FROM posts');
    console.log('Query result:', result.data);

    // Disconnect
    await adapter.disconnect();
    console.log('Disconnected from TursoDB database');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the examples
async function main() {
  await testSQLiteAdapter();
  console.log('\n---\n');
  
  // Only run TursoDB test if environment variables are set
  if (process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN) {
    await testTursoAdapter();
  } else {
    console.log('Skipping TursoDB test (environment variables not set)');
  }
}

// Run the main function if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { testSQLiteAdapter, testTursoAdapter };
