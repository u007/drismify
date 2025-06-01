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
  const { parseSchema } = await import('../parser/index.js');
  const ast = await parseSchema(schemaContent);
  
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

  // Create a migration manager (this will ensure the database exists)
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

  if (!migrationPath) {
    console.log('No schema changes detected');
    await manager.close();
    return;
  }

  console.log(`Migration generated at: ${migrationPath}`);

  // Apply the migration
  console.log('Applying migration...');
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
    const { ClientGenerator } = await import('../generator/client-generator.js');

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
    schemaPath = 'schema.prisma',
    force = false
  } = options;

  // Check if the schema file exists and read datasource info
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema file not found: ${schemaPath}. Please create a schema file with datasource configuration first.`);
  }

  // Read the existing schema file to get datasource configuration
  const existingSchemaContent = fs.readFileSync(schemaPath, 'utf-8');

  // Parse the existing schema to extract datasource
  const { parseSchema } = await import('../parser/index.js');
  const existingAst = await parseSchema(existingSchemaContent);

  // Extract datasource from the AST
  const datasource = existingAst.find((node: any) => node.type === 'datasource');
  if (!datasource) {
    throw new Error('No datasource found in the existing schema. Please add a datasource configuration.');
  }

  // Extract provider and URL
  const provider = datasource.assignments.provider;
  const url = datasource.assignments.url.replace(/^env\("([^"]+)"\)$/, (_, envVar) => {
    return process.env[envVar] || '';
  });

  if (!url) {
    throw new Error('Database URL not found in datasource configuration');
  }

  console.log(`Introspecting ${provider} database...`);
  console.log(`Database URL: ${url}`);

  // Use the introspection functionality
  const { introspectDatabase } = await import('./introspect.js');

  try {
    const newSchema = await introspectDatabase({
      url,
      provider: provider as 'sqlite' | 'turso',
      output: schemaPath,
      overwrite: force,
      saveComments: true,
      debug: true
    });

    console.log(`Schema pulled successfully and written to: ${schemaPath}`);
    console.log('Database introspection completed with support for:');
    console.log('  - Tables and columns');
    console.log('  - Primary keys and foreign keys');
    console.log('  - Unique constraints (named and unnamed)');
    console.log('  - Check constraints (named and unnamed)');
    console.log('  - Indexes (named and unnamed)');
    console.log('  - Referential actions (CASCADE, RESTRICT, etc.)');

  } catch (error: any) {
    if (error.message.includes('already exists') && !force) {
      console.error(`Schema file already exists: ${schemaPath}`);
      console.error('Use --force to overwrite the existing file');
      throw error;
    } else {
      throw error;
    }
  }
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
  const { parseSchema } = await import('../parser/index.js');
  const ast = await parseSchema(schemaContent);
  
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
      await import(path.resolve(seedScriptPath));
    }
    
    console.log('Seed script executed successfully');
  } catch (error) {
    console.error('Error executing seed script:', error);
    throw error;
  }
}
