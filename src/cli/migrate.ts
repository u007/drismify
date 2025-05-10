import * as fs from 'fs';
import * as path from 'path';
import { MigrationGenerator, MigrationManager, MigrationCommandOptions } from '../migrations';

/**
 * Options for migration operations
 */
export interface MigrateOptions extends MigrationCommandOptions {
  /**
   * Path to the schema file
   */
  schemaPath?: string;
  
  /**
   * Directory where migrations are stored
   */
  migrationsDir?: string;
  
  /**
   * Migration name
   */
  name?: string;
  
  /**
   * Whether to create an initial migration
   */
  createOnly?: boolean;
  
  /**
   * Whether to skip client generation
   */
  skipGenerate?: boolean;
  
  /**
   * Whether to skip applying migrations
   */
  skipMigrate?: boolean;
  
  /**
   * Number of migrations to roll back
   */
  rollback?: number;
  
  /**
   * Whether to prune migration history
   */
  prune?: boolean;
}

/**
 * Generate and apply migrations in development
 */
export async function migrateDev(options: MigrateOptions = {}): Promise<void> {
  const {
    schemaPath = 'schema.prisma',
    migrationsDir = path.join(path.dirname(schemaPath), 'migrations'),
    name = 'migration',
    createOnly = false,
    skipGenerate = false,
    skipMigrate = false,
    dryRun = false,
    force = false
  } = options;
  
  // Check if the schema file exists
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema file not found: ${schemaPath}`);
  }
  
  // Create migrations directory if it doesn't exist
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
  }
  
  // Generate migration
  console.log(`Generating migration from: ${schemaPath}`);
  console.log(`Migration name: ${name}`);
  console.log(`Migrations directory: ${migrationsDir}`);
  
  const generator = new MigrationGenerator({
    migrationsDir,
    debug: true
  });
  
  const migrationPath = await generator.generateMigrationFromSchemaFile(schemaPath, name);
  
  if (!migrationPath) {
    console.log('No schema changes detected');
    return;
  }
  
  console.log(`Migration generated at: ${migrationPath}`);
  
  // Apply migration if not createOnly
  if (!createOnly && !skipMigrate) {
    console.log('Applying migration...');
    
    // Read the schema file
    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
    
    // Parse the schema
    const parser = require('../parser/generatedParser.js');
    const ast = parser.parse(schemaContent);
    
    // Extract datasource from the AST
    const datasource = ast.find((node: any) => node.type === 'datasource');
    if (!datasource) {
      throw new Error('No datasource found in the schema');
    }
    
    // Create a migration manager
    const manager = new MigrationManager({
      migrationsDir,
      connectionOptions: {
        url: datasource.assignments.url.replace(/^env\("([^"]+)"\)$/, (_, envVar) => {
          return process.env[envVar] || '';
        })
      },
      debug: true
    });
    
    await manager.initialize();
    const results = await manager.applyPendingMigrations({
      dryRun,
      force
    });
    
    if (results.length === 0) {
      console.log('No migrations to apply');
    } else {
      console.log(`Applied ${results.length} migrations`);
      for (const result of results) {
        console.log(`  ${result.name}: ${result.success ? 'Success' : 'Failed'} (${result.duration}ms)`);
        if (!result.success && result.error) {
          console.error(`    Error: ${result.error}`);
        }
      }
    }
    
    await manager.close();
  }
  
  // Generate client if not skipGenerate
  if (!skipGenerate) {
    console.log('Generating client...');
    const { ClientGenerator } = require('../generator/client-generator');
    
    const generator = new ClientGenerator({
      outputDir: path.join(path.dirname(schemaPath), 'generated', 'client'),
      generateTypes: true,
      generateJs: true,
      generatePackageJson: true,
      generateReadme: true
    });
    
    await generator.generateFromSchemaFile(schemaPath);
    console.log('Client generated successfully');
  }
}

/**
 * Apply migrations in production
 */
export async function migrateDeploy(options: MigrateOptions = {}): Promise<void> {
  const {
    schemaPath = 'schema.prisma',
    migrationsDir = path.join(path.dirname(schemaPath), 'migrations'),
    dryRun = false,
    force = false
  } = options;
  
  // Check if the schema file exists
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema file not found: ${schemaPath}`);
  }
  
  // Check if migrations directory exists
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migrations directory not found: ${migrationsDir}`);
  }
  
  console.log(`Applying migrations from: ${migrationsDir}`);
  
  // Read the schema file
  const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
  
  // Parse the schema
  const parser = require('../parser/generatedParser.js');
  const ast = parser.parse(schemaContent);
  
  // Extract datasource from the AST
  const datasource = ast.find((node: any) => node.type === 'datasource');
  if (!datasource) {
    throw new Error('No datasource found in the schema');
  }
  
  // Create a migration manager
  const manager = new MigrationManager({
    migrationsDir,
    connectionOptions: {
      url: datasource.assignments.url.replace(/^env\("([^"]+)"\)$/, (_, envVar) => {
        return process.env[envVar] || '';
      })
    },
    debug: true
  });
  
  await manager.initialize();
  const results = await manager.applyPendingMigrations({
    dryRun,
    force
  });
  
  if (results.length === 0) {
    console.log('No migrations to apply');
  } else {
    console.log(`Applied ${results.length} migrations`);
    for (const result of results) {
      console.log(`  ${result.name}: ${result.success ? 'Success' : 'Failed'} (${result.duration}ms)`);
      if (!result.success && result.error) {
        console.error(`    Error: ${result.error}`);
      }
    }
  }
  
  await manager.close();
}

/**
 * Reset the database
 */
export async function migrateReset(options: MigrateOptions = {}): Promise<void> {
  const {
    schemaPath = 'schema.prisma',
    migrationsDir = path.join(path.dirname(schemaPath), 'migrations'),
    dryRun = false,
    force = false,
    skipConfirmation = false
  } = options;
  
  // Check if the schema file exists
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema file not found: ${schemaPath}`);
  }
  
  // Check if migrations directory exists
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migrations directory not found: ${migrationsDir}`);
  }
  
  // Confirm reset if not skipConfirmation
  if (!skipConfirmation && !dryRun) {
    console.log('WARNING: This will reset your database and apply all migrations from scratch.');
    console.log('All data will be lost.');
    
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise<string>(resolve => {
      readline.question('Are you sure you want to continue? (y/N) ', resolve);
    });
    
    readline.close();
    
    if (answer.toLowerCase() !== 'y') {
      console.log('Reset cancelled');
      return;
    }
  }
  
  console.log(`Resetting database with migrations from: ${migrationsDir}`);
  
  // Read the schema file
  const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
  
  // Parse the schema
  const parser = require('../parser/generatedParser.js');
  const ast = parser.parse(schemaContent);
  
  // Extract datasource from the AST
  const datasource = ast.find((node: any) => node.type === 'datasource');
  if (!datasource) {
    throw new Error('No datasource found in the schema');
  }
  
  // Create a migration manager
  const manager = new MigrationManager({
    migrationsDir,
    connectionOptions: {
      url: datasource.assignments.url.replace(/^env\("([^"]+)"\)$/, (_, envVar) => {
        return process.env[envVar] || '';
      })
    },
    debug: true
  });
  
  await manager.initialize();
  const results = await manager.resetDatabase({
    dryRun,
    force
  });
  
  console.log(`Reset database and applied ${results.length} migrations`);
  for (const result of results) {
    console.log(`  ${result.name}: ${result.success ? 'Success' : 'Failed'} (${result.duration}ms)`);
    if (!result.success && result.error) {
      console.error(`    Error: ${result.error}`);
    }
  }
  
  await manager.close();
}

/**
 * Show migration status
 */
export async function migrateStatus(options: MigrateOptions = {}): Promise<void> {
  const {
    schemaPath = 'schema.prisma',
    migrationsDir = path.join(path.dirname(schemaPath), 'migrations')
  } = options;
  
  // Check if the schema file exists
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema file not found: ${schemaPath}`);
  }
  
  // Check if migrations directory exists
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migrations directory not found: ${migrationsDir}`);
  }
  
  console.log(`Checking migration status from: ${migrationsDir}`);
  
  // Read the schema file
  const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
  
  // Parse the schema
  const parser = require('../parser/generatedParser.js');
  const ast = parser.parse(schemaContent);
  
  // Extract datasource from the AST
  const datasource = ast.find((node: any) => node.type === 'datasource');
  if (!datasource) {
    throw new Error('No datasource found in the schema');
  }
  
  // Create a migration manager
  const manager = new MigrationManager({
    migrationsDir,
    connectionOptions: {
      url: datasource.assignments.url.replace(/^env\("([^"]+)"\)$/, (_, envVar) => {
        return process.env[envVar] || '';
      })
    },
    debug: true
  });
  
  await manager.initialize();
  const status = await manager.getMigrationStatus();
  
  if (status.length === 0) {
    console.log('No migrations found');
  } else {
    console.log(`Found ${status.length} migrations:`);
    for (const migration of status) {
      const appliedStatus = migration.applied ? 
        `Applied at ${migration.appliedAt?.toISOString()}` : 
        'Not applied';
      const checksumStatus = migration.checksumMismatch ? 
        ' (Checksum mismatch)' : 
        '';
      
      console.log(`  ${migration.name}: ${appliedStatus}${checksumStatus}`);
    }
  }
  
  await manager.close();
}
