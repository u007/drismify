import { PrismaClient } from '../src/client/base-client';
import { 
  combineExtensions,
  createMiddlewareExtension,
  createTransactionExtension,
  createHookExtension,
  createDebugExtension,
  createSoftDeleteExtension,
  createComputedFieldsExtension,
  createBatchExtension
} from '../src/extensions/advanced';

// Mock adapter for testing
class MockAdapter {
  private transactions: boolean = false;
  private data: any = { users: [] };

  async connect() { return true; }
  async disconnect() { return true; }
  async beginTransaction() { this.transactions = true; return true; }
  async commitTransaction() { this.transactions = false; return true; }
  async rollbackTransaction() { this.transactions = false; return true; }
  
  async findMany(table: string, options: any = {}) {
    return this.data[table] || [];
  }
  
  async findFirst(table: string, options: any = {}) {
    const results = this.data[table] || [];
    return results.length > 0 ? results[0] : null;
  }
  
  async create(table: string, data: any) {
    if (!this.data[table]) this.data[table] = [];
    const id = this.data[table].length + 1;
    const newItem = { id, ...data.data };
    this.data[table].push(newItem);
    return newItem;
  }
  
  async update(table: string, options: any) {
    const { where, data } = options;
    if (!this.data[table]) return null;
    
    const index = this.data[table].findIndex((item: any) => 
      Object.keys(where).every(key => item[key] === where[key])
    );
    
    if (index === -1) return null;
    
    this.data[table][index] = { ...this.data[table][index], ...data };
    return this.data[table][index];
  }
  
  async delete(table: string, options: any) {
    const { where } = options;
    if (!this.data[table]) return null;
    
    const index = this.data[table].findIndex((item: any) => 
      Object.keys(where).every(key => item[key] === where[key])
    );
    
    if (index === -1) return null;
    
    const deleted = this.data[table][index];
    this.data[table].splice(index, 1);
    return deleted;
  }
  
  async count(table: string, options: any = {}) {
    return this.data[table]?.length || 0;
  }

  isInTransaction() {
    return this.transactions;
  }
}

// Mock client for testing
class MockPrismaClient extends PrismaClient {
  private mockAdapter: MockAdapter;
  
  constructor() {
    super();
    this.mockAdapter = new MockAdapter();
  }
  
  $getAdapter() {
    return this.mockAdapter;
  }
  
  get user() {
    return {
      findMany: (args: any = {}) => this.mockAdapter.findMany('users', args),
      findFirst: (args: any = {}) => this.mockAdapter.findFirst('users', args),
      create: (args: any) => this.mockAdapter.create('users', args),
      update: (args: any) => this.mockAdapter.update('users', args),
      delete: (args: any) => this.mockAdapter.delete('users', args),
      count: (args: any = {}) => this.mockAdapter.count('users', args)
    };
  }
}

