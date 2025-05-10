/**
 * Tests for the Prisma Schema Parser
 */

import * as fs from 'fs';
import * as path from 'path';
import { getFixture } from '../utils/test-utils';

// Import the parser
let parser: any;
try {
  parser = require('../../src/parser/generatedParser.js');
} catch (e) {
  console.error('Failed to load parser. Did you run "pnpm build:parser"?');
  process.exit(1);
}

describe('Prisma Schema Parser', () => {
  describe('Datasource Parsing', () => {
    it('should parse a basic datasource block', () => {
      const schema = `
        datasource db {
          provider = "sqlite"
          url      = "file:./dev.db"
        }
      `;
      
      const ast = parser.parse(schema);
      
      expect(ast).toHaveLength(1);
      expect(ast[0].type).toBe('datasource');
      expect(ast[0].name).toBe('db');
      expect(ast[0].assignments).toHaveProperty('provider', 'sqlite');
      expect(ast[0].assignments).toHaveProperty('url', 'file:./dev.db');
    });
    
    it('should parse a datasource block with environment variable', () => {
      const schema = `
        datasource db {
          provider = "sqlite"
          url      = env("DATABASE_URL")
        }
      `;
      
      const ast = parser.parse(schema);
      
      expect(ast).toHaveLength(1);
      expect(ast[0].type).toBe('datasource');
      expect(ast[0].name).toBe('db');
      expect(ast[0].assignments).toHaveProperty('provider', 'sqlite');
      expect(ast[0].assignments).toHaveProperty('url', 'env("DATABASE_URL")');
    });
  });
  
  describe('Generator Parsing', () => {
    it('should parse a basic generator block', () => {
      const schema = `
        generator client {
          provider = "drismify-client-js"
          output   = "./generated/client"
        }
      `;
      
      const ast = parser.parse(schema);
      
      expect(ast).toHaveLength(1);
      expect(ast[0].type).toBe('generator');
      expect(ast[0].name).toBe('client');
      expect(ast[0].assignments).toHaveProperty('provider', 'drismify-client-js');
      expect(ast[0].assignments).toHaveProperty('output', './generated/client');
    });
  });
  
  describe('Model Parsing', () => {
    it('should parse a basic model', () => {
      const schema = `
        model User {
          id    Int    @id @default(autoincrement())
          email String @unique
          name  String?
        }
      `;
      
      const ast = parser.parse(schema);
      
      expect(ast).toHaveLength(1);
      expect(ast[0].type).toBe('model');
      expect(ast[0].name).toBe('User');
      expect(ast[0].fields).toHaveLength(3);
      
      // Check id field
      expect(ast[0].fields[0].name).toBe('id');
      expect(ast[0].fields[0].type.name).toBe('Int');
      expect(ast[0].fields[0].attributes).toHaveLength(2);
      expect(ast[0].fields[0].attributes[0].name).toBe('id');
      expect(ast[0].fields[0].attributes[1].name).toBe('default');
      expect(ast[0].fields[0].attributes[1].args.function).toBe('autoincrement');
      
      // Check email field
      expect(ast[0].fields[1].name).toBe('email');
      expect(ast[0].fields[1].type.name).toBe('String');
      expect(ast[0].fields[1].attributes).toHaveLength(1);
      expect(ast[0].fields[1].attributes[0].name).toBe('unique');
      
      // Check name field
      expect(ast[0].fields[2].name).toBe('name');
      expect(ast[0].fields[2].type.name).toBe('String');
      expect(ast[0].fields[2].type.optional).toBe(true);
    });
    
    it('should parse a model with relations', () => {
      const schema = `
        model User {
          id    Int    @id @default(autoincrement())
          posts Post[]
        }
        
        model Post {
          id       Int  @id @default(autoincrement())
          author   User @relation(fields: [authorId], references: [id])
          authorId Int
        }
      `;
      
      const ast = parser.parse(schema);
      
      expect(ast).toHaveLength(2);
      
      // Check User model
      expect(ast[0].type).toBe('model');
      expect(ast[0].name).toBe('User');
      expect(ast[0].fields).toHaveLength(2);
      expect(ast[0].fields[1].name).toBe('posts');
      expect(ast[0].fields[1].type.name).toBe('Post');
      expect(ast[0].fields[1].type.isArray).toBe(true);
      
      // Check Post model
      expect(ast[1].type).toBe('model');
      expect(ast[1].name).toBe('Post');
      expect(ast[1].fields).toHaveLength(3);
      expect(ast[1].fields[1].name).toBe('author');
      expect(ast[1].fields[1].type.name).toBe('User');
      expect(ast[1].fields[1].attributes).toHaveLength(1);
      expect(ast[1].fields[1].attributes[0].name).toBe('relation');
      expect(ast[1].fields[1].attributes[0].args).toHaveProperty('fields');
      expect(ast[1].fields[1].attributes[0].args).toHaveProperty('references');
    });
  });
  
  describe('Enum Parsing', () => {
    it('should parse an enum', () => {
      const schema = `
        enum Role {
          USER
          ADMIN
          MODERATOR
        }
      `;
      
      const ast = parser.parse(schema);
      
      expect(ast).toHaveLength(1);
      expect(ast[0].type).toBe('enum');
      expect(ast[0].name).toBe('Role');
      expect(ast[0].values).toEqual(['USER', 'ADMIN', 'MODERATOR']);
    });
  });
  
  describe('Complete Schema Parsing', () => {
    it('should parse a basic complete schema', () => {
      const schema = getFixture('basic-schema.prisma');
      
      const ast = parser.parse(schema);
      
      expect(ast).toHaveLength(4); // datasource, generator, User model, Post model
      expect(ast[0].type).toBe('datasource');
      expect(ast[1].type).toBe('generator');
      expect(ast[2].type).toBe('model');
      expect(ast[2].name).toBe('User');
      expect(ast[3].type).toBe('model');
      expect(ast[3].name).toBe('Post');
    });
    
    it('should parse a complex complete schema', () => {
      const schema = getFixture('complex-schema.prisma');
      
      const ast = parser.parse(schema);
      
      expect(ast).toHaveLength(7); // datasource, generator, enum, 5 models
      expect(ast[0].type).toBe('datasource');
      expect(ast[1].type).toBe('generator');
      expect(ast[2].type).toBe('enum');
      expect(ast[2].name).toBe('Role');
      expect(ast[3].type).toBe('model');
      expect(ast[3].name).toBe('User');
      // Check other models
      const modelNames = ast.filter(node => node.type === 'model').map(node => node.name);
      expect(modelNames).toContain('Profile');
      expect(modelNames).toContain('Post');
      expect(modelNames).toContain('Comment');
      expect(modelNames).toContain('Tag');
    });
  });
});
