/**
 * Types for Drismify extensions
 * These types define the structure of extensions that can be applied to the Drismify client
 */

import { DatabaseAdapter } from '../adapters';

/**
 * Extension component types
 */
export type ExtensionComponentType = 'model' | 'client' | 'query' | 'result';

/**
 * Base extension interface
 */
export interface Extension {
  /**
   * Optional name for the extension (used in error logs)
   */
  name?: string;
  
  /**
   * Model extension component
   * Adds methods to models
   */
  model?: ModelExtension;
  
  /**
   * Client extension component
   * Adds methods to the client
   */
  client?: ClientExtension;
  
  /**
   * Query extension component
   * Modifies queries
   */
  query?: QueryExtension;
  
  /**
   * Result extension component
   * Adds fields to query results
   */
  result?: ResultExtension;
}

/**
 * Model extension interface
 * Adds methods to models
 */
export interface ModelExtension {
  /**
   * Methods to add to all models
   */
  $allModels?: Record<string, Function>;
  
  /**
   * Methods to add to specific models
   * Key is the model name, value is an object of methods
   */
  [modelName: string]: Record<string, Function> | undefined;
}

/**
 * Client extension interface
 * Adds methods to the client
 */
export interface ClientExtension {
  /**
   * Methods to add to the client
   */
  [methodName: string]: Function;
}

/**
 * Query extension interface
 * Modifies queries
 */
export interface QueryExtension {
  /**
   * Query modifiers for all models
   */
  $allModels?: Record<string, QueryModifier>;
  
  /**
   * Query modifiers for specific models
   * Key is the model name, value is an object of query modifiers
   */
  [modelName: string]: Record<string, QueryModifier> | undefined;
}

/**
 * Query modifier function
 * Takes the query args and returns modified args
 */
export type QueryModifier = (args: any) => any;

/**
 * Result extension interface
 * Adds fields to query results
 */
export interface ResultExtension {
  /**
   * Result modifiers for all models
   */
  $allModels?: Record<string, ResultField>;
  
  /**
   * Result modifiers for specific models
   * Key is the model name, value is an object of result fields
   */
  [modelName: string]: Record<string, ResultField> | undefined;
}

/**
 * Result field definition
 */
export interface ResultField {
  /**
   * Fields needed to compute this field
   */
  needs: Record<string, boolean>;
  
  /**
   * Function to compute the field value
   */
  compute: (data: any) => any;
}

/**
 * Extension context
 * Provides access to the current model and client
 */
export interface ExtensionContext {
  /**
   * The model name
   */
  $name: string;
  
  /**
   * The model client
   */
  [key: string]: any;
}

/**
 * Extension utilities
 */
export interface ExtensionUtils {
  /**
   * Get the extension context
   */
  getExtensionContext: (instance: any) => ExtensionContext;
  
  /**
   * Define an extension
   */
  defineExtension: (extension: Extension) => Extension;
}