describe('Advanced Extensions', () => {
  let client: MockPrismaClient;
  
  beforeEach(() => {
    client = new MockPrismaClient();
  });
  
  describe('Transaction Extension', () => {
    test('should provide transaction methods', async () => {
      const clientWithTx = client.$extends(createTransactionExtension());
      
      expect(clientWithTx.$transaction).toBeDefined();
      
      // Run a successful transaction
      await clientWithTx.$transaction(async (tx) => {
        const adapter = client.$getAdapter() as MockAdapter;
        expect(adapter.isInTransaction()).toBe(true);
        return true;
      });
      
      // The transaction should be committed
      const adapter = client.$getAdapter() as MockAdapter;
      expect(adapter.isInTransaction()).toBe(false);
    });
    
    test('should rollback transaction on error', async () => {
      const clientWithTx = client.$extends(createTransactionExtension());
      
      // Run a transaction that will fail
      await expect(
        clientWithTx.$transaction(async (tx) => {
          throw new Error('Transaction failed');
        })
      ).rejects.toThrow('Transaction failed');
      
      // The transaction should be rolled back
      const adapter = client.$getAdapter() as MockAdapter;
      expect(adapter.isInTransaction()).toBe(false);
    });
  });
  
  describe('Middleware Extension', () => {
    test('should intercept and modify operations', async () => {
      const spy = jest.fn();
      
      const middleware = createMiddlewareExtension({
        findMany: async (params, next) => {
          spy('before', params);
          const result = await next(params);
          spy('after', result);
          return result;
        }
      });
      
      const clientWithMiddleware = client.$extends(middleware);
      
      // Create a user first
      await client.user.create({ data: { name: 'Test User' } });
      
      // Call findMany and check that middleware was called
      await clientWithMiddleware.user.findMany();
      
      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenNthCalledWith(1, 'before', {});
      expect(spy).toHaveBeenNthCalledWith(2, 'after', [{ id: 1, name: 'Test User' }]);
    });
    
    test('should support $use for dynamic middleware', async () => {
      const spy = jest.fn();
      
      const middleware = createMiddlewareExtension({});
      const clientWithMiddleware = client.$extends(middleware);
      
      // Add dynamic middleware
      const dynamicClient = clientWithMiddleware.$use('create', async (params, next) => {
        spy('dynamic', params);
        return next(params);
      });
      
      // Call create and check that middleware was called
      await dynamicClient.user.create({ data: { name: 'Dynamic User' } });
      
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('dynamic', { data: { name: 'Dynamic User' } });
    });
  });
  
  describe('Hook Extension', () => {
    test('should apply before and after hooks', async () => {
      const beforeSpy = jest.fn((params) => params);
      const afterSpy = jest.fn((result) => result);
      
      const hooks = createHookExtension(
        { create: beforeSpy },
        { create: afterSpy }
      );
      
      const clientWithHooks = client.$extends(hooks);
      
      // Call create and check that hooks were called
      await clientWithHooks.user.create({ data: { name: 'Hook User' } });
      
      expect(beforeSpy).toHaveBeenCalledWith({ data: { name: 'Hook User' } });
      expect(afterSpy).toHaveBeenCalledWith({ id: 1, name: 'Hook User' });
    });
    
    test('should support dynamic hook addition', async () => {
      const beforeSpy = jest.fn((params) => params);
      const afterSpy = jest.fn((result) => result);
      
      const hooks = createHookExtension();
      const clientWithHooks = client.$extends(hooks);
      
      // Add dynamic hooks
      const dynamicClient = clientWithHooks
        .$before('create', beforeSpy)
        .$after('create', afterSpy);
      
      // Call create and check that hooks were called
      await dynamicClient.user.create({ data: { name: 'Dynamic Hook User' } });
      
      expect(beforeSpy).toHaveBeenCalledWith({ data: { name: 'Dynamic Hook User' } });
      expect(afterSpy).toHaveBeenCalledWith({ id: 1, name: 'Dynamic Hook User' });
    });
  });
  
  describe('Soft Delete Extension', () => {
    test('should implement soft deletion', async () => {
      const clientWithSoftDelete = client.$extends(
        createSoftDeleteExtension('deleted', 'deletedAt')
      );
      
      // Create a user
      await client.user.create({ data: { name: 'Soft Delete User' } });
      
      // Soft delete the user
      const softDeleted = await (clientWithSoftDelete.user as any).softDelete({ where: { id: 1 } });
      expect(softDeleted.deleted).toBe(true);
      expect(softDeleted.deletedAt).toBeInstanceOf(Date);
      
      // Regular findMany should exclude the soft-deleted user
      const visibleUsers = await clientWithSoftDelete.user.findMany();
      expect(visibleUsers.length).toBe(0);
      
      // findDeleted should include only the soft-deleted user
      const deletedUsers = await (clientWithSoftDelete.user as any).findDeleted();
      expect(deletedUsers.length).toBe(1);
      expect(deletedUsers[0].id).toBe(1);
      
      // Restore the user
      const restored = await (clientWithSoftDelete.user as any).restore({ where: { id: 1 } });
      expect(restored.deleted).toBe(false);
      expect(restored.deletedAt).toBeNull();
      
      // Now the user should be visible again
      const restoredUsers = await clientWithSoftDelete.user.findMany();
      expect(restoredUsers.length).toBe(1);
    });
  });
  
  describe('Combining Extensions', () => {
    test('should combine multiple extensions', async () => {
      const txSpy = jest.fn();
      const middlewareSpy = jest.fn();
      const hookSpy = jest.fn();
      
      const combined = combineExtensions(
        createTransactionExtension(),
        createMiddlewareExtension({
          findMany: async (params, next) => {
            middlewareSpy();
            return next(params);
          }
        }),
        createHookExtension(
          { create: (params) => { hookSpy(); return params; } },
          {}
        )
      );
      
      const clientWithCombined = client.$extends(combined);
      
      // Create a user in a transaction
      await clientWithCombined.$transaction(async (tx) => {
        txSpy();
        await tx.user.create({ data: { name: 'Combined User' } });
      });
      
      // Query users to trigger middleware
      await clientWithCombined.user.findMany();
      
      expect(txSpy).toHaveBeenCalled();
      expect(hookSpy).toHaveBeenCalled();
      expect(middlewareSpy).toHaveBeenCalled();
    });
  });
  
  describe('Debug Extension', () => {
    test('should provide debugging capabilities', async () => {
      const debugSpy = jest.fn();
      
      const clientWithDebug = client.$extends(
        createDebugExtension(debugSpy)
      );
      
      // Create a user with debug disabled (default)
      await clientWithDebug.user.create({ data: { name: 'Debug User 1' } });
      expect(debugSpy).not.toHaveBeenCalled();
      
      // Enable debugging
      (clientWithDebug as any).$enableDebug();
      
      // Create another user
      await clientWithDebug.user.create({ data: { name: 'Debug User 2' } });
      expect(debugSpy).toHaveBeenCalled();
      
      // Disable debugging
      (clientWithDebug as any).$disableDebug();
      
      // Create one more user
      await clientWithDebug.user.create({ data: { name: 'Debug User 3' } });
      
      // The debug spy should have been called only once
      expect(debugSpy).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('Batch Extension', () => {
    test('should execute operations in a batch', async () => {
      const clientWithBatch = client.$extends(createBatchExtension());
      
      // Execute a batch of operations
      const result = await (clientWithBatch as any).$batch(async (batch) => {
        await batch.user.create({ data: { name: 'Batch User 1' } });
        await batch.user.create({ data: { name: 'Batch User 2' } });
        return batch.user.findMany();
      });
      
      expect(result.length).toBe(2);
      expect(result[0].name).toBe('Batch User 1');
      expect(result[1].name).toBe('Batch User 2');
    });
  });
});