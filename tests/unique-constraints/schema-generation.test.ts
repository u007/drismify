/**
 * Test suite for unique constraint schema generation
 */

import { describe, it, expect } from 'bun:test';
import { parseSchema } from '../../src/parser';
import { translatePslToDrizzleSchema } from '../../src/translator/pslToDrizzle';

describe('Unique Constraint Schema Generation', () => {
  describe('Single-field unique constraints', () => {
    it('should generate correct Drizzle schema for @unique field attribute', async () => {
      const schema = `
        model User {
          id    Int    @id @default(autoincrement())
          email String @unique
          name  String
        }
      `;

      const ast = await parseSchema(schema);
      const drizzleSchema = translatePslToDrizzleSchema(ast);

      // Check that the Drizzle schema contains the User table
      expect(drizzleSchema).toContain("export const user =");
      expect(drizzleSchema).toContain("sqliteTable('user'");
      
      // Check that the email field has .unique() modifier
      expect(drizzleSchema).toContain("email: text('email').unique()");
    });

    it('should handle multiple single-field unique constraints', async () => {
      const schema = `
        model User {
          id       Int    @id @default(autoincrement())
          email    String @unique
          username String @unique
          name     String
        }
      `;

      const ast = await parseSchema(schema);
      const drizzleSchema = translatePslToDrizzleSchema(ast);

      // Check that both fields have unique constraints
      expect(drizzleSchema).toContain("email: text('email').unique()");
      expect(drizzleSchema).toContain("username: text('username').unique()");
    });
  });

  describe('Multi-field unique constraints', () => {
    it('should generate uniqueIndex for @@unique model attribute', async () => {
      const schema = `
        model Post {
          id       Int    @id @default(autoincrement())
          title    String
          authorId Int

          @@unique([title, authorId])
        }
      `;

      const ast = await parseSchema(schema);
      const drizzleSchema = translatePslToDrizzleSchema(ast);

      // Check that the Drizzle schema contains the Post table
      expect(drizzleSchema).toContain("export const post =");
      
      // Check that the unique index is generated
      expect(drizzleSchema).toContain("uniqueIndex(");
      expect(drizzleSchema).toContain("post.title, post.authorId");
      expect(drizzleSchema).toContain("export const postuniquetitleauthorId =");
    });

    it('should generate named unique constraints', async () => {
      const schema = `
        model Post {
          id       Int    @id @default(autoincrement())
          title    String
          authorId Int

          @@unique([title, authorId], name: "unique_post_title_author")
        }
      `;

      const ast = await parseSchema(schema);
      const drizzleSchema = translatePslToDrizzleSchema(ast);

      // Check that the named unique constraint is generated
      expect(drizzleSchema).toContain("'unique_post_title_author'");
      expect(drizzleSchema).toContain("uniqueIndex(");
    });

    it('should handle multiple multi-field unique constraints', async () => {
      const schema = `
        model User {
          id        Int    @id @default(autoincrement())
          email     String
          username  String
          firstName String
          lastName  String

          @@unique([email])
          @@unique([firstName, lastName])
        }
      `;

      const ast = await parseSchema(schema);
      const drizzleSchema = translatePslToDrizzleSchema(ast);

      // Check that both unique constraints are generated
      expect(drizzleSchema).toContain("export const useruniqueemail =");
      expect(drizzleSchema).toContain("export const useruniquefirstNamelastName =");
      expect(drizzleSchema).toMatch(/uniqueIndex.*user\.email/);
      expect(drizzleSchema).toMatch(/uniqueIndex.*user\.firstName, user\.lastName/);
    });
  });

  describe('Mixed unique constraints', () => {
    it('should handle both field-level and model-level unique constraints', async () => {
      const schema = `
        model User {
          id       Int    @id @default(autoincrement())
          email    String @unique
          username String @unique
          name     String
          age      Int

          @@unique([name, age])
        }
      `;

      const ast = await parseSchema(schema);
      const drizzleSchema = translatePslToDrizzleSchema(ast);

      // Check field-level unique constraints
      expect(drizzleSchema).toContain("email: text('email').unique()");
      expect(drizzleSchema).toContain("username: text('username').unique()");
      
      // Check model-level unique constraint
      expect(drizzleSchema).toContain("export const useruniquenameage =");
      expect(drizzleSchema).toContain("uniqueIndex(");
      expect(drizzleSchema).toContain("user.name, user.age");
    });
  });

  describe('Complex schema with relations and unique constraints', () => {
    it('should generate correct schema for complex model with relations', async () => {
      const schema = `
        model User {
          id       Int       @id @default(autoincrement())
          email    String    @unique
          posts    Post[]
          profiles Profile[]
        }

        model Post {
          id       Int    @id @default(autoincrement())
          title    String
          slug     String @unique
          authorId Int
          author   User   @relation(fields: [authorId], references: [id])

          @@unique([title, authorId])
        }

        model Profile {
          id       Int    @id @default(autoincrement())
          platform String
          handle   String
          userId   Int
          user     User   @relation(fields: [userId], references: [id])

          @@unique([platform, userId])
        }
      `;

      const ast = await parseSchema(schema);
      const drizzleSchema = translatePslToDrizzleSchema(ast);

      // Check User table
      expect(drizzleSchema).toContain("export const user =");
      expect(drizzleSchema).toContain("email: text('email').unique()");

      // Check Post table
      expect(drizzleSchema).toContain("export const post =");
      expect(drizzleSchema).toContain("slug: text('slug').unique()");
      expect(drizzleSchema).toContain("export const postuniquetitleauthorId =");

      // Check Profile table
      expect(drizzleSchema).toContain("export const profile =");
      expect(drizzleSchema).toContain("export const profileuniqueplatformuserId =");

      // Check relations are generated
      expect(drizzleSchema).toContain("userRelations");
      expect(drizzleSchema).toContain("postRelations");
      expect(drizzleSchema).toContain("profileRelations");
    });
  });

  describe('Edge cases', () => {
    it('should handle unique constraints with special characters in field names', async () => {
      const schema = `
        model User {
          id           Int    @id @default(autoincrement())
          emailAddress String @unique
          userName     String @unique

          @@unique([emailAddress, userName])
        }
      `;

      const ast = await parseSchema(schema);
      const drizzleSchema = translatePslToDrizzleSchema(ast);

      // Check that camelCase is preserved in field names
      expect(drizzleSchema).toContain("emailAddress: text('email_address').unique()");
      expect(drizzleSchema).toContain("userName: text('user_name').unique()");
      expect(drizzleSchema).toContain("user.emailAddress, user.userName");
    });

    it('should handle single-field unique constraint using @@unique syntax', async () => {
      const schema = `
        model User {
          id    Int    @id @default(autoincrement())
          email String

          @@unique([email])
        }
      `;

      const ast = await parseSchema(schema);
      const drizzleSchema = translatePslToDrizzleSchema(ast);

      // Check that single-field @@unique generates uniqueIndex
      expect(drizzleSchema).toContain("export const useruniqueemail =");
      expect(drizzleSchema).toContain("uniqueIndex(");
      expect(drizzleSchema).toContain("user.email");
    });
  });
});
