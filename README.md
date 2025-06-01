
# Drismify

A modern, Prisma-compatible ORM replacement supporting SQLite and TursoDB with full schema compatibility, CLI tools, and advanced extension system. Drismify provides a drop-in replacement for Prisma with enhanced features and better performance.

## Features

- **🔄 Full Prisma Schema Compatibility**: Use your existing Prisma schema files without modification
- **🗄️ SQLite and TursoDB Support**: Built-in support for SQLite and TursoDB databases (PostgreSQL, MySQL coming soon)
- **⚡ Prisma CLI Compatibility**: Use familiar Prisma CLI commands (`generate`, `db push`, `migrate`, etc.)
- **🔧 Prisma Extends Support**: Full compatibility with Prisma's `$extends` API for custom methods and behaviors
- **🚀 No Database Shadowing**: Direct database access without an intermediary layer for better performance
- **📝 Schema Parser & Translator**: Parse Prisma schema files and translate to optimized database schemas
- **🔄 Migration System**: Generate and apply database migrations with full rollback support
- **🔍 Advanced Query Features**: Aggregation functions, JSON operations, full-text search, and field selection
- **🏗️ Composite Types**: Full support for composite types with JSON storage and type safety
- **🔗 Referential Actions**: Complete support for foreign key constraints and cascading operations
- **✅ Database Constraints**: CHECK constraints, unique constraints, and custom indexes

## Installation

### Global CLI Installation (Recommended)

```bash
# Install CLI globally for project management
npm install -g drismify
# or
pnpm add -g drismify
# or
bun add -g drismify
```

### As a Library

```bash
# Install Drismify in your project
npm install drismify
# or
pnpm add drismify
# or
bun add drismify
```

### JSR Installation (Deno/Modern Runtimes)

```bash
# Install from JSR registry
deno add @drismify/core
# or
npx jsr add @drismify/core
```

## Quick Start (Try It Now!)

Want to try Drismify immediately? Here's a 30-second demo:

```bash
# Install globally
npm install -g drismify

# Create a sample schema file
echo 'generator client {
  provider = "drismify"
}

datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

model User {
  id    Int     @id @default(autoincrement())
  email String  @unique
  name  String?
}' > sample-schema.prisma

# Validate the schema
drismify validate sample-schema.prisma

# Convert to Drizzle schema
drismify generate-schema sample-schema.prisma drizzle-output.ts

# View the generated Drizzle schema
cat drizzle-output.ts
```

## Detailed Usage Guide

### 1. Validate Your Prisma Schema

```bash
# Validate an existing Prisma schema
drismify validate schema.prisma

# Validate with verbose output and suggestions
drismify validate schema.prisma --verbose --suggestions
```

### 2. Convert Prisma Schema to Drizzle

Create a `schema.prisma` file:

```prisma
// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "drismify"
}

datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

model User {
  id    Int     @id @default(autoincrement())
  email String  @unique
  name  String?
  posts Post[]
}

model Post {
  id        Int     @id @default(autoincrement())
  title     String
  content   String?
  published Boolean @default(false)
  author    User    @relation(fields: [authorId], references: [id])
  authorId  Int
}
```

### 3. Generate Drizzle Schema

```bash
# Convert Prisma schema to Drizzle schema
drismify generate-schema schema.prisma drizzle-schema.ts
```

This will generate a `drizzle-schema.ts` file with your Drizzle table definitions.

### 4. Use the Generated Schema with Drizzle

```typescript
// Import the generated Drizzle schema
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { user, post, userRelations, postRelations } from './drizzle-schema';

// Create database connection
const sqlite = new Database('./dev.db');
const db = drizzle(sqlite, {
  schema: { user, post, userRelations, postRelations }
});

async function main() {
  // Create a new user
  const newUser = await db.insert(user).values({
    email: 'alice@example.com',
    name: 'Alice'
  }).returning();

  console.log('Created user:', newUser[0]);

  // Create posts for the user
  await db.insert(post).values([
    {
      title: 'Hello World',
      content: 'This is my first post!',
      published: true,
      authorId: newUser[0].id
    },
    {
      title: 'Getting Started',
      content: 'Learning Drismify...',
      published: false,
      authorId: newUser[0].id
    }
  ]);

  // Query users with their posts using relations
  const usersWithPosts = await db.query.user.findMany({
    with: {
      posts: true
    }
  });

  console.log('All users with posts:', usersWithPosts);
}

main().catch(console.error);
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

Drismify provides a CLI with commands for schema validation and conversion. After installing globally, you can use `drismify` directly:

### Currently Available Commands

```bash
# Show help and available commands
drismify --help

