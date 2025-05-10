/**
 * Advanced Extensions for Drismify
 * This module provides advanced extension capabilities
 */

import { Extension, ExtensionContext, ClientExtension, ModelExtension, QueryExtension, ResultExtension } from './types';

/**
 * Middleware for Drismify client operations
 * This type defines a middleware function that can intercept and modify
 * client operations before and after execution
 */
export type Middleware = (
  params: any,
  next: (params: any) => Promise<any>
) => Promise<any>;

/**
 * Middleware extension
 * This interface defines a middleware extension that can be applied to a client
 */
export interface MiddlewareExtension extends Extension {
  /**
   * Middleware for client operations
   */
  middleware?: Record<string, Middleware>;
}

/**
 * Batch client operations
 * This interface defines batch operations that can be executed as a single transaction
 */
export interface BatchOperations {
  /**
   * Execute a batch of operations as a single transaction
   */
  $batch: <T>(callback: (client: any) => Promise<T>) => Promise<T>;
}

/**
 * Batch extension
 * This interface defines a batch extension that can be applied to a client
 */
export interface BatchExtension extends Extension {
  /**
   * Batch operations
   */
  batch?: BatchOperations;
}

/**
 * Hook type
 * This type defines hooks that can be applied before or after operations
 */
export type Hook = (params: any) => Promise<any> | any;

/**
 * Hook extension
 * This interface defines hooks that can be applied to a client
 */
export interface HookExtension extends Extension {
  /**
   * Hooks for client operations
   */
  hooks?: {
    /**
     * Before hooks
     */
    before?: Record<string, Hook>;
    
    /**
     * After hooks
     */
    after?: Record<string, Hook>;
  };
}

/**
 * Transaction extension
 * This interface defines transaction operations that can be applied to a client
 */
export interface TransactionExtension extends Extension {
  /**
   * Transaction operations
   */
  transaction?: {
    /**
     * Start a transaction
     */
    $begin: () => Promise<void>;
    
    /**
     * Commit a transaction
     */
    $commit: () => Promise<void>;
    
    /**
     * Rollback a transaction
     */
    $rollback: () => Promise<void>;
    
    /**
     * Execute a callback in a transaction
     */
    $transaction: <T>(callback: (client: any) => Promise<T>) => Promise<T>;
  };
}

/**
 * Combine multiple extensions into a single extension
 * This function combines multiple extensions into a single extension
 */
export function combineExtensions(...extensions: Extension[]): Extension {
  const combined: Extension = {
    name: 'CombinedExtension',
    model: {},
    client: {},
    query: {},
    result: {}
  };
  
  for (const extension of extensions) {
    // Combine model extensions
    if (extension.model) {
      combined.model = combined.model || {};
      
      // Handle $allModels
      if (extension.model.$allModels) {
        combined.model.$allModels = combined.model.$allModels || {};
        Object.assign(combined.model.$allModels, extension.model.$allModels);
      }
      
      // Handle specific models
      for (const modelName in extension.model) {
        if (modelName === '$allModels') continue;
        
        combined.model[modelName] = combined.model[modelName] || {};
        Object.assign(combined.model[modelName], extension.model[modelName]);
      }
    }
    
    // Combine client extensions
    if (extension.client) {
      combined.client = combined.client || {};
      Object.assign(combined.client, extension.client);
    }
    
    // Combine query extensions
    if (extension.query) {
      combined.query = combined.query || {};
      
      // Handle $allModels
      if (extension.query.$allModels) {
        combined.query.$allModels = combined.query.$allModels || {};
        Object.assign(combined.query.$allModels, extension.query.$allModels);
      }
      
      // Handle specific models
      for (const modelName in extension.query) {
        if (modelName === '$allModels') continue;
        
        combined.query[modelName] = combined.query[modelName] || {};
        Object.assign(combined.query[modelName], extension.query[modelName]);
      }
    }
    
    // Combine result extensions
    if (extension.result) {
      combined.result = combined.result || {};
      
      // Handle $allModels
      if (extension.result.$allModels) {
        combined.result.$allModels = combined.result.$allModels || {};
        Object.assign(combined.result.$allModels, extension.result.$allModels);
      }
      
      // Handle specific models
      for (const modelName in extension.result) {
        if (modelName === '$allModels') continue;
        
        combined.result[modelName] = combined.result[modelName] || {};
        Object.assign(combined.result[modelName], extension.result[modelName]);
      }
    }
  }
  
  return combined;
}

