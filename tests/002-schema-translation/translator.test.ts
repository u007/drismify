/**
 * Tests for the Prisma Schema to Drizzle Schema Translator
 */

import * as fs from 'fs';
import * as path from 'path';
import { getFixture } from '../utils/test-utils';
import { translatePslToDrizzleSchema } from '../../src/translator/pslToDrizzle';

// Import the parser
let parser: any;
try {
  parser = require('../../src/parser/generatedParser.js');
} catch (e) {
  console.error('Failed to load parser. Did you run "pnpm build:parser"?');
  process.exit(1);
}

describe('Prisma Schema to Drizzle Schema Translator', () => {
  describe('Basic Translation', () => {
    it('should translate a basic schema', () => {
      const schema = getFixture('basic-schema.prisma');
      const ast = parser.parse(schema);

      const drizzleSchema = translatePslToDrizzleSchema(ast);

      // Check that the drizzle schema contains the expected imports
      expect(drizzleSchema).toContain('import { sqliteTable');
      expect(drizzleSchema).toContain('import { text }');
      expect(drizzleSchema).toContain('import { integer }');

      // Check that the drizzle schema contains the User table
      expect(drizzleSchema).toContain('export const user =');
      expect(drizzleSchema).toContain('id: integer(\'id\').primaryKey()');
      expect(drizzleSchema).toContain('email: text(\'email\').unique().notNull()');
      expect(drizzleSchema).toContain('name: text(\'name\')');

      // Check that the drizzle schema contains the Post table
      expect(drizzleSchema).toContain('export const post =');
      expect(drizzleSchema).toContain('id: integer(\'id\').primaryKey()');
      expect(drizzleSchema).toContain('title: text(\'title\').notNull()');
      expect(drizzleSchema).toContain('content: text(\'content\')');
      expect(drizzleSchema).toContain('published: integer(\'published\', { mode: \'boolean\' }).notNull()');
      expect(drizzleSchema).toContain('authorId: integer(\'author_id\').references(() => user.id).notNull()');

      // Check that the drizzle schema contains the relations
      expect(drizzleSchema).toContain('export const userRelations =');
      expect(drizzleSchema).toContain('posts: many(post)');
      expect(drizzleSchema).toContain('export const postRelations =');
      expect(drizzleSchema).toContain('author: one(user, {');
    });
  });

  describe('Complex Translation', () => {
    it('should translate a complex schema', () => {
      const schema = getFixture('complex-schema.prisma');
      const ast = parser.parse(schema);

      const drizzleSchema = translatePslToDrizzleSchema(ast);

      // Check that the drizzle schema contains the expected imports
      expect(drizzleSchema).toContain('import { sqliteTable');
      expect(drizzleSchema).toContain('import { text }');
      expect(drizzleSchema).toContain('import { integer }');

      // Check that the drizzle schema contains the Role enum
      expect(drizzleSchema).toContain('export type Role =');
      expect(drizzleSchema).toContain("'USER'");
      expect(drizzleSchema).toContain("'ADMIN'");
      expect(drizzleSchema).toContain("'MODERATOR'");

      // Check that the drizzle schema contains the User table
      expect(drizzleSchema).toContain('export const user =');
      expect(drizzleSchema).toContain('id: integer(\'id\').primaryKey()');
      expect(drizzleSchema).toContain('email: text(\'email\').unique().notNull()');
      expect(drizzleSchema).toContain('name: text(\'name\')');
      expect(drizzleSchema).toContain('role: text(\'role\').$type<Role>().default');

      // Check that the drizzle schema contains the Profile table
      expect(drizzleSchema).toContain('export const profile =');
      expect(drizzleSchema).toContain('id: integer(\'id\').primaryKey()');
      expect(drizzleSchema).toContain('bio: text(\'bio\')');
      expect(drizzleSchema).toContain('userId: integer(\'user_id\').unique().references(() => user.id).notNull()');

      // Check that the drizzle schema contains the Post table
      expect(drizzleSchema).toContain('export const post =');

      // Check that the drizzle schema contains the Comment table
      expect(drizzleSchema).toContain('export const comment =');

      // Check that the drizzle schema contains the Tag table
      expect(drizzleSchema).toContain('export const tag =');

      // Check that the drizzle schema contains the relations
      expect(drizzleSchema).toContain('export const userRelations =');
      expect(drizzleSchema).toContain('posts: many(post)');
      expect(drizzleSchema).toContain('comments: many(comment)');

      // Check that the drizzle schema contains the many-to-many relation
      expect(drizzleSchema).toContain('tags: many(tag)');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty schema', () => {
      const ast: any[] = [];

      const drizzleSchema = translatePslToDrizzleSchema(ast);

      // Should still generate a valid schema with imports
      expect(drizzleSchema).toContain('import { sqliteTable');
      expect(drizzleSchema).toContain('import { text }');
    });

    it('should handle schema with only datasource and generator', () => {
      const schema = `
        datasource db {
          provider = "sqlite"
          url      = "file:./dev.db"
        }

        generator client {
          provider = "drismify-client-js"
          output   = "./generated/client"
        }
      `;

      const ast = parser.parse(schema);
      const drizzleSchema = translatePslToDrizzleSchema(ast);

      // Should still generate a valid schema with imports
      expect(drizzleSchema).toContain('import { sqliteTable');
      expect(drizzleSchema).toContain('import { text }');
    });

    it('should handle schema with only enums', () => {
      const schema = `
        enum Role {
          USER
          ADMIN
          MODERATOR
        }

        enum Status {
          ACTIVE
          INACTIVE
          PENDING
        }
      `;

      const ast = parser.parse(schema);
      const drizzleSchema = translatePslToDrizzleSchema(ast);

      // Should generate enums as TypeScript types
      expect(drizzleSchema).toContain('export type Role =');
      expect(drizzleSchema).toContain("'USER'");
      expect(drizzleSchema).toContain("'ADMIN'");
      expect(drizzleSchema).toContain("'MODERATOR'");

      expect(drizzleSchema).toContain('export type Status =');
      expect(drizzleSchema).toContain("'ACTIVE'");
      expect(drizzleSchema).toContain("'INACTIVE'");
      expect(drizzleSchema).toContain("'PENDING'");
    });
  });
});
