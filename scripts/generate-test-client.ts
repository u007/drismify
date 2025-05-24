import * as path from 'node:path';
import * as fs from 'node:fs';
import { execSync } from 'node:child_process';

// Path to the nested-writes schema
const schemaPath = path.join(__dirname, '..', 'tests', 'fixtures', 'nested-writes-schema.prisma');

// Ensure the schema exists
if (!fs.existsSync(schemaPath)) {
  console.error(`Schema file not found: ${schemaPath}`);
  process.exit(1);
}

// Path to the generated client
const outputDir = path.join(__dirname, '..', 'generated', 'nested-writes-client');

// Ensure the output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Generate the client
console.log(`Generating client from schema: ${schemaPath}`);
console.log(`Output directory: ${outputDir}`);

try {
  // Use the generate:client script
  execSync(`bun run generate:client "${schemaPath}"`, {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });
  
  console.log('Client generated successfully');
} catch (error) {
  console.error('Error generating client:', error);
  process.exit(1);
}
