import { PrismaClient } from '../client/base-client';
import { Drismify } from '../index';
import {
  combineExtensions,
  createMiddlewareExtension,
  createBatchExtension,
  createTransactionExtension,
  createHookExtension,
  createDebugExtension,
  createComputedFieldsExtension,
  createSoftDeleteExtension
} from '../extensions/advanced';

async function main() {
  // Initialize a base client
  const basePrisma = new PrismaClient();
  await basePrisma.connect();

  try {
    console.log('\n--- Advanced Extensions Examples ---\n');

    // Example 1: Middleware Extension
    console.log('1. Middleware Extension');
    const middlewareExtension = createMiddlewareExtension({
      findMany: async (params, next) => {
        console.log('Before findMany with params:', params);
        const startTime = Date.now();
        const result = await next(params);
        const duration = Date.now() - startTime;
        console.log(`findMany took ${duration}ms`);
        return result;
      }
    });

    const clientWithMiddleware = basePrisma.$extends(middlewareExtension);
    
    // Use the middleware (this would trigger the middleware if we had a user model)
    // await clientWithMiddleware.user.findMany({});

    // Example 2: Dynamic middleware with $use method
    console.log('\n2. Dynamic Middleware with $use');
    const dynamicMiddlewareClient = clientWithMiddleware.$use('create', async (params, next) => {
      console.log('Before create with params:', params);
      return next(params);
    });

    // Example 3: Transaction Extension
    console.log('\n3. Transaction Extension');
    const transactionExtension = createTransactionExtension();
    const clientWithTransaction = basePrisma.$extends(transactionExtension);

    // Use transaction method
    try {
      const result = await clientWithTransaction.$transaction(async (tx) => {
        // Perform operations inside transaction
        // await tx.user.create({ data: { name: 'Transaction Test' } });
        // await tx.post.create({ data: { title: 'Transaction Post' } });
        return { success: true };
      });
      console.log('Transaction result:', result);
    } catch (error) {
      console.error('Transaction failed:', error);
    }

    // Example 4: Hook Extension
    console.log('\n4. Hook Extension');
    const hookExtension = createHookExtension(
      {
        // Before hooks
        create: async (params) => {
          console.log('Before create hook', params);
          return params;
        }
      },
      {
        // After hooks
        findMany: async (result) => {
          console.log('After findMany hook', { resultCount: Array.isArray(result) ? result.length : 0 });
          return result;
        }
      }
    );

    const clientWithHooks = basePrisma.$extends(hookExtension);
    
    // Add dynamic hooks
    const dynamicHooksClient = clientWithHooks
      .$before('update', (params) => {
        console.log('Dynamic before update hook', params);
        return params;
      })
      .$after('update', (result) => {
        console.log('Dynamic after update hook', result);
        return result;
      });

    // Example 5: Debug Extension
    console.log('\n5. Debug Extension');
    const debugExtension = createDebugExtension((message, data) => {
      console.log(`DEBUG: ${message}`, data ? data : '');
    });

    const clientWithDebug = basePrisma.$extends(debugExtension);
    
    // Enable debugging
    clientWithDebug.$enableDebug();
    
    // This would log debug information if we had a post model
    // await clientWithDebug.post.findMany({});
    
    // Disable debugging
    clientWithDebug.$disableDebug();

    // Example 6: Soft Delete Extension
    console.log('\n6. Soft Delete Extension');
    const softDeleteExtension = createSoftDeleteExtension('isDeleted', 'deletedAt');
    const clientWithSoftDelete = basePrisma.$extends(softDeleteExtension);

    // Now all find queries will exclude soft-deleted records automatically
    // And the client has new methods: softDelete, hardDelete, restore, findDeleted, findWithDeleted

    // Example 7: Computed Fields Extension
    console.log('\n7. Computed Fields Extension');
    const computedFieldsExtension = createComputedFieldsExtension({
      user: {
        fullName: {
          needs: { firstName: true, lastName: true },
          compute: (user) => `${user.firstName} ${user.lastName}`
        }
      }
    });

    const clientWithComputedFields = basePrisma.$extends(computedFieldsExtension);
    
    // Add a dynamic computed field
    clientWithComputedFields.$addComputedField('user', 'nameWithTitle', {
      needs: { title: true, firstName: true, lastName: true },
      compute: (user) => `${user.title || ''} ${user.firstName} ${user.lastName}`.trim()
    });

    // Example 8: Batch Extension
    console.log('\n8. Batch Extension');
    const batchExtension = createBatchExtension();
    const clientWithBatch = basePrisma.$extends(batchExtension);

    // Use batch operations
    try {
      const result = await clientWithBatch.$batch(async (batch) => {
        // Perform multiple operations as a single transaction
        // const users = await batch.user.findMany({});
        // const posts = await batch.post.findMany({});
        return { success: true };
      });
      console.log('Batch operation result:', result);
    } catch (error) {
      console.error('Batch operation failed:', error);
    }

    // Example 9: Combining Extensions
    console.log('\n9. Combining Extensions');
    const combinedExtension = combineExtensions(
      middlewareExtension,
      transactionExtension,
      hookExtension,
      debugExtension
    );

    const clientWithCombinedExtensions = basePrisma.$extends(combinedExtension);
    console.log('Client with combined extensions created');

    // Example 10: Reusable Extension Definition
    console.log('\n10. Reusable Extension Definition');
    
    // Define a reusable extension
    const loggingExtension = Drismify.defineExtension({
      name: 'LoggingExtension',
      client: {
        $log: function(message: string) {
          console.log(`[LOG] ${message}`);
          return this;
        }
      },
      model: {
        $allModels: {
          logOperation: function(operation: string, data: any) {
            console.log(`[MODEL LOG] ${operation}:`, data);
            return this;
          }
        }
      }
    });

    // Use the reusable extension
    const clientWithLogging = basePrisma.$extends(loggingExtension);
    clientWithLogging.$log('Using the logging extension');

    console.log('\n--- Examples Completed ---');
  } catch (error) {
    console.error('Error in examples:', error);
  } finally {
    // Disconnect from the database
    await basePrisma.disconnect();
  }
}

// Run the examples
main().catch(console.error);