
# Drismify

Drismify is a Prisma ORM replacement supporting TursoDB and SQLite with full Prisma schema compatibility, CLI command support, and Prisma extends support. It provides advanced features for database management and performance optimization.

## Features

- **Full Prisma Schema Compatibility**: Use your existing Prisma schema files without changes
- **SQLite and TursoDB Support**: Built-in support for SQLite and TursoDB databases
- **Prisma CLI Command Compatibility**: Use familiar Prisma CLI commands
- **Prisma Extends Support**: Extend your client with custom methods and behaviors
- **No Database Shadowing**: Direct database access without an intermediary layer
- **Schema Parser**: Parse Prisma schema files into an AST
- **Schema Translator**: Translate Prisma schema to Drizzle schema
- **Migration System**: Generate and apply migrations

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

- Added support for Prisma's `$extends` API
- Implemented SQLite and TursoDB adapters
- Added CLI commands for schema management and migrations
- Added advanced extensions (transactions, middleware, hooks, soft delete)
- Added database introspection and Studio web UI
- Added data seeding with factory mode
- Implemented query optimization and caching
- Fixed parser to correctly handle default function arguments
- Fixed migration manager to properly detect and apply migrations
- Improved debug output for migration operations
- Fixed client generator to include Drismify export