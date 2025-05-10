/**
 * Core types for the migration system
 */

/**
 * Migration options
 */
export interface MigrationOptions {
  /**
   * Directory where migrations are stored
   */
  migrationsDir: string;

  /**
   * Name of the migrations table
   */
  migrationsTable?: string;

  /**
   * Whether to create the migrations table if it doesn't exist
   */
  createMigrationsTable?: boolean;

  /**
   * Database adapter type
   */
  adapterType?: 'sqlite' | 'turso';

  /**
   * Database connection options
   */
  connectionOptions: {
    url?: string;
    filename?: string;
    [key: string]: any;
  };

  /**
   * Whether to enable debug mode
   */
  debug?: boolean;
}

/**
 * Migration file
 */
export interface MigrationFile {
  /**
   * Migration name
   */
  name: string;

  /**
   * Migration timestamp
   */
  timestamp: number;

  /**
   * Migration file path
   */
  filePath: string;

  /**
   * Migration filename
   */
  filename: string;

  /**
   * Migration SQL content
   */
  sql: string;

  /**
   * Migration checksum
   */
  checksum: string;
}

/**
 * Migration record
 */
export interface MigrationRecord {
  /**
   * Migration name
   */
  name: string;

  /**
   * Migration timestamp
   */
  timestamp: number;

  /**
   * Migration checksum
   */
  checksum: string;

  /**
   * When the migration was applied
   */
  appliedAt: Date;
}

/**
 * Migration status
 */
export interface MigrationStatus {
  /**
   * Migration name
   */
  name: string;

  /**
   * Migration timestamp
   */
  timestamp: number;

  /**
   * Whether the migration has been applied
   */
  applied: boolean;

  /**
   * When the migration was applied
   */
  appliedAt?: Date;

  /**
   * Whether there's a checksum mismatch
   */
  checksumMismatch: boolean;
}

/**
 * Schema change type
 */
export enum SchemaChangeType {
  CREATE_TABLE = 'CREATE_TABLE',
  DROP_TABLE = 'DROP_TABLE',
  ALTER_TABLE_ADD_COLUMN = 'ALTER_TABLE_ADD_COLUMN',
  ALTER_TABLE_DROP_COLUMN = 'ALTER_TABLE_DROP_COLUMN',
  ALTER_TABLE_ALTER_COLUMN = 'ALTER_TABLE_ALTER_COLUMN',
  CREATE_INDEX = 'CREATE_INDEX',
  DROP_INDEX = 'DROP_INDEX',
}

/**
 * Schema change
 */
export interface SchemaChange {
  /**
   * Change type
   */
  type: SchemaChangeType;

  /**
   * Table name
   */
  tableName: string;

  /**
   * Column name (for column changes)
   */
  columnName?: string;

  /**
   * Index name (for index changes)
   */
  indexName?: string;

  /**
   * SQL statement
   */
  sql: string;
}

/**
 * Migration result
 */
export interface MigrationResult {
  /**
   * Migration name
   */
  name: string;

  /**
   * Whether the migration was successful
   */
  success: boolean;

  /**
   * Error message (if any)
   */
  error?: string;

  /**
   * Duration in milliseconds
   */
  duration: number;
}

/**
 * Migration command
 */
export enum MigrationCommand {
  MIGRATE = 'migrate',
  RESET = 'reset',
  STATUS = 'status',
}

/**
 * Migration command options
 */
export interface MigrationCommandOptions {
  /**
   * Whether to run in dry-run mode
   */
  dryRun?: boolean;

  /**
   * Migration name (for migrate command)
   */
  name?: string;

  /**
   * Whether to force the migration
   */
  force?: boolean;

  /**
   * Whether to skip confirmation prompts
   */
  skipConfirmation?: boolean;
}
