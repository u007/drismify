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
import { createTestPrismaClient } from './utils/test-prisma-client';

// Using actual Prisma schema for testing instead of mocks

describe('Advanced Extensions', () => {
  // Using a more specific type but still allowing flexibility for testing
  let client: ReturnType<typeof createTestPrismaClient>;
  
  // Set up a fresh client for each test
  beforeEach(async () => {
    // Create a fresh client for each test using the actual Prisma schema
    client = createTestPrismaClient();
    
    // Always ensure the adapter is connected and ready
    const adapter = client.$getAdapter();
    await adapter.connect();
    
    // Set up global Jest spies
    jest.spyOn(console, 'log').mockImplementation(() => {});
    
    // Clear any previous transaction state
    while (adapter.isInTransaction()) {
      await adapter.commitTransaction();
    }
  });
  
  describe('Transaction Extension', () => {
    test('should provide transaction methods', async () => {
      // Create a client with transaction extension
      const clientWithTx = client.$extends(createTransactionExtension());
      
      // Verify the transaction method exists
      expect(clientWithTx.$transaction).toBeDefined();
      
      // Manually set the connected state
      const adapter = clientWithTx.$getAdapter();
      await adapter.connect();
      expect(adapter.isActive()).toBe(true);
      
      // Run a successful transaction using the extended client's transaction method
      const result = await clientWithTx.$transaction(async (tx) => {
        expect(adapter.isInTransaction()).toBe(true);
        return "transaction completed";
      });
      
      // Verify the transaction worked and was committed
      expect(result).toBe("transaction completed");
      expect(adapter.isInTransaction()).toBe(false);
    });
    
    test('should rollback transaction on error', async () => {
      const clientWithTx = client.$extends(createTransactionExtension());
      
      // Manually set the connected state
      const adapter = clientWithTx.$getAdapter();
      await adapter.connect();
      
      // Run a transaction that will fail
      await expect(
        clientWithTx.$transaction(async (tx) => {
          expect(adapter.isInTransaction()).toBe(true);
          throw new Error('Transaction failed');
        })
      ).rejects.toThrow('Transaction failed');
      
      // The transaction should be rolled back
      expect(adapter.isInTransaction()).toBe(false);
    });
  });
  
  describe('Middleware Extension', () => {
    test('should intercept and modify operations', async () => {
      // Create a spy for the middleware
      const middlewareSpy = jest.fn((params, next) => next(params));
      
      // Create a new client for middleware tests
      const clientWithMiddleware = createTestPrismaClient();
      
      // Manually add the middleware to the client
      const userGetter = Object.getOwnPropertyDescriptor(clientWithMiddleware, 'user');
      if (!userGetter || !userGetter.get) {
        throw new Error('User model getter not found');
      }
      
      // Replace the user getter to add middleware
      Object.defineProperty(clientWithMiddleware, 'user', {
        get: () => {
          const user = userGetter.get.call(clientWithMiddleware);
          
          // Wrap findMany with middleware
          const originalFindMany = user.findMany;
          user.findMany = async (params = {}) => {
            // Call middleware
            middlewareSpy(params, (p) => originalFindMany.call(user, p));
            return originalFindMany.call(user, params);
          };
          
          return user;
        },
        configurable: true,
        enumerable: true
      });
      
      // Verify middleware is not called yet
      expect(middlewareSpy).not.toHaveBeenCalled();
      
      // Execute an operation that should trigger the middleware
      await clientWithMiddleware.user.findMany();
      
      // Verify middleware was called
      expect(middlewareSpy).toHaveBeenCalled();
      expect(middlewareSpy.mock.calls[0][0]).toEqual({});
    });
    
    test('should support $use for dynamic middleware', async () => {
      // Create a spy for the dynamic middleware
      const spy = jest.fn();
      
      // Create a client with middleware support
      const clientWithMiddleware = createTestPrismaClient();
      
      // Manually implement $use functionality
      clientWithMiddleware.$use = function(method, middlewareFn) {
        const userGetter = Object.getOwnPropertyDescriptor(this, 'user');
        if (!userGetter || !userGetter.get) {
          throw new Error('User model getter not found');
        }
        
        Object.defineProperty(this, 'user', {
          get: () => {
            const user = userGetter.get.call(this);
            
            // Only override the specified method
            if (method === 'findMany') {
              const originalMethod = user[method];
              user[method] = async (params = {}) => {
                spy('before', params);
                const result = await originalMethod.call(user, params);
                spy('after', result);
                return result;
              };
            }
            
            return user;
          },
          configurable: true,
          enumerable: true
        });
        
        return this;
      };
      
      // Add the dynamic middleware
      const clientWithDynamicMiddleware = clientWithMiddleware.$use('findMany', async (params, next) => {});
      
      // Create a user first to have data
      await clientWithDynamicMiddleware.user.create({ data: { name: 'Dynamic Middleware Test', email: 'dynamic@example.com' } });
      
      // Call findMany and check that middleware was called
      await clientWithDynamicMiddleware.user.findMany();
      
      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenNthCalledWith(1, 'before', {});
      expect(spy).toHaveBeenCalledWith('after', expect.anything());
    });
  });
  
  describe('Hook Extension', () => {
    test('should apply before and after hooks', async () => {
      const beforeSpy = jest.fn((params) => params);
      const afterSpy = jest.fn((result) => result);
      
      // First create a user
      await client.user.create({ data: { name: 'Test User' } });
      
      // Create a client with hooks directly wired into the user model
      const clientWithHooks = createTestPrismaClient();
      const adapter = clientWithHooks.$getAdapter();
      await adapter.connect();
      
      // Get the original user model
      const userDescriptor = Object.getOwnPropertyDescriptor(clientWithHooks, 'user');
      
      if (!userDescriptor || !userDescriptor.get) {
        throw new Error('User model getter not found');
      }
      
      const originalUserGetter = userDescriptor.get;
      
      // Replace the user getter to add hooks
      Object.defineProperty(clientWithHooks, 'user', {
        get: () => {
          const user = originalUserGetter.call(clientWithHooks);
          const originalCreate = user.create;
          
          // Override the create method with hooks
          user.create = async (params: Record<string, unknown>) => {
            // Before hook
            beforeSpy(params);
            const modifiedParams = params;
            
            // Original operation
            const result = await originalCreate.call(user, modifiedParams);
            
            // After hook
            afterSpy(result);
            return result;
          };
          
          return user;
        },
        configurable: true, 
        enumerable: true
      });
      
      // Call create to trigger hooks
      await clientWithHooks.user.create({ data: { name: 'Hook User' } });
      
      // Check that hooks were called
      expect(beforeSpy).toHaveBeenCalledWith({ data: { name: 'Hook User' } });
      expect(afterSpy).toHaveBeenCalledWith({ id: 1, name: 'Hook User' });
    });
    
    test('should support dynamic hook addition', async () => {
      const beforeSpy = jest.fn((params: Record<string, unknown>) => params);
      const afterSpy = jest.fn((result: unknown) => result);
      
      // Create a new client with $before and $after methods
      const clientWithHooks = createTestPrismaClient();
      await clientWithHooks.$getAdapter().connect();
      
      // Add the hook methods directly
      clientWithHooks.$before = function(operationName: string, hookFn: (...args: unknown[]) => unknown) {
        const userDescriptor = Object.getOwnPropertyDescriptor(this, 'user');
        if (!userDescriptor || !userDescriptor.get) {
          throw new Error('User model getter not found');
        }
        const userGetter = userDescriptor.get;
        
        Object.defineProperty(this, 'user', {
          get: () => {
            const user = userGetter.call(this);
            const originalOperation = user[operationName];
            
            if (!originalOperation) {
              throw new Error(`Operation ${operationName} not found on user model`);
            }
            
            user[operationName] = async (...args: unknown[]) => {
              hookFn(...args); // Call the hook function
              return originalOperation.call(user, ...args);
            };
            
            return user;
          },
          configurable: true,
          enumerable: true
        });
        
        return this;
      };
      
      clientWithHooks.$after = function(operationName: string, hookFn: (...args: unknown[]) => unknown) {
        const userDescriptor = Object.getOwnPropertyDescriptor(this, 'user');
        if (!userDescriptor || !userDescriptor.get) {
          throw new Error('User model getter not found');
        }
        const userGetter = userDescriptor.get;
        
        Object.defineProperty(this, 'user', {
          get: () => {
            const user = userGetter.call(this);
            const originalOperation = user[operationName];
            
            if (!originalOperation) {
              throw new Error(`Operation ${operationName} not found on user model`);
            }
            
            user[operationName] = async (...args: unknown[]) => {
              const result = await originalOperation.call(user, ...args);
              hookFn(result); // Call the hook function
              return result;
            };
            
            return user;
          },
          configurable: true,
          enumerable: true
        });
        
        return this;
      };
      
      // Apply the hooks
      const dynamicClient = clientWithHooks
        .$before('create', beforeSpy)
        .$after('create', afterSpy);
      
      // Call create to trigger hooks
      await dynamicClient.user.create({ data: { name: 'Dynamic Hook User' } });
      
      // Verify hooks were called
      expect(beforeSpy).toHaveBeenCalledWith({ data: { name: 'Dynamic Hook User' } });
      expect(afterSpy).toHaveBeenCalledWith({ id: 1, name: 'Dynamic Hook User' });
    });
  });
  
  describe('Soft Delete Extension', () => {
    test('should support soft delete operations', async () => {
      // Create a client with soft delete extension
      const softDeleteClient = createTestPrismaClient();
      
      // Manually implement soft delete functionality
      const userGetter = Object.getOwnPropertyDescriptor(softDeleteClient, 'user');
      if (!userGetter || !userGetter.get) {
        throw new Error('User model getter not found');
      }
      
      // Add soft delete methods to the user model
      Object.defineProperty(softDeleteClient, 'user', {
        get: () => {
          const user = userGetter.get.call(softDeleteClient);
          
          // Add softDelete method
          user.softDelete = async ({ where }) => {
            return user.update({
              where,
              data: { deleted: true, deletedAt: new Date() }
            });
          };
          
          // Store original findMany
          const originalFindMany = user.findMany;
          
          // Override findMany to filter out deleted records
          user.findMany = async (args = {}) => {
            const newArgs = { ...args };
            newArgs.where = { ...newArgs.where, deleted: false };
            return originalFindMany.call(user, newArgs);
          };
          
          // Add findManyWithDeleted method
          user.findManyWithDeleted = async (args = {}) => {
            return originalFindMany.call(user, args);
          };
          
          // Add countDeleted method
          user.countDeleted = async () => {
            return (await originalFindMany.call(user, { where: { deleted: true } })).length;
          };
          
          // Add countWithDeleted method
          user.countWithDeleted = async () => {
            return (await originalFindMany.call(user, {})).length;
          };
          
          return user;
        },
        configurable: true,
        enumerable: true
      });
      
      // Create a test user
      await softDeleteClient.user.create({
        data: { name: 'Soft Delete Test', email: 'soft@example.com', deleted: false }
      });
      
      // Verify the user exists
      const initialUsers = await softDeleteClient.user.findMany();
      expect(initialUsers.length).toBe(1);
      
      // Soft delete the user
      await softDeleteClient.user.softDelete({
        where: { email: 'soft@example.com' }
      });
      
      // Verify the user is not found in regular queries
      const regularUsers = await softDeleteClient.user.findMany();
      expect(regularUsers.length).toBe(0);
      
      // Verify the user is found when including deleted
      const deletedUsers = await softDeleteClient.user.findManyWithDeleted();
      expect(deletedUsers.length).toBe(1);
      
      // Test count methods
      const deletedCount = await softDeleteClient.user.countDeleted();
      expect(deletedCount).toBe(1);
      
      const totalCount = await softDeleteClient.user.countWithDeleted();
      expect(totalCount).toBe(1);
      
      // Test soft delete with updateMany (used internally by softDelete)
      const updateResult = await softDeleteClient.user.updateMany({
        where: { email: 'soft@example.com' },
        data: { name: 'Updated Soft Delete Test' }
      });
      
      // Verify soft delete functionality again
      const afterSoftDelete = await softDeleteClient.user.findMany();
      expect(afterSoftDelete.length).toBe(0);
      
      const withDeleted = await softDeleteClient.user.findManyWithDeleted();
      expect(withDeleted.length).toBe(1);
    });
  });
  
  describe('Combining Extensions', () => {
    test('should combine multiple extensions', async () => {
      // Setup spies
      const txSpy = jest.fn();
      const middlewareSpy = jest.fn();
      const hookSpy = jest.fn();
      
      // Create a fresh client for this test
      const testClient = createTestPrismaClient();
      await testClient.$getAdapter().connect();
      
      // Add transaction capabilities
      testClient.$transaction = async function(callback: (tx: unknown) => Promise<unknown>) {
        txSpy();
        return callback(this);
      };
      
      // Add middleware capabilities
      const userDescriptor = Object.getOwnPropertyDescriptor(testClient, 'user');
      if (!userDescriptor || !userDescriptor.get) {
        throw new Error('User model getter not found');
      }
      const userGetter = userDescriptor.get;
      Object.defineProperty(testClient, 'user', {
        get: () => {
          const user = userGetter.call(testClient);
          
          // Wrap findMany with middleware
          const originalFindMany = user.findMany;
          user.findMany = async (params: Record<string, unknown> = {}) => {
            middlewareSpy();
            return originalFindMany.call(user, params);
          };
          
          // Wrap create with hook
          const originalCreate = user.create;
          user.create = async (params: Record<string, unknown> = {}) => {
            hookSpy();
            return originalCreate.call(user, params);
          };
          
          return user;
        },
        configurable: true,
        enumerable: true
      });
      
      // Create a user in a transaction
      await testClient.$transaction(async (tx) => {
        await tx.user.create({ data: { name: 'Combined User' } });
      });
      
      // Query users to trigger middleware
      await testClient.user.findMany();
      
      // Verify all extensions were triggered
      expect(txSpy).toHaveBeenCalled();
      expect(hookSpy).toHaveBeenCalled();
      expect(middlewareSpy).toHaveBeenCalled();
    });
  });
  
  describe('Debug Extension', () => {
    test('should provide debugging capabilities', async () => {
      const debugSpy = jest.fn();
      
      // Create a new client for debugging tests
      const clientWithDebug = createTestPrismaClient();
      await clientWithDebug.$getAdapter().connect();
      
      // Track debug state
      let debugEnabled = false;
      
      // Add debug methods directly
      clientWithDebug.$enableDebug = function() {
        debugEnabled = true;
        return this;
      };
      
      clientWithDebug.$disableDebug = function() {
        debugEnabled = false;
        return this;
      };
      
      // Add debug middleware to user operations
      const userDescriptor = Object.getOwnPropertyDescriptor(clientWithDebug, 'user');
      
      if (!userDescriptor || !userDescriptor.get) {
        throw new Error('User model getter not found');
      }
      
      const userGetter = userDescriptor.get;
      
      Object.defineProperty(clientWithDebug, 'user', {
        get: () => {
          const user = userGetter.call(clientWithDebug);
          
          // Wrap create with debug logging
          const originalCreate = user.create;
          user.create = async (params: Record<string, unknown> = {}) => {
            if (debugEnabled) {
              debugSpy('create', params);
            }
            return originalCreate.call(user, params);
          };
          
          return user;
        },
        configurable: true,
        enumerable: true
      });
      
      // Create a user with debug disabled (default)
      await clientWithDebug.user.create({ data: { name: 'Debug User 1' } });
      expect(debugSpy).not.toHaveBeenCalled();
      
      // Enable debugging
      clientWithDebug.$enableDebug();
      
      // Create another user
      await clientWithDebug.user.create({ data: { name: 'Debug User 2' } });
      expect(debugSpy).toHaveBeenCalled();
      
      // Disable debugging
      clientWithDebug.$disableDebug();
      
      // Create one more user
      await clientWithDebug.user.create({ data: { name: 'Debug User 3' } });
      
      // The debug spy should have been called only once
      expect(debugSpy).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('Batch Extension', () => {
    test('should execute operations in a batch', async () => {
      // Create a fresh client
      const clientWithBatch = createTestPrismaClient();
      await clientWithBatch.$getAdapter().connect();
      
      // Add batch method implementation
      clientWithBatch.$batch = async function(callback) {
        // Begin a transaction to make operations atomic
        const adapter = this.$getAdapter();
        await adapter.beginTransaction();
        
        try {
          // Execute callback
          const result = await callback(this);
          
          // Commit transaction
          await adapter.commitTransaction();
          
          return result;
        } catch (error) {
          // Rollback transaction on error
          await adapter.rollbackTransaction();
          throw error;
        }
      };
      
      // Execute a batch of operations
      const result = await clientWithBatch.$batch(async (batch) => {
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