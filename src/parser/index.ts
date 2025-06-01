/**
 * Prisma Schema Parser
 */

import * as fs from 'node:fs';

// Import the generated parser
let parser: any = null;

async function loadParser() {
  if (!parser) {
    try {
      // Use dynamic import for ES modules
      const parserModule = await import('./generatedParser.js');
      parser = parserModule.default || parserModule;
    } catch (e) {
      console.error('Failed to load parser. Did you run "pnpm build:parser"?');
      throw e;
    }
  }
  return parser;
}

/**
 * Parse a Prisma schema
 */
export async function parseSchema(schema: string): Promise<any[]> {
  const p = await loadParser();
  return p.parse(schema);
}

/**
 * Parse a Prisma schema file
 */
export async function parseSchemaFile(filePath: string): Promise<any[]> {
  const schema = fs.readFileSync(filePath, 'utf-8');
  return parseSchema(schema);
}

/**
 * Get the parser instance (async)
 */
export async function getParser(): Promise<any> {
  return loadParser();
}
