
# Drismify

Drismify is a work-in-progress Prisma ORM replacement supporting TursoDB and SQLite with Prisma schema compatibility, CLI command support, and Prisma extends support. While the core functionality is implemented, several Prisma features are still pending implementation.

## Features

- **Prisma Schema Compatibility**: Use your existing Prisma schema files with limited feature set
- **SQLite and TursoDB Support**: Built-in support for SQLite and TursoDB databases (other databases pending)
- **Basic Prisma CLI Command Compatibility**: Use familiar Prisma CLI commands
- **Prisma Extends Support**: Extend your client with custom methods and behaviors
- **No Database Shadowing**: Direct database access without an intermediary layer
- **Schema Parser**: Parse Prisma schema files into an AST
- **Schema Translator**: Translate Prisma schema to Drizzle schema
- **Migration System**: Generate and apply migrations
- **Advanced Query Features**: Support for aggregation functions and JSON operations

## Installation

```bash
npm install drismify
# or
pnpm add drismify
# or
bun add drismify
```

## Quick Start

```typescript
// Import the client
import { PrismaClient } from './generated/client';

// Create a new client
const prisma = new PrismaClient();

// Connect to the database
await prisma.connect();

// Use the client
const users = await prisma.user.findMany();
console.log(users);

// Disconnect from the database
await prisma.disconnect();
```

## Prisma Extends Support

Drismify supports Prisma's `$extends` API, allowing you to extend the client with custom functionality:

### Adding a Custom Method to a Model

```typescript
const prisma = new PrismaClient().$extends({
  model: {
    user: {
      async signUp(email: string, name: string) {
        return this.create({
          data: {
            email,
            name
          }
        });
      }
    }
  }
});

// Use the extended client
const user = await prisma.user.signUp('john@example.com', 'John Doe');
```

### Adding a Method to All Models

```typescript
const prisma = new PrismaClient().$extends({
  model: {
    $allModels: {
      async exists(where: any) {
        const context = Drismify.getExtensionContext(this);
        const result = await context.findFirst({ where });
        return result !== null;
      }
    }
  }
});

// Use the extended client
const userExists = await prisma.user.exists({ email: 'john@example.com' });
```

### Adding a Client-Level Method

```typescript
const prisma = new PrismaClient().$extends({
  client: {
    async healthCheck() {
      try {
        await this.$executeRaw('SELECT 1');
        return { status: 'ok' };
      } catch (error) {
        return { status: 'error', error };
      }
    }
  }
});

// Use the extended client
const healthStatus = await prisma.healthCheck();
```

### Defining Reusable Extensions

```typescript
import { Drismify } from './generated/client';

const myExtension = Drismify.defineExtension({
  model: {
    user: {
      async signUp(email: string, name: string) {
        return this.create({
          data: {
            email,
            name
          }
        });
      }
    }
  }
});

const prisma = new PrismaClient().$extends(myExtension);
```

### Advanced Extensions

Drismify provides advanced extensions for transaction support, middleware, soft deletion, and more:

```typescript
import {
  createTransactionExtension,
  createMiddlewareExtension,
  createSoftDeleteExtension
} from 'drismify';

// Add transaction support
const prisma = new PrismaClient().$extends(createTransactionExtension());

// Use transactions
const result = await prisma.$transaction(async (tx) => {
  const user = await tx.user.create({ data: { name: 'Alice' } });
  return user;
});

// Add soft delete functionality
const softDeleteClient = prisma.$extends(createSoftDeleteExtension());

// Soft delete a record (won't appear in normal queries)
await softDeleteClient.user.softDelete({ where: { id: 1 } });

// Find only soft-deleted records
const deletedUsers = await softDeleteClient.user.findDeleted();

// Restore a soft-deleted record
await softDeleteClient.user.restore({ where: { id: 1 } });
```

## JSON Operations

Drismify supports Prisma-style JSON operations and querying, allowing you to work with JSON fields in your database:

### Querying JSON Fields

You can query JSON fields using dot notation:

```typescript
// Query by nested JSON property
const darkThemeUsers = await prisma.user.findMany({
  where: {
    'metadata.preferences.theme': 'dark'
  }
});

// Query by array element
const admins = await prisma.user.findMany({
  where: {
    'metadata.roles[0]': 'admin'
  }
});
```

### JSON Operators

Drismify supports various JSON operators:

