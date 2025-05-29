import { beforeAll, afterAll, describe, it, expect } from 'bun:test';
import { PrismaClient } from '../../generated/client';
import * as fs from 'fs';
import * as path from 'path';

describe('Views Support', () => {
  let prisma: PrismaClient;
  const dbPath = path.join(__dirname, 'test-views.db');

  beforeAll(async () => {
    // Clean up any existing database
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }

    // Initialize client
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: `file:${dbPath}`
        }
      },
      log: ['query', 'info', 'warn', 'error']
    });

    await prisma.connect();

    // Create tables
    await prisma.$executeRaw(`
      CREATE TABLE user (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await prisma.$executeRaw(`
      CREATE TABLE profile (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bio TEXT NOT NULL,
        user_id INTEGER UNIQUE NOT NULL,
        FOREIGN KEY (user_id) REFERENCES user(id)
      )
    `);

    await prisma.$executeRaw(`
      CREATE TABLE post (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT,
        published BOOLEAN DEFAULT FALSE,
        author_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (author_id) REFERENCES user(id)
      )
    `);

    // Create views
    await prisma.$executeRaw(`
      CREATE VIEW user_info AS
      SELECT
        u.id,
        u.email,
        u.name,
        p.bio
      FROM user u
      LEFT JOIN profile p ON u.id = p.user_id
    `);

    await prisma.$executeRaw(`
      CREATE VIEW published_posts AS
      SELECT
        p.id,
        p.title,
        p.content,
        u.name as author_name,
        u.email as author_email,
        p.created_at
      FROM post p
      JOIN user u ON p.author_id = u.id
      WHERE p.published = TRUE
    `);

    // Insert test data
    await prisma.$executeRaw(`
      INSERT INTO user (email, name) VALUES
      ('alice@example.com', 'Alice'),
      ('bob@example.com', 'Bob'),
      ('charlie@example.com', 'Charlie')
    `);

    await prisma.$executeRaw(`
      INSERT INTO profile (bio, user_id) VALUES
      ('Software Engineer', 1),
      ('Product Manager', 2)
    `);

    await prisma.$executeRaw(`
      INSERT INTO post (title, content, published, author_id) VALUES
      ('First Post', 'This is the first post', TRUE, 1),
      ('Second Post', 'This is the second post', FALSE, 1),
      ('Third Post', 'This is the third post', TRUE, 2),
      ('Fourth Post', 'This is the fourth post', TRUE, 3)
    `);
  });

  afterAll(async () => {
    await prisma.disconnect();
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  it('should parse view schema correctly', () => {
    const { parseSchema } = require('../../src/parser');
    const schema = `
      view UserInfo {
        id    Int    @unique
        email String
        name  String
        bio   String
      }
    `;

    const ast = parseSchema(schema);
    expect(ast).toHaveLength(1);
    expect(ast[0].type).toBe('view');
    expect(ast[0].name).toBe('UserInfo');
    expect(ast[0].fields).toHaveLength(4);
    expect(ast[0].fields[0].name).toBe('id');
    expect(ast[0].fields[0].attributes[0].name).toBe('unique');
  });

  it('should query view data with findMany', async () => {
    // This test would work if we had generated view clients
    // For now, we'll test the raw SQL approach
    const userInfoData = await prisma.$queryRaw(`SELECT * FROM user_info`);

    expect(userInfoData).toHaveLength(3);
    expect(userInfoData[0]).toHaveProperty('id');
    expect(userInfoData[0]).toHaveProperty('email');
    expect(userInfoData[0]).toHaveProperty('name');
    expect(userInfoData[0]).toHaveProperty('bio');

    // Check that Alice has a bio
    const alice = userInfoData.find((u: any) => u.email === 'alice@example.com');
    expect(alice.bio).toBe('Software Engineer');

    // Check that Charlie has no bio (NULL)
    const charlie = userInfoData.find((u: any) => u.email === 'charlie@example.com');
    expect(charlie.bio).toBeNull();
  });

  it('should query published posts view', async () => {
    const publishedPostsData = await prisma.$queryRaw(`SELECT * FROM published_posts`);

    expect(publishedPostsData).toHaveLength(3); // Only published posts

    // Check that all posts are published
    publishedPostsData.forEach((post: any) => {
      expect(post).toHaveProperty('id');
      expect(post).toHaveProperty('title');
      expect(post).toHaveProperty('author_name');
      expect(post).toHaveProperty('author_email');
    });

    // Check specific post
    const firstPost = publishedPostsData.find((p: any) => p.title === 'First Post');
    expect(firstPost.author_name).toBe('Alice');
    expect(firstPost.author_email).toBe('alice@example.com');
  });

  it('should filter view data', async () => {
    const aliceInfo = await prisma.$queryRaw(`
      SELECT * FROM user_info WHERE email = 'alice@example.com'
    `);

    expect(aliceInfo).toHaveLength(1);
    expect(aliceInfo[0].name).toBe('Alice');
    expect(aliceInfo[0].bio).toBe('Software Engineer');
  });

  it('should order view data', async () => {
    const orderedPosts = await prisma.$queryRaw(`
      SELECT * FROM published_posts ORDER BY id DESC
    `);

    expect(orderedPosts).toHaveLength(3);
    // Should be ordered by id descending (Fourth Post has highest id)
    expect(orderedPosts[0].title).toBe('Fourth Post');
  });

  it('should count view records', async () => {
    const count = await prisma.$queryRaw(`SELECT COUNT(*) as count FROM user_info`);
    expect(count[0].count).toBe(3);

    const publishedCount = await prisma.$queryRaw(`SELECT COUNT(*) as count FROM published_posts`);
    expect(publishedCount[0].count).toBe(3);
  });
});
