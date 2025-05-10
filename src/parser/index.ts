/**
 * Prisma Schema Parser
 */

// Import the generated parser
let parser: any;
try {
  parser = require('./generatedParser.js');
} catch (e) {
  console.error('Failed to load parser. Did you run "pnpm build:parser"?');
  throw e;
}

/**
 * Parse a Prisma schema
 */
export function parseSchema(schema: string): any[] {
  return parser.parse(schema);
}

/**
 * Parse a Prisma schema file
 */
export function parseSchemaFile(filePath: string): any[] {
  const fs = require('fs');
  const schema = fs.readFileSync(filePath, 'utf-8');
  return parseSchema(schema);
}

/**
 * Export the parser
 */
export { parser };
