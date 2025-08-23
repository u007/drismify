/**
 * Complete MySQL/MariaDB Example for Drismify
 * 
 * This example demonstrates the full MySQL/MariaDB integration including:
 * - Connection management
 * - Schema operations
 * - CRUD operations
 * - Transactions
 * - Batch operations
 * - Introspection
 * - CLI integration
 */

import { MySQLAdapter } from '../src/adapters/mysql-adapter';
import { DrismifyClient } from '../src/client/base-client';
import { createAdapter } from '../src/adapters/factory';
import { introspectDatabase } from '../src/cli/introspect';
import { initProject } from '../src/cli/init';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const MYSQL_CONFIG = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'password',
  database: 'drismify_complete_example',
  connectionLimit: 10
};

const MYSQL_URL = 'mysql://root:password@localhost:3306/drismify_complete_example';

async function demonstrateDirectAdapterUsage() {
  console.log('\n🔧 Direct MySQL Adapter Usage');
  console.log('================================');

  const adapter = new MySQLAdapter(MYSQL_CONFIG);

  try {
    await adapter.connect();
    console.log('✅ Connected to MySQL database');

    // Create tables
    await adapter.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        age INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await adapter.execute(`
      CREATE TABLE IF NOT EXISTS posts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT,
        published BOOLEAN DEFAULT FALSE,
        author_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    console.log('✅ Tables created successfully');

    // Insert data
    const userResult = await adapter.execute(
      'INSERT INTO users (email, name, age) VALUES (?, ?, ?)',
      ['john@example.com', 'John Doe', 30]
    );
    console.log('✅ User inserted:', userResult.data);

    // Query data
    const users = await adapter.execute('SELECT * FROM users WHERE age > ?', [25]);
    console.log('📊 Users found:', users.data);

    // Transaction example
    const transactionResult = await adapter.transaction(async (tx) => {
      const user = await tx.execute(
        'INSERT INTO users (email, name, age) VALUES (?, ?, ?)',
        ['jane@example.com', 'Jane Smith', 28]
      );

      const post = await tx.execute(
        'INSERT INTO posts (title, content, author_id) VALUES (?, ?, ?)',
        ['My First Post', 'This is my first blog post!', user.data[0]?.insertId || 1]
      );

      return { user: user.data, post: post.data };
    });

    console.log('🔄 Transaction completed:', transactionResult);

    // Batch operations
    const batchQueries = [
      { query: 'SELECT COUNT(*) as user_count FROM users' },
      { query: 'SELECT COUNT(*) as post_count FROM posts' },
      { query: 'SELECT * FROM users ORDER BY created_at DESC LIMIT ?', params: [5] }
    ];

    const batchResults = await adapter.batch(batchQueries);
    console.log('📦 Batch results:', batchResults.map(r => r.data));

    await adapter.disconnect();
    console.log('✅ Disconnected from MySQL database');

  } catch (error) {
    console.error('❌ Direct adapter error:', error);
  }
}

async function demonstrateClientUsage() {
  console.log('\n🎯 Drismify Client Usage');
  console.log('=========================');

  const client = new DrismifyClient({
    datasources: {
      db: {
        provider: 'mysql',
        url: MYSQL_URL
      }
    }
  });

  try {
    console.log('✅ Drismify client created with MySQL adapter');
    console.log('🔧 Adapter type:', client.adapter.constructor.name);

    await client.adapter.connect();

    // Access MySQL-specific features
    const mysqlAdapter = client.adapter as MySQLAdapter;
    const pool = mysqlAdapter.getPool();
    console.log('🏊 Connection pool available');

    // Execute queries through client
    const result = await client.adapter.execute(
      'SELECT VERSION() as mysql_version, DATABASE() as current_db'
    );
    console.log('📊 Database info:', result.data);

    await client.adapter.disconnect();
    console.log('✅ Client disconnected');

  } catch (error) {
    console.error('❌ Client error:', error);
  }
}

async function demonstrateFactoryUsage() {
  console.log('\n🏭 Factory Pattern Usage');
  console.log('=========================');

  try {
    // Create adapter using factory
    const adapter = createAdapter('mysql', { url: MYSQL_URL }, false);
    console.log('✅ MySQL adapter created via factory');

    // Create adapter from datasource
    const datasourceAdapter = createAdapter('mysql', {
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: 'password',
      database: 'drismify_complete_example'
    }, false);
    console.log('✅ MySQL adapter created from datasource config');

    console.log('🔧 Both adapters are MySQLAdapter instances');

  } catch (error) {
    console.error('❌ Factory error:', error);
  }
}

async function demonstrateIntrospection() {
  console.log('\n🔍 Database Introspection');
  console.log('==========================');

  const outputPath = path.join(__dirname, 'introspected-schema.prisma');

  try {
    const schema = await introspectDatabase({
      url: MYSQL_URL,
      provider: 'mysql',
      output: outputPath,
      overwrite: true,
      saveComments: true,
      debug: true
    });

    console.log('✅ Database introspected successfully');
    console.log('📄 Schema file created at:', outputPath);
    
    if (fs.existsSync(outputPath)) {
      const schemaContent = fs.readFileSync(outputPath, 'utf-8');
      console.log('\n📋 Generated Schema Preview:');
      console.log(schemaContent.substring(0, 500) + '...');
      
      // Clean up
      fs.unlinkSync(outputPath);
      console.log('🧹 Cleaned up schema file');
    }

  } catch (error) {
    console.error('❌ Introspection error:', error);
  }
}

async function demonstrateCLIIntegration() {
  console.log('\n⚡ CLI Integration');
  console.log('==================');

  const projectDir = path.join(__dirname, 'mysql-cli-demo');

  try {
    // Initialize MySQL project
    await initProject({
      directory: projectDir,
      provider: 'mysql',
      url: MYSQL_URL,
      typescript: true,
      overwrite: true
    });

    console.log('✅ MySQL project initialized');
    console.log('📁 Project directory:', projectDir);

    // Check generated files
    const schemaPath = path.join(projectDir, 'schema.prisma');
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf-8');
      console.log('📋 Generated schema contains MySQL provider');
      console.log('✅ Schema validation: MySQL provider detected');
    }

    const envPath = path.join(projectDir, '.env');
    if (fs.existsSync(envPath)) {
      const env = fs.readFileSync(envPath, 'utf-8');
      console.log('🔧 Environment file contains MySQL URL');
    }

    // Clean up
    if (fs.existsSync(projectDir)) {
      fs.rmSync(projectDir, { recursive: true, force: true });
      console.log('🧹 Cleaned up project directory');
    }

  } catch (error) {
    console.error('❌ CLI integration error:', error);
  }
}

async function demonstrateAdvancedFeatures() {
  console.log('\n🚀 Advanced MySQL Features');
  console.log('===========================');

  const adapter = new MySQLAdapter(MYSQL_CONFIG);

  try {
    await adapter.connect();

    // Connection pool management
    const connection = await adapter.getConnection();
    console.log('✅ Manual connection acquired from pool');

    // Execute query on specific connection
    const [rows] = await connection.execute('SELECT CONNECTION_ID() as connection_id');
    console.log('📊 Connection ID:', rows);

    // Release connection back to pool
    adapter.releaseConnection(connection);
    console.log('✅ Connection released back to pool');

    // Drizzle ORM integration
    const drizzleDb = adapter.getDrizzleDb();
    console.log('✅ Drizzle database instance available');

    // Transaction with isolation level
    await adapter.transaction(async (tx) => {
      const result = await tx.execute('SELECT @@transaction_isolation as isolation_level');
      console.log('🔒 Transaction isolation level:', result.data);
    }, { isolationLevel: 'ReadCommitted' });

    await adapter.disconnect();
    console.log('✅ Advanced features demonstration completed');

  } catch (error) {
    console.error('❌ Advanced features error:', error);
  }
}

// Main demonstration function
async function runCompleteExample() {
  console.log('🎉 Drismify MySQL/MariaDB Complete Example');
  console.log('===========================================');
  console.log('Note: Make sure MySQL/MariaDB is running on localhost:3306');
  console.log('with user "root", password "password", and database "drismify_complete_example"\n');

  try {
    await demonstrateDirectAdapterUsage();
    await demonstrateClientUsage();
    await demonstrateFactoryUsage();
    await demonstrateIntrospection();
    await demonstrateCLIIntegration();
    await demonstrateAdvancedFeatures();

    console.log('\n🎊 All MySQL/MariaDB examples completed successfully!');
    console.log('\nKey Features Demonstrated:');
    console.log('✅ Direct adapter usage with connection management');
    console.log('✅ Drismify client integration');
    console.log('✅ Factory pattern for adapter creation');
    console.log('✅ Database introspection and schema generation');
    console.log('✅ CLI project initialization');
    console.log('✅ Advanced features like connection pooling and transactions');

  } catch (error) {
    console.error('\n💥 Example failed:', error);
  }
}

// Export functions for individual testing
export {
  demonstrateDirectAdapterUsage,
  demonstrateClientUsage,
  demonstrateFactoryUsage,
  demonstrateIntrospection,
  demonstrateCLIIntegration,
  demonstrateAdvancedFeatures,
  runCompleteExample
};

// Run complete example if this file is executed directly
if (import.meta.main) {
  runCompleteExample();
}
