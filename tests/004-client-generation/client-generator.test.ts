/**
 * Tests for the Client Generator
 */

import * as fs from 'fs';
import * as path from 'path';
import { ClientGenerator } from '../../src/generator/client-generator';
import { getFixture, createTestSchema } from '../utils/test-utils';

// Import the parser
let parser: any;
try {
  parser = require('../../src/parser/generatedParser.js');
} catch (e) {
  console.error('Failed to load parser. Did you run "pnpm build:parser"?');
  process.exit(1);
}

describe('Client Generator', () => {
  const outputDir = path.join(__dirname, '../temp/generated/client');
  
  beforeEach(() => {
    // Clean up output directory
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
    fs.mkdirSync(outputDir, { recursive: true });
  });
  
  describe('Basic Client Generation', () => {
    it('should generate a client from a basic schema', async () => {
      const schema = getFixture('basic-schema.prisma');
      const schemaPath = createTestSchema(schema);
      
      const generator = new ClientGenerator({
        outputDir,
        generateTypes: true,
        generateJs: true,
        generatePackageJson: true,
        generateReadme: true
      });
      
      await generator.generateFromSchemaFile(schemaPath);
      
      // Check that the client files were generated
      expect(fs.existsSync(path.join(outputDir, 'index.ts'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, 'types.ts'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, 'package.json'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, 'README.md'))).toBe(true);
      
      // Check that the model files were generated
      expect(fs.existsSync(path.join(outputDir, 'models/user.ts'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, 'models/post.ts'))).toBe(true);
      
      // Check the content of the index.ts file
      const indexContent = fs.readFileSync(path.join(outputDir, 'index.ts'), 'utf-8');
      expect(indexContent).toContain('import { User } from \'./models/user\';');
      expect(indexContent).toContain('import { Post } from \'./models/post\';');
      expect(indexContent).toContain('export class PrismaClient extends DrismifyClient');
      expect(indexContent).toContain('public readonly user: User;');
      expect(indexContent).toContain('public readonly post: Post;');
      
      // Check the content of the types.ts file
      const typesContent = fs.readFileSync(path.join(outputDir, 'types.ts'), 'utf-8');
      expect(typesContent).toContain('export type User = {');
      expect(typesContent).toContain('export type Post = {');
      expect(typesContent).toContain('export type UserCreateInput = {');
      expect(typesContent).toContain('export type PostCreateInput = {');
      
      // Check the content of the user.ts file
      const userContent = fs.readFileSync(path.join(outputDir, 'models/user.ts'), 'utf-8');
      expect(userContent).toContain('export class User extends BaseModelClient<');
      expect(userContent).toContain('constructor(');
      expect(userContent).toContain('super(adapter, \'user\', debug, log);');
      
      // Check the content of the post.ts file
      const postContent = fs.readFileSync(path.join(outputDir, 'models/post.ts'), 'utf-8');
      expect(postContent).toContain('export class Post extends BaseModelClient<');
      expect(postContent).toContain('constructor(');
      expect(postContent).toContain('super(adapter, \'post\', debug, log);');
    });
  });
  
  describe('Complex Client Generation', () => {
    it('should generate a client from a complex schema', async () => {
      const schema = getFixture('complex-schema.prisma');
      const schemaPath = createTestSchema(schema);
      
      const generator = new ClientGenerator({
        outputDir,
        generateTypes: true,
        generateJs: true,
        generatePackageJson: true,
        generateReadme: true
      });
      
      await generator.generateFromSchemaFile(schemaPath);
      
      // Check that the client files were generated
      expect(fs.existsSync(path.join(outputDir, 'index.ts'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, 'types.ts'))).toBe(true);
      
      // Check that the model files were generated
      expect(fs.existsSync(path.join(outputDir, 'models/user.ts'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, 'models/profile.ts'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, 'models/post.ts'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, 'models/comment.ts'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, 'models/tag.ts'))).toBe(true);
      
      // Check the content of the index.ts file
      const indexContent = fs.readFileSync(path.join(outputDir, 'index.ts'), 'utf-8');
      expect(indexContent).toContain('import { User } from \'./models/user\';');
      expect(indexContent).toContain('import { Profile } from \'./models/profile\';');
      expect(indexContent).toContain('import { Post } from \'./models/post\';');
      expect(indexContent).toContain('import { Comment } from \'./models/comment\';');
      expect(indexContent).toContain('import { Tag } from \'./models/tag\';');
      
      // Check the content of the types.ts file
      const typesContent = fs.readFileSync(path.join(outputDir, 'types.ts'), 'utf-8');
      expect(typesContent).toContain('export type Role =');
      expect(typesContent).toContain('\'USER\' | \'ADMIN\' | \'MODERATOR\'');
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle schema with no models', async () => {
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
      
      const schemaPath = createTestSchema(schema);
      
      const generator = new ClientGenerator({
        outputDir,
        generateTypes: true,
        generateJs: true,
        generatePackageJson: true,
        generateReadme: true
      });
      
      await generator.generateFromSchemaFile(schemaPath);
      
      // Check that the client files were generated
      expect(fs.existsSync(path.join(outputDir, 'index.ts'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, 'types.ts'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, 'package.json'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, 'README.md'))).toBe(true);
      
      // Check the content of the index.ts file
      const indexContent = fs.readFileSync(path.join(outputDir, 'index.ts'), 'utf-8');
      expect(indexContent).toContain('export class PrismaClient extends DrismifyClient');
    });
  });
});
