// Main library entry point for Drismify
// This exports the client and other utilities.

// Export database adapters
export * from './adapters';

// Export client
export * from './client';

// Export generator
export * from './generator';

// Export migrations
export * from './migrations';

// Export extensions
export * from './extensions';

// Export advanced extensions
export * from './extensions/advanced';

// Export version information
export const VERSION = '0.0.1';

// Namespace for all Drismify functionality
export const Drismify = {
  // Extension utilities
  defineExtension: require('./extensions').defineExtension,
  getExtensionContext: require('./extensions').getExtensionContext,
  
  // Advanced extensions
  extensions: {
    ...require('./extensions/advanced').advancedExtensions
  },
  
  // Version information
  VERSION
};

// Initialize message
console.log(`Drismify ORM v${VERSION} loaded.`);
