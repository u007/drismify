/**
 * Test suite for unique constraints (single-field and multi-field)
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { DrismifyClient } from '../../src/client/base-client';
import { SQLiteAdapter } from '../../src/adapters/sqlite-adapter';
import { translatePslToDrizzleSchema } from '../../src/translator/pslToDrizzle';
import { parseSchemaFile } from '../../src/parser';
import * as fs from 'fs';
import * as path from 'path';

const TEST_DB_PATH = './test-unique-constraints.db';
const TEST_SCHEMA_PATH = './test-unique-constraints-schema.prisma';
const TEST_SCHEMA_OUTPUT_PATH = './test-unique-constraints-schema-output.ts';

// Test schema with various unique constraints
const TEST_SCHEMA = `
datasource db {
  provider = "sqlite"
  url      = "file:${TEST_DB_PATH}"
}

generator client {
  provider = "drismify-client-js"
  output   = "./generated/client"
}

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  username  String   @unique
  name      String?
  posts     Post[]
  profiles  Profile[]
}

model Post {
  id        Int      @id @default(autoincrement())
  title     String
  slug      String
  content   String?
  authorId  Int
  author    User     @relation(fields: [authorId], references: [id])
  
  // Multi-field unique constraint
  @@unique([title, authorId])
  @@unique([slug])
}

model Profile {
  id       Int    @id @default(autoincrement())
  platform String
  handle   String
  userId   Int
  user     User   @relation(fields: [userId], references: [id])
  
  // Multi-field unique constraint - one user can have one profile per platform
  @@unique([platform, userId])
}

model Category {
  id       Int    @id @default(autoincrement())
  name     String
  parentId Int?
  
  // Multi-field unique constraint - category name must be unique within parent
  @@unique([name, parentId])
}
`;

describe('Unique Constraints', () => {
  let prisma: DrismifyClient;
  let adapter: SQLiteAdapter;

  beforeAll(async () => {
    // Clean up any existing test files
    [TEST_DB_PATH, TEST_SCHEMA_PATH, TEST_SCHEMA_OUTPUT_PATH].forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });

    // Write test schema
    fs.writeFileSync(TEST_SCHEMA_PATH, TEST_SCHEMA);

    // Generate Drizzle schema
    const ast = await parseSchemaFile(TEST_SCHEMA_PATH);
    const drizzleSchema = translatePslToDrizzleSchema(ast);
    fs.writeFileSync(TEST_SCHEMA_OUTPUT_PATH, drizzleSchema);

    // Create adapter and client
    adapter = new SQLiteAdapter({ filename: TEST_DB_PATH });
    await adapter.connect();

    // Create tables
    await adapter.execute(`
      CREATE TABLE user (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        username TEXT UNIQUE NOT NULL,
        name TEXT
      )
    `);

    await adapter.execute(`
      CREATE TABLE post (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        content TEXT,
        author_id INTEGER NOT NULL,
        FOREIGN KEY (author_id) REFERENCES user(id),
        UNIQUE (title, author_id)
      )
    `);

    await adapter.execute(`
      CREATE TABLE profile (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        platform TEXT NOT NULL,
        handle TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES user(id),
        UNIQUE (platform, user_id)
      )
    `);

    await adapter.execute(`
      CREATE TABLE category (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        parent_id INTEGER,
        UNIQUE (name, parent_id)
      )
    `);

    prisma = new DrismifyClient({
      adapter: 'sqlite',
      datasources: {
        db: { url: `file:${TEST_DB_PATH}` }
      }
    });
  });

  afterAll(async () => {
    await adapter.disconnect();
    
    // Clean up test files
    [TEST_DB_PATH, TEST_SCHEMA_PATH, TEST_SCHEMA_OUTPUT_PATH].forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
  });

  describe('Single-field unique constraints', () => {
    it('should enforce unique email constraint', async () => {
      // Create first user
      await adapter.execute(
        'INSERT INTO user (email, username, name) VALUES (?, ?, ?)',
        ['test@example.com', 'testuser1', 'Test User 1']
      );

      // Try to create second user with same email
      try {
        await adapter.execute(
          'INSERT INTO user (email, username, name) VALUES (?, ?, ?)',
          ['test@example.com', 'testuser2', 'Test User 2']
        );
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeDefined();
        expect(String(error)).toContain('UNIQUE constraint failed');
      }
    });

    it('should enforce unique username constraint', async () => {
      // Try to create user with same username
      try {
        await adapter.execute(
          'INSERT INTO user (email, username, name) VALUES (?, ?, ?)',
          ['test2@example.com', 'testuser1', 'Test User 2']
        );
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeDefined();
        expect(String(error)).toContain('UNIQUE constraint failed');
      }
    });

    it('should allow different email and username combinations', async () => {
      // This should succeed
      await adapter.execute(
        'INSERT INTO user (email, username, name) VALUES (?, ?, ?)',
        ['test2@example.com', 'testuser2', 'Test User 2']
      );

      const users = await adapter.execute('SELECT * FROM user');
      expect(users.data).toHaveLength(2);
    });
  });

  describe('Multi-field unique constraints', () => {
    it('should enforce unique [title, authorId] constraint on posts', async () => {
      // Create a post
      await adapter.execute(
        'INSERT INTO post (title, slug, content, author_id) VALUES (?, ?, ?, ?)',
        ['My First Post', 'my-first-post', 'Content here', 1]
      );

      // Try to create another post with same title and author
      try {
        await adapter.execute(
          'INSERT INTO post (title, slug, content, author_id) VALUES (?, ?, ?, ?)',
          ['My First Post', 'my-first-post-2', 'Different content', 1]
        );
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeDefined();
        expect(String(error)).toContain('UNIQUE constraint failed');
      }
    });

    it('should allow same title with different author', async () => {
      // This should succeed - same title but different author
      await adapter.execute(
        'INSERT INTO post (title, slug, content, author_id) VALUES (?, ?, ?, ?)',
        ['My First Post', 'my-first-post-author2', 'Content by author 2', 2]
      );

      const posts = await adapter.execute('SELECT * FROM post');
      expect(posts.data).toHaveLength(2);
    });

    it('should enforce unique [platform, userId] constraint on profiles', async () => {
      // Create a profile
      await adapter.execute(
        'INSERT INTO profile (platform, handle, user_id) VALUES (?, ?, ?)',
        ['twitter', '@testuser1', 1]
      );

      // Try to create another profile for same user on same platform
      try {
        await adapter.execute(
          'INSERT INTO profile (platform, handle, user_id) VALUES (?, ?, ?)',
          ['twitter', '@testuser1_alt', 1]
        );
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeDefined();
        expect(String(error)).toContain('UNIQUE constraint failed');
      }
    });

    it('should allow same user on different platforms', async () => {
      // This should succeed - same user but different platform
      await adapter.execute(
        'INSERT INTO profile (platform, handle, user_id) VALUES (?, ?, ?)',
        ['github', 'testuser1', 1]
      );

      const profiles = await adapter.execute('SELECT * FROM profile');
      expect(profiles.data).toHaveLength(2);
    });

    it('should allow different users on same platform', async () => {
      // This should succeed - different user but same platform
      await adapter.execute(
        'INSERT INTO profile (platform, handle, user_id) VALUES (?, ?, ?)',
        ['twitter', '@testuser2', 2]
      );

      const profiles = await adapter.execute('SELECT * FROM profile');
      expect(profiles.data).toHaveLength(3);
    });
  });

  describe('Unique constraints with NULL values', () => {
    it('should handle NULL values in multi-field unique constraints', async () => {
      // Create categories with NULL parent_id
      await adapter.execute(
        'INSERT INTO category (name, parent_id) VALUES (?, ?)',
        ['Technology', null]
      );

      await adapter.execute(
        'INSERT INTO category (name, parent_id) VALUES (?, ?)',
        ['Science', null]
      );

      // In SQLite, NULL values are treated as unique, so this should actually succeed
      // This is different from some other databases where NULL != NULL
      await adapter.execute(
        'INSERT INTO category (name, parent_id) VALUES (?, ?)',
        ['Technology', null]
      );

      const categories = await adapter.execute('SELECT * FROM category WHERE name = ?', ['Technology']);
      expect(categories.data).toHaveLength(2); // Two "Technology" categories with NULL parent
    });

    it('should allow same name with different parent_id', async () => {
      // Create a parent category
      await adapter.execute(
        'INSERT INTO category (name, parent_id) VALUES (?, ?)',
        ['Programming', 1] // Technology as parent
      );

      // This should succeed - same name but different parent
      await adapter.execute(
        'INSERT INTO category (name, parent_id) VALUES (?, ?)',
        ['Programming', 2] // Science as parent
      );

      const categories = await adapter.execute('SELECT * FROM category');
      expect(categories.data).toHaveLength(5); // Updated count: Technology(2), Science(1), Programming(2)
    });
  });
});
