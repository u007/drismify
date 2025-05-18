import { PrismaClient } from '../../src/client/base-client';
import type { DatabaseAdapter } from '../../src/adapters';
import fs from 'node:fs';
import path from 'node:path';

// Path to the test schema
const TEST_SCHEMA_PATH = path.resolve(__dirname, '../fixtures/schema.prisma');

// In-memory SQLite database for testing
const TEST_DB_URL = 'file::memory:?cache=shared';

// Define a type for our test client to make TypeScript happy
type TestClient = {
  $extends: (extension: unknown) => TestClient;
  $getAdapter: () => TestDatabaseAdapter;
  $transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
  $use?: (method: string, fn: unknown) => TestClient;
  $before?: (method: string, fn: unknown) => TestClient;
  $after?: (method: string, fn: unknown) => TestClient;
  $batch?: (fn: (client: unknown) => Promise<unknown>) => Promise<unknown>;
  $enableDebug?: () => TestClient;
  $disableDebug?: () => TestClient;
  [key: string]: any;
};

/**
 * Test database adapter that simulates a database with in-memory storage
 */
export class TestDatabaseAdapter implements DatabaseAdapter {
  private data: Record<string, Record<string, unknown>[]> = {
    user: [],
    post: [],
    profile: [],
    tag: []
  };
  private isConnected = false;
  private inTransaction = false;
  
  // Implement DatabaseAdapter interface methods
  async connect(): Promise<void> {
    this.isConnected = true;
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
  }

  async beginTransaction(): Promise<void> {
    this.inTransaction = true;
  }

  async commitTransaction(): Promise<void> {
    this.inTransaction = false;
  }

  async rollbackTransaction(): Promise<void> {
    this.inTransaction = false;
  }
  
  async execute<T = unknown>(query: string, params?: unknown[]): Promise<{ data: T[] }> {
    // Simplified implementation for testing
    return { data: [] as T[] };
  }
  
  async executeRaw<T = unknown>(query: string, params?: unknown[]): Promise<{ data: T[] }> {
    // Simplified implementation for testing
    return { data: [] as T[] };
  }
  
  async batch<T = unknown>(queries: Array<{ query: string; params?: unknown[] }>, options?: unknown): Promise<Array<{ data: T[] }>> {
    // Simplified implementation for testing
    return queries.map(() => ({ data: [] as T[] }));
  }
  
  // Implement transaction method according to the DatabaseAdapter interface
  async transaction<T>(fn: (tx: unknown) => Promise<T>, options?: unknown): Promise<T> {
    await this.beginTransaction();
    try {
      // Pass 'this' as the transaction client since we're using the same adapter
      // for simplicity in testing
      const result = await fn(this);
      await this.commitTransaction();
      return result;
    } catch (error) {
      await this.rollbackTransaction();
      throw error;
    }
  }
  
  async $transaction<T>(operations: Array<() => Promise<T>>): Promise<T[]> {
    await this.beginTransaction();
    try {
      const results: T[] = [];
      for (const operation of operations) {
        results.push(await operation());
      }
      await this.commitTransaction();
      return results;
    } catch (error) {
      await this.rollbackTransaction();
      throw error;
    }
  }
  
  isInTransaction(): boolean {
    return this.inTransaction;
  }

  isActive(): boolean {
    return this.isConnected;
  }
  
  // Helper methods for test data manipulation
  getData(table: string): Record<string, unknown>[] {
    return this.data[table] || [];
  }
  
  setData(table: string, data: Record<string, unknown>[]): void {
    this.data[table] = data;
  }
  
  findMany(table: string, options: { where?: Record<string, unknown> } = {}): Record<string, unknown>[] {
    const { where = {} } = options;
    return this.data[table]?.filter((item) =>
      Object.keys(where).every(key => item[key] === where[key])
    ) || [];
  }

