/**
 * Test utilities
 */

import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Run a CLI command
 */
export async function runCommand(command: string): Promise<{ stdout: string; stderr: string }> {
  return execAsync(command);
}

/**
 * Create a test schema file
 */
export function createTestSchema(content: string): string {
  const schemaPath = path.join(__dirname, '../temp/schema.prisma');
  fs.writeFileSync(schemaPath, content);
  return schemaPath;
}

/**
 * Create a test database
 */
export function createTestDatabase(): string {
  const dbPath = path.join(__dirname, '../temp/db/test.db');
  
  // Ensure the directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  // Remove existing database if it exists
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
  
  return dbPath;
}

/**
 * Get a test fixture
 */
export function getFixture(name: string): string {
  const fixturePath = path.join(__dirname, '../fixtures', name);
  return fs.readFileSync(fixturePath, 'utf-8');
}

/**
 * Create a test fixture
 */
export function createFixture(name: string, content: string): string {
  const fixturePath = path.join(__dirname, '../fixtures', name);
  
  // Ensure the directory exists
  const fixtureDir = path.dirname(fixturePath);
  if (!fs.existsSync(fixtureDir)) {
    fs.mkdirSync(fixtureDir, { recursive: true });
  }
  
  fs.writeFileSync(fixturePath, content);
  return fixturePath;
}

/**
 * Clean up test files
 */
export function cleanupTestFiles(): void {
  const tempDir = path.join(__dirname, '../temp');
  
  if (fs.existsSync(tempDir)) {
    // Remove all files in the temp directory
    const files = fs.readdirSync(tempDir);
    for (const file of files) {
      const filePath = path.join(tempDir, file);
      if (fs.lstatSync(filePath).isDirectory()) {
        fs.rmSync(filePath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(filePath);
      }
    }
  }
}

/**
 * Wait for a specified time
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a random string
 */
export function randomString(length = 10): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Create a test model
 */
export function createTestModel(name: string, fields: Record<string, string>): string {
  const fieldStrings = Object.entries(fields).map(([fieldName, fieldType]) => `  ${fieldName} ${fieldType}`);
  return `model ${name} {\n${fieldStrings.join('\n')}\n}`;
}

/**
 * Create a basic test schema
 */
export function createBasicTestSchema(): string {
  return `
datasource db {
  provider = "sqlite"
  url      = "file:./test.db"
}

generator client {
  provider = "drismify-client-js"
  output   = "./generated/client"
}

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  posts     Post[]
}

model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String?
  published Boolean  @default(false)
  author    User     @relation(fields: [authorId], references: [id])
  authorId  Int
}
`;
}

/**
 * Create a complex test schema
 */
export function createComplexTestSchema(): string {
  return `
datasource db {
  provider = "sqlite"
  url      = "file:./test.db"
}

generator client {
  provider = "drismify-client-js"
  output   = "./generated/client"
}

enum Role {
  USER
  ADMIN
  MODERATOR
}

model User {
  id        Int       @id @default(autoincrement())
  email     String    @unique
  name      String?
  role      Role      @default(USER)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  posts     Post[]
  profile   Profile?
  comments  Comment[]

  @@index([name, email])
}

model Profile {
  id     Int     @id @default(autoincrement())
  bio    String?
  user   User    @relation(fields: [userId], references: [id])
  userId Int     @unique
}

model Post {
  id        Int       @id @default(autoincrement())
  title     String
  content   String?
  published Boolean   @default(false)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  author    User      @relation(fields: [authorId], references: [id])
  authorId  Int
  comments  Comment[]
  tags      Tag[]     @relation("PostToTag")

  @@index([title])
}

model Comment {
  id        Int      @id @default(autoincrement())
  content   String
  createdAt DateTime @default(now())
  post      Post     @relation(fields: [postId], references: [id])
  postId    Int
  author    User     @relation(fields: [authorId], references: [id])
  authorId  Int
}

model Tag {
  id    Int    @id @default(autoincrement())
  name  String @unique
  posts Post[] @relation("PostToTag")
}
`;
}
