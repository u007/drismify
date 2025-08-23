# TypeScript Coding Standards for Drismify

## Module System
- **Use ES6 modules** exclusively (`import`/`export`)
- **No CommonJS** (`require`/`module.exports`) in source code
- Use dynamic imports for conditional loading: `await import('./module.js')`
- Always include `.js` extension in import paths for ES modules

## Type Safety
- **Strict mode disabled** (`"strict": false` in tsconfig.json)
- **No implicit any disabled** (`"noImplicitAny": false`) 
- Use explicit types for public APIs and complex interfaces
- Prefer `interface` over `type` for object shapes
- Use `any` sparingly and document why when necessary

## Class Design
- **Abstract base classes** for shared functionality (e.g., `BaseDatabaseAdapter`)
- **Concrete implementations** extend base classes (e.g., `SqliteAdapter extends BaseDatabaseAdapter`)
- Use `protected` for internal methods that subclasses need
- Use `private` for internal implementation details

## Async/Await Patterns
- **Always use async/await** instead of Promises directly
- **Handle errors properly** with try/catch blocks
- **Return Promise types** explicitly for public APIs
- **Transaction patterns**: Use callback functions for transaction scopes

## File Organization
- **One main class per file** with related interfaces
- **Index files** export public APIs from directories
- **Separate types files** for complex type definitions
- **Examples directory** for usage demonstrations

## Naming Conventions
- **PascalCase** for classes and interfaces (`DatabaseAdapter`, `QueryResult`)
- **camelCase** for methods and variables (`executeQuery`, `connectionOptions`)
- **SCREAMING_SNAKE_CASE** for constants (`VERSION`, `DEFAULT_TIMEOUT`)
- **kebab-case** for file names (`base-adapter.ts`, `mysql-adapter.ts`)

## Error Handling
- **Throw Error objects** with descriptive messages
- **Include context** in error messages (operation, parameters)
- **Use custom error types** for specific failure modes
- **Ensure connection state** before database operations

## Method Signatures
- **Options objects** for methods with multiple parameters
- **Return consistent result types** (`QueryResult<T>`)
- **Generic types** for flexible APIs (`execute<T>()`)
- **Optional parameters** with default values where appropriate

## Documentation
- **JSDoc comments** for all public methods and classes
- **Parameter descriptions** and return type documentation
- **Usage examples** in complex method documentation
- **@throws annotations** for methods that can throw errors

## Import Organization
- **Node.js built-ins** first (e.g., `import * as fs from 'node:fs'`)
- **Third-party packages** second
- **Internal modules** last
- **Group by type** (types, utilities, implementations)

## Code Style
- **No semicolons required** (based on tsconfig and existing code)
- **Single quotes** for strings
- **Trailing commas** in multiline objects and arrays
- **2-space indentation** (inferred from existing code)
- **Line length**: Keep reasonable, break long lines logically

## Performance Considerations
- **Lazy loading** for heavy dependencies
- **Connection pooling** support in adapter design
- **Batch operations** for multiple queries
- **Memory management** in long-running operations

## Testing Integration
- **Export testable units** separately from main implementations
- **Mock-friendly interfaces** for dependency injection
- **Async test patterns** with proper cleanup
- **Connection state management** in test environments