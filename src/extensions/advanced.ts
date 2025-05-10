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
        
        // Ensure adapter is connected before starting transaction
        if (!adapter.isActive()) {
          await adapter.connect();
        }
        
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
          if (adapter.isActive()) {
            await adapter.rollbackTransaction();
          }
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
        // Ensure adapter is connected before beginning transaction
        if (!adapter.isActive()) {
          await adapter.connect();
        }
        await adapter.beginTransaction();
      },
      
      $commit: async function() {
        const adapter = this.$getAdapter();
        // Ensure adapter is connected before committing transaction
        if (!adapter.isActive()) {
          throw new Error('Cannot commit transaction: Database adapter is not connected');
        }
        await adapter.commitTransaction();
      },
      
      $rollback: async function() {
        const adapter = this.$getAdapter();
        // Ensure adapter is connected before rolling back transaction
        if (!adapter.isActive()) {
          throw new Error('Cannot rollback transaction: Database adapter is not connected');
        }
        await adapter.rollbackTransaction();
      },
      
      $transaction: async function<T>(callback: (client: any) => Promise<T>): Promise<T> {
        const adapter = this.$getAdapter();
        
        // Ensure adapter is connected before starting transaction
        if (!adapter.isActive()) {
          await adapter.connect();
        }
        
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
          if (adapter.isActive()) {
            await adapter.rollbackTransaction();
          }
          throw error;
        }
      }
    },
    client: {
      $transaction: async function<T>(callback: (client: any) => Promise<T>): Promise<T> {
        const adapter = this.$getAdapter();
        
        // Ensure adapter is connected before starting transaction
        if (!adapter.isActive()) {
          await adapter.connect();
        }
        
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
          if (adapter.isActive()) {
            await adapter.rollbackTransaction();
          }
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
 * Configuration options for soft delete extension
 */
export interface SoftDeleteOptions {
  /**
   * Field name to use for marking records as deleted (default: 'deleted')
   */
  deletedField?: string;
  
  /**
   * Field name to use for storing deletion timestamp (default: 'deletedAt')
   */
  deletedAtField?: string;
  
  /**
   * When true, soft deleted records are included in includes/relations (default: false)
   */
  includeDeletedInRelations?: boolean;
  
  /**
   * When true, eager load deleted status in relations (default: false)
   */
  propagateDeletedStatus?: boolean;

  /**
   * Custom filter to use for excluding deleted records (default: undefined)
   * If provided, this function will be called instead of the default filter
   */
  customDeletedFilter?: (args: any) => any;
  
  /**
   * When true, enables debug logging for the extension (default: false)
   */
  debug?: boolean;
}

/**
 * Create a soft delete extension
 * This function creates an extension that handles soft deletion of records
 * 
 * @param options Configuration options for soft delete behavior
 * @returns Extension for handling soft deletion
 */
export function createSoftDeleteExtension(options?: SoftDeleteOptions | string): Extension {
  // Handle legacy function signature
  let config: SoftDeleteOptions = {};
  
  if (typeof options === 'string') {
    config = {
      deletedField: options,
      deletedAtField: arguments[1] as string
    };
  } else {
    config = options || {};
  }
  
  // Set default values
  const deletedField = config.deletedField || 'deleted';
  const deletedAtField = config.deletedAtField || 'deletedAt';
  const includeDeletedInRelations = config.includeDeletedInRelations || false;
  const propagateDeletedStatus = config.propagateDeletedStatus || false;
  const debug = config.debug || false;
  
  // Function to apply the not-deleted filter to query args
  const applyNotDeletedFilter = (args: any) => {
    if (config.customDeletedFilter) {
      return config.customDeletedFilter(args);
    }
    
    args = args || {};
    args.where = args.where || {};
    
    if (debug) {
      console.log('SoftDelete: applyNotDeletedFilter - before:', JSON.stringify(args));
    }
    
    // Only apply filter if not explicitly asking for deleted records
    if (args.where[deletedField] === undefined) {
      args.where[deletedField] = false;
    }
    
    // Handle include relations if configured
    if (!includeDeletedInRelations && args.include) {
      for (const relationName in args.include) {
        if (args.include[relationName] && typeof args.include[relationName] === 'object') {
          if (!args.include[relationName].where) {
            args.include[relationName].where = {};
          }
          
          // Only apply filter if not already specified
          if (args.include[relationName].where[deletedField] === undefined) {
            args.include[relationName].where[deletedField] = false;
          }
        }
      }
    }
    
    if (debug) {
      console.log('SoftDelete: applyNotDeletedFilter - after:', JSON.stringify(args));
    }
    return args;
  };
  
  // Function to apply deleted filter to query args
  const applyDeletedFilter = (args: any) => {
    args = args || {};
    args.where = args.where || {};
    if (debug) {
      console.log('SoftDelete: applyDeletedFilter - before:', JSON.stringify(args));
    }
    args.where[deletedField] = true;
    if (debug) {
      console.log('SoftDelete: applyDeletedFilter - after:', JSON.stringify(args));
    }
    return args;
  };
  
  // Function to remove deleted filter from query args
  const removeDeletedFilter = (args: any) => {
    args = args || {};
    args.where = args.where || {};
    if (debug) {
      console.log('SoftDelete: removeDeletedFilter - before:', JSON.stringify(args));
    }
    delete args.where[deletedField];
    if (debug) {
      console.log('SoftDelete: removeDeletedFilter - after:', JSON.stringify(args));
    }
    return args;
  };
  
  return {
    name: 'SoftDeleteExtension',
    query: {
      $allModels: {
        findMany: applyNotDeletedFilter,
        findFirst: applyNotDeletedFilter,
        findUnique: applyNotDeletedFilter,
        findById: applyNotDeletedFilter,
        count: applyNotDeletedFilter,
        aggregate: applyNotDeletedFilter,
        groupBy: applyNotDeletedFilter
      }
    },
    model: {
      $allModels: {
        /**
         * Soft delete records matching the where condition
         * 
         * @param params Query parameters including where condition
         * @returns The updated records
         */
        softDelete: async function(params: any) {
          const now = new Date();
          const where = params?.where || params;
          
          return this.updateMany({
            where,
            data: {
              [deletedField]: true,
              [deletedAtField]: now
            }
          });
        },
        
        /**
         * Permanently delete records matching the where condition
         * This ignores the soft delete status
         * 
         * @param params Query parameters including where condition
         * @returns The deleted records
         */
        hardDelete: async function(params: any) {
          const where = params?.where || params;
          
          // Use updateMany to bypass soft delete filter
          return this.deleteMany({
            where: removeDeletedFilter({ where }).where
          });
        },
        
        /**
         * Restore soft-deleted records matching the where condition
         * 
         * @param params Query parameters including where condition
         * @returns The restored records
         */
        restore: async function(params: any) {
          const where = params?.where || params;
          
          return this.updateMany({
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
        
        /**
         * Find only soft-deleted records
         * 
         * @param args Query parameters
         * @returns Soft-deleted records matching the query
         */
        findDeleted: async function(args: any = {}) {
          if (debug) {
            console.log('SoftDelete: findDeleted called with args:', JSON.stringify(args));
          }
          const modifiedArgs = applyDeletedFilter(args);
          if (debug) {
            console.log('SoftDelete: findDeleted using modified args:', JSON.stringify(modifiedArgs));
          }
          return this.findMany(modifiedArgs);
        },
        
        /**
         * Find records regardless of soft-delete status
         * 
         * @param args Query parameters
         * @returns All records matching the query, including soft-deleted ones
         */
        findWithDeleted: async function(args: any = {}) {
          return this.findMany(removeDeletedFilter(args));
        },
        
        /**
         * Count soft-deleted records
         * 
         * @param args Query parameters
         * @returns Count of soft-deleted records matching the query
         */
        countDeleted: async function(args: any = {}) {
          return this.count(applyDeletedFilter(args));
        },
        
        /**
         * Count all records regardless of soft-delete status
         * 
         * @param args Query parameters
         * @returns Count of all records matching the query, including soft-deleted ones
         */
        countWithDeleted: async function(args: any = {}) {
          return this.count(removeDeletedFilter(args));
        }
      }
    },
    client: {
      /**
       * Configure soft delete options at runtime
       * 
       * @param newOptions New soft delete options
       * @returns Updated client with new soft delete options
       */
      $configureSoftDelete: function(newOptions: SoftDeleteOptions) {
        return this.$extends(createSoftDeleteExtension({
          ...config,
          ...newOptions
        }));
      },
      
      /**
       * Get current soft delete configuration
       * 
       * @returns Current soft delete configuration
       */
      $getSoftDeleteConfig: function() {
        return { ...config };
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