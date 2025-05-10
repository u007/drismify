/**
 * Drismify Extensions
 * This module provides functionality for extending the Drismify client
 */

import { Extension, ExtensionContext } from './types';
import * as advancedExtensions from './advanced';

// Export types
export * from './types';
export * from './advanced';

/**
 * Define an extension
 * This is a utility function for defining extensions
 */
export function defineExtension(extension: Extension): Extension {
  return extension;
}

/**
 * Get the extension context
 * This is a utility function for getting the extension context
 */
export function getExtensionContext(instance: any): ExtensionContext {
  if (!instance || typeof instance !== 'object') {
    throw new Error('Cannot get extension context from non-object instance');
  }

  return instance;
}

/**
 * Apply an extension to a client
 * This is an internal function used by the client to apply extensions
 */
export function applyExtension(client: any, extension: Extension): any {
  if (!extension) {
    return client;
  }

  // Create a new client instance with the same properties
  const newClient = Object.create(
    Object.getPrototypeOf(client),
    Object.getOwnPropertyDescriptors(client)
  );

  // Apply model extensions
  if (extension.model) {
    applyModelExtension(newClient, extension.model);
  }

  // Apply client extensions
  if (extension.client) {
    applyClientExtension(newClient, extension.client);
  }

  // Apply query extensions
  if (extension.query) {
    applyQueryExtension(newClient, extension.query);
  }

  // Apply result extensions
  if (extension.result) {
    applyResultExtension(newClient, extension.result);
  }

  // Apply middleware extensions
  if ((extension as any).middleware) {
    applyMiddlewareExtension(newClient, (extension as any).middleware);
  }

  // Apply hooks
  if ((extension as any).hooks) {
    applyHooksExtension(newClient, (extension as any).hooks);
  }

  // Apply transaction extensions
  if ((extension as any).transaction) {
    applyTransactionExtension(newClient, (extension as any).transaction);
  }

  return newClient;
}

/**
 * Apply a model extension to a client
 */
function applyModelExtension(client: any, modelExtension: any): void {
  // Apply $allModels extensions to all models
  if (modelExtension.$allModels) {
    const allModelMethods = modelExtension.$allModels;

    // Get all model names from the client
    const modelNames = Object.keys(client).filter(key => {
      return typeof client[key] === 'object' &&
             client[key] !== null &&
             !key.startsWith('$') &&
             typeof client[key].findMany === 'function';
    });

    // Apply methods to all models
    for (const modelName of modelNames) {
      const model = client[modelName];

      for (const methodName in allModelMethods) {
        if (methodName === '$allModels') continue;

        const method = allModelMethods[methodName];
        model[methodName] = function(...args: any[]) {
          return method.apply(this, args);
        };
      }
    }
  }

  // Apply model-specific extensions
  for (const modelName in modelExtension) {
    if (modelName === '$allModels') continue;

    const model = client[modelName];
    if (!model) continue;

    const modelMethods = modelExtension[modelName];
    if (!modelMethods) continue;

    for (const methodName in modelMethods) {
      const method = modelMethods[methodName];
      model[methodName] = function(...args: any[]) {
        return method.apply(this, args);
      };
    }
  }
}

/**
 * Apply a client extension to a client
 */
function applyClientExtension(client: any, clientExtension: any): void {
  for (const methodName in clientExtension) {
    const method = clientExtension[methodName];
    client[methodName] = function(...args: any[]) {
      return method.apply(this, args);
    };
  }
}

/**
 * Apply a query extension to a client
 */
function applyQueryExtension(client: any, queryExtension: any): void {
  // Apply $allModels extensions to all models
  if (queryExtension.$allModels) {
    const allModelQueries = queryExtension.$allModels;

    // Get all model names from the client
    const modelNames = Object.keys(client).filter(key => {
      return typeof client[key] === 'object' &&
             client[key] !== null &&
             !key.startsWith('$') &&
             typeof client[key].findMany === 'function';
    });

    // Apply query modifiers to all models
    for (const modelName of modelNames) {
      const model = client[modelName];

      for (const queryName in allModelQueries) {
        if (queryName === '$allModels') continue;

        const originalQuery = model[queryName];
        if (typeof originalQuery !== 'function') continue;

        const queryModifier = allModelQueries[queryName];
        model[queryName] = function(...args: any[]) {
          const modifiedArgs = queryModifier.apply(this, args);
          return originalQuery.call(this, modifiedArgs);
        };
      }
    }
  }

  // Apply model-specific query extensions
  for (const modelName in queryExtension) {
    if (modelName === '$allModels') continue;

    const model = client[modelName];
    if (!model) continue;

    const modelQueries = queryExtension[modelName];
    if (!modelQueries) continue;

    for (const queryName in modelQueries) {
      const originalQuery = model[queryName];
      if (typeof originalQuery !== 'function') continue;

      const queryModifier = modelQueries[queryName];
      model[queryName] = function(...args: any[]) {
        const modifiedArgs = queryModifier.apply(this, args);
        return originalQuery.call(this, modifiedArgs);
      };
    }
  }
}

/**
 * Apply a result extension to a client
 */
