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

// Export version information
export const VERSION = '0.0.1';

// Initialize message
console.log(`Drismify ORM v${VERSION} loaded.`);
