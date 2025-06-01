import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import fs from 'fs';
import path from 'path';
import { dbPush, dbPull } from '../../src/cli/db';
import { introspectDatabase } from '../../src/cli/introspect';

const TEST_DIR = path.join(__dirname, 'cli-test');
const TEST_DB_PATH = path.join(TEST_DIR, 'test-cli.db');
const TEST_SCHEMA_PATH = path.join(TEST_DIR, 'schema.prisma');
const TEST_PULLED_SCHEMA_PATH = path.join(TEST_DIR, 'pulled-schema.prisma');

const COMPREHENSIVE_SCHEMA = `
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
  email    String   @unique(name: "unique_user_email")
  username String   @unique
  age      Int
  salary   Float
  status   String
  name     String?
  posts    Post[]
  profile  Profile?
  
  // Check constraints with named and unnamed
  @@check(age >= 18, name: "minimum_age")
  @@check(salary > 0, name: "positive_salary")
  @@check(status IN ('active', 'inactive', 'suspended'))
  
  // Index constraints
  @@index([email, username], name: "user_credentials_idx")
  @@index([status, age])
  
  // Multi-field unique constraint
  @@unique([email, username], name: "unique_user_credentials")
}

model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String?
  published Boolean  @default(false)
  authorId  Int
  author    User     @relation(
    fields: [authorId], 
    references: [id], 
    onDelete: Cascade, 
    onUpdate: Restrict, 
    name: "post_author_fk"
  )
  
  // Check constraints
  @@check(LENGTH(title) > 0, name: "title_not_empty")
  @@check(LENGTH(title) <= 255, name: "title_max_length")
  
  // Unique constraint on title per author
  @@unique([title, authorId], name: "unique_post_title_per_author")
  
  // Index for performance
  @@index([published, authorId], name: "post_published_author_idx")
}

model Profile {
  id     Int    @id @default(autoincrement())
  bio    String
  userId Int    @unique(name: "unique_profile_user")
  user   User   @relation(
    fields: [userId], 
    references: [id], 
    onDelete: Cascade, 
    name: "profile_user_fk"
  )
  
  // Check constraint
  @@check(LENGTH(bio) <= 1000, name: "bio_max_length")
}
`;

