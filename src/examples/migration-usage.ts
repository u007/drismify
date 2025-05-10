// Example usage of the migration system

import * as path from 'path';
import * as fs from 'fs';
import { MigrationGenerator, MigrationManager } from '../migrations';

async function generateMigration() {
  console.log('Generating migration from schema...');
  
  const schemaPath = path.resolve('test-schema.prisma');
  const migrationsDir = path.resolve('./migrations');
  
  // Create the migrations directory if it doesn't exist
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
  }
  
  const generator = new MigrationGenerator({
    migrationsDir,
    debug: true
  });
  
  const migrationPath = await generator.generateMigrationFromSchemaFile(schemaPath, 'initial');
  
  if (!migrationPath) {
    console.log('No schema changes detected');
    return null;
  }
  
  console.log(`Migration generated at: ${migrationPath}`);
  return migrationPath;
}

async function applyMigrations() {
  console.log('Applying migrations...');
  
  const migrationsDir = path.resolve('./migrations');
  
  const manager = new MigrationManager({
    migrationsDir,
    connectionOptions: {
      filename: './dev.db'
    },
    debug: true
  });
  
  await manager.initialize();
  
  const results = await manager.applyPendingMigrations();
  
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

async function checkMigrationStatus() {
  console.log('Checking migration status...');
  
  const migrationsDir = path.resolve('./migrations');
  
  const manager = new MigrationManager({
    migrationsDir,
    connectionOptions: {
      filename: './dev.db'
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

async function resetDatabase() {
  console.log('Resetting database...');
  
  const migrationsDir = path.resolve('./migrations');
  
  const manager = new MigrationManager({
    migrationsDir,
    connectionOptions: {
      filename: './dev.db'
    },
    debug: true
  });
  
  await manager.initialize();
  
  const results = await manager.resetDatabase();
  
  console.log(`Reset database and applied ${results.length} migrations`);
  for (const result of results) {
    console.log(`  ${result.name}: ${result.success ? 'Success' : 'Failed'} (${result.duration}ms)`);
    if (!result.success && result.error) {
      console.error(`    Error: ${result.error}`);
    }
  }
  
  await manager.close();
}

// Run the example
async function main() {
  try {
    // Generate a migration
    const migrationPath = await generateMigration();
    
    if (migrationPath) {
      // Apply migrations
      await applyMigrations();
      
      // Check migration status
      await checkMigrationStatus();
      
      // Reset database
      // Uncomment to reset the database
      // await resetDatabase();
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the main function if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { generateMigration, applyMigrations, checkMigrationStatus, resetDatabase };
