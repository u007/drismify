# Documentation and Naming Convention Rules for Drismify

## Project Documentation Structure
```
docs/
├── README.md                  # Main project documentation
├── API_REFERENCE.md          # Complete API documentation
├── CONTRIBUTING.md           # Contribution guidelines
├── PUBLISHING.md             # Publishing and release process
├── CHANGELOG.md              # Version history and changes
├── guides/
│   ├── getting-started.md    # Quick start guide
│   ├── migration-guide.md    # Migration from Prisma
│   ├── extension-guide.md    # Extension development
│   └── database-setup.md     # Database configuration
└── examples/
    ├── basic-usage/          # Basic usage examples
    ├── advanced-features/    # Advanced feature examples
    └── real-world/          # Real-world application examples
```

## Naming Conventions

### File and Directory Names
- **kebab-case**: Use for file and directory names
  - ✅ `base-adapter.ts`, `mysql-adapter.ts`, `client-generator.ts`
  - ❌ `BaseAdapter.ts`, `mysqlAdapter.ts`, `clientGenerator.ts`
- **Descriptive names**: Use clear, descriptive names
  - ✅ `migration-manager.ts`, `schema-differ.ts`
  - ❌ `mgr.ts`, `diff.ts`

### TypeScript Naming
- **PascalCase** for classes, interfaces, types, enums
  ```typescript
  class DatabaseAdapter
  interface QueryResult<T>
  type DatabaseProvider = 'sqlite' | 'mysql'
  enum ConnectionState { Connected, Disconnected }
  ```

- **camelCase** for methods, variables, properties
  ```typescript
  async executeQuery(sql: string): Promise<QueryResult>
  const connectionOptions = { timeout: 5000 }
  private isConnected: boolean
  ```

- **SCREAMING_SNAKE_CASE** for constants
  ```typescript
  const DEFAULT_TIMEOUT = 30000
  const MAX_RETRIES = 3
  const VERSION = '0.2.1'
  ```

### Database-Related Naming
- **Table names**: Use PascalCase in schema, preserve in database
  ```prisma
  model User { }        // Becomes 'User' table
  model UserProfile { } // Becomes 'UserProfile' table
  ```

- **Field names**: Use camelCase in schema
  ```prisma
  model User {
    firstName String    // Becomes 'firstName' column
    createdAt DateTime  // Becomes 'createdAt' column
  }
  ```

- **Relationship names**: Use descriptive, contextual names
  ```prisma
  model User {
    posts    Post[]     // One-to-many: user's posts
    profile  Profile?   // One-to-one: user's profile
  }
  
  model Post {
    author   User       // Many-to-one: post's author
  }
  ```

## Code Documentation Standards

### JSDoc Comments
```typescript
/**
 * Executes a database query with optional parameters
 * 
 * @param query - SQL query string to execute
 * @param params - Optional query parameters for binding
 * @returns Promise that resolves to query results
 * @throws DatabaseError when query execution fails
 * 
 * @example
 * ```typescript
 * const users = await adapter.execute<User>(
 *   'SELECT * FROM User WHERE age > ?',
 *   [18]
 * )
 * ```
 */
async execute<T>(query: string, params?: any[]): Promise<QueryResult<T>>
```

### Class Documentation
```typescript
/**
 * Base implementation for database adapters
 * 
 * Provides common functionality that all database adapters must implement.
 * Specific database adapters should extend this class and implement the
 * abstract methods for their specific database type.
 * 
 * @example
 * ```typescript
 * class SqliteAdapter extends BaseDatabaseAdapter {
 *   async connect() { 
 *     // SQLite-specific connection logic
 *   }
 * }
 * ```
 */
export abstract class BaseDatabaseAdapter implements DatabaseAdapter {
```

### Interface Documentation
```typescript
/**
 * Configuration options for database connections
 * 
 * @interface ConnectionOptions
 * @property provider - Database provider type
 * @property url - Database connection URL
 * @property ssl - SSL/TLS configuration (optional)
 * @property pool - Connection pooling options (optional)
 */
interface ConnectionOptions {
  provider: DatabaseProvider
  url: string
  ssl?: boolean | SSLOptions
  pool?: PoolOptions
}
```