```typescript
// Using path operator
const usersWithNotifications = await prisma.user.findMany({
  where: {
    metadata: {
      path: ['$.preferences.notifications', true]
    }
  }
});

// Using array_contains operator
const adminUsers = await prisma.user.findMany({
  where: {
    metadata: {
      array_contains: 'admin'
    }
  }
});

// Using string_contains operator
const mayLogins = await prisma.user.findMany({
  where: {
    metadata: {
      string_contains: '2023-05-15'
    }
  }
});
```

### Complex JSON Filtering

You can combine multiple JSON conditions:

```typescript
// Using AND with JSON fields
const darkThemeWithNotifications = await prisma.user.findMany({
  where: {
    AND: [
      { 'metadata.preferences.theme': 'dark' },
      { 'metadata.preferences.notifications': true }
    ]
  }
});

// Using OR with JSON fields
const adminOrModerators = await prisma.user.findMany({
  where: {
    OR: [
      { metadata: { array_contains: 'admin' } },
      { metadata: { array_contains: 'moderator' } }
    ]
  }
});
```

### Updating JSON Fields

You can update JSON fields using the `updateJson` method or dot notation:

```typescript
// Using updateJson method
const updatedUser = await prisma.user.updateJson({
  where: { id: 1 },
  data: {
    metadata: {
      preferences: {
        theme: 'system'
      }
    }
  }
});

// Using dot notation
const updatedUser2 = await prisma.user.update({
  where: { id: 1 },
  data: {
    'metadata.preferences.notifications': false
  }
});
```

## CLI Commands

Drismify provides a CLI with commands similar to Prisma:

```bash
# Initialize a new project
npx drismify init

# Generate the client
npx drismify generate

# Push the schema to the database
npx drismify db push

# Generate and apply migrations
npx drismify migrate dev

# Apply migrations in production
npx drismify migrate deploy

# Introspect an existing database
npx drismify introspect <database-url> [provider]

# Seed the database
npx drismify seed [schema-path] [seed-script]

# Launch Drismify Studio (web UI)
npx drismify studio [schema-path] [--port 5555]
```

## Advanced Features

### Database Studio

Drismify includes a web-based Studio for managing your database:

```bash
npx drismify studio
```

This launches a web interface where you can:
- Browse, create, edit, and delete records
- View database schema
- Execute custom queries
- Visualize relationships between models

### Performance Optimization

```typescript
// Enable query optimization and caching
const prisma = new PrismaClient({
  queryOptimization: true,
  cache: {
    enabled: true,
    ttl: 60 // seconds
  }
});

// Or enable them dynamically
prisma.$enableQueryOptimization();
prisma.$enableCache();
```

### Factory Mode for Testing

Generate test data quickly:

```bash
npx drismify seed --factory --count 100
```

## Changes

- Replaced all mock tests with actual implementations in the Prisma Extends Support test suite
- Fixed test cases to properly work with model extensions, result extensions, and async methods
- Added comprehensive tests for $allModels extensions and multiple extension combinations
- Fixed the missing `PrismaClient` export in the base-client.ts file by adding it as an alias for `DrismifyClient`
- Enhanced the extension handling system to properly process middleware extensions
- Improved the MockPrismaClient implementation in tests to properly handle connection status and middleware
- Fixed all the failing tests in the extension system test suite
- Implemented proper connection state handling for adapters during transactions
- Improved the implementation of middleware, hook, and debug extensions
- Added support for Prisma's `$extends` API
- Implemented SQLite and TursoDB adapters
- Added CLI commands for schema management and migrations
- Added advanced extensions (transactions, middleware, hooks, soft delete)
- Added database introspection and Studio web UI
- Added data seeding with factory mode
- Implemented query optimization and caching
- Fixed parser to correctly detect and apply migrations
- Improved debug output for migration operations
- Fixed client generator to include Drismify export

## Current Limitations and Pending Features

Drismify is still in development and lacks several Prisma ORM features:

### Database Support
- Only SQLite and TursoDB are currently supported (PostgreSQL, MySQL, MongoDB, etc. pending)

### Query Features
- Advanced filtering operations (contains, startsWith, endsWith, etc.)
- Aggregation functions (sum, avg, min, max, groupBy)
- Full-text search capabilities
- Nested writes for related records

### Schema Features
- Support for views
- Composite types
- Composite/multi-field unique constraints
- Referential actions (onDelete, onUpdate)
- Cascade operations

### Infrastructure
- Connection pooling
- Database sharding support
- Read replicas support

### Developer Experience
- The interactive database Studio GUI is still under development
- Data validation layer is incomplete

Please check the TODO.md file for a comprehensive list of pending features.
