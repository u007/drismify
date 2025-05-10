import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { 
  createAdapter, 
  DatabaseAdapter 
} from '../adapters';
import { 
  MigrationCommandOptions, 
  MigrationFile, 
  MigrationOptions, 
  MigrationRecord, 
  MigrationResult, 
  MigrationStatus 
} from './types';

/**
 * Migration manager
 * Handles migration operations
 */
export class MigrationManager {
  private options: MigrationOptions;
  private adapter: DatabaseAdapter;
  private migrationsTable: string;
  
  constructor(options: MigrationOptions) {
    this.options = {
      migrationsTable: '_drismify_migrations',
      createMigrationsTable: true,
      ...options
    };
    
    this.migrationsTable = this.options.migrationsTable!;
    
    // Create the adapter
    const adapterType = this.options.adapterType || 
      (this.options.connectionOptions.url?.startsWith('libsql:') ? 'turso' : 'sqlite');
    
    this.adapter = createAdapter(adapterType, this.options.connectionOptions);
    
    // Create the migrations directory if it doesn't exist
    if (!fs.existsSync(this.options.migrationsDir)) {
      fs.mkdirSync(this.options.migrationsDir, { recursive: true });
    }
  }
  
  /**
   * Initialize the migration system
   */
  async initialize(): Promise<void> {
    await this.adapter.connect();
    
    if (this.options.createMigrationsTable) {
      await this.createMigrationsTable();
    }
  }
  
  /**
   * Create the migrations table
   */
  private async createMigrationsTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS ${this.migrationsTable} (
        name TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await this.adapter.executeRaw(query);
    
    if (this.options.debug) {
      console.log(`Created migrations table: ${this.migrationsTable}`);
    }
  }
  