## README Structure
### Main README.md Format
```markdown
# Project Name

Brief, compelling description of what the project does.

## Features
- 🔄 Key feature 1
- 🗄️ Key feature 2  
- ⚡ Key feature 3

## Installation
[Step-by-step installation instructions]

## Quick Start
[30-second demo that works]

## Documentation
[Links to detailed documentation]

## Examples
[Practical, working examples]

## Contributing
[How to contribute]

## License
[License information]
```

### Module README.md Format
```markdown
# Module Name

## Purpose
What this module does and why it exists.

## Usage
```typescript
import { ExampleClass } from './module'
const example = new ExampleClass()
```

## API
- `method1()` - Description
- `method2()` - Description

## Examples
[Working code examples]
```

## Comment Guidelines

### Single-line Comments
```typescript
// Calculate the total number of active users
const activeUsers = await this.user.count({ where: { active: true } })

// TODO: Add connection pooling support
// FIXME: Handle connection timeout properly
// NOTE: This is a temporary workaround for SQLite limitations
```

### Multi-line Comments
```typescript
/*
 * Complex algorithm explanation:
 * 1. Parse the schema AST
 * 2. Extract relationship information
 * 3. Generate foreign key constraints
 * 4. Validate referential integrity
 */
```

### Header Comments
```typescript
/**
 * @fileoverview Database adapter factory
 * 
 * This module provides a factory function for creating database adapters
 * based on the provider type. It handles the instantiation and configuration
 * of provider-specific adapter implementations.
 * 
 * @author Drismify Team
 * @since 0.1.0
 */
```

## Error Message Guidelines
- **Be specific**: Include context about what failed
- **Be actionable**: Tell users what they can do to fix it
- **Be consistent**: Use consistent terminology and format

```typescript
// Good error messages
throw new Error(
  `Failed to connect to ${provider} database at ${url}. ` +
  `Check that the database server is running and the URL is correct.`
)

throw new ValidationError(
  `Invalid field type '${fieldType}' for ${provider} provider. ` +
  `Supported types: ${supportedTypes.join(', ')}`
)

// Bad error messages
throw new Error('Connection failed')
throw new Error('Invalid type')
```

## API Documentation Rules
- **Complete parameter documentation**: Document all parameters with types
- **Return value documentation**: Describe what is returned
- **Error documentation**: List possible errors and when they occur
- **Usage examples**: Provide working code examples
- **Version information**: Document when features were added

## Change Documentation
### Changelog Format
```markdown
# Changelog

## [0.2.1] - 2024-11-23

### Added
- New feature descriptions
- Enhancement details

### Changed
- Modified behavior explanations
- Breaking change notifications

### Fixed
- Bug fix descriptions
- Security patches

### Deprecated
- Features planned for removal
- Migration instructions
```

### Commit Message Format
```
type(scope): description

feat(adapter): add MongoDB support
fix(cli): resolve schema parsing error
docs(readme): update installation instructions
test(parser): add tests for enum parsing
refactor(client): improve type inference
```

## Documentation Tools
- **TypeDoc**: Generate API documentation from TypeScript
- **Markdown**: Use for all documentation files
- **Code examples**: Always test code examples
- **Screenshots**: Use for visual features like CLI output

## Accessibility Guidelines
- **Clear language**: Use simple, clear language
- **Logical structure**: Organize information logically
- **Code highlighting**: Use proper syntax highlighting
- **Alternative text**: Provide alt text for images
- **Link descriptions**: Use descriptive link text

## Maintenance Guidelines
- **Regular updates**: Keep documentation current with code changes
- **Version alignment**: Ensure docs match the current version
- **Dead link checking**: Regularly check and fix broken links
- **Example validation**: Verify all code examples work
- **User feedback**: Incorporate user feedback and questions