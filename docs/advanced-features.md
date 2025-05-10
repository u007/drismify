# Drismify Advanced Features

This document outlines the advanced features available in Drismify, including extensions, the CLI, and other capabilities.

## Advanced Extensions

Drismify provides a powerful extension system that allows you to customize and extend the client with additional functionality.

### Transaction Extension

The transaction extension adds transaction support to your client:

```typescript
import { PrismaClient } from './generated/client';
import { createTransactionExtension } from 'drismify';

const prisma = new PrismaClient().$extends(createTransactionExtension());

// Use transactions
async function main() {
  const result = await prisma.$transaction(async (tx) => {
    // All operations in this callback are part of the same transaction
    const user = await tx.user.create({
      data: { name: 'Alice', email: 'alice@example.com' }
    });
    
    const post = await tx.post.create({
      data: {
        title: 'Hello World',
        content: 'This is my first post',
        authorId: user.id
      }
    });
    
    return { user, post };
  });
  
  console.log(result);
}
```

### Middleware Extension

Add middleware to intercept and modify operations:

```typescript
import { PrismaClient } from './generated/client';
import { createMiddlewareExtension } from 'drismify';

const prisma = new PrismaClient().$extends(createMiddlewareExtension({
  findMany: async (params, next) => {
    console.log('Before findMany:', params);
    const startTime = Date.now();
    const result = await next(params);
    const duration = Date.now() - startTime;
    console.log(`findMany took ${duration}ms and returned ${result.length} results`);
    return result;
  }
}));

// Dynamically add more middleware
const prismaWithMoreMiddleware = prisma.$use('create', async (params, next) => {
  console.log('Creating a record:', params);
  return next(params);
});
```

### Hook Extension

Add hooks to run before or after operations:

```typescript
import { PrismaClient } from './generated/client';
import { createHookExtension } from 'drismify';

const prisma = new PrismaClient().$extends(createHookExtension(
  {
    // Before hooks
    create: async (params) => {
      console.log('Before create:', params);
      // Modify params if needed
      return params;
    }
  },
  {
    // After hooks
    findMany: async (result) => {
      console.log(`Found ${result.length} records`);
      return result;
    }
  }
));

// Add hooks dynamically
const prismaWithMoreHooks = prisma
  .$before('update', (params) => {
    console.log('Before update:', params);
    return params;
  })
  .$after('update', (result) => {
    console.log('After update:', result);
    return result;
  });
```

### Soft Delete Extension

Implement soft deletion for your models:

```typescript
import { PrismaClient } from './generated/client';
import { createSoftDeleteExtension } from 'drismify';

const prisma = new PrismaClient().$extends(
  createSoftDeleteExtension('deleted', 'deletedAt')
);

// Now all find queries automatically exclude soft-deleted records
const users = await prisma.user.findMany();

// Soft delete a record
await prisma.user.softDelete({ where: { id: 1 } });

// Find only deleted records
const deletedUsers = await prisma.user.findDeleted();

// Find all records including deleted ones
const allUsers = await prisma.user.findWithDeleted();

// Restore a soft-deleted record
await prisma.user.restore({ where: { id: 1 } });

// Permanently delete a record
await prisma.user.hardDelete({ where: { id: 1 } });
```

### Computed Fields Extension

Add computed fields to your models:

```typescript
import { PrismaClient } from './generated/client';
import { createComputedFieldsExtension } from 'drismify';

const prisma = new PrismaClient().$extends(
  createComputedFieldsExtension({
    user: {
      fullName: {
        // Fields needed to compute this field
        needs: { firstName: true, lastName: true },
        // Function to compute the field value
        compute: (user) => `${user.firstName} ${user.lastName}`
      }
    }
  })
);

// Add computed fields dynamically
const prismaWithMoreFields = prisma.$addComputedField('user', 'displayName', {
  needs: { firstName: true, lastName: true, title: true },
  compute: (user) => `${user.title || ''} ${user.firstName} ${user.lastName}`.trim()
});
```

### Debug Extension

Add debugging capabilities:

```typescript
import { PrismaClient } from './generated/client';
import { createDebugExtension } from 'drismify';

const prisma = new PrismaClient().$extends(
  createDebugExtension((message, data) => {
    console.log(`[DEBUG] ${message}`, data || '');
  })
);

// Enable debugging
prisma.$enableDebug();

// All queries will now log debug information
const users = await prisma.user.findMany();

// Disable debugging
prisma.$disableDebug();
```

### Batch Operations

Execute multiple operations in a batch:

```typescript
import { PrismaClient } from './generated/client';
import { createBatchExtension } from 'drismify';

const prisma = new PrismaClient().$extends(createBatchExtension());

// Use batch operations
const result = await prisma.$batch(async (batch) => {
  const users = await batch.user.findMany();
  const posts = await batch.post.findMany({ where: { authorId: { in: users.map(u => u.id) } } });
  return { users, posts };
});
```

### Combining Extensions

Combine multiple extensions:

