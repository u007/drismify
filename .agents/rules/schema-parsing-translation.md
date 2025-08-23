# Schema Parsing and Translation Rules for Drismify

## Parser Architecture
- **PEG.js grammar**: Define Prisma schema grammar in `src/parser/prisma.pegjs`
- **Generated parser**: Build parser with `pegjs -o src/parser/generatedParser.js`
- **ES module compatibility**: Convert CommonJS output to ES modules
- **Error handling**: Provide detailed syntax error messages with line numbers

## Schema Grammar Support
```prisma
// Supported schema elements
generator client { provider = "drismify" }
datasource db { provider = "sqlite"; url = "file:./dev.db" }
model User { id Int @id @default(autoincrement()) }
enum Role { USER; ADMIN; MODERATOR }
type Address { street String; city String }
```

## Parser Module Structure
```
src/parser/
├── prisma.pegjs          # PEG.js grammar definition
├── generatedParser.js    # Generated parser (build artifact)
├── index.ts             # Parser wrapper and utilities
└── prisma.js           # Additional parser utilities
```

## AST (Abstract Syntax Tree) Structure
```typescript
interface SchemaAST {
  type: 'datasource' | 'generator' | 'model' | 'enum' | 'type'
  name: string
  // Type-specific properties
}

interface ModelAST extends SchemaAST {
  type: 'model'
  fields: FieldAST[]
  attributes: AttributeAST[]
}

interface FieldAST {
  name: string
  type: TypeAST
  attributes: AttributeAST[]
  optional: boolean
  isArray: boolean
}
```

## Translation Pipeline
1. **Parse**: Prisma schema → AST
2. **Validate**: Check schema consistency and rules
3. **Transform**: AST → Drizzle schema definitions
4. **Generate**: Output TypeScript code

## Prisma to Drizzle Translation Rules

### Table Definitions
```typescript
// Prisma model → Drizzle table
model User {
  id Int @id @default(autoincrement())
  name String
}

// Becomes
export const user = sqliteTable('User', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull()
})
```

### Field Type Mappings
```typescript
// Prisma types → Drizzle column types
String → text()
Int → integer()
Boolean → integer({ mode: 'boolean' }) // SQLite
DateTime → integer({ mode: 'timestamp' })
Float → real()
Decimal → text() // Store as string for precision
Json → text({ mode: 'json' })
Bytes → blob()
```

### Attributes Translation
```typescript
// @id → primaryKey()
@id → .primaryKey()

// @unique → unique()
@unique → .unique()

// @default() → default()
@default(autoincrement()) → .primaryKey({ autoIncrement: true })
@default(now()) → .default(sql`CURRENT_TIMESTAMP`)
@default("value") → .default("value")

// @relation → foreign key
@relation(fields: [userId], references: [id]) → foreignKey()
```

### Relationship Handling
```typescript
// One-to-many relationships
posts Post[] // In User model
authorId Int  // In Post model
author User @relation(fields: [authorId], references: [id])

// Becomes relations definition
export const userRelations = relations(user, ({ many }) => ({
  posts: many(post)
}))

export const postRelations = relations(post, ({ one }) => ({
  author: one(user, {
    fields: [post.authorId],
    references: [user.id]
  })
}))
```

## Database Provider-Specific Translation

### SQLite Translation
```typescript
// Use sqliteTable from drizzle-orm/sqlite-core
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const user = sqliteTable('User', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull()
})
```

### MySQL Translation
```typescript
// Use mysqlTable from drizzle-orm/mysql-core
import { mysqlTable, varchar, int } from 'drizzle-orm/mysql-core'

export const user = mysqlTable('User', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 255 }).notNull()
})
```

### MongoDB Translation
```typescript
// MongoDB uses different pattern - document collections
import { mongoCollection } from 'drizzle-orm/mongodb-core'

export const user = mongoCollection('User', {
  _id: objectId('_id').primaryKey(),
  name: text('name').notNull()
})
```

## Schema Validation Rules
- **Unique model names**: No duplicate model names in schema
- **Valid relationships**: All relations must reference existing models and fields
- **Consistent types**: Field types must be valid for the database provider
- **Required fields**: Check for required provider and URL in datasource

## Error Handling and Reporting
```typescript
interface ParseError {
  message: string
  line?: number
  column?: number
  location?: {
    start: { line: number; column: number }
    end: { line: number; column: number }
  }
}
```

## Translation Utilities
```typescript
// Helper functions for translation
function mapPrismaTypeToDatabase(
  prismaType: string, 
  provider: DatabaseProvider
): DrizzleColumnType

function generateRelationDefinitions(
  models: ModelAST[]
): RelationDefinition[]

function validateSchemaConsistency(ast: SchemaAST[]): ValidationResult
```

## Advanced Schema Features

### Composite Types
```prisma
type Address {
  street String
  city String
  zipCode String?
}

model User {
  address Address
}
```

Translates to JSON storage with type definitions:
```typescript
export const user = sqliteTable('User', {
  address: text('address', { mode: 'json' }).$type<Address>()
})
```

### Enum Handling
```prisma
enum Role {
  USER
  ADMIN
  MODERATOR
}
```

Translates to:
```typescript
export const roleEnum = text('role', { 
  enum: ['USER', 'ADMIN', 'MODERATOR'] 
})

export const user = sqliteTable('User', {
  role: roleEnum.notNull().default('USER')
})
```

### Indexes and Constraints
```prisma
model User {
  email String @unique
  name String
  
  @@index([name])
  @@unique([email, name])
}
```

Translates to:
```typescript
export const user = sqliteTable('User', {
  email: text('email').notNull().unique(),
  name: text('name').notNull()
}, (table) => ({
  nameIdx: index('name_idx').on(table.name),
  emailNameUnique: unique('email_name_unique').on(table.email, table.name)
}))
```

## Build Integration
- **Build script**: Include parser generation in build process
- **Watch mode**: Regenerate parser when grammar changes
- **Validation**: Validate generated parser works correctly
- **Error reporting**: Clear errors when parser generation fails

## Testing Requirements
- **Grammar testing**: Test all Prisma schema constructs
- **Error handling**: Test invalid schema error reporting
- **Translation testing**: Verify correct Drizzle output generation
- **Edge cases**: Test complex schemas and unusual constructs

## Performance Considerations
- **Parsing speed**: Optimize grammar for fast parsing
- **Memory usage**: Monitor memory usage for large schemas
- **Incremental parsing**: Support partial schema updates (future)
- **Caching**: Cache parsed ASTs for repeated operations

## Compatibility Maintenance
- **Prisma version tracking**: Track Prisma schema language changes
- **Feature parity**: Maintain compatibility with Prisma features
- **Migration support**: Help migrate from Prisma to Drismify
- **Validation**: Ensure generated code works with target databases