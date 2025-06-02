import * as fs from 'fs';
import * as path from 'path';

/**
 * Options for initializing a new Drismify project
 */
export interface InitOptions {
  /**
   * Directory where the project will be initialized
   */
  directory?: string;
  
  /**
   * Database provider to use
   */
  provider?: 'sqlite' | 'turso' | 'mongodb';
  
  /**
   * Database URL
   */
  url?: string;
  
  /**
   * Whether to use TypeScript
   */
  typescript?: boolean;
  
  /**
   * Whether to overwrite existing files
   */
  overwrite?: boolean;
}

/**
 * Initialize a new Drismify project
 */
export async function initProject(options: InitOptions = {}): Promise<void> {
  const {
    directory = '.',
    provider = 'sqlite',
    url = provider === 'sqlite' ? 'file:./dev.db' :
          provider === 'turso' ? 'libsql://localhost:8080' :
          'mongodb://localhost:37017/mydb',
    typescript = true,
    overwrite = false
  } = options;
  
  // Create the directory if it doesn't exist
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
  
  // Create the schema.prisma file
  const schemaPath = path.join(directory, 'schema.prisma');
  if (fs.existsSync(schemaPath) && !overwrite) {
    throw new Error(`File already exists: ${schemaPath}. Use --overwrite to overwrite.`);
  }
  
  const schemaContent = generateSchemaContent(provider, url);
  fs.writeFileSync(schemaPath, schemaContent);
  
  // Create the migrations directory
  const migrationsDir = path.join(directory, 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
  }
  
  // Create the prisma directory
  const prismaDir = path.join(directory, 'prisma');
  if (!fs.existsSync(prismaDir)) {
    fs.mkdirSync(prismaDir, { recursive: true });
  }
  
  // Create a symbolic link to schema.prisma in the prisma directory
  const prismaSchemePath = path.join(prismaDir, 'schema.prisma');
  if (fs.existsSync(prismaSchemePath) && !overwrite) {
    throw new Error(`File already exists: ${prismaSchemePath}. Use --overwrite to overwrite.`);
  }
  
  // Copy schema.prisma to prisma directory
  fs.copyFileSync(schemaPath, prismaSchemePath);
  
  // Create a .env file
  const envPath = path.join(directory, '.env');
  if (fs.existsSync(envPath) && !overwrite) {
    throw new Error(`File already exists: ${envPath}. Use --overwrite to overwrite.`);
  }
  
  const envContent = generateEnvContent(provider, url);
  fs.writeFileSync(envPath, envContent);
  
  // Create a package.json file if it doesn't exist
  const packageJsonPath = path.join(directory, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    const packageJsonContent = generatePackageJsonContent(typescript);
    fs.writeFileSync(packageJsonPath, packageJsonContent);
  } else {
    // Update existing package.json
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    
    // Add drismify scripts
    packageJson.scripts = {
      ...packageJson.scripts,
      'drismify': 'drismify',
      'db:push': 'drismify db push',
      'db:seed': 'drismify db seed',
      'generate': 'drismify generate',
      'migrate:dev': 'drismify migrate dev',
      'migrate:deploy': 'drismify migrate deploy',
      'migrate:reset': 'drismify migrate reset',
      'migrate:status': 'drismify migrate status'
    };
    
    // Add drismify dependency
    packageJson.dependencies = {
      ...packageJson.dependencies,
      'drismify': '^0.0.1'
    };
    
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  }
  
  // Create a tsconfig.json file if using TypeScript and it doesn't exist
  if (typescript) {
    const tsconfigPath = path.join(directory, 'tsconfig.json');
    if (!fs.existsSync(tsconfigPath)) {
      const tsconfigContent = generateTsconfigContent();
      fs.writeFileSync(tsconfigPath, tsconfigContent);
    }
  }
  
  // Create a seed script
  const seedDir = path.join(directory, 'prisma', 'seed');
  if (!fs.existsSync(seedDir)) {
    fs.mkdirSync(seedDir, { recursive: true });
  }
  
  const seedPath = path.join(seedDir, typescript ? 'seed.ts' : 'seed.js');
  if (fs.existsSync(seedPath) && !overwrite) {
    throw new Error(`File already exists: ${seedPath}. Use --overwrite to overwrite.`);
  }
  
  const seedContent = generateSeedContent(typescript);
  fs.writeFileSync(seedPath, seedContent);
  
  // Create a README.md file
  const readmePath = path.join(directory, 'README.md');
  if (!fs.existsSync(readmePath) || overwrite) {
    const readmeContent = generateReadmeContent();
    fs.writeFileSync(readmePath, readmeContent);
  }
}

