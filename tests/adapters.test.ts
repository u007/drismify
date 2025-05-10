import * as fs from 'fs';
import * as path from 'path';
import { createAdapter, SQLiteAdapter, TursoAdapter } from '../src/adapters';

// Test database paths
const TEST_SQLITE_DB_PATH = path.join(__dirname, 'temp/db/test-sqlite.db');
const TEST_TURSO_DB_PATH = path.join(__dirname, 'temp/db/test-turso.db');

// Ensure test directories exist
beforeAll(() => {
  if (!fs.existsSync(path.dirname(TEST_SQLITE_DB_PATH))) {
    fs.mkdirSync(path.dirname(TEST_SQLITE_DB_PATH), { recursive: true });
  }
});

// Clean up test databases after tests
afterAll(() => {
  // Clean up SQLite database
  if (fs.existsSync(TEST_SQLITE_DB_PATH)) {
    fs.unlinkSync(TEST_SQLITE_DB_PATH);
  }
  
  // Clean up Turso database
  if (fs.existsSync(TEST_TURSO_DB_PATH)) {
    fs.unlinkSync(TEST_TURSO_DB_PATH);
  }
});

describe('Adapter Factory', () => {
  it('should create a SQLite adapter', () => {
    const adapter = createAdapter('sqlite', {
      filename: TEST_SQLITE_DB_PATH
    });
    
    expect(adapter).toBeInstanceOf(SQLiteAdapter);
  });
  
  it('should create a Turso adapter', () => {
    const adapter = createAdapter('turso', {
      url: `file:${TEST_TURSO_DB_PATH}`
    });
    
    expect(adapter).toBeInstanceOf(TursoAdapter);
  });
  
  it('should reuse adapter instances', () => {
    const adapter1 = createAdapter('sqlite', {
      filename: TEST_SQLITE_DB_PATH
    });
    
    const adapter2 = createAdapter('sqlite', {
      filename: TEST_SQLITE_DB_PATH
    });
    
    expect(adapter1).toBe(adapter2);
  });
  
  it('should create new adapter instances when singleton is false', () => {
    const adapter1 = createAdapter('sqlite', {
      filename: TEST_SQLITE_DB_PATH
    }, false);
    
    const adapter2 = createAdapter('sqlite', {
      filename: TEST_SQLITE_DB_PATH
    }, false);
    
    expect(adapter1).not.toBe(adapter2);
  });
});

describe('SQLiteAdapter', () => {
  let adapter: SQLiteAdapter;
  
  beforeEach(async () => {
    // Create a SQLite adapter
    adapter = createAdapter('sqlite', {
      filename: TEST_SQLITE_DB_PATH
    }, false) as SQLiteAdapter;
    
    // Connect to the database
    await adapter.connect();
  });
  
  afterEach(async () => {
    // Disconnect from the database
    await adapter.disconnect();
  });
  
  it('should execute queries', async () => {
    // Create a test table
    await adapter.execute(`
      CREATE TABLE IF NOT EXISTS test (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL
      )
    `);
    
    // Insert a test record
    await adapter.execute(
      'INSERT INTO test (id, name) VALUES (?, ?)',
      [1, 'Test']
    );
    
    // Query the test record
    const result = await adapter.execute<{ id: number; name: string }>(
      'SELECT * FROM test WHERE id = ?',
      [1]
    );
    
    expect(result.data.length).toBe(1);
    expect(result.data[0].id).toBe(1);
    expect(result.data[0].name).toBe('Test');
  });
  
  it('should execute transactions', async () => {
    // Create a test table
    await adapter.execute(`
      CREATE TABLE IF NOT EXISTS test_tx (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL
      )
    `);
    
    // Execute a transaction
    await adapter.transaction(async (tx) => {
      await tx.execute(
        'INSERT INTO test_tx (id, name) VALUES (?, ?)',
        [1, 'Test 1']
      );
      
      await tx.execute(
        'INSERT INTO test_tx (id, name) VALUES (?, ?)',
        [2, 'Test 2']
      );
    });
    
    // Query the test records
    const result = await adapter.execute<{ id: number; name: string }>(
      'SELECT * FROM test_tx ORDER BY id'
    );
    
    expect(result.data.length).toBe(2);
    expect(result.data[0].id).toBe(1);
    expect(result.data[0].name).toBe('Test 1');
    expect(result.data[1].id).toBe(2);
    expect(result.data[1].name).toBe('Test 2');
  });
  
  it('should roll back transactions on error', async () => {
    // Create a test table
    await adapter.execute(`
      CREATE TABLE IF NOT EXISTS test_rollback (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL
      )
    `);
    
    // Execute a transaction that will fail
    try {
      await adapter.transaction(async (tx) => {
        await tx.execute(
          'INSERT INTO test_rollback (id, name) VALUES (?, ?)',
          [1, 'Test 1']
        );
        
        // This will fail because of a duplicate primary key
        await tx.execute(
          'INSERT INTO test_rollback (id, name) VALUES (?, ?)',
          [1, 'Test 2']
        );
      });
    } catch (error) {
      // Expected error
    }
    
    // Query the test records
    const result = await adapter.execute<{ id: number; name: string }>(
      'SELECT * FROM test_rollback'
    );
    
    // The transaction should have been rolled back
    expect(result.data.length).toBe(0);
  });
  
  it('should execute batch operations', async () => {
    // Create a test table
    await adapter.execute(`
      CREATE TABLE IF NOT EXISTS test_batch (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL
      )
    `);
    
    // Execute a batch of queries
    await adapter.batch([
      {
        query: 'INSERT INTO test_batch (id, name) VALUES (?, ?)',
        params: [1, 'Test 1']
      },
      {
        query: 'INSERT INTO test_batch (id, name) VALUES (?, ?)',
        params: [2, 'Test 2']
      }
    ]);
    
    // Query the test records
    const result = await adapter.execute<{ id: number; name: string }>(
      'SELECT * FROM test_batch ORDER BY id'
    );
    
    expect(result.data.length).toBe(2);
    expect(result.data[0].id).toBe(1);
    expect(result.data[0].name).toBe('Test 1');
    expect(result.data[1].id).toBe(2);
    expect(result.data[1].name).toBe('Test 2');
  });
});
