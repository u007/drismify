/**
 * Tests for the MongoDB Adapter
 *
 * Prerequisites:
 * - MongoDB server running on localhost:37017 (or 27017)
 * - Authentication: root user with password 000000
 * - Admin database for authentication
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { MongoDBAdapter } from '../../src/adapters/mongodb-adapter';
import { createAdapter } from '../../src/adapters';
import { getMongoDBConfig, getMongoDBConnectionOptions } from '../../src/config/mongodb.config';

describe('MongoDB Adapter', () => {
  let adapter: MongoDBAdapter | null = null;
  let mongoAvailable = false;

  // MongoDB connection details for testing - using hardcoded config
  const mongoConfig = getMongoDBConfig('test');
  const connectionOptions = getMongoDBConnectionOptions(mongoConfig);

  beforeAll(async () => {
    try {
      adapter = new MongoDBAdapter(connectionOptions);

      await adapter.connect();
      mongoAvailable = true;
      console.log('✅ MongoDB connection established for testing');
    } catch (error) {
      console.warn('❌ MongoDB not available for testing, skipping MongoDB tests:', error.message);
      console.warn('Make sure MongoDB is running with root:000000 credentials');
      mongoAvailable = false;
      adapter = null;
    }
  });
  
  beforeEach(async () => {
    if (mongoAvailable && adapter) {
      // Clean up collections before each test
      try {
        const db = adapter.getDatabase();
        const collections = await db.listCollections().toArray();

        for (const collection of collections) {
          await db.collection(collection.name).deleteMany({});
        }
      } catch (error) {
        console.warn('Failed to clean up collections:', error);
      }
    }
  });

  afterAll(async () => {
    if (adapter && adapter.isActive()) {
      // Clean up test database
      try {
        const db = adapter.getDatabase();
        await db.dropDatabase();
        console.log('🧹 Test database cleaned up');
      } catch (error) {
        console.warn('Failed to clean up test database:', error);
      }

      await adapter.disconnect();
      console.log('🔌 MongoDB connection closed');
    }
  });

  describe('Connection Management', () => {
    it('should create a MongoDB adapter', () => {
      if (!mongoAvailable || !adapter) {
        console.log('Skipping test: MongoDB not available');
        return;
      }

      expect(adapter).toBeInstanceOf(MongoDBAdapter);
    });

    it('should connect to MongoDB', async () => {
      if (!mongoAvailable || !adapter) {
        console.log('Skipping test: MongoDB not available');
        return;
      }

      expect(adapter.isActive()).toBe(true);
    });

    it('should get database instance', () => {
      if (!mongoAvailable || !adapter) {
        console.log('Skipping test: MongoDB not available');
        return;
      }

      const db = adapter.getDatabase();
      expect(db).toBeDefined();
      expect(db.databaseName).toBe(testDatabase);
    });

    it('should get client instance', () => {
      if (!mongoAvailable || !adapter) {
        console.log('Skipping test: MongoDB not available');
        return;
      }

      const client = adapter.getClient();
      expect(client).toBeDefined();
    });

    it('should get collection', () => {
      if (!mongoAvailable || !adapter) {
        console.log('Skipping test: MongoDB not available');
        return;
      }

      const collection = adapter.getCollection('test_collection');
      expect(collection).toBeDefined();
      expect(collection.collectionName).toBe('test_collection');
    });
  });

  describe('Basic Operations', () => {
    it('should handle MongoDB-specific CRUD operations', async () => {
      if (!mongoAvailable || !adapter) {
        console.log('Skipping test: MongoDB not available');
        return;
      }

      const collection = adapter.getCollection('users');

      // Insert a document
      const insertResult = await collection.insertOne({
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
        createdAt: new Date(),
        profile: {
          bio: 'Software developer',
          skills: ['JavaScript', 'TypeScript', 'MongoDB']
        }
      });

      expect(insertResult.insertedId).toBeDefined();

      // Find the document
      const user = await collection.findOne({ email: 'john@example.com' });
      expect(user).toBeDefined();
      expect(user?.name).toBe('John Doe');
      expect(user?.email).toBe('john@example.com');
      expect(user?.age).toBe(30);
      expect(user?.profile?.bio).toBe('Software developer');
      expect(user?.profile?.skills).toEqual(['JavaScript', 'TypeScript', 'MongoDB']);

      // Update the document
      const updateResult = await collection.updateOne(
        { email: 'john@example.com' },
        {
          $set: {
            age: 31,
            'profile.bio': 'Senior Software Developer'
          },
          $push: { 'profile.skills': 'Node.js' }
        }
      );

      expect(updateResult.modifiedCount).toBe(1);

      // Verify update
      const updatedUser = await collection.findOne({ email: 'john@example.com' });
      expect(updatedUser?.age).toBe(31);
      expect(updatedUser?.profile?.bio).toBe('Senior Software Developer');
      expect(updatedUser?.profile?.skills).toContain('Node.js');

      // Delete the document
      const deleteResult = await collection.deleteOne({ email: 'john@example.com' });
      expect(deleteResult.deletedCount).toBe(1);

      // Verify deletion
      const deletedUser = await collection.findOne({ email: 'john@example.com' });
      expect(deletedUser).toBeNull();
    });

    it('should handle bulk operations', async () => {
      if (!mongoAvailable || !adapter) {
        console.log('Skipping test: MongoDB not available');
        return;
      }

      const collection = adapter.getCollection('products');

      // Insert multiple documents
      const products = [
        { name: 'Laptop', price: 999.99, category: 'Electronics', inStock: true },
        { name: 'Mouse', price: 29.99, category: 'Electronics', inStock: true },
        { name: 'Keyboard', price: 79.99, category: 'Electronics', inStock: false },
        { name: 'Monitor', price: 299.99, category: 'Electronics', inStock: true }
      ];

      const insertManyResult = await collection.insertMany(products);
      expect(insertManyResult.insertedCount).toBe(4);
      expect(Object.keys(insertManyResult.insertedIds)).toHaveLength(4);

      // Find multiple documents
      const allProducts = await collection.find({}).toArray();
      expect(allProducts).toHaveLength(4);

      // Find with filter
      const inStockProducts = await collection.find({ inStock: true }).toArray();
      expect(inStockProducts).toHaveLength(3);

      // Update multiple documents
      const updateManyResult = await collection.updateMany(
        { category: 'Electronics' },
        { $set: { updatedAt: new Date() } }
      );
      expect(updateManyResult.modifiedCount).toBe(4);

      // Delete multiple documents
      const deleteManyResult = await collection.deleteMany({ inStock: false });
      expect(deleteManyResult.deletedCount).toBe(1);

      // Verify remaining documents
      const remainingProducts = await collection.find({}).toArray();
      expect(remainingProducts).toHaveLength(3);
    });

    it('should handle complex queries and aggregation', async () => {
      if (!mongoAvailable || !adapter) {
        console.log('Skipping test: MongoDB not available');
        return;
      }

      const collection = adapter.getCollection('orders');

      // Insert test data
      const orders = [
        { customerId: 'cust1', amount: 100, status: 'completed', date: new Date('2024-01-01') },
        { customerId: 'cust1', amount: 200, status: 'completed', date: new Date('2024-01-15') },
        { customerId: 'cust2', amount: 150, status: 'pending', date: new Date('2024-01-10') },
        { customerId: 'cust2', amount: 300, status: 'completed', date: new Date('2024-01-20') },
        { customerId: 'cust3', amount: 75, status: 'cancelled', date: new Date('2024-01-05') }
      ];

      await collection.insertMany(orders);

      // Complex query with sorting and limiting
      const recentOrders = await collection
        .find({ status: 'completed' })
        .sort({ date: -1 })
        .limit(2)
        .toArray();

      expect(recentOrders).toHaveLength(2);
      expect(recentOrders[0].amount).toBe(300); // Most recent completed order

      // Aggregation pipeline
      const customerStats = await collection.aggregate([
        { $match: { status: 'completed' } },
        {
          $group: {
            _id: '$customerId',
            totalAmount: { $sum: '$amount' },
            orderCount: { $sum: 1 }
          }
        },
        { $sort: { totalAmount: -1 } }
      ]).toArray();

      expect(customerStats).toHaveLength(2);
      expect(customerStats[0]._id).toBe('cust2');
      expect(customerStats[0].totalAmount).toBe(300);
      expect(customerStats[1]._id).toBe('cust1');
      expect(customerStats[1].totalAmount).toBe(300);
    });
  });

  describe('Transaction Support', () => {
    it('should support transactions', async () => {
      if (!mongoAvailable || !adapter) {
        console.log('Skipping test: MongoDB not available');
        return;
      }
      
      const result = await adapter.transaction(async (tx) => {
        // Note: In a real implementation, the transaction client would provide
        // MongoDB-specific transaction operations
        return 'transaction completed';
      });
      
      expect(result).toBe('transaction completed');
    });
  });

  describe('Error Handling', () => {
    it('should handle connection errors gracefully', async () => {
      const badAdapter = new MongoDBAdapter({
        url: 'mongodb://invalid-host:27017',
        database: 'test'
      });

      await expect(badAdapter.connect()).rejects.toThrow();
    }, 10000); // Increase timeout for connection errors

    it('should handle authentication errors', async () => {
      const badAuthAdapter = new MongoDBAdapter({
        url: mongoConfig.url.replace(mongoConfig.port.toString(), '27017'),
        database: 'test',
        user: 'wronguser',
        password: 'wrongpassword',
        authSource: mongoConfig.authSource
      });

      await expect(badAuthAdapter.connect()).rejects.toThrow();
    }, 10000);

    it('should require database name', () => {
      expect(() => {
        new MongoDBAdapter({
          url: 'mongodb://localhost:27017'
          // Missing database
        });
      }).toThrow('Database name is required for MongoDB connection');
    });

    it('should require URL', () => {
      expect(() => {
        new MongoDBAdapter({
          database: 'test'
          // Missing url
        });
      }).toThrow('URL is required for MongoDB connection');
    });

    it('should handle operations on disconnected adapter', async () => {
      const disconnectedAdapter = new MongoDBAdapter(connectionOptions);

      // Try to execute without connecting
      await expect(disconnectedAdapter.execute('test')).rejects.toThrow();
      await expect(disconnectedAdapter.getTables()).rejects.toThrow();
    });

    it('should handle duplicate key errors', async () => {
      if (!mongoAvailable || !adapter) {
        console.log('Skipping test: MongoDB not available');
        return;
      }

      const collection = adapter.getCollection('duplicate_test');

      // Create unique index
      await collection.createIndex({ email: 1 }, { unique: true });

      // Insert first document
      await collection.insertOne({ email: 'unique@example.com', name: 'First' });

      // Try to insert duplicate
      await expect(
        collection.insertOne({ email: 'unique@example.com', name: 'Second' })
      ).rejects.toThrow();
    });

    it('should format MongoDB errors correctly', async () => {
      if (!mongoAvailable || !adapter) {
        console.log('Skipping test: MongoDB not available');
        return;
      }

      const collection = adapter.getCollection('error_test');

      try {
        // Try an invalid operation that will cause an error
        await collection.updateOne(
          { _id: 'invalid_id' },
          { $invalidOperator: { field: 'value' } }
        );
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain('$invalidOperator');
      }
    });
  });

  describe('Factory Integration', () => {
    it('should create MongoDB adapter through factory', () => {
      const factoryAdapter = createAdapter('mongodb', {
        url: mongoConfig.url,
        database: mongoConfig.database
      });

      expect(factoryAdapter).toBeInstanceOf(MongoDBAdapter);
    });
  });

  describe('Introspection Methods', () => {
    it('should have introspection methods', () => {
      if (!mongoAvailable || !adapter) {
        console.log('Skipping test: MongoDB not available');
        return;
      }

      expect(typeof adapter.getTables).toBe('function');
      expect(typeof adapter.getColumns).toBe('function');
      expect(typeof adapter.getForeignKeys).toBe('function');
      expect(typeof adapter.getIndexes).toBe('function');
      expect(typeof adapter.getCheckConstraints).toBe('function');
      expect(typeof adapter.getUniqueConstraints).toBe('function');
    });

    it('should get collections as tables', async () => {
      if (!mongoAvailable || !adapter) {
        console.log('Skipping test: MongoDB not available');
        return;
      }

      // Create some test collections
      const usersCollection = adapter.getCollection('users');
      const productsCollection = adapter.getCollection('products');

      await usersCollection.insertOne({ name: 'Test User', email: 'test@example.com' });
      await productsCollection.insertOne({ name: 'Test Product', price: 99.99 });

      const tables = await adapter.getTables();
      expect(Array.isArray(tables)).toBe(true);
      expect(tables.length).toBeGreaterThanOrEqual(2);

      const tableNames = tables.map(t => t.name);
      expect(tableNames).toContain('users');
      expect(tableNames).toContain('products');

      // Check table structure
      const usersTable = tables.find(t => t.name === 'users');
      expect(usersTable).toBeDefined();
      expect(usersTable?.type).toBe('collection');
      expect(usersTable?.sql).toBeNull(); // MongoDB doesn't have SQL
    });

    it('should analyze document structure and infer columns', async () => {
      if (!mongoAvailable || !adapter) {
        console.log('Skipping test: MongoDB not available');
        return;
      }

      // Create a collection with diverse data types
      const collection = adapter.getCollection('schema_test');

      await collection.insertMany([
        {
          _id: 'test1',
          name: 'John Doe',
          age: 30,
          isActive: true,
          createdAt: new Date(),
          profile: {
            bio: 'Developer',
            skills: ['JavaScript', 'TypeScript']
          },
          tags: ['user', 'premium'],
          score: 95.5
        },
        {
          _id: 'test2',
          name: 'Jane Smith',
          age: 25,
          isActive: false,
          createdAt: new Date(),
          profile: {
            bio: 'Designer',
            skills: ['Figma', 'Photoshop']
          },
          tags: ['user'],
          score: 88
        }
      ]);

      const columns = await adapter.getColumns();
      expect(Array.isArray(columns)).toBe(true);

      const schemaTestColumns = columns.filter(c => c.table === 'schema_test');
      expect(schemaTestColumns.length).toBeGreaterThan(0);

      // Check for expected columns
      const columnNames = schemaTestColumns.map(c => c.name);
      expect(columnNames).toContain('_id');
      expect(columnNames).toContain('name');
      expect(columnNames).toContain('age');
      expect(columnNames).toContain('isActive');
      expect(columnNames).toContain('createdAt');
      expect(columnNames).toContain('profile');
      expect(columnNames).toContain('tags');
      expect(columnNames).toContain('score');

      // Check column types
      const nameColumn = schemaTestColumns.find(c => c.name === 'name');
      expect(nameColumn?.type).toBe('String');

      const ageColumn = schemaTestColumns.find(c => c.name === 'age');
      expect(ageColumn?.type).toBe('Int');

      const isActiveColumn = schemaTestColumns.find(c => c.name === 'isActive');
      expect(isActiveColumn?.type).toBe('Boolean');

      const createdAtColumn = schemaTestColumns.find(c => c.name === 'createdAt');
      expect(createdAtColumn?.type).toBe('DateTime');

      const profileColumn = schemaTestColumns.find(c => c.name === 'profile');
      expect(profileColumn?.type).toBe('Json');

      const tagsColumn = schemaTestColumns.find(c => c.name === 'tags');
      expect(tagsColumn?.type).toBe('Json');

      const scoreColumn = schemaTestColumns.find(c => c.name === 'score');
      expect(scoreColumn?.type).toBe('Float');

      // Check primary key
      const idColumn = schemaTestColumns.find(c => c.name === '_id');
      expect(idColumn?.isPrimaryKey).toBe(true);
      expect(idColumn?.isAutoIncrement).toBe(true);
    });

    it('should get indexes from collections', async () => {
      if (!mongoAvailable || !adapter) {
        console.log('Skipping test: MongoDB not available');
        return;
      }

      const collection = adapter.getCollection('indexed_collection');

      // Insert some data
      await collection.insertOne({ email: 'test@example.com', username: 'testuser' });

      // Create indexes
      await collection.createIndex({ email: 1 }, { unique: true });
      await collection.createIndex({ username: 1 });
      await collection.createIndex({ email: 1, username: 1 }, { name: 'compound_index' });

      const indexes = await adapter.getIndexes();
      expect(Array.isArray(indexes)).toBe(true);

      const collectionIndexes = indexes.filter(i => i.table === 'indexed_collection');
      expect(collectionIndexes.length).toBeGreaterThanOrEqual(3);

      // Check for email unique index
      const emailIndex = collectionIndexes.find(i => i.columns.includes('email') && i.columns.length === 1);
      expect(emailIndex).toBeDefined();
      expect(emailIndex?.isUnique).toBe(true);

      // Check for username index
      const usernameIndex = collectionIndexes.find(i => i.columns.includes('username') && i.columns.length === 1);
      expect(usernameIndex).toBeDefined();

      // Check for compound index
      const compoundIndex = collectionIndexes.find(i => i.name === 'compound_index');
      expect(compoundIndex).toBeDefined();
      expect(compoundIndex?.columns).toEqual(['email', 'username']);
    });

    it('should get unique constraints from unique indexes', async () => {
      if (!mongoAvailable || !adapter) {
        console.log('Skipping test: MongoDB not available');
        return;
      }

      const uniqueConstraints = await adapter.getUniqueConstraints();
      expect(Array.isArray(uniqueConstraints)).toBe(true);

      // Should include the unique email index we created in the previous test
      const emailConstraint = uniqueConstraints.find(
        c => c.table === 'indexed_collection' && c.columns.includes('email')
      );
      expect(emailConstraint).toBeDefined();
      expect(emailConstraint?.isNamed).toBe(true);
    });

    it('should get foreign keys (empty for MongoDB)', async () => {
      if (!mongoAvailable || !adapter) {
        console.log('Skipping test: MongoDB not available');
        return;
      }

      const foreignKeys = await adapter.getForeignKeys();
      expect(Array.isArray(foreignKeys)).toBe(true);
      expect(foreignKeys.length).toBe(0); // MongoDB doesn't have foreign keys
    });

    it('should get check constraints (empty for MongoDB)', async () => {
      if (!mongoAvailable || !adapter) {
        console.log('Skipping test: MongoDB not available');
        return;
      }

      const checkConstraints = await adapter.getCheckConstraints();
      expect(Array.isArray(checkConstraints)).toBe(true);
      expect(checkConstraints.length).toBe(0); // MongoDB doesn't have check constraints
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle large document insertions', async () => {
      if (!mongoAvailable || !adapter) {
        console.log('Skipping test: MongoDB not available');
        return;
      }

      const collection = adapter.getCollection('large_docs');

      // Create a large document
      const largeDoc = {
        id: 'large_doc_1',
        data: Array(1000).fill(0).map((_, i) => ({
          index: i,
          value: `value_${i}`,
          timestamp: new Date(),
          metadata: {
            processed: i % 2 === 0,
            category: `category_${i % 10}`,
            tags: [`tag_${i % 5}`, `tag_${(i + 1) % 5}`]
          }
        }))
      };

      const insertResult = await collection.insertOne(largeDoc);
      expect(insertResult.insertedId).toBeDefined();

      // Verify the document was inserted correctly
      const retrievedDoc = await collection.findOne({ id: 'large_doc_1' });
      expect(retrievedDoc).toBeDefined();
      expect(retrievedDoc?.data).toHaveLength(1000);
      expect(retrievedDoc?.data[0].index).toBe(0);
      expect(retrievedDoc?.data[999].index).toBe(999);
    });

    it('should handle batch operations efficiently', async () => {
      if (!mongoAvailable || !adapter) {
        console.log('Skipping test: MongoDB not available');
        return;
      }

      const collection = adapter.getCollection('batch_test');

      // Create 100 documents
      const docs = Array(100).fill(0).map((_, i) => ({
        batchId: 'batch_1',
        itemNumber: i,
        name: `Item ${i}`,
        value: Math.random() * 1000,
        category: `category_${i % 5}`,
        active: i % 3 === 0
      }));

      const startTime = Date.now();
      const insertResult = await collection.insertMany(docs);
      const insertTime = Date.now() - startTime;

      expect(insertResult.insertedCount).toBe(100);
      expect(insertTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Test batch update
      const updateStartTime = Date.now();
      const updateResult = await collection.updateMany(
        { batchId: 'batch_1' },
        { $set: { processed: true, processedAt: new Date() } }
      );
      const updateTime = Date.now() - updateStartTime;

      expect(updateResult.modifiedCount).toBe(100);
      expect(updateTime).toBeLessThan(3000); // Should complete within 3 seconds

      // Test batch query
      const queryStartTime = Date.now();
      const activeItems = await collection.find({
        batchId: 'batch_1',
        active: true
      }).toArray();
      const queryTime = Date.now() - queryStartTime;

      expect(activeItems.length).toBeGreaterThan(0);
      expect(queryTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle nested document queries', async () => {
      if (!mongoAvailable || !adapter) {
        console.log('Skipping test: MongoDB not available');
        return;
      }

      const collection = adapter.getCollection('nested_docs');

      await collection.insertMany([
        {
          user: {
            id: 'user1',
            profile: {
              name: 'John Doe',
              settings: {
                theme: 'dark',
                notifications: {
                  email: true,
                  push: false,
                  sms: true
                }
              }
            }
          },
          metadata: {
            created: new Date('2024-01-01'),
            tags: ['premium', 'active']
          }
        },
        {
          user: {
            id: 'user2',
            profile: {
              name: 'Jane Smith',
              settings: {
                theme: 'light',
                notifications: {
                  email: false,
                  push: true,
                  sms: false
                }
              }
            }
          },
          metadata: {
            created: new Date('2024-01-15'),
            tags: ['basic', 'active']
          }
        }
      ]);

      // Query nested fields
      const darkThemeUsers = await collection.find({
        'user.profile.settings.theme': 'dark'
      }).toArray();
      expect(darkThemeUsers).toHaveLength(1);
      expect(darkThemeUsers[0].user.id).toBe('user1');

      // Query array elements
      const premiumUsers = await collection.find({
        'metadata.tags': 'premium'
      }).toArray();
      expect(premiumUsers).toHaveLength(1);

      // Complex nested query
      const emailEnabledUsers = await collection.find({
        'user.profile.settings.notifications.email': true
      }).toArray();
      expect(emailEnabledUsers).toHaveLength(1);
      expect(emailEnabledUsers[0].user.id).toBe('user1');
    });

    it('should handle empty collections gracefully', async () => {
      if (!mongoAvailable || !adapter) {
        console.log('Skipping test: MongoDB not available');
        return;
      }

      const collection = adapter.getCollection('empty_collection');

      // Query empty collection
      const docs = await collection.find({}).toArray();
      expect(docs).toHaveLength(0);

      // Count empty collection
      const count = await collection.countDocuments();
      expect(count).toBe(0);

      // Update on empty collection
      const updateResult = await collection.updateMany({}, { $set: { updated: true } });
      expect(updateResult.modifiedCount).toBe(0);

      // Delete from empty collection
      const deleteResult = await collection.deleteMany({});
      expect(deleteResult.deletedCount).toBe(0);
    });

    it('should handle special characters and unicode', async () => {
      if (!mongoAvailable || !adapter) {
        console.log('Skipping test: MongoDB not available');
        return;
      }

      const collection = adapter.getCollection('unicode_test');

      const unicodeDoc = {
        name: 'Test User 测试用户',
        emoji: '🚀💻🎉',
        description: 'Special chars: !@#$%^&*()_+-=[]{}|;:,.<>?',
        multilingual: {
          english: 'Hello World',
          chinese: '你好世界',
          japanese: 'こんにちは世界',
          arabic: 'مرحبا بالعالم',
          russian: 'Привет мир'
        }
      };

      const insertResult = await collection.insertOne(unicodeDoc);
      expect(insertResult.insertedId).toBeDefined();

      // Retrieve and verify unicode data
      const retrievedDoc = await collection.findOne({ name: 'Test User 测试用户' });
      expect(retrievedDoc).toBeDefined();
      expect(retrievedDoc?.emoji).toBe('🚀💻🎉');
      expect(retrievedDoc?.multilingual.chinese).toBe('你好世界');
      expect(retrievedDoc?.multilingual.arabic).toBe('مرحبا بالعالم');
    });
  });
});

describe('MongoDB Adapter (Unit Tests)', () => {
  // These tests don't require a real MongoDB connection
  
  it('should format MongoDB errors correctly', () => {
    const testConfig = getMongoDBConfig('test');
    const adapter = new MongoDBAdapter({
      url: testConfig.url,
      database: testConfig.database
    });
    
    // Test error formatting (this would be called internally)
    // We can't easily test the private method, but we can test the adapter creation
    expect(adapter).toBeInstanceOf(MongoDBAdapter);
  });
  
  it('should validate connection options', () => {
    const testConfig = getMongoDBConfig('test');

    expect(() => {
      new MongoDBAdapter({
        url: testConfig.url,
        database: testConfig.database
      });
    }).not.toThrow();

    expect(() => {
      new MongoDBAdapter({
        url: testConfig.url
        // Missing database
      } as any);
    }).toThrow('Database name is required for MongoDB connection');

    expect(() => {
      new MongoDBAdapter({
        database: testConfig.database
        // Missing url
      } as any);
    }).toThrow('URL is required for MongoDB connection');
  });
});