function applyResultExtension(client: any, resultExtension: any): void {
  // Get all model names from the client
  const modelNames = Object.keys(client).filter(key => {
    return typeof client[key] === 'object' &&
           client[key] !== null &&
           !key.startsWith('$') &&
           typeof client[key].findMany === 'function';
  });

  // Apply result extensions to all models
  for (const modelName of modelNames) {
    // Skip if no result extension for this model
    if (!resultExtension[modelName] && !resultExtension.$allModels) continue;

    const model = client[modelName];
    
    // Get model-specific and all-models result fields
    const modelFields = resultExtension[modelName] || {};
    const allModelFields = resultExtension.$allModels || {};
    
    // Combine fields
    const fields = { ...allModelFields, ...modelFields };
    
    // Apply result extensions to model operations that return data
    for (const operationName of ['findMany', 'findFirst', 'findUnique', 'findById', 'create', 'update', 'upsert']) {
      if (typeof model[operationName] !== 'function') continue;
      
      const originalOperation = model[operationName];
      
      // Wrap the original operation to add computed fields
      model[operationName] = async function(...args: any[]) {
        const result = await originalOperation.call(this, ...args);
        
        if (!result) return result;
        
        // For findMany, process array of results
        if (Array.isArray(result)) {
          return result.map(item => processResultItem(item, fields));
        }
        
        // For single result operations
        return processResultItem(result, fields);
      };
    }
  }
  
  // Helper function to process a single result item
  function processResultItem(item: any, fields: any): any {
    if (!item || typeof item !== 'object') return item;
    
    const result = { ...item };
    
    // Apply each computed field
    for (const [fieldName, fieldDef] of Object.entries(fields)) {
      const { compute, needs } = fieldDef as { compute: Function, needs: Record<string, boolean> };
      
      // Check if all needed fields are present
      const hasAllNeeds = Object.keys(needs).every(neededField => result[neededField] !== undefined);
      
      if (hasAllNeeds) {
        // Compute and add the field
        result[fieldName] = compute(result);
      }
    }
    
    return result;
  }
}

/**
 * Apply a middleware extension to a client
 */
function applyMiddlewareExtension(client: any, middlewareExtension: any): void {
  // Get all model names from the client
  const modelNames = Object.keys(client).filter(key => {
    return typeof client[key] === 'object' &&
           client[key] !== null &&
           !key.startsWith('$') &&
           typeof client[key].findMany === 'function';
  });

  // Apply middleware to all models
  for (const modelName of modelNames) {
    const model = client[modelName];

    // Apply middleware to model operations
    for (const operationName in model) {
      if (typeof model[operationName] !== 'function') continue;

      const originalOperation = model[operationName];
      
      // Check if there's middleware for this operation
      if (middlewareExtension[operationName]) {
        const middleware = middlewareExtension[operationName];
        
        // Wrap the original operation with middleware
        model[operationName] = async function(...args: any[]) {
          const params = args[0] || {};
          const next = async (p: any) => {
            return await originalOperation.call(this, p);
          };
          return await middleware.call(this, params, next);
        };
      }
    }
  }
}

/**
 * Apply hooks to a client
 */
function applyHooksExtension(client: any, hooksExtension: any): void {
  const { before = {}, after = {} } = hooksExtension;

  // Get all model names from the client
  const modelNames = Object.keys(client).filter(key => {
    return typeof client[key] === 'object' &&
           client[key] !== null &&
           !key.startsWith('$') &&
           typeof client[key].findMany === 'function';
  });

  // Apply hooks to all models
  for (const modelName of modelNames) {
    // Get the original getter if there is one
    const modelDescriptor = Object.getOwnPropertyDescriptor(client, modelName);
    if (!modelDescriptor) continue;
    
    if (modelDescriptor.get) {
      // We have a getter, so we need to wrap it
      const originalGetter = modelDescriptor.get;
      
      Object.defineProperty(client, modelName, {
        get: function() {
          // Get the original model
          const model = originalGetter.call(this);
          
          // For each operation that has hooks
          for (const operationName in model) {
            if (typeof model[operationName] !== 'function') continue;
            
            const originalOperation = model[operationName];
            const beforeHook = before[operationName];
            const afterHook = after[operationName];
            
            if (beforeHook || afterHook) {
              // Wrap the original operation with hooks
              model[operationName] = async function(...args: any[]) {
                let params = args[0] || {};
                
                // Apply before hook
                if (beforeHook) {
                  params = await beforeHook(params);
                }
                
                // Call the original operation
                const result = await originalOperation.call(this, params);
                
                // Apply after hook
                if (afterHook) {
                  return afterHook(result);
                }
                
                return result;
              };
            }
          }
          
          return model;
        },
        enumerable: modelDescriptor.enumerable,
        configurable: modelDescriptor.configurable
      });
    } else {
      // Direct property, not a getter
      const model = client[modelName];

      // Apply hooks to model operations
      for (const operationName in model) {
        if (typeof model[operationName] !== 'function') continue;

        const originalOperation = model[operationName];
        const beforeHook = before[operationName];
        const afterHook = after[operationName];

        if (beforeHook || afterHook) {
          // Wrap the original operation with hooks
          model[operationName] = async function(...args: any[]) {
            let params = args[0] || {};
            
            // Apply before hook
            if (beforeHook) {
              params = await beforeHook(params);
            }
            
            // Call the original operation
            const result = await originalOperation.call(this, params);
            
            // Apply after hook
            if (afterHook) {
              return afterHook(result);
            }
            
            return result;
          };
        }
      }
    }
  }
}

/**
 * Apply transaction extensions to a client
 */
function applyTransactionExtension(client: any, transactionExtension: any): void {
  // Add each transaction method to the client
  for (const methodName in transactionExtension) {
    const method = transactionExtension[methodName];
    
    // Create a bound version of the method to ensure proper 'this' context
    client[methodName] = async function(...args: any[]) {
      // Ensure the adapter is connected before transaction operations
      const adapter = this.$getAdapter();
      if (!adapter.isActive()) {
        await adapter.connect();
      }
      
      // Apply the transaction method
      return method.apply(this, args);
    };
  }
  
  // If there's a transaction method but no $transaction on the client,
  // add it as a convenience method directly on the client
  if (transactionExtension.$transaction && !client.$transaction) {
    client.$transaction = client.$transaction || transactionExtension.$transaction;
  }
}
