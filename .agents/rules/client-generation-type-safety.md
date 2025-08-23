# Client Generation and Type Safety Rules for Drismify

## Client Generation Architecture
- **Schema-to-Code**: Generate TypeScript client from Prisma schema
- **Type Safety**: Full TypeScript type inference and checking
- **Prisma Compatibility**: API compatible with Prisma Client
- **Multiple Outputs**: Support different output directories and formats
- **Watch Mode**: Regenerate client on schema changes

## Generator Module Structure
```
src/generator/
├── index.ts              # Main generator exports
└── client-generator.ts   # Client code generation logic
```

## Generated Client Structure
```
generated/client/
├── models/              # Individual model clients
│   ├── user.ts         # User model operations
│   ├── post.ts         # Post model operations
│   └── index.ts        # Export all models
├── index.ts            # Main client export
├── types.ts            # Generated TypeScript types
├── package.json        # Generated package metadata
└── README.md          # Generated documentation
```

## Type Generation Rules

### Model Types
```typescript
// Generated from Prisma model
model User {
  id    Int     @id @default(autoincrement())
  email String  @unique
  name  String?
  posts Post[]
}

// Generates
export interface User {
  id: number
  email: string
  name: string | null
  posts?: Post[]
}

export interface UserCreateInput {
  email: string
  name?: string | null
  posts?: PostCreateNestedManyWithoutAuthorInput
}

export interface UserUpdateInput {
  email?: string | StringFieldUpdateOperationsInput
  name?: NullableStringFieldUpdateOperationsInput | string | null
  posts?: PostUpdateManyWithoutAuthorNestedInput
}
```

### Relationship Types
```typescript
// One-to-many relationship types
export interface UserInclude {
  posts?: boolean | PostFindManyArgs
}

export interface UserSelect {
  id?: boolean
  email?: boolean
  name?: boolean
  posts?: boolean | PostFindManyArgs
}

// Many-to-one relationship types
export interface PostInclude {
  author?: boolean | UserArgs
}
```

### Query Result Types
```typescript
// Conditional types based on include/select
type UserGetPayload<S extends UserArgs> = 
  S extends { select: infer U }
    ? U extends Record<keyof U, never>
      ? never
      : { [P in keyof U as string extends P ? never : P]: P extends keyof User ? User[P] : never }
    : S extends { include: infer U }
      ? User & { [P in keyof U]: U[P] extends true ? Post[] : never }
      : User
```

## Client Generation Process
1. **Parse Schema**: Load and parse Prisma schema file
2. **Extract Models**: Extract model definitions and relationships
3. **Generate Types**: Create TypeScript interfaces and types
4. **Generate Operations**: Create CRUD operation methods
5. **Generate Relations**: Create relationship helper methods
6. **Write Files**: Output generated code to target directory

## Model Client Generation
```typescript
// Generated model client class
export class UserClient {
  constructor(private adapter: DatabaseAdapter) {}

  async findUnique<T extends UserFindUniqueArgs>(
    args: SelectSubset<T, UserFindUniqueArgs>
  ): Promise<UserGetPayload<T> | null> {
    // Implementation
  }

  async findMany<T extends UserFindManyArgs>(
    args?: SelectSubset<T, UserFindManyArgs>
  ): Promise<Array<UserGetPayload<T>>> {
    // Implementation
  }

  async create<T extends UserCreateArgs>(
    args: SelectSubset<T, UserCreateArgs>
  ): Promise<UserGetPayload<T>> {
    // Implementation
  }

  async update<T extends UserUpdateArgs>(
    args: SelectSubset<T, UserUpdateArgs>
  ): Promise<UserGetPayload<T>> {
    // Implementation
  }

  async delete<T extends UserDeleteArgs>(
    args: SelectSubset<T, UserDeleteArgs>
  ): Promise<UserGetPayload<T>> {
    // Implementation
  }
}
```

## Main Client Generation
```typescript
// Generated main client
export class DrismifyClient {
  readonly user: UserClient
  readonly post: PostClient
  
  constructor(options: ClientOptions) {
    const adapter = createAdapter(options)
    this.user = new UserClient(adapter)
    this.post = new PostClient(adapter)
  }

  async $connect(): Promise<void> {
    await this.adapter.connect()
  }

  async $disconnect(): Promise<void> {
    await this.adapter.disconnect()
  }

  $extends<T>(extension: T): ExtendedClient<T> {
    return applyExtension(this, extension)
  }
}
```

