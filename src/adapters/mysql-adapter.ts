import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import type {
  ConnectionOptions,
  QueryResult,
  TransactionClient,
  TransactionOptions
} from './types';
import { BaseDatabaseAdapter } from './base-adapter';

/**
 * Transaction client implementation for MySQL
 */
class MySQLTransactionClient implements TransactionClient {
  constructor(private tx: mysql.PoolConnection | mysql.Connection) {}

  async execute<T = any>(query: string, params?: any[]): Promise<QueryResult<T>> {
    try {
      const [rows] = await this.tx.execute(query, params || []);
      
      return {
        data: Array.isArray(rows) ? rows as T[] : [rows as T]
      };
    } catch (error) {
      throw this.formatError(error);
    }
  }

  async executeRaw<T = any>(query: string, params?: any[]): Promise<QueryResult<T>> {
    return this.execute(query, params);
  }

  private formatError(error: any): Error {
    if (error instanceof Error) {
      return new Error(`MySQL transaction error: ${error.message}`);
    }
    return new Error(`MySQL transaction error: ${String(error)}`);
  }
}

/**
 * MySQL database adapter implementation
 * Supports both MySQL and MariaDB databases using mysql2 driver
 */
export class MySQLAdapter extends BaseDatabaseAdapter {
  private pool: mysql.Pool | null = null;
  private drizzleDb: any = null;

  constructor(options: ConnectionOptions) {
    super(options);
  }

