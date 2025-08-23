# Testing and Quality Assurance Rules for Drismify

## Test Framework Configuration
- **Jest** as primary testing framework with TypeScript support
- **Bun runtime** for test execution: `bun --bail --serial test !dist/ .`
- **ts-jest** transformer for TypeScript files
- **30-second timeout** for long-running database operations
- **Serial execution** to avoid database conflicts

## Test Organization Structure
```
tests/
├── 001-schema-parsing/     # Feature-based numbering
├── 002-schema-translation/
├── 003-database-adapters/
├── 004-client-generation/
├── 005-migration-system/
├── adapters/               # Component-based grouping
├── cli/
├── client/
├── integration/            # End-to-end tests
├── fixtures/               # Test data
├── utils/                  # Test utilities
└── setup.ts               # Global test setup
```

## Test Naming Conventions
- **Files**: `*.test.ts` pattern
- **Describe blocks**: Feature or class name being tested
- **Test cases**: Should describe expected behavior clearly
  - ✅ `should parse a basic model with relations`
  - ❌ `test model parsing`

## Database Testing Patterns
- **Clean database** before each test (`beforeEach` cleanup)
- **Temporary databases** in `tests/temp/db/` directory
- **Mock adapters** for unit testing client logic
- **Real databases** for integration testing
- **Connection state management** in test environments

## Test Categories and Requirements

### Unit Tests
- **Isolated components** testing single functions/classes
- **Mock external dependencies** (database connections, file system)
- **Fast execution** (under 100ms per test)
- **High coverage** of business logic and edge cases

### Integration Tests  
- **Real database connections** for adapter testing
- **End-to-end workflows** (schema → client → query)
- **CLI command testing** with temporary files
- **Extension system integration** testing

### Database Adapter Tests
- **Connection lifecycle** testing (connect/disconnect)
- **Query execution** with various parameter types
- **Transaction handling** and rollback scenarios
- **Error conditions** (connection failures, invalid queries)
- **Batch operations** and performance

### Schema Parser Tests
- **Valid schema parsing** with all Prisma features
- **Error handling** for invalid syntax
- **AST structure validation** for complex schemas
- **Edge cases** (comments, whitespace, special characters)

### CLI Tests
- **Command execution** with various arguments
- **File generation** and validation
- **Error messaging** for invalid inputs
- **Help system** functionality

## Test Data Management
- **Fixtures directory** for reusable test schemas
- **Test utilities** for common operations
- **Global test helpers** in setup.ts:
  - `getFixturePath(filename)`
  - `getTempPath(filename)`
  - `readFixture(filename)`
  - `writeTemp(filename, content)`

## Mock and Stub Patterns
- **MockPrismaClient** for testing extensions
- **Mock adapters** with connection state tracking
- **Stub external services** (file system, network)
- **Dependency injection** for testable code

## Test Coverage Requirements
- **Minimum 80% code coverage** for core modules
- **100% coverage** for critical paths (schema parsing, client generation)
- **Exception paths** must be tested
- **Edge cases** and error conditions covered

## Performance Testing
- **Benchmark critical operations** (schema parsing, query execution)
- **Memory usage** monitoring for large schemas
- **Connection pooling** performance
- **Extension overhead** measurement

## Test Environment Setup
```typescript
// Required environment variables
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'file:./tests/temp/db/test.db'

// Global timeout
jest.setTimeout(30000)

// Custom matchers
expect.extend({
  toBeValidSchema(received: string) { /* validation logic */ }
})
```

## Database-Specific Testing
- **SQLite**: File-based databases in temp directory
- **MySQL**: Docker containers or test database instances
- **MongoDB**: MongoDB Memory Server for unit tests
- **TursoDB**: Mock libSQL client for testing

## Async Testing Patterns
- **Always use async/await** in tests
- **Proper cleanup** in afterEach/afterAll hooks
- **Handle Promise rejections** explicitly
- **Test timeout scenarios** appropriately

## Error Testing Requirements
- **Expected errors** must be tested with specific error messages
- **Validation failures** should be caught and verified
- **Connection failures** must be handled gracefully
- **Malformed input** should produce clear error messages

## Continuous Integration Rules
- **All tests must pass** before merge
- **Coverage reports** generated and reviewed
- **No flaky tests** - tests must be deterministic
- **Fast feedback** - test suite under 5 minutes total

## Test Documentation
- **Complex test setups** must be documented
- **Test data** should be self-explanatory
- **Integration test scenarios** documented
- **Known limitations** and workarounds noted

## Quality Gates
- **Zero TypeScript errors** in test code
- **All async operations** properly awaited
- **Resources cleaned up** (connections, files, timers)
- **No test interdependencies** - tests run in any order