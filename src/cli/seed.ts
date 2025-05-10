import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { DatabaseAdapter } from '../adapters';
import { createAdapterFromDatasource } from '../adapters';
import { MigrationManager } from '../migrations';

/**
 * Seed options
 */
export interface SeedOptions {
  /**
   * Path to the schema file
   */
  schemaPath?: string;
  
  /**
   * Path to the seed script
   */
  seedScript?: string;
  
  /**
   * Whether to reset the database before seeding
   */
  reset?: boolean;
  
  /**
   * Whether to print debug information
   */
  debug?: boolean;
  
  /**
   * Whether to run in factoryMode for creating test data
   */
  factoryMode?: boolean;
  
  /**
   * Number of records to generate in factory mode
   */
  factoryCount?: number;
}

/**
 * Run a seed script against the database
 */
export async function runSeed(options: SeedOptions): Promise<void> {
  const {
    schemaPath = 'schema.prisma',
    seedScript,
    reset = false,
    debug = false,
    factoryMode = false,
    factoryCount = 10
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
    if (debug) {
      console.log('Resetting the database...');
    }
    
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
      debug
    });
    
    await manager.initialize();
    await manager.resetDatabase();
    await manager.close();
    
    if (debug) {
      console.log('Database reset successfully');
    }
  }
  
  // Check if in factory mode
  if (factoryMode) {
    await runFactorySeeding({
      schemaPath,
      count: factoryCount,
      debug
    });
    return;
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
  if (debug) {
    console.log(`Executing seed script: ${seedScriptPath}`);
  }
  
  try {
    // Check if it's a TypeScript file
    if (seedScriptPath.endsWith('.ts')) {
      // Use ts-node to execute the script
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
    
    if (debug) {
      console.log('Seed script executed successfully');
    }
  } catch (error) {
    console.error('Error executing seed script:', error);
    throw error;
  }
}

/**
 * Factory options
 */
interface FactoryOptions {
  /**
   * Path to the schema file
   */
  schemaPath: string;
  
  /**
   * Number of records to generate
   */
  count: number;
  
  /**
   * Whether to print debug information
   */
  debug: boolean;
}

/**
 * Run factory seeding to generate test data
 */
async function runFactorySeeding(options: FactoryOptions): Promise<void> {
  const {
    schemaPath,
    count,
    debug
  } = options;
  
  if (debug) {
    console.log(`Running factory seeding with ${count} records per model...`);
  }
  
  // Read the schema file
  const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
  
  // Parse the schema
  const parser = require('../parser/generatedParser.js');
  const ast = parser.parse(schemaContent);
  
  // Extract models from the AST
  const models = ast.filter((node: any) => node.type === 'model');
  
  // Extract datasource from the AST
  const datasource = ast.find((node: any) => node.type === 'datasource');
  if (!datasource) {
    throw new Error('No datasource found in the schema');
  }
  
  // Create adapter from datasource
  const adapter = await createAdapterFromDatasource(datasource);
  
  // Connect to the database
  await adapter.connect();
  
  try {
    // Begin transaction
    await adapter.beginTransaction();
    
    // Generate and insert data for each model
    for (const model of models) {
      const modelName = model.name;
      const tableName = toSnakeCase(modelName);
      
      if (debug) {
        console.log(`Generating ${count} records for model ${modelName}...`);
      }
      
      // Generate test data based on the model fields
      for (let i = 0; i < count; i++) {
        const data = generateTestData(model.fields);
        
        // Insert data into the database
        await adapter.insert(tableName, data);
      }
    }
    
    // Commit transaction
    await adapter.commitTransaction();
    
    if (debug) {
      console.log('Factory seeding completed successfully');
    }
  } catch (error) {
    // Rollback transaction on error
    await adapter.rollbackTransaction();
    console.error('Factory seeding failed:', error);
    throw error;
  } finally {
    // Disconnect from the database
    await adapter.disconnect();
  }
}

/**
 * Generate test data for a model
 */
function generateTestData(fields: any[]): any {
  const data: any = {};
  
  for (const field of fields) {
    const fieldName = field.name;
    const fieldType = field.type.name;
    const isOptional = field.type.optional;
    
    // Skip optional fields randomly
    if (isOptional && Math.random() > 0.7) {
      continue;
    }
    
    // Generate value based on field type
    switch (fieldType) {
      case 'String':
        data[fieldName] = generateRandomString(8);
        break;
      case 'Int':
        data[fieldName] = Math.floor(Math.random() * 1000);
        break;
      case 'Float':
        data[fieldName] = Math.random() * 1000;
        break;
      case 'Boolean':
        data[fieldName] = Math.random() > 0.5;
        break;
      case 'DateTime':
        data[fieldName] = new Date();
        break;
      case 'Json':
        data[fieldName] = { key: generateRandomString(4), value: generateRandomString(4) };
        break;
      default:
        // Skip relation fields
        break;
    }
  }
  
  return data;
}

/**
 * Generate a random string
 */
function generateRandomString(length: number): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  
  return result;
}

/**
 * Convert PascalCase to snake_case
 */
function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toLowerCase();
}