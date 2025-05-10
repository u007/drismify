import { ConnectionOptions, DatabaseAdapter } from './types';
import { SQLiteAdapter } from './sqlite-adapter';
import { TursoAdapter } from './turso-adapter';

/**
 * Singleton instances of database adapters
 */
const adapterInstances: Record<string, DatabaseAdapter> = {};

/**
 * Create a database adapter based on the specified type and options
 * @param type The type of database adapter to create
 * @param options Connection options for the adapter
 * @param singleton Whether to use a singleton instance (default: true)
 * @returns A database adapter instance
 */
export function createAdapter(
  type: 'sqlite' | 'turso',
  options: ConnectionOptions,
  singleton: boolean = true
): DatabaseAdapter {
  // Generate a unique key for the adapter instance
  const key = `${type}:${JSON.stringify(options)}`;

  // Return existing instance if singleton is requested and instance exists
  if (singleton && adapterInstances[key]) {
    return adapterInstances[key];
  }

  // Create a new adapter instance based on the type
  let adapter: DatabaseAdapter;
  switch (type) {
    case 'sqlite':
      adapter = new SQLiteAdapter(options);
      break;
    case 'turso':
      adapter = new TursoAdapter(options);
      break;
    default:
      throw new Error(`Unsupported database adapter type: ${type}`);
  }

  // Store the instance if singleton is requested
  if (singleton) {
    adapterInstances[key] = adapter;
  }

  return adapter;
}

/**
 * Create a database adapter from a Prisma datasource configuration
 * @param datasource The Prisma datasource configuration
 * @param singleton Whether to use a singleton instance (default: true)
 * @returns A database adapter instance
 */
export function createAdapterFromDatasource(
  datasource: { provider: string; url: string; [key: string]: any },
  singleton: boolean = true
): DatabaseAdapter {
  // Determine the adapter type based on the provider
  let type: 'sqlite' | 'turso';
  switch (datasource.provider.toLowerCase()) {
    case 'sqlite':
      type = 'sqlite';
      break;
    case 'turso':
    case 'libsql':
      type = 'turso';
      break;
    default:
      throw new Error(`Unsupported database provider: ${datasource.provider}`);
  }

  // Extract connection options from the datasource
  const options: ConnectionOptions = {
    url: datasource.url,
  };

  // Add additional options based on the provider
  if (type === 'sqlite') {
    options.filename = datasource.url.replace('file:', '');
  } else if (type === 'turso') {
    // Extract auth token from the URL if present
    const url = new URL(datasource.url);
    if (url.password) {
      options.password = url.password;
    } else if (datasource.authToken) {
      options.password = datasource.authToken;
    }
  }

  // Create and return the adapter
  return createAdapter(type, options, singleton);
}

/**
 * Get all active adapter instances
 * @returns A record of active adapter instances
 */
export function getAdapterInstances(): Record<string, DatabaseAdapter> {
  return { ...adapterInstances };
}

/**
 * Clear all adapter instances
 * This will disconnect all adapters and remove them from the instances cache
 */
export async function clearAdapterInstances(): Promise<void> {
  // Disconnect all adapters
  for (const key in adapterInstances) {
    try {
      await adapterInstances[key].disconnect();
    } catch (error) {
      console.error(`Failed to disconnect adapter ${key}:`, error);
    }
  }

  // Clear the instances cache
  Object.keys(adapterInstances).forEach(key => {
    delete adapterInstances[key];
  });
}
