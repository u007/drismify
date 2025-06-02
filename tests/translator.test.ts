import { translatePslToDrizzleSchema } from '../src/translator/pslToDrizzle';
import { parseSchema } from '../src/parser';

describe('Translator', () => {
  it('should translate a simple schema to Drizzle schema', async () => {
    const schema = `
      datasource db {
        provider = "sqlite"
        url      = "file:./dev.db"
      }

      model User {
        id        Int      @id @default(autoincrement())
        email     String   @unique
        name      String?
        posts     Post[]
        createdAt DateTime @default(now())
        updatedAt DateTime @updatedAt
      }

      model Post {
        id        Int      @id @default(autoincrement())
        title     String
        content   String?
        published Boolean  @default(false)
        author    User     @relation(fields: [authorId], references: [id])
        authorId  Int
        createdAt DateTime @default(now())
        updatedAt DateTime @updatedAt
      }
    `;

    const ast = await parseSchema(schema);
    const drizzleSchema = translatePslToDrizzleSchema(ast);

    // Check that the Drizzle schema contains expected imports
    expect(drizzleSchema).toContain("import { sqliteTable");
    expect(drizzleSchema).toContain("import { text");
    expect(drizzleSchema).toContain("import { integer");

    // Check that the Drizzle schema contains the User table
    expect(drizzleSchema).toContain("export const user =");
    expect(drizzleSchema).toContain("id: integer('id')");
    expect(drizzleSchema).toContain("email: text('email')");
    expect(drizzleSchema).toContain("name: text('name')");

    // Check that the Drizzle schema contains the Post table
    expect(drizzleSchema).toContain("export const post =");
    expect(drizzleSchema).toContain("id: integer('id')");
    expect(drizzleSchema).toContain("title: text('title')");
    expect(drizzleSchema).toContain("content: text('content')");
    expect(drizzleSchema).toContain("published: integer('published'");

    // Check that the Drizzle schema contains relations
    expect(drizzleSchema).toContain("export const userRelations =");
    expect(drizzleSchema).toContain("posts: many(post)");
    expect(drizzleSchema).toContain("export const postRelations =");
    expect(drizzleSchema).toContain("author: one(user");
  });

  it('should translate enums to Drizzle schema', async () => {
    const schema = `
      enum Role {
        USER
        ADMIN
      }

      model User {
        id   Int  @id @default(autoincrement())
        role Role @default(USER)
      }
    `;

    const ast = await parseSchema(schema);
    const drizzleSchema = translatePslToDrizzleSchema(ast);

    // Check that the Drizzle schema contains the Role enum
    expect(drizzleSchema).toContain("export type Role =");
    expect(drizzleSchema).toContain("'USER' | 'ADMIN'");

    // Check that the Drizzle schema contains the User table with the Role field
    expect(drizzleSchema).toContain("export const user =");
    expect(drizzleSchema).toContain("role: text('role').$type<Role>()");
  });

  it('should translate model attributes to Drizzle schema', async () => {
    const schema = `
      model User {
        id    Int    @id
        email String @unique
        name  String

        @@index([name])
        @@unique([email, name])
      }
    `;

    const ast = await parseSchema(schema);
    const drizzleSchema = translatePslToDrizzleSchema(ast);

    // Check that the Drizzle schema contains the User table
    expect(drizzleSchema).toContain("export const user =");

    // Check that the Drizzle schema contains the index
    expect(drizzleSchema).toContain("export const useridxname =");
    expect(drizzleSchema).toContain("index(");

    // Check that the Drizzle schema contains the unique constraint
    expect(drizzleSchema).toContain("export const useruniqueemailname =");
    expect(drizzleSchema).toContain("uniqueIndex(");
  });
});