/**
 * Create a middleware extension
 * This function creates a middleware extension that can intercept and modify client operations
 */
export function createMiddlewareExtension(middleware: Record<string, Middleware>): MiddlewareExtension {
  return {
    name: 'MiddlewareExtension',
    client: {
      $use: function(operationName: string, middlewareFunction: Middleware) {
        const middlewareExtension = { ...middleware };
        middlewareExtension[operationName] = middlewareFunction;
        return this.$extends({
          name: 'DynamicMiddlewareExtension',
          client: {
            $use: this.$use
          },
          middleware: middlewareExtension
        });
      }
    },
    middleware
  };
}

/**
 * Create a batch extension
 * This function creates a batch extension that can execute multiple operations as a single transaction
 */
export function createBatchExtension(): BatchExtension {
  return {
    name: 'BatchExtension',
    client: {
      $batch: async function<T>(callback: (client: any) => Promise<T>): Promise<T> {
        const adapter = this.$getAdapter();
        
        try {
          // Begin transaction
          await adapter.beginTransaction();
          
          // Execute callback
          const result = await callback(this);
          
          // Commit transaction
          await adapter.commitTransaction();
          
          return result;
        } catch (error) {
          // Rollback transaction
          await adapter.rollbackTransaction();
          throw error;
        }
      }
    }
  };
}

/**
 * Create a transaction extension
 * This function creates a transaction extension that provides transaction operations
 */
export function createTransactionExtension(): TransactionExtension {
  return {
    name: 'TransactionExtension',
    transaction: {
      $begin: async function() {
        const adapter = this.$getAdapter();
        await adapter.beginTransaction();
      },
      
      $commit: async function() {
        const adapter = this.$getAdapter();
        await adapter.commitTransaction();
      },
      
      $rollback: async function() {
        const adapter = this.$getAdapter();
        await adapter.rollbackTransaction();
      },
      
      $transaction: async function<T>(callback: (client: any) => Promise<T>): Promise<T> {
        const adapter = this.$getAdapter();
        
        try {
          // Begin transaction
          await adapter.beginTransaction();
          
          // Execute callback
          const result = await callback(this);
          
          // Commit transaction
          await adapter.commitTransaction();
          
          return result;
        } catch (error) {
          // Rollback transaction
          await adapter.rollbackTransaction();
          throw error;
        }
      }
    },
    client: {
      $transaction: async function<T>(callback: (client: any) => Promise<T>): Promise<T> {
        const adapter = this.$getAdapter();
        
        try {
          // Begin transaction
          await adapter.beginTransaction();
          
          // Execute callback
          const result = await callback(this);
          
          // Commit transaction
          await adapter.commitTransaction();
          
          return result;
        } catch (error) {
          // Rollback transaction
          await adapter.rollbackTransaction();
          throw error;
        }
      }
    }
  };
}

/**
 * Create a hook extension
 * This function creates a hook extension that can execute functions before and after operations
 */
export function createHookExtension(
  beforeHooks: Record<string, Hook> = {},
  afterHooks: Record<string, Hook> = {}
): HookExtension {
  return {
    name: 'HookExtension',
    hooks: {
      before: beforeHooks,
      after: afterHooks
    },
    client: {
      $before: function(operationName: string, hook: Hook) {
        const newBeforeHooks = { ...beforeHooks };
        newBeforeHooks[operationName] = hook;
        
        return this.$extends({
          name: 'DynamicHookExtension',
          client: {
            $before: this.$before,
            $after: this.$after
          },
          hooks: {
            before: newBeforeHooks,
            after: { ...afterHooks }
          }
        });
      },
      $after: function(operationName: string, hook: Hook) {
        const newAfterHooks = { ...afterHooks };
        newAfterHooks[operationName] = hook;
        
        return this.$extends({
          name: 'DynamicHookExtension',
          client: {
            $before: this.$before,
            $after: this.$after
          },
          hooks: {
            before: { ...beforeHooks },
            after: newAfterHooks
          }
        });
      }
    }
  };
}

