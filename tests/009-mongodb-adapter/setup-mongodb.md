# MongoDB Test Setup Guide

This guide helps you set up MongoDB for running the Drismify MongoDB adapter tests.

## Prerequisites

- Docker (recommended) or MongoDB installed locally
- Node.js/Bun runtime

## Option 1: Using Docker (Recommended)

### 1. Start MongoDB with Docker

```bash
# Start MongoDB with authentication
docker run -d \
  --name drismify-mongodb-test \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=root \
  -e MONGO_INITDB_ROOT_PASSWORD=000000 \
  mongo:latest

# Wait for MongoDB to start (about 10-15 seconds)
sleep 15

# Verify connection
docker exec drismify-mongodb-test mongosh --username root --password 000000 --authenticationDatabase admin --eval "db.adminCommand('ping')"
```

### 2. Run the tests

```bash
# From the project root
bun test tests/009-mongodb-adapter/mongodb-adapter.test.ts
```

### 3. Stop and clean up

```bash
# Stop and remove the container
docker stop drismify-mongodb-test
docker rm drismify-mongodb-test
```

## Option 2: Local MongoDB Installation

### 1. Install MongoDB

**macOS (using Homebrew):**
```bash
brew tap mongodb/brew
brew install mongodb-community
```

**Ubuntu/Debian:**
```bash
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
```

**Windows:**
Download and install from [MongoDB Download Center](https://www.mongodb.com/try/download/community)

### 2. Configure Authentication

Start MongoDB and create the root user:

```bash
# Start MongoDB without authentication
mongod --dbpath /path/to/your/data/directory

# In another terminal, connect and create user
mongosh
```

In the MongoDB shell:
```javascript
use admin
db.createUser({
  user: "root",
  pwd: "000000",
  roles: ["root"]
})
exit
```

### 3. Start MongoDB with Authentication

```bash
# Stop the previous instance and restart with auth
mongod --dbpath /path/to/your/data/directory --auth
```

### 4. Run the tests

```bash
# From the project root
bun test tests/009-mongodb-adapter/mongodb-adapter.test.ts
```

## Configuration

MongoDB connection details are now hardcoded in `src/config/mongodb.config.ts`. The configuration includes:

- **Test Environment**: `mongodb://root:000000@localhost:37017` (database: `drismify_test`)
- **Production Environment**: `mongodb://root:000000@localhost:27017` (database: `drismify_production`)
- **Example Environment**: `mongodb://root:000000@localhost:37017` (database: `drismify_example`)

To modify connection settings, edit the configuration file directly:

```typescript
// src/config/mongodb.config.ts
export const DEFAULT_MONGODB_CONFIG: MongoDBConfig = {
  url: 'mongodb://root:000000@localhost:37017',
  database: 'drismify_test',
  user: 'root',
  password: '000000',
  authSource: 'admin',
  port: 37017,
  host: 'localhost'
};
```

## Test Database

The tests use a database called `drismify_test` which will be automatically created and cleaned up during testing.

## Troubleshooting

### Connection Issues

1. **Authentication Failed**: Make sure the username is `root` and password is `000000`
2. **Connection Refused**: Ensure MongoDB is running on port 27017
3. **Permission Denied**: Check that the MongoDB user has the correct permissions

### Docker Issues

1. **Port Already in Use**: Stop any existing MongoDB instances or use a different port
2. **Container Won't Start**: Check Docker logs with `docker logs drismify-mongodb-test`

### Test Failures

1. **Timeout Errors**: Increase the timeout in test configuration
2. **Permission Errors**: Ensure the test user has admin privileges
3. **Database Not Found**: The test will create the database automatically

## Test Coverage

The MongoDB adapter tests cover:

- ✅ Connection management
- ✅ Basic CRUD operations
- ✅ Bulk operations
- ✅ Complex queries and aggregation
- ✅ Transaction support
- ✅ Error handling
- ✅ Schema introspection
- ✅ Index management
- ✅ Performance testing
- ✅ Unicode and special characters
- ✅ Nested document operations

## Performance Expectations

The tests include performance benchmarks:
- Batch insert of 100 documents: < 5 seconds
- Batch update of 100 documents: < 3 seconds
- Complex queries: < 1 second

If tests are failing due to performance, check your MongoDB configuration and system resources.
