# Migration System Rules for Drismify

## Migration Architecture
- **Schema-driven migrations**: Generate migrations from schema changes
- **Version control**: Track migration history and status
- **Rollback support**: Support for migration rollbacks
- **Database-agnostic**: Work across all supported database providers
- **Development vs Production**: Different workflows for different environments

## Migration Module Structure
```
src/migrations/
├── index.ts               # Main migration exports
├── migration-generator.ts # Generate migration files
├── migration-manager.ts   # Execute and track migrations
├── schema-differ.ts       # Compare schema versions
└── types.ts              # Migration type definitions
```

## Migration Commands

### Development Workflow
```bash
# Generate and apply migration in development
drismify migrate dev [schema-path] [migration-name]
```

### Production Workflow
```bash
# Apply pending migrations in production
drismify migrate deploy

# Check migration status
drismify migrate status

# Reset database (development only)
drismify migrate reset
```

## Migration File Structure
```typescript
// migration_YYYYMMDD_HHMMSS_name.sql
-- Migration: 20241123_143022_add_user_table
-- Generated at: 2024-11-23T14:30:22.000Z
-- Schema: schema.prisma

-- Up migration
CREATE TABLE User (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Down migration (for rollback)
-- DROP TABLE User;
```

## Migration Types
```typescript
interface Migration {
  id: string
  name: string
  timestamp: Date
  checksum: string
  up: string[]      // Forward migration SQL
  down: string[]    // Rollback migration SQL
  applied: boolean
  appliedAt?: Date
}

interface MigrationResult {
  success: boolean
  error?: string
  migrationsApplied: string[]
}
```

## Schema Diffing Rules
- **Compare table structures**: Detect added/removed tables
- **Compare column changes**: Detect type changes, additions, removals
- **Compare indexes**: Track index additions and modifications
- **Compare constraints**: Foreign keys, unique constraints, check constraints
- **Preserve data**: Generate safe migration paths

## Migration Generation Process
1. **Parse current schema**: Load and parse Prisma schema
2. **Compare with previous**: Diff against last migration state
3. **Generate SQL**: Create database-specific migration SQL
4. **Validate migration**: Check for potential data loss
5. **Create migration file**: Write timestamped migration file

## Database-Specific Migration SQL

### SQLite Migrations
```sql
-- Create table
CREATE TABLE User (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE
);

-- Add column (SQLite limitation workaround)
ALTER TABLE User ADD COLUMN name TEXT;

-- Create index
CREATE INDEX idx_user_email ON User(email);
```

### MySQL Migrations
```sql
-- Create table
CREATE TABLE User (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255)
);

-- Modify column
ALTER TABLE User MODIFY COLUMN name VARCHAR(500);

-- Add foreign key
ALTER TABLE Post ADD CONSTRAINT fk_post_author 
  FOREIGN KEY (authorId) REFERENCES User(id);
```

### MongoDB Migrations
```javascript
// MongoDB migrations are JavaScript/JSON
db.createCollection('User');

// Create index
db.User.createIndex({ email: 1 }, { unique: true });

// Update documents
db.User.updateMany({}, { $set: { status: 'active' } });
```

## Migration State Tracking
```sql
-- Migration tracking table
CREATE TABLE _drismify_migrations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  checksum TEXT NOT NULL,
  applied_at DATETIME NOT NULL
);
```

## Migration Safety Rules
- **No destructive operations in production**: Avoid DROP, ALTER that loses data
- **Backup recommendations**: Suggest backups before migrations
- **Validation steps**: Validate migration before applying
- **Rollback verification**: Ensure down migrations work correctly

## Development Migration Workflow
```typescript
async function migrateDev(options: {
  schemaPath: string
  name: string
  migrationsDir: string
}) {
  // 1. Parse current schema
  const currentSchema = await parseSchema(options.schemaPath)
  
  // 2. Compare with last migration
  const diff = await compareSchemata(lastSchema, currentSchema)
  
  // 3. Generate migration if changes exist
  if (diff.hasChanges) {
    const migration = await generateMigration(diff, options.name)
    await writeMigrationFile(migration, options.migrationsDir)
    await applyMigration(migration)
  }
}
```

## Production Migration Workflow
```typescript
async function migrateDeploy(options: {
  migrationsDir: string
}) {
  // 1. Load pending migrations
  const pending = await getPendingMigrations(options.migrationsDir)
  
  // 2. Apply each migration in order
  for (const migration of pending) {
    await applyMigration(migration)
    await recordMigrationApplied(migration)
  }
}
```

## Migration Validation
- **SQL syntax validation**: Check generated SQL syntax
- **Dependency validation**: Ensure foreign key targets exist
- **Data integrity**: Verify migration preserves data integrity
- **Reversibility**: Ensure down migrations can reverse up migrations

## Error Handling
```typescript
interface MigrationError {
  type: 'syntax' | 'dependency' | 'data_loss' | 'constraint'
  message: string
  migration: string
  line?: number
  suggestion?: string
}
```

## Rollback Support
```typescript
async function rollbackMigration(migrationId: string) {
  const migration = await getMigration(migrationId)
  
  if (migration.down.length === 0) {
    throw new Error('Migration does not support rollback')
  }
  
  // Execute down migration
  await executeMigrationSQL(migration.down)
  await recordMigrationRolledBack(migrationId)
}
```

## Migration Testing
- **Test migration generation**: Verify correct SQL generation
- **Test migration application**: Verify migrations apply correctly
- **Test rollback**: Verify down migrations work
- **Test edge cases**: Schema renames, complex relationships

## Performance Considerations
- **Large table migrations**: Handle large table modifications
- **Index creation**: Create indexes with minimal downtime
- **Batch operations**: Use batching for large data migrations
- **Connection timeouts**: Handle long-running migrations

## Migration Best Practices
- **Descriptive names**: Use clear, descriptive migration names
- **Atomic operations**: Each migration should be atomic
- **Test migrations**: Test migrations in development first
- **Review generated SQL**: Always review generated migration SQL

## Custom Migration Support
```typescript
// Allow custom migration SQL
interface CustomMigration {
  name: string
  up: string[]
  down: string[]
  skipGeneration?: boolean
}

async function createCustomMigration(migration: CustomMigration) {
  await writeMigrationFile(migration, migrationsDir)
}
```

## Migration Hooks
```typescript
interface MigrationHooks {
  beforeMigration?: (migration: Migration) => Promise<void>
  afterMigration?: (migration: Migration) => Promise<void>
  onError?: (error: MigrationError) => Promise<void>
}
```

## Schema Evolution Tracking
- **Schema snapshots**: Save schema state at each migration
- **Change history**: Track what changed in each migration
- **Schema visualization**: Tools to visualize schema evolution
- **Conflict detection**: Detect conflicting schema changes

## Environment-Specific Rules
- **Development**: Allow destructive operations, auto-apply migrations
- **Staging**: Require manual approval for destructive operations
- **Production**: Strict validation, backup requirements, no auto-apply