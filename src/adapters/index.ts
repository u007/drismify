// Export types
export * from './types';

// Export base adapter
export * from './base-adapter';

// Export specific adapters
export * from './sqlite-adapter';
export * from './turso-adapter';
export * from './mongodb-adapter';

// Export factory functions
export * from './factory';

// Re-export commonly used types and functions for convenience
import { createAdapter, createAdapterFromDatasource } from './factory';
import { ConnectionOptions, DatabaseAdapter } from './types';

export { createAdapter, createAdapterFromDatasource };
export type { ConnectionOptions, DatabaseAdapter };
