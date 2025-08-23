/**
 * MySQL/MariaDB Example for Drismify
 * 
 * This example demonstrates how to use Drismify with MySQL/MariaDB databases.
 * Make sure you have MySQL or MariaDB running locally or provide your own connection details.
 */

import { MySQLAdapter } from '../src/adapters/mysql-adapter';
import { DrismifyClient } from '../src/client/base-client';

// Example 1: Using MySQL Adapter directly
async function mysqlAdapterExample() {
  console.log('🔗 MySQL Adapter Example');
  
  // Create MySQL adapter with connection options
  const adapter = new MySQLAdapter({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'password',
    database: 'drismify_example',
    connectionLimit: 10
  });

  try {
    // Connect to the database
    await adapter.connect();
    console.log('✅ Connected to MySQL database');

    // Execute a simple query
    const result = await adapter.execute('SELECT 1 as test, NOW() as current_time');
    console.log('📊 Query result:', result.data);

    // Use transactions
    const transactionResult = await adapter.transaction(async (tx) => {
      const step1 = await tx.execute('SELECT "Transaction Step 1" as message');
      const step2 = await tx.execute('SELECT "Transaction Step 2" as message');
      return { step1: step1.data, step2: step2.data };
    });
    console.log('🔄 Transaction result:', transactionResult);

    // Batch operations
    const batchQueries = [
      { query: 'SELECT "Batch Query 1" as message' },
      { query: 'SELECT ? as message', params: ['Batch Query 2'] },
      { query: 'SELECT "Batch Query 3" as message' }
    ];
    const batchResults = await adapter.batch(batchQueries);
    console.log('📦 Batch results:', batchResults.map(r => r.data));

    // Disconnect
    await adapter.disconnect();
    console.log('✅ Disconnected from MySQL database');

  } catch (error) {
    console.error('❌ MySQL Adapter Error:', error);
  }
}

// Example 2: Using MySQL with URL connection string
async function mysqlUrlExample() {
  console.log('\n🔗 MySQL URL Example');
  
  // Create MySQL adapter with URL
  const adapter = new MySQLAdapter({
    url: 'mysql://root:password@localhost:3306/drismify_example'
  });

  try {
    await adapter.connect();
    console.log('✅ Connected to MySQL using URL');

    // Test connection with a simple query
    const result = await adapter.execute('SELECT VERSION() as mysql_version');
    console.log('📊 MySQL Version:', result.data);

    await adapter.disconnect();
    console.log('✅ Disconnected from MySQL database');

  } catch (error) {
    console.error('❌ MySQL URL Error:', error);
  }
}

// Example 3: Using Drismify Client with MySQL
async function drismifyClientExample() {
  console.log('\n🔗 Drismify Client with MySQL Example');
  
  // Create Drismify client with MySQL datasource
  const client = new DrismifyClient({
    datasources: {
      db: {
        provider: 'mysql',
        url: 'mysql://root:password@localhost:3306/drismify_example'
      }
    }
  });

  try {
    // The client automatically creates a MySQL adapter
    console.log('✅ Drismify client created with MySQL adapter');
    console.log('🔧 Adapter type:', client.adapter.constructor.name);

    // Access MySQL-specific methods through the adapter
    const mysqlAdapter = client.adapter as MySQLAdapter;
    
    // Get connection pool information
    const pool = mysqlAdapter.getPool();
    console.log('🏊 Connection pool created');

    // Test with a query
    await client.adapter.connect();
    const result = await client.adapter.execute('SELECT "Hello from Drismify!" as message');
    console.log('📊 Client query result:', result.data);

    await client.adapter.disconnect();
    console.log('✅ Drismify client disconnected');

  } catch (error) {
    console.error('❌ Drismify Client Error:', error);
  }
}

// Example 4: MariaDB compatibility
async function mariadbExample() {
  console.log('\n🔗 MariaDB Compatibility Example');
  
  // MariaDB uses the same MySQL adapter
  const client = new DrismifyClient({
    datasources: {
      db: {
        provider: 'mariadb', // This will create a MySQL adapter
        url: 'mysql://root:password@localhost:3306/drismify_example'
      }
    }
  });

  try {
    console.log('✅ Drismify client created for MariaDB');
    console.log('🔧 Adapter type:', client.adapter.constructor.name);

    await client.adapter.connect();
    const result = await client.adapter.execute('SELECT "MariaDB Compatible!" as message');
    console.log('📊 MariaDB query result:', result.data);

    await client.adapter.disconnect();
    console.log('✅ MariaDB client disconnected');

  } catch (error) {
    console.error('❌ MariaDB Error:', error);
  }
}

// Run all examples
async function runExamples() {
  console.log('🚀 Drismify MySQL/MariaDB Examples\n');
  console.log('Note: Make sure MySQL/MariaDB is running on localhost:3306');
  console.log('with user "root", password "password", and database "drismify_example"\n');

  try {
    await mysqlAdapterExample();
    await mysqlUrlExample();
    await drismifyClientExample();
    await mariadbExample();
    
    console.log('\n🎉 All examples completed successfully!');
  } catch (error) {
    console.error('\n💥 Example failed:', error);
  }
}

// Run examples if this file is executed directly
if (import.meta.main) {
  runExamples();
}

export {
  mysqlAdapterExample,
  mysqlUrlExample,
  drismifyClientExample,
  mariadbExample,
  runExamples
};
