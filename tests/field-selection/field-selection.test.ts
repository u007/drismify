import { PrismaClient } from '@generated/client';
import { beforeAll, afterAll, describe, it, expect } from 'bun:test';

describe('Field Selection', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.connect();

    // Create test data
    await prisma.$executeRaw('DROP TABLE IF EXISTS user');
    await prisma.$executeRaw(`
      CREATE TABLE user (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        age INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert test data
    await prisma.$executeRaw(`
      INSERT INTO user (id, name, email, age) VALUES
      (1, 'Alice', 'alice@example.com', 30),
      (2, 'Bob', 'bob@example.com', 25),
      (3, 'Charlie', 'charlie@example.com', 35)
    `);
  });

  afterAll(async () => {
    await prisma.disconnect();
  });

  it('should select only specified fields in findUnique', async () => {
    const user = await prisma.user.findUnique({
      where: { id: 1 },
      select: { id: true, name: true }
    });

    expect(user).toEqual({ id: 1, name: 'Alice' });
    expect(user).not.toHaveProperty('email');
    expect(user).not.toHaveProperty('age');
    expect(user).not.toHaveProperty('created_at');
  });

  it('should select only specified fields in findFirst', async () => {
    const user = await prisma.user.findFirst({
      where: { age: { gt: 25 } },
      select: { name: true, email: true }
    });

    expect(user).toHaveProperty('name');
    expect(user).toHaveProperty('email');
    expect(user).not.toHaveProperty('id');
    expect(user).not.toHaveProperty('age');
    expect(user).not.toHaveProperty('created_at');
  });

  it('should select only specified fields in findMany', async () => {
    const users = await prisma.user.findMany({
      select: { id: true, age: true }
    });

    expect(users).toHaveLength(3);
    // biome-ignore lint/complexity/noForEach: <explanation>
    users.forEach(user => {
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('age');
      expect(user).not.toHaveProperty('name');
      expect(user).not.toHaveProperty('email');
      expect(user).not.toHaveProperty('created_at');
    });
  });

  it('should return all fields when select is not provided', async () => {
    const user = await prisma.user.findUnique({
      where: { id: 1 }
    });

    expect(user).toHaveProperty('id');
    expect(user).toHaveProperty('name');
    expect(user).toHaveProperty('email');
    expect(user).toHaveProperty('age');
  });

  it('should handle empty select object by returning all fields', async () => {
    const user = await prisma.user.findUnique({
      where: { id: 1 },
      select: {}
    });

    expect(user).toHaveProperty('id');
    expect(user).toHaveProperty('name');
    expect(user).toHaveProperty('email');
    expect(user).toHaveProperty('age');
  });

  it('should work with update operations', async () => {
    const user = await prisma.user.update({
      where: { id: 1 },
      data: { age: 31 },
      select: { id: true, age: true }
    });

    expect(user).toEqual({ id: 1, age: 31 });
    expect(user).not.toHaveProperty('name');
    expect(user).not.toHaveProperty('email');
  });

  it('should work with delete operations', async () => {
    // First create a user to delete
    await prisma.$executeRaw(`
      INSERT INTO user (id, name, email, age) VALUES
      (4, 'David', 'david@example.com', 40)
    `);
    
    // Verify the user was created
    const checkUser = await prisma.user.findUnique({
      where: { id: 4 }
    });
    console.log('User before delete:', checkUser);
    
    // Now delete the user with field selection
    const user = await prisma.user.delete({
      where: { id: 4 },
      select: { id: true, name: true }
    });

    expect(user).toEqual({ id: 4, name: 'David' });
    expect(user).not.toHaveProperty('email');
    expect(user).not.toHaveProperty('age');
  });
});
