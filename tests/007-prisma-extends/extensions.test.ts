/**
 * Tests for Prisma Extends Support
 */

import { test, expect, beforeAll, afterAll } from 'bun:test';
import type { Extension } from '../../src/extensions/types';
import { applyExtension, defineExtension, createComputedField } from '../../src/extensions';
import { createTestDatabase, cleanupTestFiles } from '../utils/test-utils';
import { clearAdapterInstances } from '../../src/adapters';

// Test database path
let dbPath: string;

// Setup before all tests
beforeAll(() => {
  // Create test database
  dbPath = createTestDatabase();
});

// Cleanup after all tests
afterAll(() => {
  clearAdapterInstances();
  cleanupTestFiles();
});

// Test basic extension functionality with a minimal client
test("Basic Extension Functionality", () => {
  // Create a simple mock client with the correct model name (User, not user)
  const mockClient = {
    User: {
      $name: 'User',
      findMany: () => [
        { id: 1, name: 'Test User', email: 'test@example.com' }
      ]
    }
  };
  
  // Define a simple extension that adds a method to the User model
  const extension = defineExtension({
    name: 'TestExtension',
    model: {
      User: {
        findByEmail: function(email: string) {
          // Use the existing findMany method
          const users = this.findMany();
          return users.find(user => user.email === email);
        }
      }
    }
  });
  
  // Apply the extension manually
  const extendedClient = applyExtension(mockClient, extension);
  
  // Verify the extension was applied correctly
  expect(typeof extendedClient.User.findByEmail).toBe('function');
  
  // Test the extended functionality
  const user = extendedClient.User.findByEmail('test@example.com');
  expect(user).toEqual({ id: 1, name: 'Test User', email: 'test@example.com' });
});

// Test with $allModels extension
test("AllModels Extension", () => {
  // Create a client with multiple models
  const mockClient = {
    User: {
      $name: 'User',
      findMany: () => [
        { id: 1, name: 'Test User', email: 'test@example.com' },
        { id: 2, name: 'Another User', email: 'another@example.com' }
      ]
    },
    Post: {
      $name: 'Post',
      findMany: () => [
        { id: 1, title: 'Test Post', content: 'Test content' },
        { id: 2, title: 'Another Post', content: 'More content' }
      ]
    }
  };
  
  // Define an extension with $allModels
  const extension = defineExtension({
    name: 'AllModelsExtension',
    model: {
      $allModels: {
        count: function() {
          const results = this.findMany();
          return results.length;
        }
      }
    }
  });
  
  // Apply the extension
  const extendedClient = applyExtension(mockClient, extension);
  
  // Test that the extension was applied to all models
  expect(typeof extendedClient.User.count).toBe('function');
  expect(typeof extendedClient.Post.count).toBe('function');
  
  // Test the functionality
  expect(extendedClient.User.count()).toBe(2);
  expect(extendedClient.Post.count()).toBe(2);
});

// Test result extensions
test("Result Extensions", async () => {
  // Create a simple mock client with async methods
  // This is important because applyResultExtension wraps methods with async functions
  const mockClient = {
    User: {
      $name: 'User',
      async findMany() {
        return [
          { id: 1, name: 'Test User', email: 'test@example.com' }
        ];
      },
      async findUnique() {
        return { id: 1, name: 'Test User', email: 'test@example.com' };
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
  const extendedClient = applyExtension(mockClient, extension);
  
  // Test the result extension - must await since the wrapped method is async
  const user = await extendedClient.User.findUnique();
  expect(user.fullName).toBe('Test User (Full)');
  expect(user.initials).toBe('TU');
});

// Test with asynchronous methods
test("Asynchronous Methods", async () => {
  // Create a client with async methods
  const mockClient = {
    User: {
      $name: 'User',
      findMany: async () => [
        { id: 1, name: 'Test User', email: 'test@example.com' },
        { id: 2, name: 'Another User', email: 'another@example.com' }
      ]
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
  const extendedClient = applyExtension(mockClient, extension);
  
  // Test the async extension methods
  const user = await extendedClient.User.findByEmail('test@example.com');
  expect(user).toEqual({ id: 1, name: 'Test User', email: 'test@example.com' });
  
  const count = await extendedClient.User.count();
  expect(count).toBe(2);
});

// Test with multiple extensions
test("Multiple Extensions", async () => {
  // Create a client
  const mockClient = {
    User: {
      $name: 'User',
      findMany: async () => [
        { id: 1, name: 'Test User', email: 'test@example.com' }
      ],
      findUnique: async () => ({ id: 1, name: 'Test User', email: 'test@example.com' })
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
    applyExtension(mockClient, modelExtension),
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
  // Create a class-based client
  class TestClient {
    User = {
      $name: 'User',
      findMany: async () => [
        { id: 1, name: 'Test User', email: 'test@example.com' }
      ]
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