  findFirst(table: string, options: { where?: Record<string, unknown> } = {}): Record<string, unknown> | null {
    const results = this.findMany(table, options);
    return results.length > 0 ? results[0] : null;
  }

  create(table: string, data: { data: Record<string, unknown> }): Record<string, unknown> {
    if (!this.data[table]) this.data[table] = [];
    const id = this.data[table].length + 1;
    const newItem = { id, ...data.data };
    this.data[table].push(newItem);
    return newItem;
  }

  update(table: string, options: { where: Record<string, unknown>, data: Record<string, unknown> }): Record<string, unknown> | null {
    const { where, data } = options;
    if (!this.data[table]) return null;
    
    const index = this.data[table].findIndex((item) => 
      Object.keys(where).every(key => item[key] === where[key])
    );
    
    if (index === -1) return null;
    
    this.data[table][index] = { ...this.data[table][index], ...data };
    return { ...this.data[table][index] };
  }

  delete(table: string, options: { where: Record<string, unknown> }): Record<string, unknown> | null {
    const { where } = options;
    if (!this.data[table]) return null;
    
    const index = this.data[table].findIndex((item) => 
      Object.keys(where).every(key => item[key] === where[key])
    );
    
    if (index === -1) return null;
    
    const deleted = this.data[table][index];
    this.data[table].splice(index, 1);
    return deleted;
  }

  count(table: string, options: { where?: Record<string, unknown> } = {}): number {
    return this.findMany(table, options).length;
  }
}

/**
 * Create a test Prisma client that uses the test schema
 */
export function createTestPrismaClient(): TestClient {
  // Create a test adapter
  const adapter = new TestDatabaseAdapter();
  
  // Create a client with the test adapter
  const client = new PrismaClient({
    datasources: {
      db: {
        url: TEST_DB_URL
      }
    },
    adapter: 'sqlite', // Use SQLite for testing
    log: [] // Disable logging for tests
  });
  
  // Override the $getAdapter method to return our test adapter
  client.$getAdapter = () => adapter;
  
  // Set up the models based on the schema
  setupModels(client, adapter);

  return client;
}

/**
 * Set up the models on the client based on the schema
 */
function setupModels(client: any, adapter: TestDatabaseAdapter): void {
  // Read the schema to determine the models
  const schemaContent = fs.readFileSync(TEST_SCHEMA_PATH, 'utf8');
  const modelRegex = /model\s+(\w+)\s+{([^}]*)}/g;
  let match: RegExpExecArray | null;

  while ((match = modelRegex.exec(schemaContent)) !== null) {
    const modelName = match[1];
    const modelNameLower = modelName.charAt(0).toLowerCase() + modelName.slice(1);
    
    // Define the model on the client
    setupModel(client, adapter, modelNameLower);
  }
}

/**
 * Set up a specific model on the client
 */
function setupModel(client: any, adapter: TestDatabaseAdapter, modelName: string): void {
  // Define the model property with getter
  Object.defineProperty(client, modelName, {
    get: () => {
      return {
        findMany: async (args: { where?: Record<string, unknown> } = {}) => adapter.findMany(modelName, args),
        findFirst: async (args: { where?: Record<string, unknown> } = {}) => adapter.findFirst(modelName, args),
        create: async (args: { data: Record<string, unknown> }) => adapter.create(modelName, args),
        update: async (args: { where: Record<string, unknown>, data: Record<string, unknown> }) => adapter.update(modelName, args),
        updateMany: async (args: { where: Record<string, unknown>, data: Record<string, unknown> }) => adapter.update(modelName, args),
        delete: async (args: { where: Record<string, unknown> }) => adapter.delete(modelName, args),
        deleteMany: async (args: { where: Record<string, unknown> }) => adapter.delete(modelName, args),
        count: async (args: { where?: Record<string, unknown> } = {}) => adapter.count(modelName, args)
      };
    },
    configurable: true,
    enumerable: true
  });
}
