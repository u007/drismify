import * as fs from 'fs';
import * as path from 'path';
import { SchemaDiffer } from './schema-differ';
import { SchemaChange } from './types';

// Import types from our parser
type PslAstNode = { type: string; [key: string]: any };

/**
 * Migration generator options
 */
export interface MigrationGeneratorOptions {
  /**
   * Directory where migrations are stored
   */
  migrationsDir: string;
  
  /**
   * Database adapter type
   */
  adapterType?: 'sqlite' | 'turso';
  
  /**
   * Whether to enable debug mode
   */
  debug?: boolean;
}

/**
 * Migration generator
 * Generates migration files
 */
export class MigrationGenerator {
  private options: MigrationGeneratorOptions;
  private differ: SchemaDiffer;
  
  constructor(options: MigrationGeneratorOptions) {
    this.options = options;
    this.differ = new SchemaDiffer({
      adapterType: options.adapterType,
      debug: options.debug
    });
    
    // Create the migrations directory if it doesn't exist
    if (!fs.existsSync(options.migrationsDir)) {
      fs.mkdirSync(options.migrationsDir, { recursive: true });
    }
  }
  
  /**
   * Generate a migration from schema changes
   */
  async generateMigration(
    oldAst: PslAstNode[],
    newAst: PslAstNode[],
    name: string
  ): Promise<string | null> {
    // Diff the schemas
    const changes = this.differ.diffSchemas(oldAst, newAst);
    
    if (changes.length === 0) {
      if (this.options.debug) {
        console.log('No schema changes detected');
      }
      
      return null;
    }
    
    // Generate the migration SQL
    const sql = this.generateMigrationSql(changes);
    
    // Generate the migration file
    const timestamp = this.generateTimestamp();
    const fileName = `${timestamp}_${name}.sql`;
    const filePath = path.join(this.options.migrationsDir, fileName);
    
    fs.writeFileSync(filePath, sql);
    
    if (this.options.debug) {
      console.log(`Generated migration: ${fileName}`);
    }
    
    return filePath;
  }
  
  /**
   * Generate a migration from schema files
   */
  async generateMigrationFromSchemaFiles(
    oldSchemaPath: string,
    newSchemaPath: string,
    name: string
  ): Promise<string | null> {
    // Read the schema files
    const oldSchemaContent = fs.readFileSync(oldSchemaPath, 'utf-8');
    const newSchemaContent = fs.readFileSync(newSchemaPath, 'utf-8');
    
    // Parse the schemas
    const parser = require('../parser/generatedParser.js');
    const oldAst = parser.parse(oldSchemaContent) as PslAstNode[];
    const newAst = parser.parse(newSchemaContent) as PslAstNode[];
    
    // Generate the migration
    return this.generateMigration(oldAst, newAst, name);
  }
  
  /**
   * Generate a migration from a schema file
   */
  async generateMigrationFromSchemaFile(
    schemaPath: string,
    name: string
  ): Promise<string | null> {
    // Read the schema file
    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
    
    // Parse the schema
    const parser = require('../parser/generatedParser.js');
    const ast = parser.parse(schemaContent) as PslAstNode[];
    
    // Find the latest migration file
    const migrationFiles = fs.readdirSync(this.options.migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort()
      .reverse();
    
    if (migrationFiles.length === 0) {
      // No previous migrations, generate a migration from scratch
      return this.generateMigration([], ast, name);
    }
    
    // Get the latest migration file
    const latestMigrationFile = path.join(this.options.migrationsDir, migrationFiles[0]);
    
    // Read the latest migration file
    const latestMigrationContent = fs.readFileSync(latestMigrationFile, 'utf-8');
    
    // Extract the schema from the latest migration
    const oldAst = this.extractSchemaFromMigration(latestMigrationContent);
    
    if (!oldAst) {
      // Couldn't extract schema from migration, generate a migration from scratch
      return this.generateMigration([], ast, name);
    }
    
    // Generate the migration
    return this.generateMigration(oldAst, ast, name);
  }
  
  /**
   * Extract schema from a migration
   * This is a placeholder implementation
   */
  private extractSchemaFromMigration(migrationContent: string): PslAstNode[] | null {
    // In a real implementation, we would parse the migration SQL and extract the schema
    // For now, we'll just return null to indicate that we couldn't extract the schema
    return null;
  }
  
  /**
   * Generate migration SQL
   */
  private generateMigrationSql(changes: SchemaChange[]): string {
    // Group changes by type
    const createTableChanges = changes.filter(c => c.type === 'CREATE_TABLE');
    const dropTableChanges = changes.filter(c => c.type === 'DROP_TABLE');
    const alterTableAddColumnChanges = changes.filter(c => c.type === 'ALTER_TABLE_ADD_COLUMN');
    const createIndexChanges = changes.filter(c => c.type === 'CREATE_INDEX');
    const dropIndexChanges = changes.filter(c => c.type === 'DROP_INDEX');
    
    // Generate SQL
    let sql = '-- Migration generated by Drismify\n\n';
    
    // Add transaction
    sql += '-- Start transaction\nBEGIN;\n\n';
    
    // Add drop tables
    if (dropTableChanges.length > 0) {
      sql += '-- Drop tables\n';
      for (const change of dropTableChanges) {
        sql += `${change.sql}\n`;
      }
      sql += '\n';
    }
    
    // Add create tables
    if (createTableChanges.length > 0) {
      sql += '-- Create tables\n';
      for (const change of createTableChanges) {
        sql += `${change.sql}\n`;
      }
      sql += '\n';
    }
    
    // Add alter tables
    if (alterTableAddColumnChanges.length > 0) {
      sql += '-- Alter tables\n';
      for (const change of alterTableAddColumnChanges) {
        sql += `${change.sql}\n`;
      }
      sql += '\n';
    }
    
    // Add drop indexes
    if (dropIndexChanges.length > 0) {
      sql += '-- Drop indexes\n';
      for (const change of dropIndexChanges) {
        sql += `${change.sql}\n`;
      }
      sql += '\n';
    }
    
    // Add create indexes
    if (createIndexChanges.length > 0) {
      sql += '-- Create indexes\n';
      for (const change of createIndexChanges) {
        sql += `${change.sql}\n`;
      }
      sql += '\n';
    }
    
    // Add commit
    sql += '-- Commit transaction\nCOMMIT;\n';
    
    return sql;
  }
  
  /**
   * Generate a timestamp
   */
  private generateTimestamp(): string {
    const now = new Date();
    
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }
}
