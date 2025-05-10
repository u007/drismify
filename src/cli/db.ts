import * as fs from 'fs';
import * as path from 'path';
import { createAdapterFromDatasource } from '../adapters';
import { MigrationGenerator, MigrationManager } from '../migrations';

/**
 * Options for database operations
 */
export interface DbOptions {
  /**
   * Path to the schema file
   */
  schemaPath?: string;
  
  /**
   * Whether to skip client generation
   */
  skipGenerate?: boolean;
  
  /**
   * Whether to force the operation
   */
  force?: boolean;
  
  /**
   * Whether to reset the database
   */
  reset?: boolean;
  
  /**
   * Whether to accept data loss
   */
  acceptDataLoss?: boolean;
  
  /**
   * Path to the seed script
   */
  seedScript?: string;
}

/**
 * Push the schema to the database
 */
export async function dbPush(options: DbOptions = {}): Promise<void> {
  const {
    schemaPath = 'schema.prisma',
    skipGenerate = false,
    force = false,
    reset = false,
    acceptDataLoss = false
  } = options;
  
  // Check if the schema file exists
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema file not found: ${schemaPath}`);
  }
  
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
  
  // Create a temporary migration
  const migrationsDir = path.join(path.dirname(schemaPath), 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
  }
  
  // Generate a migration
  const generator = new MigrationGenerator({
    migrationsDir,
    debug: true
  });
  
  // If reset is true, we'll reset the database
  if (reset) {
    console.log('Resetting the database...');
    
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
    await manager.resetDatabase();
    await manager.close();
    
    console.log('Database reset successfully');
  }
  
  // Generate a migration
  console.log('Generating migration...');
  const migrationPath = await generator.generateMigrationFromSchemaFile(schemaPath, 'db-push');
  
  if (!migrationPath) {
    console.log('No schema changes detected');
    return;
  }
  
  console.log(`Migration generated at: ${migrationPath}`);
  
  // Apply the migration
  console.log('Applying migration...');
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
  
  // Generate the client if not skipped
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
 * Pull the schema from the database
 */
export async function dbPull(options: DbOptions = {}): Promise<void> {
  const {
    schemaPath = 'schema.prisma'
  } = options;
  
  // This is a placeholder for the actual implementation
  // In a real implementation, we would:
  // 1. Connect to the database
  // 2. Introspect the database schema
  // 3. Generate a Prisma schema file
  
  console.log('Database introspection is not yet implemented');
  console.log('This would generate a schema file from an existing database');
}

/**
 * Seed the database
 */
export async function dbSeed(options: DbOptions = {}): Promise<void> {
  const {
    schemaPath = 'schema.prisma',
    seedScript,
    reset = false
  } = options;
  
  // Check if the schema file exists
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema file not found: ${schemaPath}`);
  }
  
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
  
  // If reset is true, we'll reset the database
  if (reset) {
    console.log('Resetting the database...');
    
    const migrationsDir = path.join(path.dirname(schemaPath), 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      fs.mkdirSync(migrationsDir, { recursive: true });
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
    await manager.resetDatabase();
    await manager.close();
    
    console.log('Database reset successfully');
  }
  
  // Find the seed script
  let seedScriptPath = seedScript;
  if (!seedScriptPath) {
    // Look for seed script in standard locations
    const possibleLocations = [
      path.join(path.dirname(schemaPath), 'prisma', 'seed', 'seed.ts'),
      path.join(path.dirname(schemaPath), 'prisma', 'seed', 'seed.js'),
      path.join(path.dirname(schemaPath), 'prisma', 'seed.ts'),
      path.join(path.dirname(schemaPath), 'prisma', 'seed.js'),
      path.join(path.dirname(schemaPath), 'seed.ts'),
      path.join(path.dirname(schemaPath), 'seed.js')
    ];
    
    for (const location of possibleLocations) {
      if (fs.existsSync(location)) {
        seedScriptPath = location;
        break;
      }
    }
  }
  
  if (!seedScriptPath || !fs.existsSync(seedScriptPath)) {
    throw new Error('Seed script not found. Specify with --seed-script or create a seed script in a standard location.');
  }
  
  // Execute the seed script
  console.log(`Executing seed script: ${seedScriptPath}`);
  
  try {
    // Check if it's a TypeScript file
    if (seedScriptPath.endsWith('.ts')) {
      // Use ts-node to execute the script
      const { spawn } = require('child_process');
      const child = spawn('npx', ['ts-node', seedScriptPath], {
        stdio: 'inherit',
        shell: true
      });
      
      await new Promise<void>((resolve, reject) => {
        child.on('close', (code: number) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Seed script exited with code ${code}`));
          }
        });
      });
    } else {
      // Execute JavaScript file directly
      require(path.resolve(seedScriptPath));
    }
    
    console.log('Seed script executed successfully');
  } catch (error) {
    console.error('Error executing seed script:', error);
    throw error;
  }
}