# Validate schema syntax and structure
drismify validate [schema-path] [--verbose] [--lint] [--suggestions]

# Convert Prisma schema to Drizzle schema
drismify generate-schema <prisma-schema-path> [drizzle-output-path]
```

### Examples

```bash
# Validate a Prisma schema file
drismify validate ./prisma/schema.prisma

# Validate with detailed output and suggestions
drismify validate ./prisma/schema.prisma --verbose --suggestions --lint

# Convert Prisma schema to Drizzle
drismify generate-schema ./prisma/schema.prisma ./src/db/schema.ts
```

### Available Commands

All CLI commands are now fully functional:

```bash
# Project initialization
drismify init [directory] [--provider sqlite|turso]

# Client generation
drismify generate [schema-path] [--output ./generated/client]

# Database operations
drismify db push [--schema schema.prisma] [--force] [--reset]
drismify db pull [--schema schema.prisma]

# Migration management
drismify migrate dev [schema-path] [migration-name]
drismify migrate deploy
drismify migrate reset
drismify migrate status

# Database introspection
drismify introspect <database-url> [provider] [output-path]

# Database seeding
drismify seed [schema-path] [seed-script] [--reset]
```

### Temporarily Disabled Commands

```bash
# Database studio (coming soon)
drismify studio [schema-path] [--port 5555]
```

### Using with npx (without global installation)

If you prefer not to install globally, you can use npx:

```bash
npx drismify validate schema.prisma
npx drismify generate-schema schema.prisma output.ts
npx drismify --help
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

## Referential Actions Support

Drismify provides full support for referential actions (foreign key constraints) to maintain data integrity and define cascading behaviors when parent records are updated or deleted.

### Supported Referential Actions

- **Cascade**: Automatically delete/update child records when parent is deleted/updated
- **Restrict**: Prevent deletion/update of parent if child records exist
- **SetNull**: Set foreign key to NULL when parent is deleted/updated
- **SetDefault**: Set foreign key to default value when parent is deleted/updated
- **NoAction**: No action taken (database default behavior)

### Using Referential Actions

```prisma
model User {
  id       Int       @id @default(autoincrement())
  email    String    @unique
  posts    Post[]
  comments Comment[]
  profile  Profile?
}

// One-to-one with cascade delete
model Profile {
  id     Int    @id @default(autoincrement())
  bio    String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId Int    @unique
}

// Many-to-one with cascade delete and restrict update
model Post {
  id        Int       @id @default(autoincrement())
  title     String
  content   String?
  author    User      @relation(fields: [authorId], references: [id], onDelete: Cascade, onUpdate: Restrict)
  authorId  Int
  comments  Comment[]
}

// Set null on delete, set default on update
model Comment {
  id       Int    @id @default(autoincrement())
  content  String
  post     Post   @relation(fields: [postId], references: [id], onDelete: SetNull)
  postId   Int?
  author   User   @relation(fields: [authorId], references: [id], onDelete: SetDefault, onUpdate: NoAction)
  authorId Int    @default(1) // Default to system user
}
```

### Generated SQL

Drismify automatically generates the appropriate SQL foreign key constraints:

```sql
-- Profile table with CASCADE delete
CREATE TABLE "profile" (
  id INTEGER PRIMARY KEY,
  bio TEXT NOT NULL,
  user_id INTEGER UNIQUE NOT NULL,
  FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
);

-- Post table with CASCADE delete and RESTRICT update
CREATE TABLE "post" (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  author_id INTEGER NOT NULL,
  FOREIGN KEY ("author_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE RESTRICT
);

-- Comment table with SET NULL and SET DEFAULT
CREATE TABLE "comment" (
  id INTEGER PRIMARY KEY,
  content TEXT NOT NULL,
  post_id INTEGER,
  author_id INTEGER DEFAULT 1,
  FOREIGN KEY ("post_id") REFERENCES "post"("id") ON DELETE SET NULL,
  FOREIGN KEY ("author_id") REFERENCES "user"("id") ON DELETE SET DEFAULT ON UPDATE NO ACTION
);
```

