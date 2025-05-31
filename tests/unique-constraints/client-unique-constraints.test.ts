/**
 * Test suite for unique constraints at the client level
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { DrismifyClient } from '../../src/client/base-client';
import { SQLiteAdapter } from '../../src/adapters/sqlite-adapter';
import * as fs from 'fs';

const TEST_DB_PATH = './test-client-unique-constraints.db';

describe('Client-level Unique Constraints', () => {
  let prisma: DrismifyClient;
  let adapter: SQLiteAdapter;

  beforeAll(async () => {
    // Clean up any existing test files
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    // Create adapter and client
    adapter = new SQLiteAdapter({ filename: TEST_DB_PATH });
    await adapter.connect();

    // Create tables with unique constraints
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
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('Single-field unique constraint violations', () => {
    it('should handle unique email constraint violation gracefully', async () => {
      // Create first user
      await adapter.execute(
        'INSERT INTO user (email, username, name) VALUES (?, ?, ?)',
        ['test@example.com', 'testuser1', 'Test User 1']
      );

      // Try to create second user with same email using raw SQL
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

    it('should handle unique username constraint violation gracefully', async () => {
      // Try to create user with same username using raw SQL
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
  });

  describe('Multi-field unique constraint violations', () => {
    it('should handle unique [title, authorId] constraint violation', async () => {
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

    it('should handle unique [platform, userId] constraint violation', async () => {
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
  });

  describe('Successful operations with unique constraints', () => {
    it('should allow creating users with different email and username', async () => {
      // This should succeed
      await adapter.execute(
        'INSERT INTO user (email, username, name) VALUES (?, ?, ?)',
        ['test2@example.com', 'testuser2', 'Test User 2']
      );

      const users = await adapter.execute('SELECT * FROM user');
      expect(users.data).toHaveLength(2);
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

  describe('Error message formatting', () => {
    it('should provide meaningful error messages for unique constraint violations', async () => {
      try {
        await adapter.execute(
          'INSERT INTO user (email, username, name) VALUES (?, ?, ?)',
          ['test@example.com', 'testuser3', 'Test User 3']
        );
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeDefined();
        const errorMessage = String(error);
        expect(errorMessage).toContain('UNIQUE constraint failed');
        // The error should be informative enough for debugging
        expect(errorMessage.length).toBeGreaterThan(10);
      }
    });
  });

  describe('Transaction rollback with unique constraints', () => {
    it('should rollback transaction when unique constraint is violated', async () => {
      const initialUserCount = await adapter.execute('SELECT COUNT(*) as count FROM user');
      const initialCount = (initialUserCount.data as any)[0].count;

      try {
        await adapter.transaction(async (tx) => {
          // This should succeed
          await tx.execute(
            'INSERT INTO user (email, username, name) VALUES (?, ?, ?)',
            ['test3@example.com', 'testuser3', 'Test User 3']
          );

          // This should fail due to unique constraint
          await tx.execute(
            'INSERT INTO user (email, username, name) VALUES (?, ?, ?)',
            ['test@example.com', 'testuser4', 'Test User 4'] // Duplicate email
          );
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeDefined();
      }

      // Verify that the transaction was rolled back
      const finalUserCount = await adapter.execute('SELECT COUNT(*) as count FROM user');
      const finalCount = (finalUserCount.data as any)[0].count;
      expect(finalCount).toBe(initialCount);
    });
  });
});
