// MongoDB initialization script for Drismify tests
// This script runs when the MongoDB container starts for the first time

// Switch to the test database
db = db.getSiblingDB('drismify_test');

// Create a test user with read/write access to the test database
db.createUser({
  user: 'drismify_test_user',
  pwd: 'test_password',
  roles: [
    {
      role: 'readWrite',
      db: 'drismify_test'
    }
  ]
});

// Create some initial collections with sample data for testing
db.createCollection('test_collection');

// Insert sample data
db.test_collection.insertMany([
  {
    name: 'Sample Document 1',
    type: 'test',
    createdAt: new Date(),
    metadata: {
      version: 1,
      tags: ['sample', 'test']
    }
  },
  {
    name: 'Sample Document 2',
    type: 'test',
    createdAt: new Date(),
    metadata: {
      version: 1,
      tags: ['sample', 'demo']
    }
  }
]);

// Create indexes for testing
db.test_collection.createIndex({ name: 1 });
db.test_collection.createIndex({ type: 1, 'metadata.version': 1 });

print('MongoDB initialization completed for Drismify tests');
