import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import type {
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
  constructor(private tx: Database) {}

  async execute<T = any>(query: string, params?: any[]): Promise<QueryResult<T>> {
    try {
      let result;

      // Check if the query is a SELECT query
      if (query.trim().toLowerCase().startsWith('select')) {
        const stmt = this.tx.query(query);
        result = stmt.all(params || []);
      } else {
        // For non-SELECT queries (INSERT, UPDATE, DELETE, CREATE, etc.)
        const stmt = this.tx.query(query);
        stmt.run(params || []);
        // For non-SELECT queries, return an empty array as data
        return { data: [] as T[] };
      }

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
  private db: Database | null = null;
  private drizzleDb: any = null;

  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      const filename = this.options.filename || this.options.url?.replace('file:', '') || ':memory:';

      this.db = new Database(filename, {
        // SQLite connection options
        create: true,
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

      // Handle multiple statements by splitting on semicolons
      if (query.includes(';') && !query.trim().toLowerCase().startsWith('select')) {
        // For non-SELECT queries with multiple statements, execute them in a transaction
        this.db.run('BEGIN TRANSACTION');

        try {
          // Split by semicolons but ignore semicolons inside quotes
          const statements = this.splitSqlStatements(query);

          for (const statement of statements) {
            const trimmedStatement = statement.trim();
            if (trimmedStatement && !trimmedStatement.startsWith('--')) {
              this.db.run(trimmedStatement);
            }
          }

          this.db.run('COMMIT');
          return { data: [] as T[] };
        } catch (error) {
          this.db.run('ROLLBACK');
          throw error;
        }
      }

      // Handle single statements
      const stmt = this.db.query(query);
      let result;

      // Check if the query is a SELECT query
      if (query.trim().toLowerCase().startsWith('select')) {
        result = params ? stmt.all(params || []) : stmt.all();
      } else {
        // For non-SELECT queries (INSERT, UPDATE, DELETE, CREATE, etc.)
        result = params ? stmt.run(params || []) : stmt.run();
        // For non-SELECT queries, return an empty array as data
        return { data: [] as T[] };
      }

      return {
        data: result as T[]
      };
    } catch (error) {
      throw this.formatError(error);
    }
  }

  /**
   * Split SQL statements by semicolons, ignoring semicolons inside quotes
   */
  private splitSqlStatements(sql: string): string[] {
    const statements: string[] = [];
    let currentStatement = '';
    let inSingleQuote = false;
    let inDoubleQuote = false;

    for (let i = 0; i < sql.length; i++) {
      const char = sql[i];

      // Handle quotes
      if (char === "'" && !inDoubleQuote) {
        inSingleQuote = !inSingleQuote;
      } else if (char === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
      }

      // If we're at a semicolon and not inside quotes
      if (char === ';' && !inSingleQuote && !inDoubleQuote) {
        statements.push(`${currentStatement};`);
        currentStatement = '';
      } else {
        currentStatement += char;
      }
    }

    // Add the last statement if there is one
    if (currentStatement.trim()) {
      statements.push(currentStatement);
    }

    return statements;
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

    // Begin transaction manually
    this.db.run('BEGIN TRANSACTION');

    try {
      // Create a transaction client
      const txClient = new SQLiteTransactionClient(this.db);

      // Execute the transaction function
      const result = await fn(txClient);

      // If we get here, commit the transaction
      this.db.run('COMMIT');

      return result;
    } catch (error) {
      // If there's an error, rollback the transaction
      this.db.run('ROLLBACK');
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
