/**
 * Tests for Prisma Extends Support
 */

import { test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import type { Extension } from '../../src/extensions/types';
import { applyExtension, defineExtension, createComputedField } from '../../src/extensions';
import { createTestDatabase, cleanupTestFiles } from '../utils/test-utils';
import { clearAdapterInstances, createAdapter, type DatabaseAdapter } from '../../src/adapters';

// Test database path
let dbPath: string;
let adapter: DatabaseAdapter;

// Setup before all tests
beforeAll(() => {
  // Create test database
  dbPath = createTestDatabase();
  
  // Create adapter
  adapter = createAdapter('sqlite', { url: `file:${dbPath}` });
});

// Setup before each test
beforeEach(async () => {
  // Connect to the database
  await adapter.connect();
  
  // Create test tables
  await adapter.executeRaw(`
    CREATE TABLE IF NOT EXISTS User (
      id INTEGER PRIMARY KEY,
      name TEXT,
      email TEXT UNIQUE
    )
  `);
  
  await adapter.executeRaw(`
    CREATE TABLE IF NOT EXISTS Post (
      id INTEGER PRIMARY KEY,
      title TEXT,
      content TEXT,
      published BOOLEAN DEFAULT 0,
      authorId INTEGER,
      FOREIGN KEY (authorId) REFERENCES User(id)
    )
  `);
  
  // Insert test data
  await adapter.executeRaw(`
    INSERT OR REPLACE INTO User (id, name, email) VALUES (1, 'Test User', 'test@example.com')
  `);
  
  await adapter.executeRaw(`
    INSERT OR REPLACE INTO User (id, name, email) VALUES (2, 'Another User', 'another@example.com')
  `);
  
  await adapter.executeRaw(`
    INSERT OR REPLACE INTO Post (id, title, content, published, authorId) VALUES 
    (1, 'Test Post', 'Test content', 1, 1),
    (2, 'Another Post', 'More content', 1, 2)
  `);
});

// Cleanup after all tests
afterAll(async () => {
  // Disconnect from the database
  if (adapter) {
    await adapter.disconnect();
  }
  
  clearAdapterInstances();
  cleanupTestFiles();
});

// Test basic extension functionality with a real client
test("Basic Extension Functionality", async () => {
  // Create a real client with the database adapter
  const client = {
    User: {
      $name: 'User',
      async findMany() {
        const result = await adapter.executeRaw<{ id: number; name: string; email: string }>(`
          SELECT * FROM User
        `);
        return result.data;
      }
    }
  };
  
  // Define a simple extension that adds a method to the User model
  const extension = defineExtension({
    name: 'TestExtension',
    model: {
      User: {
        async findByEmail(email: string) {
          // Use the existing findMany method
          const users = await this.findMany();
          return users.find(user => user.email === email);
        }
      }
    }
  });
  
  // Apply the extension manually
  const extendedClient = applyExtension(client, extension);
  
  // Verify the extension was applied correctly
  expect(typeof extendedClient.User.findByEmail).toBe('function');
  
  // Test the extended functionality
  const user = await extendedClient.User.findByEmail('test@example.com');
  expect(user).toEqual({ id: 1, name: 'Test User', email: 'test@example.com' });
});

// Test with $allModels extension
test("AllModels Extension", async () => {
  // Create a client with multiple models using the actual database
  const client = {
    User: {
      $name: 'User',
      async findMany() {
        const result = await adapter.executeRaw<{ id: number; name: string; email: string }>(`
          SELECT * FROM User
        `);
        return result.data;
      }
    },
    Post: {
      $name: 'Post',
      async findMany() {
        const result = await adapter.executeRaw<{ id: number; title: string; content: string; published: boolean; authorId: number }>(`
          SELECT * FROM Post
        `);
        return result.data;
      }
    }
  };
  
  // Define an extension with $allModels
  const extension = defineExtension({
    name: 'AllModelsExtension',
    model: {
      $allModels: {
        async count() {
          const results = await this.findMany();
          return results.length;
        }
      }
    }
  });
  
  // Apply the extension
  const extendedClient = applyExtension(client, extension);
  
  // Test that the extension was applied to all models
  expect(typeof extendedClient.User.count).toBe('function');
  expect(typeof extendedClient.Post.count).toBe('function');
  
  // Test the functionality
  expect(await extendedClient.User.count()).toBe(2);
  expect(await extendedClient.Post.count()).toBe(2);
});

// Test result extensions
test("Result Extensions", async () => {
  // Create a client with async methods using the actual database
  const client = {
    User: {
      $name: 'User',
      async findMany() {
        const result = await adapter.executeRaw<{ id: number; name: string; email: string }>(`
          SELECT * FROM User
        `);
        return result.data;
      },
      async findUnique() {
        const result = await adapter.executeRaw<{ id: number; name: string; email: string }>(`
          SELECT * FROM User WHERE id = 1
        `);
        return result.data[0];
      }
    }
  };
  
  // Define a result extension
  const extension = defineExtension({
    name: 'ResultExtension',
    result: {
      User: {
        fullName: createComputedField({
          needs: ['name'],
          compute: (user) => `${user.name} (Full)`
        }),
        initials: createComputedField({
          needs: ['name'],
          compute: (user) => {
            const nameParts = user.name.split(' ');
            return nameParts.map(part => part.charAt(0).toUpperCase()).join('');
          }
        })
      }
    }
  });
  
  // Apply the extension
  const extendedClient = applyExtension(client, extension);
  
  // Test the result extension - must await since the wrapped method is async
  const user = await extendedClient.User.findUnique();
  expect(user.fullName).toBe('Test User (Full)');
  expect(user.initials).toBe('TU');
});

// Test with asynchronous methods
test("Asynchronous Methods", async () => {
  // Create a client with async methods using the actual database
  const client = {
    User: {
      $name: 'User',
      async findMany() {
        const result = await adapter.executeRaw<{ id: number; name: string; email: string }>(`
          SELECT * FROM User
        `);
        return result.data;
      }
    }
  };
  
  // Define an extension with async methods
  const extension = defineExtension({
    name: 'AsyncExtension',
    model: {
      User: {
        async findByEmail(email: string) {
          const users = await this.findMany();
          return users.find(user => user.email === email);
        },
        async count() {
          const users = await this.findMany();
          return users.length;
        }
      }
    }
  });
  
  // Apply the extension
  const extendedClient = applyExtension(client, extension);
  
  // Test the async extension methods
  const user = await extendedClient.User.findByEmail('test@example.com');
  expect(user).toEqual({ id: 1, name: 'Test User', email: 'test@example.com' });
  
  const count = await extendedClient.User.count();
  expect(count).toBe(2);
});

// Test with multiple extensions
test("Multiple Extensions", async () => {
  // Create a client using the actual database
  const client = {
    User: {
      $name: 'User',
      async findMany() {
        const result = await adapter.executeRaw<{ id: number; name: string; email: string }>(`
          SELECT * FROM User
        `);
        return result.data;
      },
      async findUnique() {
        const result = await adapter.executeRaw<{ id: number; name: string; email: string }>(`
          SELECT * FROM User WHERE id = 1
        `);
        return result.data[0];
      }
    }
  };
  
  // Define model extension
  const modelExtension = defineExtension({
    name: 'ModelExtension',
    model: {
      User: {
        async findByEmail(email: string) {
          const users = await this.findMany();
          return users.find(user => user.email === email);
        }
      }
    }
  });
  
  // Define result extension
  const resultExtension = defineExtension({
    name: 'ResultExtension',
    result: {
      User: {
        fullName: createComputedField({
          needs: ['name'],
          compute: (user) => `${user.name} (Full)`
        })
      }
    }
  });
  
  // Apply both extensions
  const extendedClient = applyExtension(
    applyExtension(client, modelExtension),
    resultExtension
  );
  
  // Test both extensions
  const user = await extendedClient.User.findByEmail('test@example.com');
  
  // Check the base properties
  expect(user).toMatchObject({
    id: 1,
    name: 'Test User',
    email: 'test@example.com'
  });
  
  // Check the computed property separately
  expect(user.fullName).toBe('Test User (Full)');
});

// Test with a class-based client that implements $extends
test("Class Client with $extends", async () => {
  // Create a class-based client using the actual database
  class TestClient {
    User = {
      $name: 'User',
      findMany: async () => {
        const result = await adapter.executeRaw<{ id: number; name: string; email: string }>(`
          SELECT * FROM User
        `);
        return result.data;
      }
    };
    
    $extends(extension: Extension) {
      return applyExtension(this, extension);
    }
  }
  
  const client = new TestClient();
  
  // Define an extension
  const extension = defineExtension({
    name: 'TestExtension',
    model: {
      User: {
        async findByEmail(email: string) {
          const users = await this.findMany();
          return users.find(user => user.email === email);
        }
      }
    }
  });
  
  // Apply the extension using the client's $extends method
  const extendedClient = client.$extends(extension);
  
  // Test the extension
  const user = await extendedClient.User.findByEmail('test@example.com');
  expect(user).toEqual({ id: 1, name: 'Test User', email: 'test@example.com' });
});
