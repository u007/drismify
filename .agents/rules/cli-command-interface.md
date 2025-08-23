# CLI and Command Interface Rules for Drismify

## CLI Architecture
- **Entry point**: `src/cli.ts` with shebang `#!/usr/bin/env node`
- **Dynamic imports**: Load CLI modules dynamically for ES module compatibility
- **Error handling**: Comprehensive error catching with detailed messages
- **Help system**: Built-in help for all commands and subcommands

## Command Structure
```bash
drismify <command> [subcommand] [options] [arguments]
```

## Available Commands

### Project Management
- `init [directory] [--provider <provider>]` - Initialize new project
- `generate [schema-path] [output-dir] [--watch]` - Generate client code
- `validate [schema-path] [--verbose] [--suggestions]` - Validate schema

### Database Operations
- `db push [--schema path] [--skip-generate] [--force] [--reset]` - Push schema to database
- `db pull [--schema path]` - Pull schema from database  
- `db seed [seed-script] [--reset]` - Seed database with data

### Migration Management
- `migrate dev [schema-path] [migration-name]` - Generate and apply development migrations
- `migrate deploy` - Apply pending migrations (production)
- `migrate reset` - Reset database and reapply migrations
- `migrate status` - Show migration status

### Advanced Operations
- `introspect <database-url> [provider] [output-path]` - Introspect existing database
- `studio [schema-path] [--port 5555]` - Launch database studio (planned)

## Command Implementation Pattern
```typescript
async function main() {
  const args = process.argv.slice(2)
  const command = args[0]
  
  // Dynamic import pattern
  if (command === 'validate') {
    const { validateSchema } = await import('./cli/validate.js')
    // Implementation
  }
}
```

## Error Handling Standards
- **Structured error output**: Include operation context and suggestions
- **Exit codes**: Use appropriate exit codes (0 for success, 1 for errors)
- **Stack traces**: Show in debug mode only
- **User-friendly messages**: Clear, actionable error descriptions

## Module Organization
```
src/cli/
├── index.ts        # Export all CLI functions
├── init.ts         # Project initialization
├── generate.ts     # Client generation
├── validate.ts     # Schema validation
├── db.ts          # Database operations
├── migrate.ts     # Migration management
├── introspect.ts  # Database introspection
├── seed.ts        # Database seeding
└── studio.ts      # Database studio (planned)
```

## Argument Parsing Rules
- **Positional arguments**: Required parameters come first
- **Flags and options**: Use `--flag` format for boolean options
- **Option values**: Use `--option value` format
- **Schema path resolution**: Use `path.resolve()` for file paths

## Configuration Discovery
- **Default schema**: Look for `schema.prisma` in current directory
- **Default output**: Use `./generated/client` for client generation
- **Migrations directory**: Default to `./migrations`
- **Environment variables**: Support `DATABASE_URL` and other env vars

## Provider Support
```typescript
type Provider = 'sqlite' | 'turso' | 'mongodb' | 'mysql'
```

## Output Formatting
- **Success messages**: Green checkmarks and clear success descriptions
- **Error messages**: Red X marks with detailed error information
- **Progress indicators**: Show current operation progress
- **Version display**: Show version on every command execution

## File System Operations
- **Path resolution**: Always use `path.resolve()` for absolute paths
- **Directory creation**: Create directories recursively as needed
- **File existence checks**: Verify files exist before operations
- **Backup creation**: Create backups before destructive operations

## Dynamic Module Loading
```typescript
// Use dynamic imports for ES module compatibility
const { functionName } = await import('./cli/module.js')

// Handle import failures gracefully
try {
  const module = await import('./optional-module.js')
} catch (error) {
  console.error('Module not available:', error.message)
}
```

## Command Validation
- **Required arguments**: Validate presence of required parameters
- **File existence**: Check schema files exist before processing
- **Provider validation**: Ensure valid database provider specified
- **URL validation**: Validate database URLs for introspection

## Help System
- **Global help**: `drismify help`, `drismify --help`, `drismify -h`
- **Command help**: Show usage when command used incorrectly
- **Subcommand help**: List available subcommands when needed
- **Examples**: Include practical usage examples in help text

## Environment Integration
- **Working directory**: Respect current working directory for relative paths
- **Environment variables**: Read configuration from environment
- **Shell integration**: Support shell completion (future feature)
- **Exit codes**: Use standard Unix exit codes

## Development vs Production
- **Development mode**: Additional debugging and verbose output
- **Production mode**: Minimal output, focus on success/failure
- **Debug flag**: Optional `--debug` flag for detailed output
- **Dry run**: Support `--dry-run` for preview operations

## Schema Processing
- **Parser integration**: Use PEG.js generated parser for schema validation
- **AST processing**: Convert parsed AST to appropriate formats
- **Error reporting**: Line numbers and context for schema errors
- **Suggestion system**: Provide helpful suggestions for common mistakes

## Database URL Handling
- **URL parsing**: Support all database provider URL formats
- **Environment variables**: Support `env("VARIABLE_NAME")` syntax
- **Validation**: Validate URL format for each provider
- **Security**: Never log complete URLs with credentials

## Migration Workflow
- **Development**: `migrate dev` generates and applies migrations
- **Production**: `migrate deploy` applies pending migrations only
- **Reset**: `migrate reset` for development database resets
- **Status**: `migrate status` shows pending/applied migrations

## Client Generation
- **Schema input**: Process Prisma schema files
- **Output directory**: Configurable client output location
- **Watch mode**: Support `--watch` for development
- **Type generation**: Generate TypeScript types and client code

## Introspection Features
- **Multiple providers**: Support introspection for all database types
- **Schema output**: Generate Prisma schema from existing database
- **Overwrite protection**: Confirm before overwriting existing files
- **Comment preservation**: Maintain comments during introspection

## CLI Testing
- **Mock file system**: Use temp directories for CLI tests
- **Command execution**: Test actual CLI command execution
- **Error scenarios**: Test invalid arguments and error conditions
- **Integration tests**: Test complete workflows end-to-end

## Performance Considerations
- **Lazy loading**: Load CLI modules only when needed
- **Startup time**: Minimize CLI startup overhead
- **Progress feedback**: Show progress for long-running operations
- **Memory usage**: Monitor memory usage for large schema processing