import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import fs from 'fs';
import path from 'path';
import { parseSchemaFile } from '../../src/parser';
import { translatePslToDrizzleSchema } from '../../src/translator/pslToDrizzle';
import { SchemaDiffer } from '../../src/migrations/schema-differ';

const TEST_SCHEMA_PATH = path.join(__dirname, 'integration-test-schema.prisma');
const TEST_SCHEMA_OUTPUT_PATH = path.join(__dirname, 'integration-test-schema-output.ts');

const INTEGRATION_SCHEMA = `
datasource db {
  provider = "sqlite"
  url      = "file:./integration-test.db"
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
  @@check(salary > 0, name: "positive_salary")
  @@check(status IN ('active', 'inactive', 'suspended'))
  
  // Index constraints
  @@index([email, username], name: "user_credentials_idx")
  @@index([status, age])
  
  // Multi-field unique constraint
  @@unique([email, username], name: "unique_user_credentials")
}

model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String?
  published Boolean  @default(false)
  authorId  Int
  author    User     @relation(
    fields: [authorId], 
    references: [id], 
    onDelete: Cascade, 
    onUpdate: Restrict, 
    name: "post_author_fk"
  )
  
  // Check constraints
  @@check(LENGTH(title) > 0, name: "title_not_empty")
  @@check(LENGTH(title) <= 255, name: "title_max_length")
  
  // Unique constraint on title per author
  @@unique([title, authorId], name: "unique_post_title_per_author")
  
  // Index for performance
  @@index([published, authorId], name: "post_published_author_idx")
}

model Profile {
  id     Int    @id @default(autoincrement())
  bio    String
  userId Int    @unique(name: "unique_profile_user")
  user   User   @relation(
    fields: [userId], 
    references: [id], 
    onDelete: Cascade, 
    name: "profile_user_fk"
  )
  
  // Check constraint
  @@check(LENGTH(bio) <= 1000, name: "bio_max_length")
}
`;

