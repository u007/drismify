/**
 * Core types for the Drismify client
 */

import { ConnectionOptions, DatabaseAdapter, TransactionOptions } from '../adapters';
import { Extension } from '../extensions/types';

/**
 * Base client options
 */
export interface ClientOptions {
  /**
   * Database connection options
   */
  datasources: {
    db: ConnectionOptions;
  };

  /**
   * Database adapter type
   */
  adapter?: 'sqlite' | 'turso';

  /**
   * Log level
   */
  log?: ('query' | 'info' | 'warn' | 'error')[];

  /**
   * Whether to enable debug mode
   */
  debug?: boolean;
}

/**
 * Transaction client options
 */
export interface TransactionClientOptions extends TransactionOptions {
  /**
   * Maximum number of attempts for the transaction
   */
  maxAttempts?: number;
}

/**
 * Base model client interface
 * This is the interface that all model clients will implement
 */
export interface ModelClient<T, CreateInput, UpdateInput, WhereInput, WhereUniqueInput, OrderByInput, SelectInput, IncludeInput> {
  /**
   * Create a new record
   */
  create(data: CreateInput): Promise<T>;

  /**
   * Create multiple records
   */
  createMany(data: CreateInput[]): Promise<{ count: number }>;

  /**
   * Find a record by its unique identifier
   */
  findUnique(args: { where: WhereUniqueInput; select?: SelectInput; include?: IncludeInput }): Promise<T | null>;

  /**
   * Find the first record that matches the filter
   */
  findFirst(args: {
    where?: WhereInput;
    orderBy?: OrderByInput | OrderByInput[];
    select?: SelectInput;
    include?: IncludeInput;
    skip?: number;
  }): Promise<T | null>;

  /**
   * Find all records that match the filter
   */
  findMany(args?: {
    where?: WhereInput;
    orderBy?: OrderByInput | OrderByInput[];
    select?: SelectInput;
    include?: IncludeInput;
    skip?: number;
    take?: number;
    cursor?: WhereUniqueInput;
  }): Promise<T[]>;

  /**
   * Update a record by its unique identifier
   */
  update(args: {
    where: WhereUniqueInput;
    data: UpdateInput;
    select?: SelectInput;
    include?: IncludeInput;
  }): Promise<T>;

  /**
   * Update multiple records that match the filter
   */
  updateMany(args: {
    where?: WhereInput;
    data: UpdateInput;
  }): Promise<{ count: number }>;

  /**
   * Delete a record by its unique identifier
   */
  delete(args: {
    where: WhereUniqueInput;
    select?: SelectInput;
    include?: IncludeInput;
  }): Promise<T>;

  /**
   * Delete multiple records that match the filter
   */
  deleteMany(args?: { where?: WhereInput }): Promise<{ count: number }>;

  /**
   * Count the number of records that match the filter
   */
  count(args?: { where?: WhereInput }): Promise<number>;
}

/**
 * Base client interface
 * This is the interface that the main client will implement
 */
export interface BaseClient {
  /**
   * Connect to the database
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the database
   */
  disconnect(): Promise<void>;

  /**
   * Execute a raw query
   */
  $executeRaw(query: string, ...values: any[]): Promise<number>;

  /**
   * Execute a raw query and return the results
   */
  $queryRaw<T = any>(query: string, ...values: any[]): Promise<T[]>;

  /**
   * Execute multiple operations in a transaction
   */
  $transaction<T>(operations: Promise<T>[], options?: TransactionClientOptions): Promise<T[]>;

  /**
   * Execute a function in a transaction
   */
  $transaction<T>(fn: (tx: any) => Promise<T>, options?: TransactionClientOptions): Promise<T>;

  /**
   * Get the underlying database adapter
   */
  $getAdapter(): DatabaseAdapter;

  /**
   * Extend the client with custom functionality
   * This method creates a new client instance with the extension applied
   */
  $extends(extension: Extension | Extension[]): any;
}
