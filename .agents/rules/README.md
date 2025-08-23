# Drismify Project Rules Index

This directory contains comprehensive rule files for the Drismify project, a modern Prisma-compatible ORM replacement. These rules guide development, architecture, testing, and maintenance of the project.

## Rule Files Overview

### 📝 [TypeScript Coding Standards](./typescript-coding-standards.md)
**Core development patterns and TypeScript usage rules**
- ES6 modules usage and import patterns
- Type safety practices (strict mode disabled by design)
- Class design patterns with abstract base classes
- Async/await patterns and error handling
- File organization and naming conventions
- Documentation requirements with JSDoc

### 🧪 [Testing and Quality Assurance](./testing-quality-assurance.md)
**Comprehensive testing framework and quality gates**
- Jest configuration with TypeScript and Bun runtime
- Test organization structure with numbered feature directories
- Database testing patterns with temporary databases
- Mock and stub patterns for unit testing
- Coverage requirements (80% minimum, 100% for critical paths)
- Performance testing and CI/CD integration

### 🗄️ [Database Adapter Architecture](./database-adapter-architecture.md)
**Database abstraction layer and adapter pattern implementation**
- Base adapter contract with `BaseDatabaseAdapter` class
- Support for SQLite, TursoDB, MySQL/MariaDB, and MongoDB
- Connection management and transaction handling
- Query execution patterns and batch operations
- Database-specific implementation guidelines
- Error handling and security requirements

### 💻 [CLI and Command Interface](./cli-command-interface.md)
**Command-line interface design and implementation**
- Command structure and argument parsing
- Dynamic module loading for ES module compatibility
- Comprehensive command set (init, generate, validate, migrate, db operations)
- Error handling and user experience guidelines
- Configuration discovery and environment integration
- Help system and output formatting standards

### 🔧 [Extension System and Plugins](./extension-system-plugins.md)
**Prisma $extends compatible extension architecture**
- Extension types: Model, Client, Query, and Result extensions
- Built-in extensions (soft delete, audit, computed fields)
- Extension composition and type safety preservation
- Performance optimization and error isolation
- Testing patterns for extensions
- Advanced features like dynamic extensions and hooks

### 📄 [Schema Parsing and Translation](./schema-parsing-translation.md)
**Prisma schema processing and Drizzle translation**
- PEG.js grammar definition and parser generation
- AST structure and validation rules
- Prisma to Drizzle translation mappings
- Database provider-specific translations
- Advanced schema features (composite types, enums, indexes)
- Error handling and compatibility maintenance

### 🔄 [Migration System](./migration-system.md)
**Database schema evolution and migration management**
- Schema-driven migration generation
- Development vs production workflows
- Migration file structure and versioning
- Database-specific migration SQL generation
- Rollback support and safety rules
- Migration state tracking and validation

### 🏗️ [Client Generation and Type Safety](./client-generation-type-safety.md)
**TypeScript client code generation from schemas**
- Type-safe client API generation
- Model types and relationship type generation
- Conditional types based on query parameters
- Advanced type features (field selection, nested writes)
- Generated code structure and optimization
- Backward compatibility and testing requirements

### 📚 [Documentation and Naming Conventions](./documentation-naming-conventions.md)
**Project documentation and naming standards**
- File and directory naming (kebab-case)
- TypeScript naming (PascalCase, camelCase, SCREAMING_SNAKE_CASE)
- Database-related naming conventions
- JSDoc documentation standards
- README structure and content guidelines
- Error message and API documentation rules

### 🏭 [Build and Deployment](./build-deployment.md)
**Build system, packaging, and deployment processes**
- TypeScript compilation with ES2020/ESNext
- PEG.js parser generation and ES module conversion
- CLI executable creation and permissions
- Package.json configuration and exports
- Multi-format support (ESM primary, CommonJS compatibility)
- Publishing process and version management

## Project Overview

### Technology Stack
- **Language**: TypeScript with ES modules
- **Runtime**: Node.js 16+ (ESNext modules)
- **Testing**: Jest with Bun runtime
- **Databases**: SQLite, TursoDB, MySQL/MariaDB, MongoDB
- **ORM Base**: Drizzle ORM for database operations
- **CLI**: Node.js with shebang scripts
- **Parser**: PEG.js for Prisma schema parsing

### Architecture Principles
1. **Prisma Compatibility**: Drop-in replacement for Prisma Client
2. **Multi-Database Support**: Unified API across different database types
3. **Extension System**: Full Prisma $extends API compatibility
4. **Type Safety**: Complete TypeScript type inference
5. **Performance**: Direct database access without intermediary layers
6. **Developer Experience**: Familiar CLI and schema language

### Key Components
- **Adapters**: Database-specific implementations
- **Client**: Type-safe query interface
- **CLI**: Command-line tools for project management
- **Extensions**: Custom behavior and middleware system
- **Generator**: TypeScript client code generation
- **Migrations**: Schema evolution and database updates
- **Parser**: Prisma schema language processing

### Development Workflow
1. **Schema Definition**: Write Prisma schema files
2. **Client Generation**: Generate TypeScript client from schema
3. **Database Operations**: Use generated client for queries
4. **Extensions**: Add custom behavior with extension system
5. **Migrations**: Evolve schema with migration system
6. **Testing**: Comprehensive test suite with real databases

### Quality Standards
- **Test Coverage**: 80% minimum, 100% for critical paths
- **Type Safety**: No `any` types in public APIs
- **Performance**: Benchmarked operations and memory usage
- **Documentation**: Complete API documentation with examples
- **Compatibility**: Maintain Prisma API compatibility

## Rule Compliance
All development on the Drismify project must follow these rules to ensure:
- **Consistency**: Uniform code style and architecture
- **Quality**: High code quality and test coverage
- **Maintainability**: Clear structure and documentation
- **Performance**: Optimized database operations
- **Compatibility**: Seamless migration from Prisma
- **Developer Experience**: Intuitive APIs and helpful tooling

## Contributing
When contributing to Drismify:
1. **Read relevant rule files** for the area you're working on
2. **Follow naming conventions** and code style guidelines
3. **Write comprehensive tests** with proper coverage
4. **Document new features** with JSDoc and examples
5. **Validate against rules** before submitting PRs

These rules are living documents that evolve with the project. Updates should be discussed and approved by the project maintainers.