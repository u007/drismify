
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
- **Field Selection**: Select specific fields in queries to optimize data transfer and improve performance
- **Composite Types**: Full support for composite types with JSON storage and type safety

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

## Composite Types Support

Drismify supports Prisma composite types, allowing you to define reusable structured data types:

### Defining Composite Types

```prisma
// Define composite types in your schema
type Address {
  street  String
  city    String
  state   String
  zip     String
  country String
}

type ContactInfo {
  email   String
  phone   String?
  website String?
}

// Use composite types in models
model User {
  id      Int     @id @default(autoincrement())
  name    String
  address Address
  contact ContactInfo
}

model Business {
  id          Int         @id @default(autoincrement())
  name        String
  address     Address
  coordinates Coordinates?
}
```

### Working with Composite Types

```typescript
// Create records with composite types
const user = await prisma.user.create({
  data: {
    name: 'John Doe',
    address: {
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      zip: '10001',
      country: 'USA'
    },
    contact: {
      email: 'john@example.com',
      phone: '+1-555-0123',
      website: 'https://johndoe.com'
    }
  }
});

// Query records with composite types
const users = await prisma.user.findMany({
  where: {
    // Composite types are stored as JSON and can be queried
    'address.city': 'New York'
  }
});
```

Composite types are automatically stored as JSON in the database while maintaining full TypeScript type safety in your application code.

## Unique Constraints Support

Drismify provides full support for both single-field and multi-field unique constraints, ensuring data integrity at the database level.

### Single-field Unique Constraints

Use the `@unique` attribute on individual fields:

```prisma
model User {
  id       Int    @id @default(autoincrement())
  email    String @unique
  username String @unique
  name     String
}
```

### Multi-field Unique Constraints

Use the `@@unique` attribute at the model level to create composite unique constraints:

```prisma
model Post {
  id       Int    @id @default(autoincrement())
  title    String
  authorId Int
  author   User   @relation(fields: [authorId], references: [id])

  // Ensure each author can only have one post with the same title
  @@unique([title, authorId])
}

model Profile {
  id       Int    @id @default(autoincrement())
  platform String
  handle   String
  userId   Int
  user     User   @relation(fields: [userId], references: [id])

  // Ensure each user can only have one profile per platform
  @@unique([platform, userId])
}
```

### Named Unique Constraints

You can provide custom names for your unique constraints:

```prisma
model Category {
  id       Int    @id @default(autoincrement())
  name     String
  parentId Int?

  // Custom constraint name
  @@unique([name, parentId], name: "unique_category_name_per_parent")
}
```

### Error Handling

Unique constraint violations are properly handled and return meaningful error messages:

```typescript
try {
  await prisma.user.create({
    data: {
      email: 'existing@example.com', // This email already exists
      username: 'newuser'
    }
  });
} catch (error) {
  // Error: UNIQUE constraint failed: user.email
  console.error('Unique constraint violation:', error.message);
}
```

### NULL Values in Unique Constraints

SQLite treats NULL values as unique, so multiple records can have NULL values in unique fields:

```prisma
model Category {
  id       Int    @id @default(autoincrement())
  name     String
  parentId Int?   // Can be NULL

  @@unique([name, parentId])
}
```

```typescript
// These are all valid - NULL values are treated as unique
await prisma.category.create({ data: { name: 'Technology', parentId: null } });
await prisma.category.create({ data: { name: 'Science', parentId: null } });
await prisma.category.create({ data: { name: 'Technology', parentId: null } }); // This is allowed in SQLite
```

## Database Views Support

Drismify supports database views for read-only queries that combine data from multiple tables:

```prisma
// Define a view in your schema
view UserInfo {
  id    Int    @unique
  email String
  name  String
  bio   String
}

view PublishedPosts {
  id          Int      @unique
  title       String
  content     String
  authorName  String
  authorEmail String
  createdAt   DateTime
}
```

Create the corresponding SQL views in your database:

```sql
CREATE VIEW user_info AS
SELECT
  u.id,
  u.email,
  u.name,
  p.bio
FROM user u
LEFT JOIN profile p ON u.id = p.user_id;

CREATE VIEW published_posts AS
SELECT
  p.id,
  p.title,
  p.content,
  u.name as author_name,
  u.email as author_email,
  p.created_at
FROM post p
JOIN user u ON p.author_id = u.id
WHERE p.published = TRUE;
```

Query views using raw SQL (generated view clients coming soon):

```typescript
// Query view data
const userInfo = await prisma.$queryRaw('SELECT * FROM user_info');
const publishedPosts = await prisma.$queryRaw('SELECT * FROM published_posts WHERE author_name = ?', ['Alice']);
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

- Added full support for composite types - Schema parsing, type generation, client generation, and JSON storage implemented
- Added support for database views - Schema parsing, type generation, and basic view functionality implemented
- Implemented nested writes functionality for creating, connecting, disconnecting, and deleting related records
- Added support for to-one and to-many relationships in nested operations
- Implemented many-to-many relationship handling with explicit join tables
- Added support for updating join records in many-to-many relationships
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

### Schema Features
- ✅ Composite/multi-field unique constraints - Full support for both single-field (@unique) and multi-field (@@unique) unique constraints
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
