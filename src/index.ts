// Main library entry point for Drismify
// This exports the client and other utilities for use as a library.

// Export database adapters
export * from './adapters';

// Export client
export * from './client';

// Export generator
export * from './generator';

// Export migrations
export * from './migrations';

// Export core extensions only (excluding problematic ones for now)
export * from './extensions/index';
export * from './extensions/advanced';

// Export parser for advanced usage
export * from './parser';

// Export version information
export const VERSION = '0.2.1';

// Namespace for all Drismify functionality
export const Drismify: {
  defineExtension: any;
  getExtensionContext: any;
  extensions: any;
  VERSION: string;
  createClient: any;
  createAdapter: any;
} = {
  // Extension utilities
  defineExtension: require('./extensions').defineExtension,
  getExtensionContext: require('./extensions').getExtensionContext,

  // Advanced extensions
  extensions: {
    ...require('./extensions/advanced').advancedExtensions
  },

  // Version information
  VERSION,

  // Utility functions for library users
  createClient: require('./client').DrismifyClient,
  createAdapter: require('./adapters').createAdapter
};