## Type Safety Features

### Strict Type Checking
- **No any types**: All generated types are strictly typed
- **Null safety**: Proper handling of nullable fields
- **Optional fields**: Correct optional field typing
- **Relationship types**: Type-safe relationship access

### Generic Type Parameters
```typescript
// Generic type constraints for type safety
interface FindManyArgs<T> {
  where?: T
  select?: { [K in keyof T]?: boolean }
  include?: RelationInclude<T>
  orderBy?: OrderBy<T>
  take?: number
  skip?: number
}
```

### Conditional Types
```typescript
// Conditional result types based on query parameters
type GetResult<T, A> = 
  A extends { select: infer S }
    ? SelectResult<T, S>
    : A extends { include: infer I }
      ? IncludeResult<T, I>
      : T
```

## Advanced Type Features

### Field Selection
```typescript
// Type-safe field selection
const user = await client.user.findUnique({
  where: { id: 1 },
  select: {
    id: true,
    email: true,
    // posts: true // This would change the return type
  }
})
// user: { id: number; email: string }
```

### Relationship Inclusion
```typescript
// Type-safe relationship inclusion
const userWithPosts = await client.user.findUnique({
  where: { id: 1 },
  include: {
    posts: true
  }
})
// userWithPosts: User & { posts: Post[] }
```

### Nested Writes
```typescript
// Type-safe nested write operations
const user = await client.user.create({
  data: {
    email: 'user@example.com',
    posts: {
      create: [
        { title: 'First Post', content: 'Hello World' },
        { title: 'Second Post', content: 'Another post' }
      ]
    }
  }
})
```

## Error Type Generation
```typescript
// Generated error types
export class PrismaClientKnownRequestError extends Error {
  code: string
  meta?: Record<string, unknown>
  constructor(message: string, code: string, meta?: Record<string, unknown>)
}

export class PrismaClientUnknownRequestError extends Error {
  constructor(message: string)
}

export class PrismaClientValidationError extends Error {
  constructor(message: string)
}
```

## Code Generation Utilities
```typescript
// Helper functions for code generation
function generateModelInterface(model: ModelAST): string
function generateCreateInput(model: ModelAST): string
function generateUpdateInput(model: ModelAST): string
function generateWhereInput(model: ModelAST): string
function generateIncludeType(model: ModelAST): string
function generateSelectType(model: ModelAST): string
```

## Template System
- **Template files**: Use template files for consistent code generation
- **Variable substitution**: Replace placeholders with actual values
- **Conditional blocks**: Include/exclude code based on schema features
- **Code formatting**: Ensure generated code is properly formatted

## Watch Mode Implementation
```typescript
// Watch for schema changes and regenerate
async function watchMode(schemaPath: string, outputDir: string) {
  const watcher = fs.watch(schemaPath, (eventType) => {
    if (eventType === 'change') {
      console.log('Schema changed, regenerating client...')
      generateClient({ schemaPath, outputDir })
    }
  })
}
```

## Generated Package Structure
```json
{
  "name": "@generated/client",
  "version": "0.0.1",
  "main": "index.js",
  "types": "index.d.ts",
  "exports": {
    ".": {
      "types": "./index.d.ts",
      "import": "./index.js"
    }
  }
}
```

## Quality Assurance
- **Generated code validation**: Ensure generated code compiles
- **Type checking**: Verify all types are correct
- **Runtime testing**: Test generated client operations
- **Performance testing**: Monitor generation speed and output size

## Backward Compatibility
- **API stability**: Maintain stable client API across versions
- **Migration guides**: Provide migration paths for breaking changes
- **Deprecation warnings**: Warn about deprecated features
- **Version detection**: Detect schema version and adapt generation

## Optimization Features
- **Tree shaking**: Generate code that supports tree shaking
- **Lazy loading**: Support lazy loading of model clients
- **Bundle size**: Minimize generated code size
- **Compilation speed**: Optimize TypeScript compilation speed

## Testing Generated Code
```typescript
// Test that generated types work correctly
it('should generate correct types for User model', () => {
  const user: User = {
    id: 1,
    email: 'test@example.com',
    name: 'Test User'
  }
  
  const createInput: UserCreateInput = {
    email: 'new@example.com',
    name: 'New User'
  }
  
  // Type checking ensures these compile correctly
  expect(user.id).toBe(1)
  expect(createInput.email).toBe('new@example.com')
})
```