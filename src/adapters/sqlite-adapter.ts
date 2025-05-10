import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { 
  ConnectionOptions, 
  QueryResult, 
  TransactionClient, 
  TransactionOptions 
} from './types';
import { BaseDatabaseAdapter } from './base-adapter';

/**
 * Transaction client implementation for SQLite
 */
class SQLiteTransactionClient implements TransactionClient {
  constructor(private tx: any) {}

  async execute<T = any>(query: string, params?: any[]): Promise<QueryResult<T>> {
    try {
      const result = this.tx.run(query, params || []);
      return {
        data: Array.isArray(result) ? result : [result]
      };
    } catch (error) {
      throw this.formatError(error);
    }
  }

  async executeRaw<T = any>(query: string, params?: any[]): Promise<QueryResult<T>> {
    return this.execute(query, params);
  }

  private formatError(error: any): Error {
    // Format SQLite specific errors to match Prisma error format
    if (error.code) {
      // Map SQLite error codes to more user-friendly messages
      const errorMap: Record<string, string> = {
        'SQLITE_CONSTRAINT': 'Unique constraint failed',
        'SQLITE_BUSY': 'Database is locked',
        'SQLITE_READONLY': 'Database is in readonly mode',
        // Add more mappings as needed
      };

      const errorMessage = errorMap[error.code] || error.message;
      return new Error(`SQLite error: ${errorMessage}`);
    }
    return error;
  }
}

/**
 * SQLite adapter implementation
 */
export class SQLiteAdapter extends BaseDatabaseAdapter {
  private db: Database.Database | null = null;
  private drizzleDb: any = null;

  constructor(options: ConnectionOptions) {
    super(options);
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      const filename = this.options.filename || this.options.url?.replace('file:', '') || ':memory:';
      
      this.db = new Database(filename, {
        // SQLite connection options
        verbose: process.env.NODE_ENV === 'development',
        fileMustExist: false,
      });

      // Initialize Drizzle ORM with the SQLite connection
      this.drizzleDb = drizzle(this.db);
      
      this.isConnected = true;
    } catch (error) {
      throw new Error(`Failed to connect to SQLite database: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected || !this.db) {
      return;
    }

    try {
      this.db.close();
      this.db = null;
      this.drizzleDb = null;
      this.isConnected = false;
    } catch (error) {
      throw new Error(`Failed to disconnect from SQLite database: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async execute<T = any>(query: string, params?: any[]): Promise<QueryResult<T>> {
    this.ensureConnected();

    try {
      if (!this.db) {
        throw new Error('SQLite database connection is not initialized');
      }

      const stmt = this.db.prepare(query);
      const result = params ? stmt.all(...params) : stmt.all();
      
      return {
        data: result as T[]
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

    if (!this.db) {
      throw new Error('SQLite database connection is not initialized');
    }

    // Start a transaction
    const sqliteTransaction = this.db.transaction(() => {
      const txClient = new SQLiteTransactionClient(this.db);
      return fn(txClient);
    });

    try {
      // Execute the transaction function
      return await sqliteTransaction();
    } catch (error) {
      throw this.formatError(error);
    }
  }

  private formatError(error: any): Error {
    // Format SQLite specific errors to match Prisma error format
    if (error.code) {
      // Map SQLite error codes to more user-friendly messages
      const errorMap: Record<string, string> = {
        'SQLITE_CONSTRAINT': 'Unique constraint failed',
        'SQLITE_BUSY': 'Database is locked',
        'SQLITE_READONLY': 'Database is in readonly mode',
        // Add more mappings as needed
      };

      const errorMessage = errorMap[error.code] || error.message;
      return new Error(`SQLite error: ${errorMessage}`);
    }
    return error;
  }
}