describe('CLI Database Constraints Integration', () => {
  beforeAll(() => {
    // Create test directory
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
    
    // Clean up any existing test files
    [TEST_DB_PATH, TEST_SCHEMA_PATH, TEST_PULLED_SCHEMA_PATH].forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
  });

  afterAll(() => {
    // Clean up test files and directory
    [TEST_DB_PATH, TEST_SCHEMA_PATH, TEST_PULLED_SCHEMA_PATH].forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });

    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe('db push with constraints', () => {
    it('should push schema with all constraint types to database', async () => {
      // Write test schema
      fs.writeFileSync(TEST_SCHEMA_PATH, COMPREHENSIVE_SCHEMA);
      
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
        expect(tableNames).toContain('post');
        expect(tableNames).toContain('profile');
        
        // Check constraints exist
        const checkConstraints = await adapter.getCheckConstraints();
        expect(checkConstraints.length).toBeGreaterThan(0);
        
        // Verify specific named constraints
        const namedConstraints = checkConstraints.filter(c => c.isNamed);
        const constraintNames = namedConstraints.map(c => c.name);
        expect(constraintNames).toContain('minimum_age');
        expect(constraintNames).toContain('positive_salary');
        expect(constraintNames).toContain('title_not_empty');
        expect(constraintNames).toContain('bio_max_length');
        
        // Check unique constraints
        const uniqueConstraints = await adapter.getUniqueConstraints();
        expect(uniqueConstraints.length).toBeGreaterThan(0);
        
        const uniqueConstraintNames = uniqueConstraints.filter(c => c.isNamed).map(c => c.name);
        expect(uniqueConstraintNames).toContain('unique_user_email');
        expect(uniqueConstraintNames).toContain('unique_user_credentials');
        
        // Check indexes
        const indexes = await adapter.getIndexes();
        expect(indexes.length).toBeGreaterThan(0);
        
        const indexNames = indexes.map(i => i.name);
        expect(indexNames).toContain('user_credentials_idx');
        expect(indexNames).toContain('post_published_author_idx');
        
      } finally {
        await adapter.disconnect();
      }
    });
  });

  describe('db pull with constraints', () => {
    it('should pull schema with all constraint types from database', async () => {
      // Create a minimal schema file with just datasource for db pull
      const minimalSchema = `
datasource db {
  provider = "sqlite"
  url      = "file:${TEST_DB_PATH}"
}

generator client {
  provider = "drismify-client-js"
  output   = "./generated/client"
}
`;
      
      fs.writeFileSync(TEST_PULLED_SCHEMA_PATH, minimalSchema);
      
      // Pull schema from database
      await dbPull({
        schemaPath: TEST_PULLED_SCHEMA_PATH,
        force: true
      });
      
      // Read the pulled schema
      const pulledSchema = fs.readFileSync(TEST_PULLED_SCHEMA_PATH, 'utf-8');
      
      // Verify the pulled schema contains all constraint types
      expect(pulledSchema).toContain('@@check(');
      expect(pulledSchema).toContain('@@unique(');
      expect(pulledSchema).toContain('@@index(');
      
      // Verify named constraints are preserved
      expect(pulledSchema).toContain('name: "minimum_age"');
      expect(pulledSchema).toContain('name: "positive_salary"');
      expect(pulledSchema).toContain('name: "unique_user_email"');
      expect(pulledSchema).toContain('name: "unique_user_credentials"');
      expect(pulledSchema).toContain('name: "user_credentials_idx"');
      expect(pulledSchema).toContain('name: "title_not_empty"');
      expect(pulledSchema).toContain('name: "bio_max_length"');
      
      // Verify foreign key constraints with referential actions
      expect(pulledSchema).toContain('onDelete: Cascade');
      expect(pulledSchema).toContain('onUpdate: Restrict');
      
      // Verify models are generated
      expect(pulledSchema).toContain('model User {');
      expect(pulledSchema).toContain('model Post {');
      expect(pulledSchema).toContain('model Profile {');
    });
  });

  describe('introspect command', () => {
    it('should introspect database with all constraint types', async () => {
      const introspectedSchema = await introspectDatabase({
        url: TEST_DB_PATH,
        provider: 'sqlite',
        output: path.join(TEST_DIR, 'introspected-schema.prisma'),
        overwrite: true,
        saveComments: true,
        debug: false
      });
      
      // Verify the introspected schema contains all constraint types
      expect(introspectedSchema).toContain('@@check(');
      expect(introspectedSchema).toContain('@@unique(');
      expect(introspectedSchema).toContain('@@index(');
      
      // Verify named constraints
      expect(introspectedSchema).toContain('minimum_age');
      expect(introspectedSchema).toContain('positive_salary');
      expect(introspectedSchema).toContain('unique_user_email');
      expect(introspectedSchema).toContain('user_credentials_idx');
      
      // Verify constraint expressions are preserved
      expect(introspectedSchema).toContain('age >= 18');
      expect(introspectedSchema).toContain('salary > 0');
      expect(introspectedSchema).toContain('LENGTH(title) > 0');
      expect(introspectedSchema).toContain('LENGTH(bio) <= 1000');
      
      // Clean up
      const introspectedFile = path.join(TEST_DIR, 'introspected-schema.prisma');
      if (fs.existsSync(introspectedFile)) {
        fs.unlinkSync(introspectedFile);
      }
    });
  });

  describe('round-trip consistency', () => {
    it('should maintain constraint consistency through push and pull cycle', async () => {
      // Create a separate directory for round-trip test to avoid migration conflicts
      const roundTripDir = path.join(TEST_DIR, 'roundtrip');
      const roundTripSchemaPath = path.join(roundTripDir, 'schema.prisma');
      const roundTripDbPath = path.join(roundTripDir, 'roundtrip.db');

      // Create the roundtrip directory
      if (!fs.existsSync(roundTripDir)) {
        fs.mkdirSync(roundTripDir, { recursive: true });
      }

      const originalSchema = COMPREHENSIVE_SCHEMA.replace(TEST_DB_PATH, roundTripDbPath);
      fs.writeFileSync(roundTripSchemaPath, originalSchema);

      try {
        // Push original schema
        await dbPush({
          schemaPath: roundTripSchemaPath,
          skipGenerate: true,
          force: true
        });

        // Pull schema back
        await dbPull({
          schemaPath: roundTripSchemaPath,
          force: true
        });

        // Read the pulled schema
        const pulledSchema = fs.readFileSync(roundTripSchemaPath, 'utf-8');

        // Verify key constraints are preserved
        expect(pulledSchema).toContain('minimum_age');
        expect(pulledSchema).toContain('positive_salary');
        expect(pulledSchema).toContain('unique_user_email');
        expect(pulledSchema).toContain('user_credentials_idx');
        expect(pulledSchema).toContain('title_not_empty');
        expect(pulledSchema).toContain('bio_max_length');

        // Verify constraint types are preserved
        expect(pulledSchema).toContain('@@check(');
        expect(pulledSchema).toContain('@@unique(');
        expect(pulledSchema).toContain('@@index(');

      } finally {
        // Clean up
        if (fs.existsSync(roundTripDir)) {
          fs.rmSync(roundTripDir, { recursive: true, force: true });
        }
      }
    });
  });
});
