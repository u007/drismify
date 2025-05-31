import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import fs from 'fs';
import path from 'path';
import { parseSchemaFile } from '../../src/parser';
import { translatePslToDrizzleSchema } from '../../src/translator/pslToDrizzle';
import { DrismifyClient } from '../../src/client/base-client';
import { SQLiteAdapter } from '../../src/adapters/sqlite-adapter';

const TEST_DB_PATH = path.join(__dirname, 'test-check-constraints.db');
const TEST_SCHEMA_PATH = path.join(__dirname, 'test-schema.prisma');
const TEST_SCHEMA_OUTPUT_PATH = path.join(__dirname, 'test-schema-output.ts');

const TEST_SCHEMA = `
datasource db {
  provider = "sqlite"
  url      = "file:./test-check-constraints.db"
}

generator client {
  provider = "drismify-client-js"
  output   = "./generated/client"
}

model User {
  id       Int      @id @default(autoincrement())
  email    String   @unique
  age      Int
  salary   Float
  status   String
  name     String?
  
  // Check constraints
  @@check(age >= 0, name: "age_non_negative")
  @@check(salary > 0)
  @@check(status IN ('active', 'inactive', 'pending'))
}

model Product {
  id          Int      @id @default(autoincrement())
  name        String
  price       Float
  discount    Float    @default(0)
  category    String
  
  // Multiple check constraints
  @@check(price > 0, name: "positive_price")
  @@check(discount >= 0 AND discount <= 1, name: "valid_discount")
  @@check(category IN ('electronics', 'clothing', 'books'))
}
`;

describe('Check Constraints', () => {
  let prisma: DrismifyClient;
  let adapter: SQLiteAdapter;

  beforeAll(async () => {
    // Clean up any existing test files
    [TEST_DB_PATH, TEST_SCHEMA_PATH, TEST_SCHEMA_OUTPUT_PATH].forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });

    // Write test schema
    fs.writeFileSync(TEST_SCHEMA_PATH, TEST_SCHEMA);

    // Generate Drizzle schema
    const ast = parseSchemaFile(TEST_SCHEMA_PATH);
    const drizzleSchema = translatePslToDrizzleSchema(ast);
    fs.writeFileSync(TEST_SCHEMA_OUTPUT_PATH, drizzleSchema);

    // Create adapter and client
    adapter = new SQLiteAdapter({ filename: TEST_DB_PATH });
    await adapter.connect();

    // Create tables with check constraints
    await adapter.execute(`
      CREATE TABLE user (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        age INTEGER NOT NULL,
        salary REAL NOT NULL,
        status TEXT NOT NULL,
        name TEXT,
        CONSTRAINT age_non_negative CHECK (age >= 0),
        CHECK (salary > 0),
        CHECK (status IN ('active', 'inactive', 'pending'))
      )
    `);

    await adapter.execute(`
      CREATE TABLE product (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        discount REAL DEFAULT 0 NOT NULL,
        category TEXT NOT NULL,
        CONSTRAINT positive_price CHECK (price > 0),
        CONSTRAINT valid_discount CHECK (discount >= 0 AND discount <= 1),
        CHECK (category IN ('electronics', 'clothing', 'books'))
      )
    `);

    prisma = new DrismifyClient({
      adapter: 'sqlite',
      datasources: {
        db: { url: `file:${TEST_DB_PATH}` }
      }
    });
  });

  afterAll(async () => {
    if (adapter) {
      await adapter.disconnect();
    }

    // Clean up test files
    [TEST_DB_PATH, TEST_SCHEMA_PATH, TEST_SCHEMA_OUTPUT_PATH].forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
  });

  describe('Schema Generation', () => {
    it('should parse check constraints from schema', () => {
      const ast = parseSchemaFile(TEST_SCHEMA_PATH);
      const userModel = ast.find(node => node.type === 'model' && node.name === 'User');
      
      expect(userModel).toBeDefined();
      expect(userModel.attributes).toBeDefined();
      
      const checkConstraints = userModel.attributes.filter(attr => attr.name === 'check');
      expect(checkConstraints).toHaveLength(3);
      
      // Check named constraint
      const namedConstraint = checkConstraints.find(attr => attr.args?.name === 'age_non_negative');
      expect(namedConstraint).toBeDefined();
      expect(namedConstraint.args.constraint).toContain('age >= 0');
    });

    it('should generate Drizzle schema with check constraints', () => {
      const drizzleSchema = fs.readFileSync(TEST_SCHEMA_OUTPUT_PATH, 'utf-8');
      
      // Check that check constraints are included
      expect(drizzleSchema).toContain('check(');
      expect(drizzleSchema).toContain('age_non_negative');
      expect(drizzleSchema).toContain('positive_price');
      expect(drizzleSchema).toContain('valid_discount');
    });
  });

  describe('Database Operations', () => {
    it('should allow valid data that satisfies check constraints', async () => {
      const user = await adapter.execute(`
        INSERT INTO user (email, age, salary, status, name) 
        VALUES ('john@example.com', 25, 50000.0, 'active', 'John Doe')
      `);
      
      expect(user).toBeDefined();
    });

    it('should reject data that violates age check constraint', async () => {
      await expect(async () => {
        await adapter.execute(`
          INSERT INTO user (email, age, salary, status, name) 
          VALUES ('jane@example.com', -5, 50000.0, 'active', 'Jane Doe')
        `);
      }).toThrow();
    });

    it('should reject data that violates salary check constraint', async () => {
      await expect(async () => {
        await adapter.execute(`
          INSERT INTO user (email, age, salary, status, name) 
          VALUES ('bob@example.com', 30, -1000.0, 'active', 'Bob Smith')
        `);
      }).toThrow();
    });

    it('should reject data that violates status check constraint', async () => {
      await expect(async () => {
        await adapter.execute(`
          INSERT INTO user (email, age, salary, status, name) 
          VALUES ('alice@example.com', 28, 60000.0, 'invalid_status', 'Alice Johnson')
        `);
      }).toThrow();
    });

    it('should allow valid product data', async () => {
      const product = await adapter.execute(`
        INSERT INTO product (name, price, discount, category) 
        VALUES ('Laptop', 999.99, 0.1, 'electronics')
      `);
      
      expect(product).toBeDefined();
    });

    it('should reject product with invalid price', async () => {
      await expect(async () => {
        await adapter.execute(`
          INSERT INTO product (name, price, discount, category) 
          VALUES ('Free Item', 0, 0, 'electronics')
        `);
      }).toThrow();
    });

    it('should reject product with invalid discount', async () => {
      await expect(async () => {
        await adapter.execute(`
          INSERT INTO product (name, price, discount, category) 
          VALUES ('Overpriced Item', 100, 1.5, 'electronics')
        `);
      }).toThrow();
    });

    it('should reject product with invalid category', async () => {
      await expect(async () => {
        await adapter.execute(`
          INSERT INTO product (name, price, discount, category) 
          VALUES ('Mystery Item', 50, 0, 'unknown')
        `);
      }).toThrow();
    });
  });
});
