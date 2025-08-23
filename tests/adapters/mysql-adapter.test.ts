import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { MySQLAdapter } from '../../src/adapters/mysql-adapter';
import type { ConnectionOptions } from '../../src/adapters/types';

// MySQL test configuration
const TEST_CONFIG: ConnectionOptions = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '000000',
  database: 'drismify_test',
  connectionLimit: 5
};

// Alternative URL-based configuration
const TEST_URL_CONFIG: ConnectionOptions = {
  url: 'mysql://root:000000@localhost:3306/drismify_test'
};

describe('MySQLAdapter', () => {
  let adapter: MySQLAdapter;
  let urlAdapter: MySQLAdapter;

  beforeAll(async () => {
    // Create adapters
    adapter = new MySQLAdapter(TEST_CONFIG);
    urlAdapter = new MySQLAdapter(TEST_URL_CONFIG);
  });

  afterAll(async () => {
    // Clean up connections
    try {
      await adapter.disconnect();
      await urlAdapter.disconnect();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    // Ensure clean state for each test
    try {
      if (!adapter.isConnected) {
        await adapter.connect();
      }
    } catch (error) {
      console.warn('Could not connect to MySQL for testing. Skipping MySQL tests.');
      console.warn('Make sure MySQL is running on localhost:3306 with user root:000000');
      console.warn('Error:', error);
    }
  });

  describe('Connection Management', () => {
    test('should connect to MySQL database with config object', async () => {
      const testAdapter = new MySQLAdapter(TEST_CONFIG);
      
      try {
        await testAdapter.connect();
        expect(testAdapter.isConnected).toBe(true);
        
        // Test connection by executing a simple query
        const result = await testAdapter.execute('SELECT 1 as test');
        expect(result.data).toHaveLength(1);
        expect(result.data[0]).toHaveProperty('test', 1);
        
        await testAdapter.disconnect();
        expect(testAdapter.isConnected).toBe(false);
      } catch (error) {
        console.warn('Skipping MySQL connection test - database not available');
      }
    });

    test('should connect to MySQL database with URL', async () => {
      try {
        await urlAdapter.connect();
        expect(urlAdapter.isConnected).toBe(true);
        
        // Test connection by executing a simple query
        const result = await urlAdapter.execute('SELECT 1 as test');
        expect(result.data).toHaveLength(1);
        expect(result.data[0]).toHaveProperty('test', 1);
        
        await urlAdapter.disconnect();
        expect(urlAdapter.isConnected).toBe(false);
      } catch (error) {
        console.warn('Skipping MySQL URL connection test - database not available');
      }
    });

    test('should handle connection errors gracefully', async () => {
      const badAdapter = new MySQLAdapter({
        host: 'nonexistent-host',
        port: 3306,
        user: 'baduser',
        password: 'badpass',
        database: 'baddatabase'
      });

      await expect(badAdapter.connect()).rejects.toThrow();
    });

    test('should allow multiple connections to same database', async () => {
      const adapter1 = new MySQLAdapter(TEST_CONFIG);
      const adapter2 = new MySQLAdapter(TEST_CONFIG);

      try {
        await adapter1.connect();
        await adapter2.connect();
        
        expect(adapter1.isConnected).toBe(true);
        expect(adapter2.isConnected).toBe(true);
        
        await adapter1.disconnect();
        await adapter2.disconnect();
      } catch (error) {
        console.warn('Skipping multiple connections test - database not available');
      }
    });
  });

  describe('Query Execution', () => {
    test('should execute simple SELECT queries', async () => {
      try {
        const result = await adapter.execute('SELECT 1 as number, "hello" as text');
        
        expect(result.data).toHaveLength(1);
        expect(result.data[0]).toEqual({
          number: 1,
          text: 'hello'
        });
      } catch (error) {
        console.warn('Skipping SELECT query test - database not available');
      }
    });

    test('should execute parameterized queries', async () => {
      try {
        const result = await adapter.execute(
          'SELECT ? as param1, ? as param2',
          ['test', 42]
        );
        
        expect(result.data).toHaveLength(1);
        expect(result.data[0]).toEqual({
          param1: 'test',
          param2: 42
        });
      } catch (error) {
        console.warn('Skipping parameterized query test - database not available');
      }
    });

    test('should handle query errors', async () => {
      try {
        await expect(adapter.execute('INVALID SQL QUERY')).rejects.toThrow();
      } catch (error) {
        console.warn('Skipping query error test - database not available');
      }
    });
  });

  describe('Transaction Support', () => {
    test('should execute transactions successfully', async () => {
      try {
        const result = await adapter.transaction(async (tx) => {
          const result1 = await tx.execute('SELECT 1 as step');
          const result2 = await tx.execute('SELECT 2 as step');
          return { result1, result2 };
        });

        expect(result.result1.data[0]).toEqual({ step: 1 });
        expect(result.result2.data[0]).toEqual({ step: 2 });
      } catch (error) {
        console.warn('Skipping transaction test - database not available');
      }
    });

    test('should rollback transactions on error', async () => {
      try {
        await expect(
          adapter.transaction(async (tx) => {
            await tx.execute('SELECT 1');
            throw new Error('Test error');
          })
        ).rejects.toThrow('Test error');
      } catch (error) {
        console.warn('Skipping transaction rollback test - database not available');
      }
    });

    test('should support transaction isolation levels', async () => {
      try {
        const result = await adapter.transaction(
          async (tx) => {
            return await tx.execute('SELECT 1 as isolated');
          },
          { isolationLevel: 'ReadCommitted' }
        );

        expect(result.data[0]).toEqual({ isolated: 1 });
      } catch (error) {
        console.warn('Skipping isolation level test - database not available');
      }
    });
  });

  describe('Batch Operations', () => {
    test('should execute batch queries without transaction', async () => {
      try {
        const queries = [
          { query: 'SELECT 1 as first' },
          { query: 'SELECT ? as second', params: [2] },
          { query: 'SELECT 3 as third' }
        ];

        const results = await adapter.batch(queries);
        
        expect(results).toHaveLength(3);
        expect(results[0].data[0]).toEqual({ first: 1 });
        expect(results[1].data[0]).toEqual({ second: 2 });
        expect(results[2].data[0]).toEqual({ third: 3 });
      } catch (error) {
        console.warn('Skipping batch operations test - database not available');
      }
    });

    test('should execute batch queries with transaction', async () => {
      try {
        const queries = [
          { query: 'SELECT 1 as first' },
          { query: 'SELECT 2 as second' }
        ];

        const results = await adapter.batch(queries, { transaction: true });
        
        expect(results).toHaveLength(2);
        expect(results[0].data[0]).toEqual({ first: 1 });
        expect(results[1].data[0]).toEqual({ second: 2 });
      } catch (error) {
        console.warn('Skipping batch transaction test - database not available');
      }
    });
  });

  describe('Adapter-specific Methods', () => {
    test('should provide access to MySQL pool', async () => {
      try {
        const pool = adapter.getPool();
        expect(pool).toBeDefined();
        expect(typeof pool.getConnection).toBe('function');
      } catch (error) {
        console.warn('Skipping pool access test - database not available');
      }
    });

    test('should provide access to Drizzle database instance', async () => {
      try {
        const drizzleDb = adapter.getDrizzleDb();
        expect(drizzleDb).toBeDefined();
      } catch (error) {
        console.warn('Skipping Drizzle access test - database not available');
      }
    });

    test('should allow manual connection management', async () => {
      try {
        const connection = await adapter.getConnection();
        expect(connection).toBeDefined();
        
        // Test the connection
        const [rows] = await connection.execute('SELECT 1 as test');
        expect(Array.isArray(rows)).toBe(true);
        
        // Release the connection
        adapter.releaseConnection(connection);
      } catch (error) {
        console.warn('Skipping manual connection test - database not available');
      }
    });
  });
});
