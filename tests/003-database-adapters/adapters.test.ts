/**
 * Tests for the Database Adapters
 */

import {
  createAdapter,
  DatabaseAdapter,
  SQLiteAdapter,
  TursoAdapter,
  MongoDBAdapter
} from '../../src/adapters';
import { createTestDatabase } from '../utils/test-utils';

describe('Database Adapters', () => {
  describe('Adapter Factory', () => {
    it('should create a SQLite adapter', () => {
      const dbPath = createTestDatabase();
      const adapter = createAdapter('sqlite', { url: `file:${dbPath}` });
      
      expect(adapter).toBeInstanceOf(SQLiteAdapter);
    });
    
    it('should create a Turso adapter', () => {
      const adapter = createAdapter('turso', { url: 'libsql://localhost:8080' });

      expect(adapter).toBeInstanceOf(TursoAdapter);
    });

    it('should create a MongoDB adapter', () => {
      const adapter = createAdapter('mongodb', {
        url: 'mongodb://localhost:27017',
        database: 'test'
      });

      expect(adapter).toBeInstanceOf(MongoDBAdapter);
    });

    it('should throw an error for unknown adapter type', () => {
      expect(() => {
        // @ts-ignore - Testing invalid adapter type
        createAdapter('unknown', { url: 'file:./test.db' });
      }).toThrow();
    });
  });
  
  describe('SQLite Adapter', () => {
    let adapter: DatabaseAdapter;
    let dbPath: string;
    
    beforeEach(() => {
      dbPath = createTestDatabase();
      adapter = createAdapter('sqlite', { url: `file:${dbPath}` });
    });
    
    afterEach(async () => {
      if (adapter) {
        await adapter.disconnect();
      }
    });
    
    it('should connect to the database', async () => {
      await adapter.connect();
      expect(adapter).toBeDefined();
    });
    
    it('should execute a query', async () => {
      await adapter.connect();
      
      // Create a test table
      await adapter.executeRaw(`
        CREATE TABLE test (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL
        )
      `);
      
      // Insert data
      await adapter.executeRaw(`
        INSERT INTO test (id, name) VALUES (1, 'Test 1')
      `);
      
      // Query data
      const result = await adapter.executeRaw<{ id: number; name: string }>(`
        SELECT * FROM test
      `);
      
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(1);
      expect(result.data[0].name).toBe('Test 1');
    });
    
    it('should execute a batch of queries', async () => {
      await adapter.connect();
      
      // Create a test table
      await adapter.executeRaw(`
        CREATE TABLE test (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL
        )
      `);
      
      // Execute batch
      const results = await adapter.batch([
        {
          query: `INSERT INTO test (id, name) VALUES (?, ?)`,
          params: [1, 'Test 1']
        },
        {
          query: `INSERT INTO test (id, name) VALUES (?, ?)`,
          params: [2, 'Test 2']
        },
        {
          query: `SELECT * FROM test ORDER BY id`
        }
      ]);
      
      expect(results).toHaveLength(3);
      expect(results[2].data).toHaveLength(2);
      expect(results[2].data[0].id).toBe(1);
      expect(results[2].data[0].name).toBe('Test 1');
      expect(results[2].data[1].id).toBe(2);
      expect(results[2].data[1].name).toBe('Test 2');
    });
    
    it('should execute a transaction', async () => {
      await adapter.connect();
      
      // Create a test table
      await adapter.executeRaw(`
        CREATE TABLE test (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL
        )
      `);
      
      // Execute transaction
      const result = await adapter.transaction(async (tx) => {
        await tx.executeRaw(`INSERT INTO test (id, name) VALUES (?, ?)`, [1, 'Test 1']);
        await tx.executeRaw(`INSERT INTO test (id, name) VALUES (?, ?)`, [2, 'Test 2']);
        
        const queryResult = await tx.executeRaw<{ id: number; name: string }>(`SELECT * FROM test ORDER BY id`);
        return queryResult.data;
      });
      
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[0].name).toBe('Test 1');
      expect(result[1].id).toBe(2);
      expect(result[1].name).toBe('Test 2');
    });
    
    it('should rollback a transaction on error', async () => {
      await adapter.connect();
      
      // Create a test table
      await adapter.executeRaw(`
        CREATE TABLE test (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL
        )
      `);
      
      // Execute transaction that will fail
      try {
        await adapter.transaction(async (tx) => {
          await tx.executeRaw(`INSERT INTO test (id, name) VALUES (?, ?)`, [1, 'Test 1']);
          
          // This will fail because of a duplicate primary key
          await tx.executeRaw(`INSERT INTO test (id, name) VALUES (?, ?)`, [1, 'Test 2']);
          
          return true;
        });
        
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Transaction should have been rolled back
        const result = await adapter.executeRaw<{ id: number; name: string }>(`SELECT * FROM test`);
        expect(result.data).toHaveLength(0);
      }
    });
  });
  
  // Note: TursoAdapter tests would be similar but would require a mock or actual Turso instance
  // For now, we'll skip those tests or use mocks in a real implementation
});