  async connect(): Promise<void> {
    if (this.isConnected && this.pool) {
      return;
    }

    try {
      // Create MySQL connection pool
      const poolConfig: mysql.PoolOptions = {
        // Connection details
        host: this.options.host || 'localhost',
        port: this.options.port || 3306,
        user: this.options.user || 'root',
        password: this.options.password || '',
        database: this.options.database || '',

        // Pool configuration
        connectionLimit: this.options.connectionLimit || 10,

        // SSL configuration
        ssl: this.options.ssl === true ? {} : this.options.ssl || undefined,

        // Additional MySQL options
        charset: 'utf8mb4',
        timezone: 'Z',
        supportBigNumbers: true,
        bigNumberStrings: true,
        dateStrings: false,

        // Connection management
        idleTimeout: 300000, // 5 minutes
      };

      // Handle connection URL if provided
      if (this.options.url) {
        const url = new URL(this.options.url);
        poolConfig.host = url.hostname;
        poolConfig.port = parseInt(url.port) || 3306;
        poolConfig.user = url.username;
        poolConfig.password = url.password;
        poolConfig.database = url.pathname.slice(1); // Remove leading slash
        
        // Parse query parameters for additional options
        const searchParams = url.searchParams;
        if (searchParams.has('ssl')) {
          const sslValue = searchParams.get('ssl');
          poolConfig.ssl = sslValue === 'true' ? {} : undefined;
        }
        if (searchParams.has('charset')) {
          poolConfig.charset = searchParams.get('charset') || 'utf8mb4';
        }
      }

      this.pool = mysql.createPool(poolConfig);

      // Test the connection
      const connection = await this.pool.getConnection();
      await connection.ping();
      connection.release();

      // Initialize Drizzle ORM with the MySQL pool
      this.drizzleDb = drizzle(this.pool);

      this.isConnected = true;
    } catch (error) {
      throw new Error(`Failed to connect to MySQL database: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected || !this.pool) {
      return;
    }

    try {
      await this.pool.end();
      this.pool = null;
      this.drizzleDb = null;
      this.isConnected = false;
    } catch (error) {
      throw new Error(`Failed to disconnect from MySQL database: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async execute<T = any>(query: string, params?: any[]): Promise<QueryResult<T>> {
    this.ensureConnected();

    try {
      if (!this.pool) {
        throw new Error('MySQL connection pool is not initialized');
      }

      const [rows] = await this.pool.execute(query, params || []);
      
      return {
        data: Array.isArray(rows) ? rows as T[] : [rows as T]
      };
    } catch (error) {
      throw this.formatError(error);
    }
  }

  async executeRaw<T = any>(query: string, params?: any[]): Promise<QueryResult<T>> {
    return this.execute(query, params);
  }

  async batch<T = any>(
    queries: Array<{ query: string; params?: any[] }>,
    options?: { transaction?: boolean }
  ): Promise<Array<QueryResult<T>>> {
    this.ensureConnected();

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

    // Execute queries in parallel without transaction
    const promises = queries.map(({ query, params }) => this.execute<T>(query, params));
    return Promise.all(promises);
  }

  async transaction<T>(
    fn: (tx: TransactionClient) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T> {
    this.ensureConnected();

    if (!this.pool) {
      throw new Error('MySQL connection pool is not initialized');
    }

    const connection = await this.pool.getConnection();
    
    try {
      // Set isolation level if specified
      if (options?.isolationLevel) {
        const isolationMap = {
          'ReadUncommitted': 'READ UNCOMMITTED',
          'ReadCommitted': 'READ COMMITTED',
          'RepeatableRead': 'REPEATABLE READ',
          'Serializable': 'SERIALIZABLE'
        };
        const level = isolationMap[options.isolationLevel];
        await connection.execute(`SET TRANSACTION ISOLATION LEVEL ${level}`);
      }

      await connection.beginTransaction();
      
      const txClient = new MySQLTransactionClient(connection);
      const result = await fn(txClient);
      
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw this.formatError(error);
    } finally {
      connection.release();
    }
  }

  async $transaction<T = any>(
    operations: Array<() => Promise<T>>,
    options?: TransactionOptions
  ): Promise<T[]> {
    return this.transaction(async () => {
      const results: T[] = [];
      for (const operation of operations) {
        const result = await operation();
        results.push(result);
      }
      return results;
    }, options);
  }

  private formatError(error: any): Error {
    if (error instanceof Error) {
      return new Error(`MySQL error: ${error.message}`);
    }
    return new Error(`MySQL error: ${String(error)}`);
  }

  /**
   * Get the MySQL connection pool
   */
  getPool(): mysql.Pool {
    this.ensureConnected();
    
    if (!this.pool) {
      throw new Error('MySQL connection pool is not initialized');
    }
    
    return this.pool;
  }

  /**
   * Get the Drizzle database instance
   */
  getDrizzleDb(): any {
    this.ensureConnected();
    
    if (!this.drizzleDb) {
      throw new Error('Drizzle database instance is not initialized');
    }
    
    return this.drizzleDb;
  }

  /**
   * Get a connection from the pool for manual management
   */
  async getConnection(): Promise<mysql.PoolConnection> {
    this.ensureConnected();
    
    if (!this.pool) {
      throw new Error('MySQL connection pool is not initialized');
    }
    
    return this.pool.getConnection();
  }

  /**
   * Release a connection back to the pool
   */
  releaseConnection(connection: mysql.PoolConnection): void {
    connection.release();
  }

  /**
   * Get all tables in the database for introspection
   */
  async getTables(): Promise<any[]> {
    this.ensureConnected();

    const result = await this.execute(`
      SELECT
        TABLE_NAME as name,
        TABLE_COMMENT as comment,
        TABLE_TYPE as type
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
      ORDER BY TABLE_NAME
    `);

    return result.data;
  }

  /**
   * Get all columns for introspection
   */
  async getColumns(): Promise<any[]> {
    this.ensureConnected();

    const result = await this.execute(`
      SELECT
        TABLE_NAME as \`table\`,
        COLUMN_NAME as name,
        DATA_TYPE as type,
        IS_NULLABLE = 'YES' as isNullable,
        COLUMN_DEFAULT as defaultValue,
        EXTRA LIKE '%auto_increment%' as isAutoIncrement,
        COLUMN_KEY = 'PRI' as isPrimaryKey,
        CHARACTER_MAXIMUM_LENGTH as maxLength,
        NUMERIC_PRECISION as precision,
        NUMERIC_SCALE as scale,
        COLUMN_COMMENT as comment
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      ORDER BY TABLE_NAME, ORDINAL_POSITION
    `);

    return result.data;
  }

  /**
   * Get all foreign keys for introspection
   */
  async getForeignKeys(): Promise<any[]> {
    this.ensureConnected();

    const result = await this.execute(`
      SELECT
        kcu.CONSTRAINT_NAME as name,
        kcu.TABLE_NAME as foreignTable,
        kcu.COLUMN_NAME as foreignKey,
        kcu.REFERENCED_TABLE_NAME as referencedTable,
        kcu.REFERENCED_COLUMN_NAME as referencedColumn,
        rc.UPDATE_RULE as onUpdate,
        rc.DELETE_RULE as onDelete
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
      JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
        ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
        AND kcu.TABLE_SCHEMA = rc.CONSTRAINT_SCHEMA
      WHERE kcu.TABLE_SCHEMA = DATABASE()
        AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
      ORDER BY kcu.TABLE_NAME, kcu.ORDINAL_POSITION
    `);

    return result.data;
  }

  /**
   * Get all indexes for introspection
   */
  async getIndexes(): Promise<any[]> {
    this.ensureConnected();

    const result = await this.execute(`
      SELECT
        TABLE_NAME as \`table\`,
        INDEX_NAME as name,
        COLUMN_NAME as \`column\`,
        NON_UNIQUE = 0 as isUnique,
        SEQ_IN_INDEX as position,
        INDEX_TYPE as type
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND INDEX_NAME != 'PRIMARY'
      ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX
    `);

    // Group columns by index
    const indexMap = new Map();

    for (const row of result.data) {
      const key = `${row.table}.${row.name}`;
      if (!indexMap.has(key)) {
        indexMap.set(key, {
          table: row.table,
          name: row.name,
          isUnique: row.isUnique,
          type: row.type,
          columns: []
        });
      }
      indexMap.get(key).columns.push(row.column);
    }

    return Array.from(indexMap.values());
  }

  /**
   * Get check constraints for introspection
   */
  async getCheckConstraints(): Promise<any[]> {
    this.ensureConnected();

    const result = await this.execute(`
      SELECT
        TABLE_NAME as \`table\`,
        CONSTRAINT_NAME as name,
        CHECK_CLAUSE as expression,
        TRUE as isNamed
      FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
      ORDER BY TABLE_NAME, CONSTRAINT_NAME
    `);

    return result.data;
  }

  /**
   * Get unique constraints for introspection
   */
  async getUniqueConstraints(): Promise<any[]> {
    this.ensureConnected();

    const result = await this.execute(`
      SELECT
        kcu.TABLE_NAME as \`table\`,
        kcu.CONSTRAINT_NAME as name,
        kcu.COLUMN_NAME as \`column\`,
        kcu.ORDINAL_POSITION as position,
        tc.CONSTRAINT_TYPE = 'UNIQUE' as isUnique,
        TRUE as isNamed
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
      JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
        ON kcu.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
        AND kcu.TABLE_SCHEMA = tc.TABLE_SCHEMA
      WHERE kcu.TABLE_SCHEMA = DATABASE()
        AND tc.CONSTRAINT_TYPE IN ('UNIQUE', 'PRIMARY KEY')
      ORDER BY kcu.TABLE_NAME, kcu.CONSTRAINT_NAME, kcu.ORDINAL_POSITION
    `);

    // Group columns by constraint
    const constraintMap = new Map();

    for (const row of result.data) {
      const key = `${row.table}.${row.name}`;
      if (!constraintMap.has(key)) {
        constraintMap.set(key, {
          table: row.table,
          name: row.name,
          isNamed: row.isNamed,
          columns: []
        });
      }
      constraintMap.get(key).columns.push(row.column);
    }

    return Array.from(constraintMap.values());
  }
}