  /**
   * Get all migration files
   */
  async getMigrationFiles(): Promise<MigrationFile[]> {
    const files = fs.readdirSync(this.options.migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    const migrationFiles: MigrationFile[] = [];
    
    for (const file of files) {
      const filePath = path.join(this.options.migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');
      const checksum = this.calculateChecksum(sql);
      
      // Parse the filename to get the timestamp and name
      // Format: YYYYMMDDHHMMSS_migration_name.sql
      const match = file.match(/^(\d{14})_(.+)\.sql$/);
      
      if (match) {
        const timestamp = parseInt(match[1], 10);
        const name = match[2];
        
        migrationFiles.push({
          name,
          timestamp,
          filePath,
          sql,
          checksum
        });
      }
    }
    
    return migrationFiles.sort((a, b) => a.timestamp - b.timestamp);
  }
  
  /**
   * Get applied migrations
   */
  async getAppliedMigrations(): Promise<MigrationRecord[]> {
    try {
      const query = `SELECT name, timestamp, checksum, applied_at FROM ${this.migrationsTable} ORDER BY timestamp ASC`;
      const result = await this.adapter.executeRaw<{
        name: string;
        timestamp: number;
        checksum: string;
        applied_at: string;
      }>(query);
      
      return result.data.map(record => ({
        name: record.name,
        timestamp: record.timestamp,
        checksum: record.checksum,
        appliedAt: new Date(record.applied_at)
      }));
    } catch (error) {
      if (this.options.debug) {
        console.error('Error getting applied migrations:', error);
      }
      
      return [];
    }
  }
  
  /**
   * Get migration status
   */
  async getMigrationStatus(): Promise<MigrationStatus[]> {
    const migrationFiles = await this.getMigrationFiles();
    const appliedMigrations = await this.getAppliedMigrations();
    
    const appliedMigrationsMap = new Map<string, MigrationRecord>();
    for (const migration of appliedMigrations) {
      appliedMigrationsMap.set(migration.name, migration);
    }
    
    return migrationFiles.map(file => {
      const appliedMigration = appliedMigrationsMap.get(file.name);
      
      return {
        name: file.name,
        timestamp: file.timestamp,
        applied: !!appliedMigration,
        appliedAt: appliedMigration?.appliedAt,
        checksumMismatch: !!appliedMigration && appliedMigration.checksum !== file.checksum
      };
    });
  }
  
  /**
   * Get pending migrations
   */
  async getPendingMigrations(): Promise<MigrationFile[]> {
    const migrationFiles = await this.getMigrationFiles();
    const appliedMigrations = await this.getAppliedMigrations();
    
    const appliedMigrationNames = new Set(appliedMigrations.map(m => m.name));
    
    return migrationFiles.filter(file => !appliedMigrationNames.has(file.name));
  }
  
  /**
   * Apply a migration
   */
  async applyMigration(migration: MigrationFile, options: MigrationCommandOptions = {}): Promise<MigrationResult> {
    const startTime = Date.now();
    
    try {
      if (options.dryRun) {
        if (this.options.debug) {
          console.log(`[DRY RUN] Would apply migration: ${migration.name}`);
        }
        
        return {
          name: migration.name,
          success: true,
          duration: Date.now() - startTime
        };
      }
      
      // Execute the migration SQL
      await this.adapter.executeRaw(migration.sql);
      
      // Record the migration
      await this.recordMigration(migration);
      
      if (this.options.debug) {
        console.log(`Applied migration: ${migration.name}`);
      }
      
      return {
        name: migration.name,
        success: true,
        duration: Date.now() - startTime
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (this.options.debug) {
        console.error(`Error applying migration ${migration.name}:`, error);
      }
      
      return {
        name: migration.name,
        success: false,
        error: errorMessage,
        duration: Date.now() - startTime
      };
    }
  }
  
  /**
   * Record a migration
   */
  private async recordMigration(migration: MigrationFile): Promise<void> {
    const query = `
      INSERT INTO ${this.migrationsTable} (name, timestamp, checksum)
      VALUES (?, ?, ?)
    `;
    
    await this.adapter.executeRaw(query, [
      migration.name,
      migration.timestamp,
      migration.checksum
    ]);
  }
  
  /**
   * Apply pending migrations
   */
  async applyPendingMigrations(options: MigrationCommandOptions = {}): Promise<MigrationResult[]> {
    const pendingMigrations = await this.getPendingMigrations();
    
    if (pendingMigrations.length === 0) {
      if (this.options.debug) {
        console.log('No pending migrations to apply');
      }
      
      return [];
    }
    
    const results: MigrationResult[] = [];
    
    for (const migration of pendingMigrations) {
      const result = await this.applyMigration(migration, options);
      results.push(result);
      
      if (!result.success && !options.force) {
        break;
      }
    }
    
    return results;
  }
  
  /**
   * Reset the database
   */
  async resetDatabase(options: MigrationCommandOptions = {}): Promise<MigrationResult[]> {
    if (options.dryRun) {
      if (this.options.debug) {
        console.log('[DRY RUN] Would reset database');
      }
      
      return [];
    }
    
    // Drop all tables except the migrations table
    const tables = await this.getTables();
    const results: MigrationResult[] = [];
    
    for (const table of tables) {
      if (table !== this.migrationsTable) {
        const startTime = Date.now();
        
        try {
          await this.adapter.executeRaw(`DROP TABLE IF EXISTS ${table}`);
          
          results.push({
            name: `drop_table_${table}`,
            success: true,
            duration: Date.now() - startTime
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          results.push({
            name: `drop_table_${table}`,
            success: false,
            error: errorMessage,
            duration: Date.now() - startTime
          });
          
          if (!options.force) {
            break;
          }
        }
      }
    }
    
    // Clear the migrations table
    await this.adapter.executeRaw(`DELETE FROM ${this.migrationsTable}`);
    
    // Apply all migrations
    const migrationFiles = await this.getMigrationFiles();
    
    for (const migration of migrationFiles) {
      const result = await this.applyMigration(migration, options);
      results.push(result);
      
      if (!result.success && !options.force) {
        break;
      }
    }
    
    return results;
  }
  
  /**
   * Get all tables in the database
   */
  private async getTables(): Promise<string[]> {
    const query = `
      SELECT name FROM sqlite_master
      WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
    `;
    
    const result = await this.adapter.executeRaw<{ name: string }>(query);
    return result.data.map(row => row.name);
  }
  
  /**
   * Calculate checksum for a SQL string
   */
  private calculateChecksum(sql: string): string {
    return crypto.createHash('md5').update(sql).digest('hex');
  }
  
  /**
   * Close the connection
   */
  async close(): Promise<void> {
    await this.adapter.disconnect();
  }
}