## Database-Level Constraints Support

Drismify provides comprehensive support for database-level constraints to ensure data integrity and enforce business rules at the database level.

### Check Constraints (`@@check`)

Use check constraints to enforce custom validation rules on your data:

```prisma
model User {
  id       Int      @id @default(autoincrement())
  email    String   @unique
  age      Int
  salary   Float
  status   String

  // Named check constraints
  @@check(age >= 18, name: "minimum_age")
  @@check(salary > 0, name: "positive_salary")

  // Unnamed check constraints
  @@check(status IN ('active', 'inactive', 'suspended'))
  @@check(LENGTH(email) > 5)
}

model Product {
  id          Int      @id @default(autoincrement())
  name        String
  price       Float
  discount    Float    @default(0)

  // Complex check constraints
  @@check(price > 0 AND price < 1000000, name: "valid_price_range")
  @@check(discount >= 0 AND discount <= 1, name: "valid_discount")
  @@check(LENGTH(name) > 0 AND LENGTH(name) <= 255)
}
```

### Index Constraints (`@@index`)

Create database indexes for improved query performance:

```prisma
model User {
  id       Int      @id @default(autoincrement())
  email    String
  username String
  status   String
  createdAt DateTime @default(now())

  // Named indexes
  @@index([email, username], name: "user_credentials_idx")
  @@index([status, createdAt], name: "user_status_created_idx")

  // Unnamed indexes
  @@index([email])
  @@index([createdAt])
}
```

### Named Constraints

All constraint types support custom names for better database management:

```prisma
model Order {
  id         Int      @id @default(autoincrement())
  customerId Int
  total      Float
  status     String
  customer   Customer @relation(fields: [customerId], references: [id], name: "order_customer_fk")

  // Named unique constraint
  @@unique([customerId, total], name: "unique_customer_total")

  // Named check constraint
  @@check(total > 0, name: "positive_total")

  // Named index
  @@index([status, total], name: "order_status_total_idx")
}
```

### Enhanced Unique Constraints

Drismify supports both single-field and multi-field unique constraints with optional custom names:

```prisma
model User {
  id       Int    @id @default(autoincrement())
  email    String @unique(name: "unique_user_email")
  username String @unique

  // Multi-field unique constraint with custom name
  @@unique([email, username], name: "unique_user_credentials")
}
```

### Enhanced Foreign Key Constraints

Foreign key constraints now support custom names along with referential actions:

```prisma
model Post {
  id       Int  @id @default(autoincrement())
  authorId Int
  author   User @relation(
    fields: [authorId],
    references: [id],
    onDelete: Cascade,
    onUpdate: Restrict,
    name: "post_author_fk"
  )
}
```

### Generated SQL

Drismify automatically generates the appropriate SQL constraints:

```sql
-- Table with check constraints
CREATE TABLE "user" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  age INTEGER NOT NULL,
  salary REAL NOT NULL,
  status TEXT NOT NULL,
  CONSTRAINT minimum_age CHECK (age >= 18),
  CONSTRAINT positive_salary CHECK (salary > 0),
  CHECK (status IN ('active', 'inactive', 'suspended')),
  CHECK (LENGTH(email) > 5)
);

-- Named foreign key constraint
CREATE TABLE "post" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author_id INTEGER NOT NULL,
  CONSTRAINT post_author_fk FOREIGN KEY ("author_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE RESTRICT
);

-- Named indexes
CREATE INDEX user_credentials_idx ON user (email, username);
CREATE INDEX user_status_created_idx ON user (status, created_at);
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
- Added full support for referential actions (onDelete, onUpdate) with all five action types: Cascade, Restrict, SetNull, SetDefault, and NoAction
- Implemented referential actions in schema parser, translator, and migration system
- Added comprehensive test suite for referential actions functionality
- Implemented comprehensive database-level constraints support including CHECK constraints, named constraints for all constraint types
- Enhanced unique constraints, foreign key constraints, and index constraints with custom naming support
- Added @@check constraint parsing, translation, and migration generation with both named and unnamed constraints
- Improved constraint SQL generation with proper CONSTRAINT naming for better database management

## Library Usage

### Using Drismify as a Library

You can also use Drismify programmatically in your applications:

```typescript
import { Drismify, DrismifyClient, createAdapter } from 'drismify';

