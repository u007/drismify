/**
 * Jest setup file
 * This file is run before each test file
 */

import * as path from 'path';
import * as fs from 'fs';

// Set test timeout to 10 seconds
jest.setTimeout(10000);

// Create test directories if they don't exist
const testDirs = [
  'tests/fixtures',
  'tests/temp',
  'tests/temp/migrations',
  'tests/temp/generated',
  'tests/temp/db',
];

for (const dir of testDirs) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Set up environment variables for testing
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:./tests/temp/db/test.db';

// Clean up test database before each test
beforeEach(() => {
  const dbPath = path.resolve('./tests/temp/db/test.db');
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
});

// Global test utilities
global.getFixturePath = (filename: string) => path.join(__dirname, 'fixtures', filename);
global.getTempPath = (filename: string) => path.join(__dirname, 'temp', filename);
global.readFixture = (filename: string) => fs.readFileSync(getFixturePath(filename), 'utf-8');
global.writeTemp = (filename: string, content: string) => fs.writeFileSync(getTempPath(filename), content);
global.readTemp = (filename: string) => fs.readFileSync(getTempPath(filename), 'utf-8');
global.fileExists = (filepath: string) => fs.existsSync(filepath);

// Add custom matchers
expect.extend({
  toBeValidSchema(received: string) {
    try {
      // Try to parse the schema
      const parser = require('../src/parser/generatedParser.js');
      parser.parse(received);
      return {
        message: () => 'Expected schema to be invalid, but it was valid',
        pass: true,
      };
    } catch (error) {
      return {
        message: () => `Expected schema to be valid, but got error: ${error}`,
        pass: false,
      };
    }
  },
});
