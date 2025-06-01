#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

console.log('🔨 Building Drismify...');

// Step 1: Build parser
console.log('📝 Building parser...');
try {
  execSync('pegjs -o src/parser/generatedParser.js src/parser/prisma.pegjs', {
    stdio: 'inherit',
    cwd: projectRoot
  });
  console.log('✅ Parser built successfully');
} catch (error) {
  console.error('❌ Failed to build parser:', error.message);
  process.exit(1);
}

// Step 2: Clean dist directory
console.log('🧹 Cleaning dist directory...');
const distPath = path.join(projectRoot, 'dist');
if (fs.existsSync(distPath)) {
  fs.rmSync(distPath, { recursive: true, force: true });
}

// Step 3: Build TypeScript (ESM)
console.log('🔧 Building TypeScript (ESM)...');
try {
  execSync('tsc', {
    stdio: 'inherit',
    cwd: projectRoot
  });
  console.log('✅ TypeScript built successfully');
} catch (error) {
  console.error('❌ Failed to build TypeScript:', error.message);
  process.exit(1);
}

// Step 4: Create CLI wrapper with correct paths
console.log('🔧 Creating CLI wrapper...');
const targetCliPath = path.join(projectRoot, 'dist', 'cli.js');

try {
  // Create a CLI wrapper that imports from the correct location
  const cliWrapperContent = `#!/usr/bin/env node

// CLI wrapper for Drismify
// This wrapper imports the actual CLI from the correct location

import('./src/cli.js').then(module => {
  // The CLI module should export a main function or run automatically
  if (module.main) {
    module.main();
  }
}).catch(error => {
  console.error('Failed to load CLI:', error);
  process.exit(1);
});
`;

  fs.writeFileSync(targetCliPath, cliWrapperContent);
  fs.chmodSync(targetCliPath, '755');
  console.log('✅ CLI wrapper created and made executable');
} catch (error) {
  console.error('❌ Failed to create CLI wrapper:', error.message);
}

// Step 5: Copy and convert generated parser to ES modules
console.log('🔧 Copying and converting generated parser...');
const srcParserPath = path.join(projectRoot, 'src', 'parser', 'generatedParser.js');
const targetParserPath = path.join(projectRoot, 'dist', 'src', 'parser', 'generatedParser.js');

if (fs.existsSync(srcParserPath)) {
  // Read the parser file and convert CommonJS to ES modules
  let parserContent = fs.readFileSync(srcParserPath, 'utf8');

  // Replace CommonJS exports with ES module exports
  parserContent = parserContent.replace(
    'module.exports = {\n  SyntaxError: peg$SyntaxError,\n  parse:       peg$parse\n};',
    'export { peg$SyntaxError as SyntaxError, peg$parse as parse };\nexport default { SyntaxError: peg$SyntaxError, parse: peg$parse };'
  );

  fs.writeFileSync(targetParserPath, parserContent);
  console.log('✅ Generated parser copied and converted to ES modules');
} else {
  console.warn('⚠️ Generated parser not found at', srcParserPath);
}

// Step 6: Move main files to correct location
console.log('🔧 Moving main files...');
const srcIndexPath = path.join(projectRoot, 'dist', 'src', 'index.js');
const targetIndexPath = path.join(projectRoot, 'dist', 'index.js');
const srcIndexDtsPath = path.join(projectRoot, 'dist', 'src', 'index.d.ts');
const targetIndexDtsPath = path.join(projectRoot, 'dist', 'index.d.ts');

if (fs.existsSync(srcIndexPath)) {
  fs.copyFileSync(srcIndexPath, targetIndexPath);
  console.log('✅ Main index.js moved');
}

if (fs.existsSync(srcIndexDtsPath)) {
  fs.copyFileSync(srcIndexDtsPath, targetIndexDtsPath);
  console.log('✅ Main index.d.ts moved');
}

// Step 7: Create CommonJS version for compatibility
console.log('🔧 Creating CommonJS compatibility...');
try {
  // Create a simple CommonJS wrapper for the main export
  const cjsContent = `
const drismify = require('./index.js');
module.exports = drismify;
module.exports.default = drismify;
`;
  fs.writeFileSync(path.join(projectRoot, 'dist', 'index.cjs'), cjsContent);
  console.log('✅ CommonJS compatibility created');
} catch (error) {
  console.error('❌ Failed to create CommonJS compatibility:', error.message);
}

console.log('🎉 Build completed successfully!');
