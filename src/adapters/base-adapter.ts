import { 
  BatchOptions, 
  ConnectionOptions, 
  DatabaseAdapter, 
  QueryResult, 
  TransactionClient, 
  TransactionOptions 
} from './types';

/**
 * Base adapter implementation with common functionality
 * Specific adapters will extend this class
 */
export abstract class BaseDatabaseAdapter implements DatabaseAdapter {
  protected options: ConnectionOptions;
  protected isConnected: boolean = false;

  constructor(options: ConnectionOptions) {
    this.options = options;
  }

  /**
   * Connect to the database
   * Must be implemented by specific adapters
   */
  abstract connect(): Promise<void>;

  /**
   * Disconnect from the database
   * Must be implemented by specific adapters
   */
  abstract disconnect(): Promise<void>;

  /**
   * Execute a query and return the results
   * Must be implemented by specific adapters
   */
  abstract execute<T = any>(query: string, params?: any[]): Promise<QueryResult<T>>;

  /**
   * Execute a raw query and return the results
   * Must be implemented by specific adapters
   */
  abstract executeRaw<T = any>(query: string, params?: any[]): Promise<QueryResult<T>>;

  /**
   * Execute a batch of queries
   * Default implementation executes queries sequentially
   * Can be overridden by specific adapters for optimized batch operations
   */
  async batch<T = any>(
    queries: Array<{ query: string; params?: any[] }>,
    options?: BatchOptions
  ): Promise<Array<QueryResult<T>>> {
    // If transaction is requested, use transaction for batch
    if (options?.transaction) {
      return this.transaction(async (tx) => {
        const results: Array<QueryResult<T>> = [];
        for (const { query, params } of queries) {
          const result = await tx.execute<T>(query, params);
          results.push(result);
        }
        return results;
      });
    }

    // Otherwise execute queries sequentially
    const results: Array<QueryResult<T>> = [];
    for (const { query, params } of queries) {
      const result = await this.execute<T>(query, params);
      results.push(result);
    }
    return results;
  }

  /**
   * Execute a function within a transaction
   * Must be implemented by specific adapters
   */
  abstract transaction<T>(
    fn: (tx: TransactionClient) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T>;

  /**
   * Execute multiple operations in a transaction
   * Default implementation uses the transaction method
   */
  async $transaction<T = any>(
    operations: Array<() => Promise<T>>,
    options?: TransactionOptions
  ): Promise<T[]> {
    return this.transaction(async (tx) => {
      const results: T[] = [];
      for (const operation of operations) {
        const result = await operation();
        results.push(result);
      }
      return results;
    }, options);
  }

  /**
   * Check if the adapter is connected to the database
   */
  isActive(): boolean {
    return this.isConnected;
  }

  /**
   * Ensure the adapter is connected before executing operations
   * @throws Error if not connected
   */
  protected ensureConnected(): void {
    if (!this.isConnected) {
      throw new Error('Database adapter is not connected');
    }
  }
}