/**
 * Create a debug extension
 * This function creates a debug extension that logs all operations
 */
export function createDebugExtension(
  logger: (message: string, data?: any) => void = console.log
): Extension {
  return {
    name: 'DebugExtension',
    client: {
      $enableDebug: function() {
        this.$debug = true;
        return this;
      },
      $disableDebug: function() {
        this.$debug = false;
        return this;
      }
    },
    query: {
      $allModels: {
        findMany: (args: any) => {
          if (logger) {
            logger('findMany', args);
          }
          return args;
        },
        findUnique: (args: any) => {
          if (logger) {
            logger('findUnique', args);
          }
          return args;
        },
        findFirst: (args: any) => {
          if (logger) {
            logger('findFirst', args);
          }
          return args;
        },
        create: (args: any) => {
          if (logger) {
            logger('create', args);
          }
          return args;
        },
        update: (args: any) => {
          if (logger) {
            logger('update', args);
          }
          return args;
        },
        upsert: (args: any) => {
          if (logger) {
            logger('upsert', args);
          }
          return args;
        },
        delete: (args: any) => {
          if (logger) {
            logger('delete', args);
          }
          return args;
        },
        count: (args: any) => {
          if (logger) {
            logger('count', args);
          }
          return args;
        }
      }
    }
  };
}

/**
 * Create a custom field extension
 * This function creates an extension that adds computed fields to query results
 */
export function createComputedFieldsExtension(
  computedFields: Record<string, Record<string, {
    needs: Record<string, boolean>;
    compute: (data: any) => any;
  }>>
): Extension {
  return {
    name: 'ComputedFieldsExtension',
    result: Object.entries(computedFields).reduce((acc, [modelName, fields]) => {
      acc[modelName] = fields;
      return acc;
    }, {} as Record<string, any>),
    client: {
      $addComputedField: function(modelName: string, fieldName: string, options: {
        needs: Record<string, boolean>;
        compute: (data: any) => any;
      }) {
        const newComputedFields = { ...computedFields };
        newComputedFields[modelName] = newComputedFields[modelName] || {};
        newComputedFields[modelName][fieldName] = options;
        
        return this.$extends(createComputedFieldsExtension(newComputedFields));
      }
    }
  };
}

/**
 * Create a soft delete extension
 * This function creates an extension that handles soft deletion of records
 */
export function createSoftDeleteExtension(
  deletedField: string = 'deleted',
  deletedAtField: string = 'deletedAt'
): Extension {
  return {
    name: 'SoftDeleteExtension',
    query: {
      $allModels: {
        findMany: (args: any) => {
          args = args || {};
          args.where = args.where || {};
          args.where[deletedField] = false;
          return args;
        },
        findFirst: (args: any) => {
          args = args || {};
          args.where = args.where || {};
          args.where[deletedField] = false;
          return args;
        },
        findUnique: (args: any) => {
          args = args || {};
          args.where = args.where || {};
          args.where[deletedField] = false;
          return args;
        },
        count: (args: any) => {
          args = args || {};
          args.where = args.where || {};
          args.where[deletedField] = false;
          return args;
        }
      }
    },
    model: {
      $allModels: {
        softDelete: async function(where: any) {
          const now = new Date();
          return this.update({
            where,
            data: {
              [deletedField]: true,
              [deletedAtField]: now
            }
          });
        },
        hardDelete: async function(where: any) {
          return this.delete({
            where
          });
        },
        restore: async function(where: any) {
          return this.update({
            where: {
              ...where,
              [deletedField]: true
            },
            data: {
              [deletedField]: false,
              [deletedAtField]: null
            }
          });
        },
        findDeleted: async function(args: any = {}) {
          args = args || {};
          args.where = args.where || {};
          args.where[deletedField] = true;
          return this.findMany(args);
        },
        findWithDeleted: async function(args: any = {}) {
          args = args || {};
          args.where = args.where || {};
          delete args.where[deletedField];
          return this.findMany(args);
        }
      }
    }
  };
}

// Export advanced extensions
export const advancedExtensions = {
  combineExtensions,
  createMiddlewareExtension,
  createBatchExtension,
  createTransactionExtension,
  createHookExtension,
  createDebugExtension,
  createComputedFieldsExtension,
  createSoftDeleteExtension
};