```typescript
import { PrismaClient } from './generated/client';
import {
  combineExtensions,
  createTransactionExtension,
  createMiddlewareExtension,
  createSoftDeleteExtension
} from 'drismify';

const combinedExtension = combineExtensions(
  createTransactionExtension(),
  createMiddlewareExtension({
    findMany: async (params, next) => {
      console.log('Query:', params);
      return next(params);
    }
  }),
  createSoftDeleteExtension()
);

const prisma = new PrismaClient().$extends(combinedExtension);
```

## Advanced CLI Commands

Drismify provides several advanced CLI commands for managing your database and application.

### Database Introspection

Introspect an existing database to generate a Prisma schema:

```bash
npx drismify introspect <database-url> [provider] [output-path]

# Examples:
npx drismify introspect ./dev.db sqlite ./schema.prisma
npx drismify introspect https://my-db.turso.io turso ./schema.prisma
```

Options:
- `--overwrite`: Overwrite the output file if it exists
- `--no-comments`: Don't include comments about table relationships
- `--debug`: Print debug information

### Database Seeding

Seed your database with test data:

```bash
npx drismify seed [schema-path] [seed-script]

# Examples:
npx drismify seed
npx drismify seed ./schema.prisma ./seed.ts
npx drismify seed ./schema.prisma --reset
```

Options:
- `--reset`: Reset the database before seeding
- `--debug`: Print debug information
- `--factory`: Use factory mode to generate test data
- `--count <number>`: Number of records to generate in factory mode (default: 10)

### Drismify Studio

Launch Drismify Studio, a web-based interface for managing your database:

```bash
npx drismify studio [schema-path]

# Examples:
npx drismify studio
npx drismify studio ./schema.prisma
npx drismify studio ./schema.prisma --port 3000
```

Options:
- `--port <number>`: Port to run the studio on (default: 5555)
- `--no-browser`: Don't open the browser automatically
- `--read-only`: Run in read-only mode

### Migration Commands

Advanced migration commands:

```bash
# Generate and apply migrations in development
npx drismify migrate dev [schema-path] [migration-name]

# Apply migrations in production
npx drismify migrate deploy

# Reset the database
npx drismify migrate reset

# Show migration status
npx drismify migrate status
```

### Database Commands

Advanced database commands:

```bash
# Push schema to database
npx drismify db push [schema-path] [--skip-generate] [--force] [--reset]

# Pull schema from database
npx drismify db pull [schema-path]

# Seed database
npx drismify db seed [seed-script] [--reset]
```

## Performance Optimization

Drismify includes several features for optimizing performance:

### Query Optimization

The query optimizer can automatically improve the performance of your queries:

```typescript
// Enable query optimization
prisma.$enableQueryOptimization();

// All queries will now be optimized
const users = await prisma.user.findMany({
  where: {
    posts: {
      some: {
        published: true
      }
    }
  },
  include: {
    posts: true
  }
});

// Disable query optimization
prisma.$disableQueryOptimization();
```

### Connection Pooling

Drismify automatically manages connection pooling for better performance:

```typescript
const prisma = new PrismaClient({
  connectionPool: {
    min: 5,
    max: 20,
    idleTimeoutMs: 60000
  }
});
```

### Caching

Enable caching for frequently accessed data:

```typescript
const prisma = new PrismaClient({
  cache: {
    enabled: true,
    ttl: 60, // Time-to-live in seconds
    size: 100 // Maximum number of cached queries
  }
});

// Or enable caching dynamically
prisma.$enableCache({
  ttl: 30,
  size: 50
});

// Cached queries will be served from cache when possible
const cachedUsers = await prisma.user.findMany({
  cache: true
});

// Bypass cache for specific queries
const freshUsers = await prisma.user.findMany({
  cache: false
});

// Clear the cache
prisma.$clearCache();

// Disable caching
prisma.$disableCache();
```

## Advanced Security Features

### Field-Level Security

Implement field-level security policies:

```typescript
const prisma = new PrismaClient().$extends({
  query: {
    user: {
      findMany: (args) => {
        // Restrict which fields can be returned
        if (args.select) {
          delete args.select.password;
        }
        return args;
      }
    }
  }
});
```

### Row-Level Security

Implement row-level security policies:

```typescript
const currentUser = { id: 1, role: 'user' };

const prisma = new PrismaClient().$extends({
  query: {
    post: {
      findMany: (args) => {
        // Only allow access to published posts or posts created by the current user
        args.where = {
          AND: [
            args.where || {},
            {
              OR: [
                { published: true },
                { authorId: currentUser.id }
              ]
            }
          ]
        };
        return args;
      }
    }
  }
});
```

## Conclusion

These advanced features make Drismify a powerful and flexible ORM for your database needs. By leveraging extensions, the CLI, and other capabilities, you can build more robust and efficient applications.

For more information and examples, check out the [official documentation](https://github.com/drismify/drismify) or the [examples directory](https://github.com/drismify/drismify/tree/main/examples).