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
  // Implementation for result extensions will be more complex
  // and will require modifying the query results
  // This is a placeholder for now
  console.log('Result extensions are not yet implemented');
}
