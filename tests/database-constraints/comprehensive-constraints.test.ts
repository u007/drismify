import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import fs from 'fs';
import path from 'path';
import { parseSchemaFile } from '../../src/parser';
import { translatePslToDrizzleSchema } from '../../src/translator/pslToDrizzle';
import { SchemaDiffer } from '../../src/migrations/schema-differ';

const TEST_SCHEMA_PATH = path.join(__dirname, 'comprehensive-test-schema.prisma');
const TEST_SCHEMA_OUTPUT_PATH = path.join(__dirname, 'comprehensive-test-schema-output.ts');

const COMPREHENSIVE_SCHEMA = `
datasource db {
  provider = "sqlite"
  url      = "file:./comprehensive-test.db"
}

generator client {
  provider = "drismify-client-js"
  output   = "./generated/client"
}

model User {
  id       Int      @id @default(autoincrement())
  email    String   @unique(name: "unique_user_email")
  username String   @unique
  age      Int
  salary   Float
  status   String
  name     String?
  posts    Post[]
  profile  Profile?
  
  // Check constraints with named and unnamed
  @@check(age >= 18, name: "minimum_age")
  @@check(salary > 0)
  @@check(status IN ('active', 'inactive', 'suspended'))
  
  // Index constraints
  @@index([email, username], name: "user_email_username_idx")
  @@index([status])
  
  // Multi-field unique constraint
  @@unique([email, username], name: "unique_user_credentials")
}

model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String?
  published Boolean  @default(false)
  authorId  Int
  author    User     @relation(fields: [authorId], references: [id], onDelete: Cascade, onUpdate: Restrict, name: "post_author_fk")
  
  // Check constraints
  @@check(LENGTH(title) > 0, name: "title_not_empty")
  @@check(published IN (0, 1))
  
  // Unique constraint on title per author
  @@unique([title, authorId], name: "unique_post_title_per_author")
}

model Profile {
  id     Int    @id @default(autoincrement())
  bio    String
  userId Int    @unique(name: "unique_profile_user")
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade, name: "profile_user_fk")
  
  // Check constraint
  @@check(LENGTH(bio) <= 500, name: "bio_max_length")
}

model Category {
  id       Int    @id @default(autoincrement())
  name     String
  parentId Int?
  
  // Check constraints
  @@check(LENGTH(name) > 0)
  @@check(parentId IS NULL OR parentId != id, name: "no_self_reference")
  
  // Unique constraint allowing multiple NULL values
  @@unique([name, parentId], name: "unique_category_name_per_parent")
}
`;

