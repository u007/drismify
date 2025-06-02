/**
 * MongoDB Configuration
 * 
 * This file contains hardcoded MongoDB connection settings for the Drismify project.
 * These settings are used across tests, examples, and development environments.
 */

export interface MongoDBConfig {
  /** MongoDB connection URL */
  url: string;
  /** Database name */
  database: string;
  /** Username for authentication */
  user: string;
  /** Password for authentication */
  password: string;
  /** Authentication source database */
  authSource: string;
  /** Connection port */
  port: number;
  /** Host address */
  host: string;
}

/**
 * Default MongoDB configuration for development and testing
 */
export const DEFAULT_MONGODB_CONFIG: MongoDBConfig = {
  url: 'mongodb://root:000000@localhost:37017',
  database: 'drismify_test',
  user: 'root',
  password: '000000',
  authSource: 'admin',
  port: 37017,
  host: 'localhost'
};

/**
 * MongoDB configuration for production-like testing
 */
export const PRODUCTION_MONGODB_CONFIG: MongoDBConfig = {
  url: 'mongodb://root:000000@localhost:27017',
  database: 'drismify_production',
  user: 'root',
  password: '000000',
  authSource: 'admin',
  port: 27017,
  host: 'localhost'
};

/**
 * MongoDB configuration for examples
 */
export const EXAMPLE_MONGODB_CONFIG: MongoDBConfig = {
  url: 'mongodb://root:000000@localhost:37017',
  database: 'drismify_example',
  user: 'root',
  password: '000000',
  authSource: 'admin',
  port: 37017,
  host: 'localhost'
};

/**
 * Get MongoDB configuration based on environment or purpose
 * @param env Environment type ('test', 'production', 'example')
 * @returns MongoDB configuration object
 */
export function getMongoDBConfig(env: 'test' | 'production' | 'example' = 'test'): MongoDBConfig {
  switch (env) {
    case 'production':
      return PRODUCTION_MONGODB_CONFIG;
    case 'example':
      return EXAMPLE_MONGODB_CONFIG;
    case 'test':
    default:
      return DEFAULT_MONGODB_CONFIG;
  }
}

/**
 * Build MongoDB connection URL from config
 * @param config MongoDB configuration
 * @returns Complete MongoDB connection URL
 */
export function buildMongoDBUrl(config: MongoDBConfig): string {
  return `mongodb://${config.user}:${config.password}@${config.host}:${config.port}`;
}

/**
 * Get MongoDB connection options for the MongoDB driver
 * @param config MongoDB configuration
 * @returns Connection options object
 */
export function getMongoDBConnectionOptions(config: MongoDBConfig) {
  return {
    url: config.url,
    database: config.database,
    user: config.user,
    password: config.password,
    authSource: config.authSource
  };
}
