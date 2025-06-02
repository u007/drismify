/**
 * Core database adapter interface for Drismify
 * This provides a consistent API across different database backends
 */

export type QueryResult<T> = {
  data: T[];
  count?: number;
};

export type TransactionOptions = {
  isolationLevel?: 'ReadUncommitted' | 'ReadCommitted' | 'RepeatableRead' | 'Serializable';
  maxWait?: number; // in milliseconds
  timeout?: number; // in milliseconds
};

export type BatchOptions = {
  transaction?: boolean;
};

export type ConnectionOptions = {
  url?: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  filename?: string; // For SQLite
  ssl?: boolean | Record<string, any>;
  schema?: string;
  connectionLimit?: number;
  authToken?: string; // For TursoDB
  authSource?: string; // For MongoDB
};

/**
 * Core database adapter interface
 * All database-specific adapters must implement this interface
 */
export interface DatabaseAdapter {
  /**
   * Connect to the database
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the database
   */
  disconnect(): Promise<void>;

  /**
   * Execute a query and return the results
   * @param query The query to execute
   * @param params The parameters for the query
   */
  execute<T = any>(query: string, params?: any[]): Promise<QueryResult<T>>;

  /**
   * Execute a raw query and return the results
   * @param query The raw SQL query to execute
   * @param params The parameters for the query
   */
  executeRaw<T = any>(query: string, params?: any[]): Promise<QueryResult<T>>;

  /**
   * Execute a batch of queries
   * @param queries The queries to execute
   * @param options Options for the batch operation
   */
  batch<T = any>(
    queries: Array<{ query: string; params?: any[] }>,
    options?: BatchOptions
  ): Promise<Array<QueryResult<T>>>;

  /**
   * Execute a function within a transaction
   * @param fn The function to execute within the transaction
   * @param options Options for the transaction
   */
  transaction<T>(
    fn: (tx: TransactionClient) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T>;

  /**
   * Execute multiple operations in a transaction
   * @param operations The operations to execute
   * @param options Options for the transaction
   */
  $transaction<T = any>(
    operations: Array<() => Promise<T>>,
    options?: TransactionOptions
  ): Promise<T[]>;
}

/**
 * Transaction client interface
 * Represents a client within a transaction
 */
export interface TransactionClient {
  /**
   * Execute a query within the transaction
   * @param query The query to execute
   * @param params The parameters for the query
   */
  execute<T = any>(query: string, params?: any[]): Promise<QueryResult<T>>;

  /**
   * Execute a raw query within the transaction
   * @param query The raw SQL query to execute
   * @param params The parameters for the query
   */
  executeRaw<T = any>(query: string, params?: any[]): Promise<QueryResult<T>>;
}

/**
 * Factory function to create a database adapter
 * @param type The type of database adapter to create
 * @param options Connection options for the adapter
 */
export type DatabaseAdapterFactory = (
  type: 'sqlite' | 'turso' | 'mongodb',
  options: ConnectionOptions
) => DatabaseAdapter;
