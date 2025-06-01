import { drizzle } from 'drizzle-orm/bun-sqlite';
// Conditional import for Bun SQLite - will be handled at runtime
// import { Database } from 'bun:sqlite';

// Type declaration for Bun SQLite Database
interface Database {
  query: (sql: string) => any;
  run: (sql: string, ...params: any[]) => any;
  prepare: (sql: string) => any;
  close: () => void;
  transaction: (fn: () => void) => any;
}

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
        // For SQLite, we need to be careful with parameter binding
        // The query might use named parameters ($1, $2) or question marks (?)
        if (params && params.length > 0) {
          // For queries with question marks, we can use the prepare/run pattern
          if (query.includes('?')) {
            try {
              const stmt = this.tx.prepare(query);
              stmt.run(...params);
            } catch (error) {
              console.error('Error executing prepared statement:', error);
              console.error('Query:', query);
              console.error('Params:', params);
              throw error;
            }
          } else {
            // For queries with $ parameters, we need to handle them differently
            // Replace each $n with ? and reorder params if needed
            let modifiedQuery = query;
            const paramRegex = /\$(\d+)/g;
            const paramIndices: number[] = [];
            let match;
            
            // Extract all parameter indices
            while ((match = paramRegex.exec(query)) !== null) {
              paramIndices.push(parseInt(match[1], 10));
            }
            
            // Replace $n with ? in the query
            modifiedQuery = query.replace(paramRegex, '?');
            
            // Reorder params based on the indices if needed
            const orderedParams = paramIndices.length > 0 
              ? paramIndices.map(idx => params[idx - 1]) 
              : params;
            
            try {
              const stmt = this.tx.prepare(modifiedQuery);
              stmt.run(...orderedParams);
            } catch (error) {
              console.error('Error executing prepared statement with $ params:', error);
              console.error('Original query:', query);
              console.error('Modified query:', modifiedQuery);
              console.error('Params:', params);
              console.error('Ordered params:', orderedParams);
              throw error;
            }
          }
        } else {
          // If no parameters, just run the query directly
          this.tx.run(query);
        }
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

      // Dynamic import for Bun SQLite
      let DatabaseClass: any;
      try {
        // Use eval to avoid TypeScript compilation errors
        const bunSqlite = await eval('import("bun:sqlite")');
        DatabaseClass = bunSqlite.Database;
      } catch {
        // Fallback to better-sqlite3 for Node.js environments
        const betterSqlite3 = await import('better-sqlite3');
        DatabaseClass = betterSqlite3.default;
      }

      this.db = new DatabaseClass(filename, {
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
      // Exclude PRAGMA and SELECT statements from multi-statement handling
      const queryLower = query.trim().toLowerCase();
      if (query.includes(';') && !queryLower.startsWith('select') && !queryLower.startsWith('pragma')) {
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

      // Check if the query is a SELECT query or PRAGMA command (both return data)
      if (queryLower.startsWith('select') || queryLower.startsWith('pragma')) {
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
   * Split SQL statements by semicolons, ignoring semicolons inside quotes and handling comments
   */
  private splitSqlStatements(sql: string): string[] {
    // First, remove comments from the SQL
    const cleanedSql = this.removeComments(sql);

    const statements: string[] = [];
    let currentStatement = '';
    let inSingleQuote = false;
    let inDoubleQuote = false;

    for (let i = 0; i < cleanedSql.length; i++) {
      const char = cleanedSql[i];

      // Handle quotes
      if (char === "'" && !inDoubleQuote) {
        inSingleQuote = !inSingleQuote;
      } else if (char === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
      }

      // If we're at a semicolon and not inside quotes
      if (char === ';' && !inSingleQuote && !inDoubleQuote) {
        const statement = `${currentStatement};`.trim();
        if (statement) {
          statements.push(statement);
        }
        currentStatement = '';
      } else {
        currentStatement += char;
      }
    }

    // Add the last statement if there is one
    const finalStatement = currentStatement.trim();
    if (finalStatement) {
      statements.push(finalStatement);
    }

    return statements;
  }

  /**
   * Remove SQL comments from a string
   */
  private removeComments(sql: string): string {
    let result = '';
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inLineComment = false;
    let inBlockComment = false;

    for (let i = 0; i < sql.length; i++) {
      const char = sql[i];
      const nextChar = i + 1 < sql.length ? sql[i + 1] : '';

      // Handle line comments (-- comment)
      if (!inSingleQuote && !inDoubleQuote && !inBlockComment && char === '-' && nextChar === '-') {
        inLineComment = true;
        i++; // Skip the next character
        continue;
      }

      // Handle block comments (/* comment */)
      if (!inSingleQuote && !inDoubleQuote && !inLineComment && char === '/' && nextChar === '*') {
        inBlockComment = true;
        i++; // Skip the next character
        continue;
      }

      // End line comment on newline
      if (inLineComment && (char === '\n' || char === '\r')) {
        inLineComment = false;
        result += char; // Keep the newline
        continue;
      }

      // End block comment on */
      if (inBlockComment && char === '*' && nextChar === '/') {
        inBlockComment = false;
        i++; // Skip the next character
        continue;
      }

      // Skip characters if we're in a comment
      if (inLineComment || inBlockComment) {
        continue;
      }

      // Handle quotes
      if (char === "'" && !inDoubleQuote) {
        inSingleQuote = !inSingleQuote;
      } else if (char === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
      }

      result += char;
    }

    return result;
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

  async enableFullTextSearch(tableName: string, columns: string[]): Promise<void> {
    this.ensureConnected();
    const virtualTableName = `${tableName}_fts`;
    const columnList = columns.join(', ');
    
    await this.execute(`
      CREATE VIRTUAL TABLE IF NOT EXISTS ${virtualTableName} 
      USING fts5(${columnList}, content=${tableName});
    `);

    // Create triggers to keep FTS table in sync
    await this.execute(`
      CREATE TRIGGER IF NOT EXISTS ${tableName}_ai AFTER INSERT ON ${tableName} BEGIN
        INSERT INTO ${virtualTableName}(rowid, ${columnList}) 
        VALUES (new.rowid, ${columns.map(c => `new.${c}`).join(', ')});
      END;
    `);

    await this.execute(`
      CREATE TRIGGER IF NOT EXISTS ${tableName}_ad AFTER DELETE ON ${tableName} BEGIN
        INSERT INTO ${virtualTableName}(${virtualTableName}, rowid, ${columnList}) 
        VALUES('delete', old.rowid, ${columns.map(c => `old.${c}`).join(', ')});
      END;
    `);

    await this.execute(`
      CREATE TRIGGER IF NOT EXISTS ${tableName}_au AFTER UPDATE ON ${tableName} BEGIN
        INSERT INTO ${virtualTableName}(${virtualTableName}, rowid, ${columnList}) 
        VALUES('delete', old.rowid, ${columns.map(c => `old.${c}`).join(', ')});
        INSERT INTO ${virtualTableName}(rowid, ${columnList}) 
        VALUES (new.rowid, ${columns.map(c => `new.${c}`).join(', ')});
      END;
    `);
  }

  async searchFullText(tableName: string, query: string): Promise<QueryResult<any>> {
    this.ensureConnected();
    const virtualTableName = `${tableName}_fts`;

    const result = await this.execute(`
      SELECT t.* FROM ${tableName} t
      INNER JOIN ${virtualTableName} f ON t.rowid = f.rowid
      WHERE ${virtualTableName} MATCH ?
      ORDER BY rank;
    `, [query]);

    return result;
  }

  // Introspection methods for database schema
  async getTables(): Promise<any[]> {
    this.ensureConnected();
    const result = await this.execute(`
      SELECT name, type, sql
      FROM sqlite_master
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name;
    `);
    return result.data || [];
  }

  async getColumns(): Promise<any[]> {
    this.ensureConnected();
    const tables = await this.getTables();
    const columns: any[] = [];

    for (const table of tables) {
      const tableInfo = await this.execute(`PRAGMA table_info(${table.name});`);

      for (const column of tableInfo.data || []) {
        columns.push({
          table: table.name,
          name: column.name,
          type: column.type,
          isNullable: !column.notnull,
          isAutoIncrement: column.pk && column.type.toLowerCase().includes('integer'),
          isPrimaryKey: column.pk,
          defaultValue: column.dflt_value,
          position: column.cid
        });
      }
    }

    return columns;
  }

  async getForeignKeys(): Promise<any[]> {
    this.ensureConnected();
    const tables = await this.getTables();
    const foreignKeys: any[] = [];

    for (const table of tables) {
      const fkInfo = await this.execute(`PRAGMA foreign_key_list(${table.name});`);

      for (const fk of fkInfo.data || []) {
        foreignKeys.push({
          name: `fk_${table.name}_${fk.from}_${fk.table}_${fk.to}`,
          foreignTable: table.name,
          foreignKey: fk.from,
          referencedTable: fk.table,
          referencedColumn: fk.to,
          onDelete: fk.on_delete,
          onUpdate: fk.on_update
        });
      }
    }

    return foreignKeys;
  }

  async getIndexes(): Promise<any[]> {
    this.ensureConnected();
    const tables = await this.getTables();
    const indexes: any[] = [];

    for (const table of tables) {
      const indexList = await this.execute(`PRAGMA index_list(${table.name});`);

      for (const index of indexList.data || []) {
        // Include user-created indexes ('c') and unique constraint indexes ('u')
        // Exclude primary key auto-indexes ('pk') and internal indexes
        if (index.origin === 'c' || index.origin === 'u') {
          const indexInfo = await this.execute(`PRAGMA index_info(${index.name});`);
          const columns = (indexInfo.data || []).map((col: any) => col.name);

          indexes.push({
            name: index.name,
            table: table.name,
            columns,
            isUnique: index.unique,
            isPrimary: false
          });
        }
      }
    }

    return indexes;
  }

  async getCheckConstraints(): Promise<any[]> {
    this.ensureConnected();
    const tables = await this.getTables();
    const checkConstraints: any[] = [];

    for (const table of tables) {
      if (table.sql) {
        // Parse CHECK constraints from CREATE TABLE statement
        // Use a more sophisticated approach to handle nested parentheses
        const checkConstraints_parsed = this.parseCheckConstraints(table.sql, table.name);
        checkConstraints.push(...checkConstraints_parsed);
      }
    }

    return checkConstraints;
  }

  /**
   * Parse CHECK constraints from SQL, handling nested parentheses correctly
   */
  private parseCheckConstraints(sql: string, tableName: string): any[] {
    const constraints: any[] = [];

    // Find all CHECK constraint patterns
    const checkRegex = /(CONSTRAINT\s+(\w+)\s+)?CHECK\s*\(/gi;
    let match;

    while ((match = checkRegex.exec(sql)) !== null) {
      const isNamed = !!match[2];
      const constraintName = match[2];
      const startPos = match.index + match[0].length - 1; // Position of opening parenthesis

      // Find the matching closing parenthesis
      const expression = this.extractBalancedParentheses(sql, startPos);

      if (expression) {
        constraints.push({
          name: constraintName || null,
          table: tableName,
          expression: expression.trim(),
          isNamed
        });
      }
    }

    return constraints;
  }

  /**
   * Extract content between balanced parentheses starting at the given position
   */
  private extractBalancedParentheses(sql: string, startPos: number): string | null {
    if (sql[startPos] !== '(') return null;

    let depth = 0;
    let i = startPos;

    while (i < sql.length) {
      if (sql[i] === '(') {
        depth++;
      } else if (sql[i] === ')') {
        depth--;
        if (depth === 0) {
          // Found the matching closing parenthesis
          return sql.substring(startPos + 1, i);
        }
      }
      i++;
    }

    return null; // Unbalanced parentheses
  }

  async getUniqueConstraints(): Promise<any[]> {
    this.ensureConnected();
    const tables = await this.getTables();
    const uniqueConstraints: any[] = [];

    for (const table of tables) {
      if (table.sql) {
        // Parse UNIQUE constraints from CREATE TABLE statement
        const uniqueMatches = table.sql.match(/CONSTRAINT\s+(\w+)\s+UNIQUE\s*\(([^)]+)\)|UNIQUE\s*\(([^)]+)\)/gi);

        if (uniqueMatches) {
          for (const match of uniqueMatches) {
            const namedMatch = match.match(/CONSTRAINT\s+(\w+)\s+UNIQUE\s*\(([^)]+)\)/i);
            const unnamedMatch = match.match(/UNIQUE\s*\(([^)]+)\)/i);

            if (namedMatch) {
              const columns = namedMatch[2].split(',').map(col => col.trim().replace(/["`]/g, ''));
              uniqueConstraints.push({
                name: namedMatch[1],
                table: table.name,
                columns,
                isNamed: true
              });
            } else if (unnamedMatch) {
              const columns = unnamedMatch[1].split(',').map(col => col.trim().replace(/["`]/g, ''));
              uniqueConstraints.push({
                name: null,
                table: table.name,
                columns,
                isNamed: false
              });
            }
          }
        }
      }
    }

    return uniqueConstraints;
  }
}