// Create a custom adapter
const adapter = createAdapter({
  type: 'sqlite',
  connectionString: 'file:./my-app.db'
});

// Create a client with custom configuration
const client = new DrismifyClient({
  adapter,
  debug: true
});

// Use Drismify utilities
const extension = Drismify.defineExtension({
  model: {
    user: {
      async findByEmail(email: string) {
        return this.findFirst({ where: { email } });
      }
    }
  }
});

const extendedClient = client.$extends(extension);
```

### Advanced Library Features

```typescript
import {
  SchemaParser,
  SchemaTranslator,
  MigrationGenerator,
  ClientGenerator
} from 'drismify';

// Parse Prisma schema programmatically
const parser = new SchemaParser();
const ast = parser.parseFromFile('./schema.prisma');

// Generate client code programmatically
const generator = new ClientGenerator({
  outputDir: './generated/client',
  generateTypes: true
});

await generator.generateFromAST(ast);
```

## Publishing Information

### NPM Package

- **Package Name**: `drismify`
- **Registry**: [npm](https://www.npmjs.com/package/drismify)
- **Installation**: `npm install drismify`

### JSR Package

- **Package Name**: `@drismify/core`
- **Registry**: [JSR](https://jsr.io/@drismify/core)
- **Installation**: `deno add @drismify/core` or `npx jsr add @drismify/core`

### GitHub Repository

- **Repository**: [github.com/u007/drismify](https://github.com/u007/drismify)
- **Issues**: [github.com/u007/drismify/issues](https://github.com/u007/drismify/issues)
- **Contributions**: Welcome! Please read our contributing guidelines.

## Current Status & Roadmap

### ✅ **Currently Working**

- **Schema Validation**: Full Prisma schema validation with detailed error reporting
- **Schema Conversion**: Convert Prisma schemas to Drizzle schemas with full type safety
- **CLI Interface**: Working command-line interface with help and error handling
- **Library Usage**: Use Drismify programmatically in your applications
- **TypeScript Support**: Full TypeScript support with generated type definitions
- **JSR & NPM Publishing**: Ready for distribution on both registries
- **Client Generation**: Generate type-safe database clients
- **Migration System**: Database migration generation and management
- **Database Operations**: Push/pull schema changes to/from database
- **Project Initialization**: Scaffold new Drismify projects
- **Data Seeding**: Populate databases with test data
- **Database Introspection**: Generate schemas from existing databases

### 🚧 **In Development**

- **Database Studio**: Web-based database management interface

### 🎯 **Upcoming Features**

- **Multi-Database Support**: PostgreSQL, MySQL, MongoDB support
- **Performance Optimizations**: Query optimization and connection pooling
- **Advanced Extensions**: More built-in extensions for common use cases
- **Developer Tools**: Enhanced debugging and development experience
- **Documentation**: Comprehensive API documentation and tutorials

## Development & Contributing

### Building from Source

```bash
# Clone the repository
git clone https://github.com/u007/drismify.git
cd drismify

# Install dependencies
pnpm install

# Build the project
pnpm run build

# Test the CLI
node dist/cli.js --help
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test --watch
```

### Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for your changes
5. Ensure all tests pass (`pnpm test`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

### Development Guidelines

- Use TypeScript for all new code
- Follow the existing code style
- Add tests for new features
- Update documentation as needed
- Use conventional commit messages

## Current Limitations and Pending Features

Drismify is actively developed and continuously improving. Current limitations:

### Database Support
- Only SQLite and TursoDB are currently supported (PostgreSQL, MySQL, MongoDB, etc. pending)

### Query Features
- Advanced filtering operations (contains, startsWith, endsWith, etc.)
- Aggregation functions (sum, avg, min, max, groupBy)
- Full-text search capabilities

### Schema Features
- ✅ Composite/multi-field unique constraints - Full support for both single-field (@unique) and multi-field (@@unique) unique constraints
- ✅ Referential actions (onDelete, onUpdate) - Full support for Cascade, Restrict, SetNull, SetDefault, and NoAction
- ✅ Cascade operations - Implemented through referential actions

### Infrastructure
- Connection pooling
- Database sharding support
- Read replicas support

### Developer Experience
- The interactive database Studio GUI is still under development
- Data validation layer is incomplete

Please check the TODO.md file for a comprehensive list of pending features.
