import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { 
  ConnectionOptions, 
  QueryResult, 
  TransactionClient, 
  TransactionOptions 
} from './types';
import { BaseDatabaseAdapter } from './base-adapter';

/**
 * Transaction client implementation for TursoDB
 */
class TursoTransactionClient implements TransactionClient {
  constructor(private tx: any) {}

  async execute<T = any>(query: string, params?: any[]): Promise<QueryResult<T>> {
    try {
      const result = await this.tx.execute({
        sql: query,
        args: params || []
      });
      
      return {
        data: result.rows as T[]
      };
    } catch (error) {
      throw this.formatError(error);
    }
  }

  async executeRaw<T = any>(query: string, params?: any[]): Promise<QueryResult<T>> {
    return this.execute(query, params);
  }

  private formatError(error: any): Error {
    // Format TursoDB specific errors to match Prisma error format
    if (error.code) {
      // Map TursoDB error codes to more user-friendly messages
      const errorMap: Record<string, string> = {
        'SQLITE_CONSTRAINT': 'Unique constraint failed',
        'SQLITE_BUSY': 'Database is locked',
        'SQLITE_READONLY': 'Database is in readonly mode',
        // Add more mappings as needed
      };

      const errorMessage = errorMap[error.code] || error.message;
      return new Error(`TursoDB error: ${errorMessage}`);
    }
    return error;
  }
}

/**
 * TursoDB adapter implementation
 */
export class TursoAdapter extends BaseDatabaseAdapter {
  private client: any = null;
  private drizzleDb: any = null;

  constructor(options: ConnectionOptions) {
    super(options);
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      const url = this.options.url;
      const authToken = this.options.password; // Turso uses authToken as password

      if (!url) {
        throw new Error('URL is required for TursoDB connection');
      }

      // Create libSQL client for TursoDB
      this.client = createClient({
        url,
        authToken
      });

      // Initialize Drizzle ORM with the TursoDB connection
      this.drizzleDb = drizzle(this.client);
      
      // Test the connection
      await this.client.execute('SELECT 1');
      
      this.isConnected = true;
    } catch (error) {
      throw new Error(`Failed to connect to TursoDB: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected || !this.client) {
      return;
    }

    try {
      await this.client.close();
      this.client = null;
      this.drizzleDb = null;
      this.isConnected = false;
    } catch (error) {
      throw new Error(`Failed to disconnect from TursoDB: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async execute<T = any>(query: string, params?: any[]): Promise<QueryResult<T>> {
    this.ensureConnected();

    try {
      if (!this.client) {
        throw new Error('TursoDB client is not initialized');
      }

      const result = await this.client.execute({
        sql: query,
        args: params || []
      });
      
      return {
        data: result.rows as T[]
      };
    } catch (error) {
      throw this.formatError(error);
    }
  }

  async executeRaw<T = any>(query: string, params?: any[]): Promise<QueryResult<T>> {
    return this.execute(query, params);
  }

  async transaction<T>(
    fn: (tx: TransactionClient) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T> {
    this.ensureConnected();

    if (!this.client) {
      throw new Error('TursoDB client is not initialized');
    }

    try {
      // Start a transaction
      return await this.client.transaction(async (tx: any) => {
        const txClient = new TursoTransactionClient(tx);
        return await fn(txClient);
      });
    } catch (error) {
      throw this.formatError(error);
    }
  }

  private formatError(error: any): Error {
    // Format TursoDB specific errors to match Prisma error format
    if (error.code) {
      // Map TursoDB error codes to more user-friendly messages
      const errorMap: Record<string, string> = {
        'SQLITE_CONSTRAINT': 'Unique constraint failed',
        'SQLITE_BUSY': 'Database is locked',
        'SQLITE_READONLY': 'Database is in readonly mode',
        // Add more mappings as needed
      };

      const errorMessage = errorMap[error.code] || error.message;
      return new Error(`TursoDB error: ${errorMessage}`);
    }
    return error;
  }
}