/**
 * Generate schema.prisma content
 */
function generateSchemaContent(provider: string, url: string): string {
  return `// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "drismify-client-js"
  output   = "../generated/client"
}

datasource db {
  provider = "${provider}"
  url      = env("DATABASE_URL")
}

// Define your models below
model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
`;
}

/**
 * Generate .env content
 */
function generateEnvContent(provider: string, url: string): string {
  return `# Environment variables
DATABASE_URL="${url}"
`;
}

/**
 * Generate package.json content
 */
function generatePackageJsonContent(typescript: boolean): string {
  return JSON.stringify({
    name: 'drismify-project',
    version: '0.0.1',
    description: 'A Drismify project',
    main: typescript ? 'dist/index.js' : 'index.js',
    scripts: {
      'drismify': 'drismify',
      'db:push': 'drismify db push',
      'db:seed': 'drismify db seed',
      'generate': 'drismify generate',
      'migrate:dev': 'drismify migrate dev',
      'migrate:deploy': 'drismify migrate deploy',
      'migrate:reset': 'drismify migrate reset',
      'migrate:status': 'drismify migrate status',
      'build': typescript ? 'tsc' : 'echo "No build step"',
      'start': typescript ? 'node dist/index.js' : 'node index.js',
      'dev': typescript ? 'ts-node src/index.ts' : 'node index.js'
    },
    dependencies: {
      'drismify': '^0.0.1'
    },
    devDependencies: typescript ? {
      '@types/node': '^20.0.0',
      'ts-node': '^10.9.2',
      'typescript': '^5.0.0'
    } : {}
  }, null, 2);
}

/**
 * Generate tsconfig.json content
 */
function generateTsconfigContent(): string {
  return JSON.stringify({
    compilerOptions: {
      target: 'es2016',
      module: 'commonjs',
      esModuleInterop: true,
      forceConsistentCasingInFileNames: true,
      strict: true,
      skipLibCheck: true,
      outDir: 'dist'
    },
    include: ['src/**/*'],
    exclude: ['node_modules']
  }, null, 2);
}

/**
 * Generate seed script content
 */
function generateSeedContent(typescript: boolean): string {
  if (typescript) {
    return `import { PrismaClient } from '../../generated/client';

const prisma = new PrismaClient();

async function main() {
  // Create seed data
  const alice = await prisma.user.upsert({
    where: { email: 'alice@example.com' },
    update: {},
    create: {
      email: 'alice@example.com',
      name: 'Alice'
    }
  });

  const bob = await prisma.user.upsert({
    where: { email: 'bob@example.com' },
    update: {},
    create: {
      email: 'bob@example.com',
      name: 'Bob'
    }
  });

  console.log({ alice, bob });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.disconnect();
  });
`;
  } else {
    return `const { PrismaClient } = require('../../generated/client');

const prisma = new PrismaClient();

async function main() {
  // Create seed data
  const alice = await prisma.user.upsert({
    where: { email: 'alice@example.com' },
    update: {},
    create: {
      email: 'alice@example.com',
      name: 'Alice'
    }
  });

  const bob = await prisma.user.upsert({
    where: { email: 'bob@example.com' },
    update: {},
    create: {
      email: 'bob@example.com',
      name: 'Bob'
    }
  });

  console.log({ alice, bob });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.disconnect();
  });
`;
  }
}

/**
 * Generate README.md content
 */
function generateReadmeContent(): string {
  return `# Drismify Project

This project uses [Drismify](https://github.com/your-username/drismify), a Prisma-compatible ORM replacement.

## Getting Started

1. Install dependencies:
   \`\`\`
   npm install
   \`\`\`

2. Generate the client:
   \`\`\`
   npm run generate
   \`\`\`

3. Push the schema to the database:
   \`\`\`
   npm run db:push
   \`\`\`

4. Seed the database:
   \`\`\`
   npm run db:seed
   \`\`\`

## Available Scripts

- \`npm run generate\` - Generate the Drismify client
- \`npm run db:push\` - Push the schema to the database
- \`npm run db:seed\` - Seed the database
- \`npm run migrate:dev\` - Generate and apply migrations in development
- \`npm run migrate:deploy\` - Apply migrations in production
- \`npm run migrate:reset\` - Reset the database
- \`npm run migrate:status\` - Show migration status

## Learn More

- [Drismify Documentation](https://github.com/your-username/drismify)
- [Prisma Documentation](https://www.prisma.io/docs)
`;
}