describe('Comprehensive Database Constraints', () => {
  beforeAll(() => {
    // Clean up any existing test files
    [TEST_SCHEMA_PATH, TEST_SCHEMA_OUTPUT_PATH].forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });

    // Write test schema
    fs.writeFileSync(TEST_SCHEMA_PATH, COMPREHENSIVE_SCHEMA);
  });

  afterAll(() => {
    // Clean up test files
    [TEST_SCHEMA_PATH, TEST_SCHEMA_OUTPUT_PATH].forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
  });

  describe('Schema Parsing', () => {
    it('should parse all constraint types correctly', () => {
      const ast = parseSchemaFile(TEST_SCHEMA_PATH);
      
      const userModel = ast.find(node => node.type === 'model' && node.name === 'User');
      expect(userModel).toBeDefined();
      
      // Check constraints
      const checkConstraints = userModel.attributes.filter(attr => attr.name === 'check');
      expect(checkConstraints).toHaveLength(3);
      
      // Index constraints
      const indexConstraints = userModel.attributes.filter(attr => attr.name === 'index');
      expect(indexConstraints).toHaveLength(2);
      
      // Unique constraints
      const uniqueConstraints = userModel.attributes.filter(attr => attr.name === 'unique');
      expect(uniqueConstraints).toHaveLength(1);
      
      // Verify named constraints
      const namedCheck = checkConstraints.find(attr => attr.args?.name === 'minimum_age');
      expect(namedCheck).toBeDefined();
      expect(namedCheck.args.constraint).toContain('age >= 18');
      
      const namedIndex = indexConstraints.find(attr => attr.args?.name === 'user_email_username_idx');
      expect(namedIndex).toBeDefined();
      expect(namedIndex.args.fields).toEqual(['email', 'username']);
      
      const namedUnique = uniqueConstraints.find(attr => attr.args?.name === 'unique_user_credentials');
      expect(namedUnique).toBeDefined();
      expect(namedUnique.args.fields).toEqual(['email', 'username']);
    });

    it('should parse foreign key constraints with names', () => {
      const ast = parseSchemaFile(TEST_SCHEMA_PATH);
      
      const postModel = ast.find(node => node.type === 'model' && node.name === 'Post');
      expect(postModel).toBeDefined();
      
      const authorField = postModel.fields.find(field => field.name === 'author');
      expect(authorField).toBeDefined();
      
      const relationAttr = authorField.attributes.find(attr => attr.name === 'relation');
      expect(relationAttr).toBeDefined();
      expect(relationAttr.args.name).toBe('post_author_fk');
      expect(relationAttr.args.onDelete).toBe('Cascade');
      expect(relationAttr.args.onUpdate).toBe('Restrict');
    });
  });

  describe('Drizzle Schema Generation', () => {
    it('should generate correct Drizzle schema with all constraints', () => {
      const ast = parseSchemaFile(TEST_SCHEMA_PATH);
      const drizzleSchema = translatePslToDrizzleSchema(ast);
      fs.writeFileSync(TEST_SCHEMA_OUTPUT_PATH, drizzleSchema);
      
      // Check that all constraint types are included
      expect(drizzleSchema).toContain('check(');
      expect(drizzleSchema).toContain('index(');
      expect(drizzleSchema).toContain('uniqueIndex(');
      
      // Check named constraints
      expect(drizzleSchema).toContain('minimum_age');
      expect(drizzleSchema).toContain('user_email_username_idx');
      expect(drizzleSchema).toContain('unique_user_credentials');
      expect(drizzleSchema).toContain('title_not_empty');
      expect(drizzleSchema).toContain('bio_max_length');
    });
  });

  describe('Migration SQL Generation', () => {
    it('should generate correct SQL with all constraint types', () => {
      const ast = parseSchemaFile(TEST_SCHEMA_PATH);
      const differ = new SchemaDiffer();
      const changes = differ.diffSchemas([], ast);
      
      // Find the User table creation
      const userTableChange = changes.find(change => 
        change.type === 'CREATE_TABLE' && change.tableName === 'user'
      );
      expect(userTableChange).toBeDefined();
      
      const userSql = userTableChange.sql;
      
      // Check that named constraints are included
      expect(userSql).toContain('CONSTRAINT minimum_age CHECK');
      expect(userSql).toContain('CONSTRAINT unique_user_email UNIQUE');
      expect(userSql).toContain('CONSTRAINT unique_user_credentials UNIQUE');
      
      // Check unnamed constraints
      expect(userSql).toContain('CHECK (salary > 0)');
      expect(userSql).toContain('CHECK (status IN');
      
      // Find the Post table creation
      const postTableChange = changes.find(change => 
        change.type === 'CREATE_TABLE' && change.tableName === 'post'
      );
      expect(postTableChange).toBeDefined();
      
      const postSql = postTableChange.sql;
      
      // Check foreign key with name
      expect(postSql).toContain('CONSTRAINT post_author_fk FOREIGN KEY');
      expect(postSql).toContain('ON DELETE CASCADE');
      expect(postSql).toContain('ON UPDATE RESTRICT');
      
      // Check named check constraint
      expect(postSql).toContain('CONSTRAINT title_not_empty CHECK');
      expect(postSql).toContain('CONSTRAINT unique_post_title_per_author UNIQUE');
    });

    it('should generate index creation statements', () => {
      const ast = parseSchemaFile(TEST_SCHEMA_PATH);
      const differ = new SchemaDiffer();
      const changes = differ.diffSchemas([], ast);
      
      // Find index creation statements
      const indexChanges = changes.filter(change => change.type === 'CREATE_INDEX');
      expect(indexChanges.length).toBeGreaterThan(0);
      
      // Check for named index
      const namedIndexChange = indexChanges.find(change => 
        change.indexName === 'user_email_username_idx'
      );
      expect(namedIndexChange).toBeDefined();
      expect(namedIndexChange.sql).toContain('CREATE INDEX user_email_username_idx ON user');
    });
  });

  describe('Constraint Validation', () => {
    it('should validate check constraint syntax', () => {
      const ast = parseSchemaFile(TEST_SCHEMA_PATH);
      
      const categoryModel = ast.find(node => node.type === 'model' && node.name === 'Category');
      const checkConstraints = categoryModel.attributes.filter(attr => attr.name === 'check');
      
      // Verify complex check constraint
      const selfRefCheck = checkConstraints.find(attr => attr.args?.name === 'no_self_reference');
      expect(selfRefCheck).toBeDefined();
      expect(selfRefCheck.args.constraint).toContain('parentId IS NULL OR parentId != id');
    });

    it('should handle NULL values in unique constraints', () => {
      const ast = parseSchemaFile(TEST_SCHEMA_PATH);
      const differ = new SchemaDiffer();
      const changes = differ.diffSchemas([], ast);
      
      const categoryTableChange = changes.find(change => 
        change.type === 'CREATE_TABLE' && change.tableName === 'category'
      );
      expect(categoryTableChange).toBeDefined();
      
      // SQLite allows multiple NULL values in unique constraints
      expect(categoryTableChange.sql).toContain('CONSTRAINT unique_category_name_per_parent UNIQUE (name, parent_id)');
    });
  });
});