describe('Database Constraints Integration', () => {
  beforeAll(() => {
    // Clean up any existing test files
    [TEST_SCHEMA_PATH, TEST_SCHEMA_OUTPUT_PATH].forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });

    // Write test schema
    fs.writeFileSync(TEST_SCHEMA_PATH, INTEGRATION_SCHEMA);
  });

  afterAll(() => {
    // Clean up test files
    [TEST_SCHEMA_PATH, TEST_SCHEMA_OUTPUT_PATH].forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
  });

  it('should parse all constraint types in a complex schema', async () => {
    const ast = await parseSchemaFile(TEST_SCHEMA_PATH);
    
    const userModel = ast.find(node => node.type === 'model' && node.name === 'User');
    expect(userModel).toBeDefined();
    
    // Verify all constraint types are parsed
    const checkConstraints = userModel.attributes.filter(attr => attr.name === 'check');
    const indexConstraints = userModel.attributes.filter(attr => attr.name === 'index');
    const uniqueConstraints = userModel.attributes.filter(attr => attr.name === 'unique');
    
    expect(checkConstraints).toHaveLength(3);
    expect(indexConstraints).toHaveLength(2);
    expect(uniqueConstraints).toHaveLength(1);
    
    // Verify named constraints
    expect(checkConstraints.find(c => c.args?.name === 'minimum_age')).toBeDefined();
    expect(checkConstraints.find(c => c.args?.name === 'positive_salary')).toBeDefined();
    expect(indexConstraints.find(i => i.args?.name === 'user_credentials_idx')).toBeDefined();
    expect(uniqueConstraints.find(u => u.args?.name === 'unique_user_credentials')).toBeDefined();
  });

  it('should generate complete Drizzle schema with all constraints', async () => {
    const ast = await parseSchemaFile(TEST_SCHEMA_PATH);
    const drizzleSchema = translatePslToDrizzleSchema(ast);
    fs.writeFileSync(TEST_SCHEMA_OUTPUT_PATH, drizzleSchema);
    
    // Verify all constraint types are included
    expect(drizzleSchema).toContain('check(');
    expect(drizzleSchema).toContain('index(');
    expect(drizzleSchema).toContain('uniqueIndex(');
    
    // Verify named constraints
    expect(drizzleSchema).toContain('minimum_age');
    expect(drizzleSchema).toContain('positive_salary');
    expect(drizzleSchema).toContain('user_credentials_idx');
    expect(drizzleSchema).toContain('unique_user_credentials');
    expect(drizzleSchema).toContain('title_not_empty');
    expect(drizzleSchema).toContain('bio_max_length');
    
    // Verify foreign key options
    expect(drizzleSchema).toContain('onDelete: \'cascade\'');
    expect(drizzleSchema).toContain('onUpdate: \'restrict\'');
  });

  it('should generate complete migration SQL with all constraints', async () => {
    const ast = await parseSchemaFile(TEST_SCHEMA_PATH);
    const differ = new SchemaDiffer();
    const changes = differ.diffSchemas([], ast);
    
    // Find table creation changes
    const userTableChange = changes.find(change => 
      change.type === 'CREATE_TABLE' && change.tableName === 'user'
    );
    const postTableChange = changes.find(change => 
      change.type === 'CREATE_TABLE' && change.tableName === 'post'
    );
    const profileTableChange = changes.find(change => 
      change.type === 'CREATE_TABLE' && change.tableName === 'profile'
    );
    
    expect(userTableChange).toBeDefined();
    expect(postTableChange).toBeDefined();
    expect(profileTableChange).toBeDefined();
    
    // Verify User table constraints
    const userSql = userTableChange.sql;
    expect(userSql).toContain('CONSTRAINT unique_user_email UNIQUE');
    expect(userSql).toContain('CONSTRAINT minimum_age CHECK');
    expect(userSql).toContain('CONSTRAINT positive_salary CHECK');
    expect(userSql).toContain('CONSTRAINT unique_user_credentials UNIQUE');
    
    // Verify Post table constraints
    const postSql = postTableChange.sql;
    expect(postSql).toContain('CONSTRAINT post_author_fk FOREIGN KEY');
    expect(postSql).toContain('ON DELETE CASCADE');
    expect(postSql).toContain('ON UPDATE RESTRICT');
    expect(postSql).toContain('CONSTRAINT title_not_empty CHECK');
    expect(postSql).toContain('CONSTRAINT unique_post_title_per_author UNIQUE');
    
    // Verify Profile table constraints
    const profileSql = profileTableChange.sql;
    expect(profileSql).toContain('CONSTRAINT unique_profile_user UNIQUE');
    expect(profileSql).toContain('CONSTRAINT profile_user_fk FOREIGN KEY');
    expect(profileSql).toContain('CONSTRAINT bio_max_length CHECK');
    
    // Verify index creation
    const indexChanges = changes.filter(change => change.type === 'CREATE_INDEX');
    expect(indexChanges.length).toBeGreaterThan(0);
    
    const namedIndexChange = indexChanges.find(change => 
      change.indexName === 'user_credentials_idx'
    );
    expect(namedIndexChange).toBeDefined();
    expect(namedIndexChange.sql).toContain('CREATE INDEX user_credentials_idx ON user');
  });

  it('should handle complex constraint combinations correctly', async () => {
    const ast = await parseSchemaFile(TEST_SCHEMA_PATH);
    
    // Verify Post model has all expected constraints
    const postModel = ast.find(node => node.type === 'model' && node.name === 'Post');
    expect(postModel).toBeDefined();
    
    // Check constraints
    const checkConstraints = postModel.attributes.filter(attr => attr.name === 'check');
    expect(checkConstraints).toHaveLength(2);
    expect(checkConstraints.find(c => c.args?.name === 'title_not_empty')).toBeDefined();
    expect(checkConstraints.find(c => c.args?.name === 'title_max_length')).toBeDefined();
    
    // Unique constraints
    const uniqueConstraints = postModel.attributes.filter(attr => attr.name === 'unique');
    expect(uniqueConstraints).toHaveLength(1);
    expect(uniqueConstraints[0].args?.name).toBe('unique_post_title_per_author');
    
    // Index constraints
    const indexConstraints = postModel.attributes.filter(attr => attr.name === 'index');
    expect(indexConstraints).toHaveLength(1);
    expect(indexConstraints[0].args?.name).toBe('post_published_author_idx');
    
    // Foreign key with referential actions
    const authorField = postModel.fields.find(field => field.name === 'author');
    const relationAttr = authorField.attributes.find(attr => attr.name === 'relation');
    expect(relationAttr.args.name).toBe('post_author_fk');
    expect(relationAttr.args.onDelete).toBe('Cascade');
    expect(relationAttr.args.onUpdate).toBe('Restrict');
  });
});
