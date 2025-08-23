# Extension System and Plugin Rules for Drismify

## Extension Architecture Overview
- **Prisma $extends compatibility**: Full support for Prisma's extension API
- **Multiple extension types**: Model, Client, Query, and Result extensions
- **Middleware system**: Intercept and modify operations
- **Composable extensions**: Chain multiple extensions together
- **Type safety**: Maintain TypeScript types through extension chains

## Extension Types

### Model Extensions
```typescript
// Add custom methods to model clients
const extendedClient = client.$extends({
  model: {
    user: {
      async findManyWithPosts() {
        return this.findMany({ include: { posts: true } })
      }
    }
  }
})
```

### Client Extensions
```typescript
// Add methods to the client instance
const extendedClient = client.$extends({
  client: {
    async getStats() {
      return { userCount: await this.user.count() }
    }
  }
})
```

### Query Extensions
```typescript
// Modify queries before execution
const extendedClient = client.$extends({
  query: {
    user: {
      findMany: ({ args, query }) => {
        args.where = { ...args.where, deleted: false }
        return query(args)
      }
    }
  }
})
```

### Result Extensions
```typescript
// Transform query results
const extendedClient = client.$extends({
  result: {
    user: {
      fullName: {
        needs: { firstName: true, lastName: true },
        compute(user) {
          return `${user.firstName} ${user.lastName}`
        }
      }
    }
  }
})
```

## Extension Implementation Structure
```
src/extensions/
├── index.ts           # Main extension API
├── advanced.ts        # Advanced extension implementations
├── types.ts          # Extension type definitions
├── internal-utils.ts # Internal utilities
├── aggregation.ts    # Aggregation extensions
├── fulltext.ts       # Full-text search extensions
└── json.ts           # JSON operations (future)
```

## Core Extension API
```typescript
// Primary extension function
function defineExtension<T>(extension: T): ExtensionDefinition<T>

// Apply extension to client
function applyExtension<T>(client: T, extension: ExtensionDefinition): T

// Get extension context
function getExtensionContext(): ExtensionContext
```

## Extension Definition Rules
- **Single responsibility**: Each extension should have a focused purpose
- **Immutable**: Extensions should not modify the original client
- **Composable**: Extensions must work together without conflicts
- **Type-preserving**: Maintain TypeScript inference through extensions

## Built-in Extension Categories

### Middleware Extensions
- **Operation interception**: Intercept operations before/after execution
- **Parameter modification**: Modify operation parameters
- **Result transformation**: Transform operation results
- **Error handling**: Custom error handling and recovery

### Soft Delete Extensions
```typescript
const softDeleteExtension = defineExtension({
  name: 'softDelete',
  query: {
    // Automatically filter deleted records
    $allModels: {
      findMany: ({ args, query }) => {
        args.where = { ...args.where, deleted: false }
        return query(args)
      }
    }
  },
  model: {
    // Add soft delete method
    $allModels: {
      softDelete: async function(where) {
        return this.update({ where, data: { deleted: true } })
      }
    }
  }
})
```

### Audit Extensions
```typescript
const auditExtension = defineExtension({
  name: 'audit',
  query: {
    $allModels: {
      create: ({ args, query }) => {
        args.data = { ...args.data, createdAt: new Date() }
        return query(args)
      },
      update: ({ args, query }) => {
        args.data = { ...args.data, updatedAt: new Date() }
        return query(args)
      }
    }
  }
})
```

### Computed Fields Extensions
```typescript
const computedFieldsExtension = defineExtension({
  result: {
    user: {
      displayName: {
        needs: { firstName: true, lastName: true },
        compute(user) {
          return user.firstName && user.lastName 
            ? `${user.firstName} ${user.lastName}`
            : user.firstName || user.lastName || 'Anonymous'
        }
      }
    }
  }
})
```

## Extension Application Rules
- **Order matters**: Extensions are applied in sequence
- **Last wins**: Later extensions can override earlier ones
- **Namespace isolation**: Model extensions are isolated by model name
- **Performance consideration**: Minimize extension overhead

## Extension Context Management
```typescript
interface ExtensionContext {
  client: any
  model?: string
  operation?: string
  args?: any
  result?: any
}
```

## Testing Extension Rules
- **Unit testing**: Test each extension in isolation
- **Integration testing**: Test extension combinations
- **Mock adapters**: Use mock adapters for testing extensions
- **Type testing**: Verify TypeScript types are preserved

## Extension Error Handling
- **Graceful degradation**: Extensions should not break core functionality
- **Error isolation**: One extension failure shouldn't affect others
- **Debug information**: Provide detailed error context
- **Recovery mechanisms**: Allow extensions to recover from errors

## Performance Optimization
- **Lazy evaluation**: Compute fields only when needed
- **Caching**: Cache expensive computed results
- **Minimal overhead**: Keep extension execution lightweight
- **Hot path avoidance**: Avoid extensions on critical performance paths

## Extension Composition Patterns
```typescript
// Sequential composition
const composedClient = client
  .$extends(auditExtension)
  .$extends(softDeleteExtension)
  .$extends(computedFieldsExtension)

// Conditional composition
const extendedClient = client
  .$extends(baseExtension)
  .$extends(process.env.NODE_ENV === 'development' ? debugExtension : {})
```

## Advanced Extension Features

### Dynamic Extensions
```typescript
// Extensions that modify behavior based on runtime conditions
const dynamicExtension = defineExtension({
  query: {
    user: {
      findMany: ({ args, query }) => {
        if (process.env.TENANT_ISOLATION) {
          args.where = { ...args.where, tenantId: getCurrentTenant() }
        }
        return query(args)
      }
    }
  }
})
```

### Extension Hooks
```typescript
// Pre/post operation hooks
const hookExtension = defineExtension({
  name: 'hooks',
  hooks: {
    beforeCreate: async (model, data) => {
      console.log(`Creating ${model}:`, data)
    },
    afterCreate: async (model, result) => {
      console.log(`Created ${model}:`, result)
    }
  }
})
```

## Extension Documentation Requirements
- **Purpose**: Clear description of what the extension does
- **Usage examples**: Practical code examples
- **Type definitions**: Exported TypeScript types
- **Performance impact**: Document any performance considerations
- **Compatibility**: List compatible database providers

## Security Considerations
- **Input validation**: Validate extension inputs
- **Permission checks**: Ensure user has permission for extended operations
- **Data isolation**: Prevent extensions from accessing unauthorized data
- **SQL injection**: Prevent extensions from introducing security vulnerabilities

## Extension Registry (Future)
```typescript
// Planned extension registry system
interface ExtensionRegistry {
  register(name: string, extension: ExtensionDefinition): void
  get(name: string): ExtensionDefinition
  list(): string[]
  unregister(name: string): void
}
```

## Extension Development Guidelines
- **Follow naming conventions**: Use descriptive, consistent names
- **Minimize dependencies**: Keep extensions lightweight
- **Document side effects**: Clearly document any side effects
- **Version compatibility**: Ensure compatibility across Drismify versions

## Built-in Extension Utilities
```typescript
// Utility functions for extension development
export const extensionUtils = {
  isModel: (name: string) => boolean,
  getModelName: (context: ExtensionContext) => string,
  validateArgs: (args: any, schema: any) => boolean,
  deepMerge: (target: any, source: any) => any
}
```