# Build and Deployment Rules for Drismify

## Build System Architecture
- **TypeScript compilation**: ES2020 target with ESNext modules
- **Parser generation**: PEG.js grammar compilation
- **ES module output**: Pure ES modules for Node.js 16+
- **CLI executable**: Shebang script with proper permissions
- **Multi-format support**: ESM primary, CommonJS compatibility

## Build Process Overview
```bash
# Complete build pipeline
pnpm run build

# Individual build steps
pnpm run build:parser    # Generate parser from grammar
pnpm run clean          # Clean dist directory
tsc                     # TypeScript compilation
```

## Build Script Structure (`scripts/build.js`)
1. **Parser Generation**: Convert PEG.js grammar to JavaScript
2. **Directory Cleanup**: Remove existing dist directory
3. **TypeScript Compilation**: Compile TS to ES modules
4. **CLI Wrapper Creation**: Create executable CLI entry point
5. **Parser Module Conversion**: Convert CommonJS to ES modules
6. **File Organization**: Move files to correct output structure
7. **CommonJS Compatibility**: Create .cjs wrapper for compatibility

## TypeScript Configuration (`tsconfig.json`)
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "outDir": "./dist",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": false,
    "noImplicitAny": false
  },
  "include": ["src/**/*"],
  "exclude": [
    "dist", "tests", "generated", "src/examples",
    "**/*.test.ts", "temp", "docs", "scripts"
  ]
}
```

## Output Directory Structure
```
dist/
├── src/                    # Compiled source code
│   ├── adapters/
│   ├── cli/
│   ├── client/
│   ├── extensions/
│   ├── generator/
│   ├── migrations/
│   ├── parser/
│   │   └── generatedParser.js  # Converted ES module
│   ├── translator/
│   ├── cli.js             # CLI implementation
│   └── index.js           # Main library export
├── cli.js                 # CLI wrapper (executable)
├── index.js               # Main library export (copy)
├── index.d.ts             # Type definitions (copy)
└── index.cjs              # CommonJS compatibility wrapper
```

## Package.json Configuration
```json
{
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "drismify": "dist/cli.js"
  },
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./cli": {
      "types": "./dist/cli.d.ts",
      "import": "./dist/cli.js"
    },
    "./adapters": {
      "types": "./dist/adapters/index.d.ts",
      "import": "./dist/adapters/index.js"
    }
  },
  "files": [
    "dist/**/*",
    "README.md",
    "LICENSE"
  ]
}
```

## Parser Build Process
```bash
# Generate parser from grammar
pegjs -o src/parser/generatedParser.js src/parser/prisma.pegjs

# Convert CommonJS exports to ES modules
module.exports = { SyntaxError: peg$SyntaxError, parse: peg$parse };
# Becomes:
export { peg$SyntaxError as SyntaxError, peg$parse as parse };
export default { SyntaxError: peg$SyntaxError, parse: peg$parse };
```

## CLI Executable Creation
```javascript
#!/usr/bin/env node
// CLI wrapper for dynamic import
import('./src/cli.js').then(module => {
  if (module.main) {
    module.main();
  }
}).catch(error => {
  console.error('Failed to load CLI:', error);
  process.exit(1);
});
```

## Development Build Commands
```json
{
  "scripts": {
    "build": "node scripts/build.js",
    "build:parser": "pegjs -o src/parser/generatedParser.js src/parser/prisma.pegjs",
    "prepublishOnly": "npm run build",
    "clean": "rm -rf dist",
    "dev": "ts-node src/index.ts",
    "dev:cli": "ts-node src/cli.ts"
  }
}
```

## Testing Before Build
- **TypeScript compilation**: Ensure no TypeScript errors
- **Parser generation**: Verify parser builds successfully
- **Module imports**: Test ES module imports work correctly
- **CLI functionality**: Test CLI commands work after build

## Build Validation
```bash
# Validate build output
node -e "import('./dist/index.js').then(m => console.log('✅ ES import works'))"
node -e "const m = require('./dist/index.cjs'); console.log('✅ CommonJS works')"
./dist/cli.js --help  # Test CLI executable
```

## Pre-publish Checklist
- [ ] All tests pass (`pnpm test`)
- [ ] Build completes without errors (`pnpm run build`)
- [ ] CLI works after build (`./dist/cli.js --help`)
- [ ] Version updated in package.json
- [ ] CHANGELOG.md updated
- [ ] README.md current
- [ ] No dev dependencies in production build

## Publishing Process
```bash
# Local testing
npm pack                    # Create tarball for testing
npm install drismify-0.2.1.tgz  # Test installation

# Registry publishing
npm publish                 # Publish to npm
npx jsr publish            # Publish to JSR registry

# Verify publication
npm install -g drismify     # Test global installation
drismify --help            # Test global CLI
```

## Version Management
- **Semantic versioning**: Follow semver (MAJOR.MINOR.PATCH)
- **Version consistency**: Update all version references
- **Git tags**: Tag releases with version numbers
- **Release notes**: Document changes in each release

## Environment-Specific Builds

### Development Build
- **Source maps**: Include for debugging
- **Type declarations**: Generate .d.ts files
- **Watch mode**: Support file watching
- **Debug symbols**: Include debug information

### Production Build
- **Minification**: Not applied (library code)
- **Optimization**: TypeScript optimizations enabled
- **Tree shaking**: Support tree shaking in consumers
- **Size optimization**: Minimize bundle size

## Cross-Platform Compatibility
- **Node.js versions**: Support Node.js 16+
- **Operating systems**: Windows, macOS, Linux
- **Shell compatibility**: CLI works in different shells
- **Path handling**: Use Node.js path module

## Build Performance
- **Incremental builds**: Only rebuild changed files
- **Parallel processing**: Use available CPU cores
- **Cache utilization**: Leverage TypeScript build cache
- **Build time monitoring**: Track build performance

## Error Handling in Build
```javascript
// Build script error handling
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
```

## Continuous Integration
```yaml
# Example GitHub Actions workflow
name: Build and Test
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: pnpm install
      - run: pnpm run build:parser
      - run: pnpm run build
      - run: pnpm test
      - run: ./dist/cli.js --help
```

## Distribution Targets
- **npm registry**: Primary distribution channel
- **JSR registry**: Deno/modern runtime support
- **GitHub Releases**: Source code and binaries
- **Docker images**: Containerized runtime (future)

## Security Considerations
- **Dependency scanning**: Check for vulnerabilities
- **Code signing**: Sign releases (future feature)
- **Supply chain**: Verify build integrity
- **Access controls**: Limit publishing permissions

## Monitoring and Analytics
- **Download statistics**: Track package downloads
- **Error reporting**: Monitor build failures
- **Performance metrics**: Track build times
- **User feedback**: Collect usage data