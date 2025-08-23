import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { initProject } from '../../src/cli/init';
import * as fs from 'fs';
import * as path from 'path';

describe('MySQL CLI Init', () => {
  const testDir = path.join(__dirname, 'test-mysql-project');

  beforeEach(() => {
    // Clean up test directory before each test
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    // Clean up test directory after each test
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('should initialize MySQL project with correct configuration', async () => {
    await initProject({
      directory: testDir,
      provider: 'mysql',
      url: 'mysql://root:password@localhost:3306/testdb',
      typescript: true,
      overwrite: false
    });

    // Check that directory was created
    expect(fs.existsSync(testDir)).toBe(true);

    // Check schema.prisma file
    const schemaPath = path.join(testDir, 'schema.prisma');
    expect(fs.existsSync(schemaPath)).toBe(true);

    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
    expect(schemaContent).toContain('provider = "mysql"');
    expect(schemaContent).toContain('generator client');
    expect(schemaContent).toContain('provider = "drismify-client-js"');
    expect(schemaContent).toContain('model User');
    expect(schemaContent).toContain('model Post');
    expect(schemaContent).toContain('@db.Text'); // MySQL-specific annotation

    // Check .env file
    const envPath = path.join(testDir, '.env');
    expect(fs.existsSync(envPath)).toBe(true);

    const envContent = fs.readFileSync(envPath, 'utf-8');
    expect(envContent).toContain('DATABASE_URL="mysql://root:password@localhost:3306/testdb"');

    // Check package.json
    const packageJsonPath = path.join(testDir, 'package.json');
    expect(fs.existsSync(packageJsonPath)).toBe(true);

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    expect(packageJson.dependencies).toHaveProperty('drismify');
    expect(packageJson.scripts).toHaveProperty('db:push');
    expect(packageJson.scripts).toHaveProperty('generate');

    // Check prisma directory and schema copy
    const prismaDir = path.join(testDir, 'prisma');
    expect(fs.existsSync(prismaDir)).toBe(true);

    const prismaSchemaCopy = path.join(prismaDir, 'schema.prisma');
    expect(fs.existsSync(prismaSchemaCopy)).toBe(true);

    // Check migrations directory
    const migrationsDir = path.join(testDir, 'migrations');
    expect(fs.existsSync(migrationsDir)).toBe(true);

    // Check seed script
    const seedDir = path.join(testDir, 'prisma', 'seed');
    expect(fs.existsSync(seedDir)).toBe(true);

    const seedPath = path.join(seedDir, 'seed.ts');
    expect(fs.existsSync(seedPath)).toBe(true);

    const seedContent = fs.readFileSync(seedPath, 'utf-8');
    expect(seedContent).toContain('PrismaClient');
    expect(seedContent).toContain('user.upsert');

    // Check tsconfig.json
    const tsconfigPath = path.join(testDir, 'tsconfig.json');
    expect(fs.existsSync(tsconfigPath)).toBe(true);

    const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
    expect(tsconfig.compilerOptions).toHaveProperty('target');
    expect(tsconfig.compilerOptions).toHaveProperty('module');

    // Check README.md
    const readmePath = path.join(testDir, 'README.md');
    expect(fs.existsSync(readmePath)).toBe(true);

    const readmeContent = fs.readFileSync(readmePath, 'utf-8');
    expect(readmeContent).toContain('Drismify Project');
    expect(readmeContent).toContain('npm run generate');
    expect(readmeContent).toContain('npm run db:push');
  });

  test('should initialize MySQL project with default URL', async () => {
    await initProject({
      directory: testDir,
      provider: 'mysql',
      typescript: true,
      overwrite: false
    });

    const envPath = path.join(testDir, '.env');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    expect(envContent).toContain('DATABASE_URL="mysql://root:password@localhost:3306/mydb"');
  });

  test('should create MySQL schema with proper field types', async () => {
    await initProject({
      directory: testDir,
      provider: 'mysql',
      typescript: true,
      overwrite: false
    });

    const schemaPath = path.join(testDir, 'schema.prisma');
    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

    // Check MySQL-specific features
    expect(schemaContent).toContain('@db.Text'); // MySQL TEXT type for content field
    expect(schemaContent).toContain('@default(autoincrement())'); // Auto increment
    expect(schemaContent).toContain('@relation(fields:'); // Foreign key relations
    expect(schemaContent).toContain('references:'); // References
    expect(schemaContent).toContain('Post[]'); // One-to-many relation
  });

  test('should handle JavaScript project initialization', async () => {
    await initProject({
      directory: testDir,
      provider: 'mysql',
      typescript: false,
      overwrite: false
    });

    // Check that TypeScript files are not created
    const tsconfigPath = path.join(testDir, 'tsconfig.json');
    expect(fs.existsSync(tsconfigPath)).toBe(false);

    // Check that JavaScript seed file is created
    const seedPath = path.join(testDir, 'prisma', 'seed', 'seed.js');
    expect(fs.existsSync(seedPath)).toBe(true);

    const seedContent = fs.readFileSync(seedPath, 'utf-8');
    expect(seedContent).toContain('require(');
    expect(seedContent).not.toContain('import ');

    // Check package.json scripts
    const packageJsonPath = path.join(testDir, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    expect(packageJson.scripts.build).toBe('echo "No build step"');
    expect(packageJson.scripts.start).toBe('node index.js');
  });

  test('should handle overwrite option', async () => {
    // Create initial project
    await initProject({
      directory: testDir,
      provider: 'mysql',
      typescript: true,
      overwrite: false
    });

    // Modify schema file
    const schemaPath = path.join(testDir, 'schema.prisma');
    fs.writeFileSync(schemaPath, '// Modified schema');

    // Try to initialize again without overwrite (should fail)
    await expect(
      initProject({
        directory: testDir,
        provider: 'mysql',
        typescript: true,
        overwrite: false
      })
    ).rejects.toThrow();

    // Initialize again with overwrite (should succeed)
    await initProject({
      directory: testDir,
      provider: 'mysql',
      typescript: true,
      overwrite: true
    });

    // Check that schema was overwritten
    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
    expect(schemaContent).not.toBe('// Modified schema');
    expect(schemaContent).toContain('provider = "mysql"');
  });

  test('should create proper directory structure', async () => {
    await initProject({
      directory: testDir,
      provider: 'mysql',
      typescript: true,
      overwrite: false
    });

    // Check all expected directories exist
    const expectedDirs = [
      testDir,
      path.join(testDir, 'prisma'),
      path.join(testDir, 'prisma', 'seed'),
      path.join(testDir, 'migrations')
    ];

    for (const dir of expectedDirs) {
      expect(fs.existsSync(dir)).toBe(true);
      expect(fs.statSync(dir).isDirectory()).toBe(true);
    }

    // Check all expected files exist
    const expectedFiles = [
      path.join(testDir, 'schema.prisma'),
      path.join(testDir, 'prisma', 'schema.prisma'),
      path.join(testDir, '.env'),
      path.join(testDir, 'package.json'),
      path.join(testDir, 'tsconfig.json'),
      path.join(testDir, 'README.md'),
      path.join(testDir, 'prisma', 'seed', 'seed.ts')
    ];

    for (const file of expectedFiles) {
      expect(fs.existsSync(file)).toBe(true);
      expect(fs.statSync(file).isFile()).toBe(true);
    }
  });
});
