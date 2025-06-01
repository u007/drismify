import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import fs from 'fs';
import path from 'path';
import { dbPush } from '../../src/cli/db';

const TEST_DIR = path.join(__dirname, 'simple-cli-test');
const TEST_DB_PATH = path.join(TEST_DIR, 'simple-test.db');
const TEST_SCHEMA_PATH = path.join(TEST_DIR, 'simple-schema.prisma');

const SIMPLE_SCHEMA = `
datasource db {
  provider = "sqlite"
  url      = "file:${TEST_DB_PATH}"
}

generator client {
  provider = "drismify-client-js"
  output   = "./generated/client"
}

model User {
  id       Int      @id @default(autoincrement())
  email    String   @unique
  name     String?
}
`;

describe('Simple CLI Test', () => {
  beforeAll(() => {
    // Create test directory
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }

    // Clean up any existing test files and directories
    [TEST_DB_PATH, TEST_SCHEMA_PATH].forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });

    // Clean up migrations directory
    const migrationsDir = path.join(TEST_DIR, 'migrations');
    if (fs.existsSync(migrationsDir)) {
      fs.rmSync(migrationsDir, { recursive: true, force: true });
    }
  });

  afterAll(() => {
    // Don't clean up for debugging
    console.log(`Test files left in: ${TEST_DIR}`);
  });

  it('should push simple schema to database', async () => {
    // Write test schema
    fs.writeFileSync(TEST_SCHEMA_PATH, SIMPLE_SCHEMA);
    
    // Push schema to database
    await dbPush({
      schemaPath: TEST_SCHEMA_PATH,
      skipGenerate: true,
      force: true
    });
    
    // Verify database file was created
    expect(fs.existsSync(TEST_DB_PATH)).toBe(true);
    
    // Verify database has the expected structure
    const { SQLiteAdapter } = require('../../src/adapters/sqlite-adapter');
    const adapter = new SQLiteAdapter({ filename: TEST_DB_PATH });
    await adapter.connect();
    
    try {
      // Check tables exist
      const tables = await adapter.getTables();
      const tableNames = tables.map(t => t.name);
      expect(tableNames).toContain('user');
      
    } finally {
      await adapter.disconnect();
    }
  });
});
