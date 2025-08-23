# Database Adapter Architecture Rules for Drismify

## Adapter Pattern Implementation
- **Base class inheritance**: All adapters extend `BaseDatabaseAdapter`
- **Interface compliance**: Implement `DatabaseAdapter` interface completely
- **Database-specific logic**: Isolate vendor-specific code in concrete adapters
- **Factory pattern**: Use `createAdapter()` factory for adapter instantiation

## Supported Database Types
```typescript
type DatabaseProvider = 'sqlite' | 'turso' | 'mysql' | 'mongodb'
```

### Current Implementations
- **SQLite**: `SqliteAdapter` using `better-sqlite3`
- **TursoDB**: `TursoAdapter` using `@libsql/client`
- **MySQL/MariaDB**: `MySqlAdapter` using `mysql2`
- **MongoDB**: `MongoDbAdapter` using `mongodb` driver

## Base Adapter Contract
```typescript
abstract class BaseDatabaseAdapter implements DatabaseAdapter {
  // Required implementations
  abstract connect(): Promise<void>
  abstract disconnect(): Promise<void>
  abstract execute<T>(query: string, params?: any[]): Promise<QueryResult<T>>
  abstract executeRaw<T>(query: string, params?: any[]): Promise<QueryResult<T>>
  abstract transaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T>
  
  // Default implementations provided
  async batch<T>(queries: Array<{query: string; params?: any[]}>): Promise<Array<QueryResult<T>>>
  async $transaction<T>(operations: Array<() => Promise<T>>): Promise<T[]>
  isActive(): boolean
}
```

## Connection Management
- **Connection state tracking**: Use `isConnected` boolean flag
- **Connection validation**: `ensureConnected()` before operations
- **Graceful disconnection**: Clean up resources in `disconnect()`
- **Connection options**: Accept provider-specific configuration

## Query Execution Patterns
- **Parameterized queries**: Always use parameter binding for safety
- **Result consistency**: Return standardized `QueryResult<T>` format
- **Error wrapping**: Convert database-specific errors to standard format
- **Type safety**: Generic return types for query results

## Transaction Handling
- **Callback pattern**: Transaction functions receive `TransactionClient`
- **Automatic rollback**: Roll back on exceptions
- **Nested transactions**: Support adapter-dependent nesting
- **Connection state**: Maintain connection during transaction scope

## Batch Operations
- **Sequential execution**: Default implementation runs queries in sequence
- **Transaction option**: Use `BatchOptions.transaction` for atomic batches
- **Performance optimization**: Adapters can override for native batch support
- **Error handling**: Stop on first error or continue based on options

## Database-Specific Implementations

### SQLite Adapter (`sqlite-adapter.ts`)
- **Synchronous nature**: Wrap sync operations in Promises
- **File-based**: Handle database file path and permissions
- **WAL mode**: Enable for better concurrency
- **Foreign keys**: Enable foreign key constraints

### TursoDB Adapter (`turso-adapter.ts`)
- **LibSQL client**: Use `@libsql/client` for connection
- **Remote database**: Handle network connectivity issues
- **Authentication**: Support auth tokens and URLs
- **Async operations**: All operations are naturally async

### MySQL Adapter (`mysql-adapter.ts`)
- **Connection pooling**: Manage connection pools properly
- **SSL support**: Handle secure connections
- **Timezone handling**: Consistent UTC timestamp handling
- **Character encoding**: UTF-8 by default

### MongoDB Adapter (`mongodb-adapter.ts`)
- **Document-oriented**: Translate relational queries to document operations
- **Collections mapping**: Map tables to MongoDB collections
- **ObjectId handling**: Convert between strings and ObjectIds
- **Aggregation pipeline**: Use for complex queries

## Error Handling Standards
```typescript
// Standard error format
interface DatabaseError extends Error {
  code?: string          // Database-specific error code
  constraint?: string    // Constraint violation details
  table?: string        // Affected table/collection
  column?: string       // Affected column/field
}
```

## Configuration Options
```typescript
interface ConnectionOptions {
  provider: DatabaseProvider
  url: string
  // Provider-specific options
  ssl?: boolean | SSLOptions
  pool?: PoolOptions
  timeout?: number
  retries?: number
}
```

## Testing Requirements
- **Mock implementations**: Create `MockAdapter` for testing
- **Connection simulation**: Track connection state in mocks
- **Error simulation**: Test error conditions and recovery
- **Performance testing**: Benchmark adapter operations
- **Database fixtures**: Provide test data for each adapter type

## Performance Considerations
- **Connection reuse**: Avoid connection churn
- **Query optimization**: Use database-specific optimizations
- **Lazy loading**: Connect only when needed
- **Resource cleanup**: Proper disposal of connections and resources

## Security Requirements
- **SQL injection prevention**: Always use parameterized queries
- **Connection string security**: Mask sensitive data in logs
- **SSL/TLS**: Support encrypted connections
- **Authentication**: Handle database authentication securely

## Monitoring and Logging
- **Query logging**: Optional query logging for debugging
- **Performance metrics**: Track query execution times
- **Connection events**: Log connection/disconnection events
- **Error tracking**: Detailed error logging with context

## Extension Points
- **Hooks**: Pre/post operation hooks for monitoring
- **Interceptors**: Query modification and enhancement
- **Custom types**: Database-specific type mappings
- **Migration support**: Schema change operations

## Factory Pattern Usage
```typescript
// Factory creates appropriate adapter based on provider
const adapter = createAdapter({
  provider: 'sqlite',
  url: 'file:./dev.db'
})

// Type-safe adapter creation
const adapter: DatabaseAdapter = createAdapter(options)
```

## Backward Compatibility
- **Interface stability**: Don't break `DatabaseAdapter` interface
- **Graceful degradation**: Handle missing features gracefully
- **Version detection**: Detect database version capabilities
- **Feature flags**: Enable/disable features based on database support