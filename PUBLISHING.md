# Publishing Guide for Drismify

This guide explains how to publish Drismify to various package registries.

## Prerequisites

1. Ensure you have the necessary permissions to publish
2. Make sure all tests pass: `npm test`
3. Update version in `package.json` and `jsr.json`
4. Update `CHANGELOG.md` with new features and fixes
5. Build the project: `npm run build`

## Publishing to NPM

### 1. Login to NPM

```bash
npm login
```

### 2. Publish

```bash
# For stable releases
npm publish

# For beta releases
npm publish --tag beta

# For alpha releases  
npm publish --tag alpha
```

### 3. Verify Publication

```bash
npm view drismify
```

## Publishing to JSR (JavaScript Registry)

### 1. Install JSR CLI

```bash
npm install -g @jsr/cli
```

### 2. Login to JSR

```bash
jsr login
```

### 3. Publish

```bash
jsr publish
```

### 4. Verify Publication

```bash
jsr info @drismify/core
```

## Version Management

### Semantic Versioning

- **Patch** (0.1.1): Bug fixes, small improvements
- **Minor** (0.2.0): New features, backwards compatible
- **Major** (1.0.0): Breaking changes

### Update Versions

```bash
# Update package.json
npm version patch|minor|major

# Manually update jsr.json to match
# Update src/index.ts VERSION constant
```

## Pre-publish Checklist

- [ ] All tests pass
- [ ] Documentation is updated
- [ ] Version numbers are consistent across files
- [ ] CHANGELOG.md is updated
- [ ] Build artifacts are clean (`npm run clean && npm run build`)
- [ ] No sensitive information in published files
- [ ] CLI works correctly after build

## Post-publish Tasks

1. Create a GitHub release with changelog
2. Update documentation website (if applicable)
3. Announce on social media/community channels
4. Monitor for issues and user feedback

## Troubleshooting

### NPM Publish Issues

```bash
# Check what files will be published
npm pack --dry-run

# Check package contents
tar -tzf drismify-*.tgz
```

### JSR Publish Issues

```bash
# Validate JSR configuration
jsr validate

# Check JSR package contents
jsr pack --dry-run
```

## Automated Publishing

Consider setting up GitHub Actions for automated publishing:

```yaml
# .github/workflows/publish.yml
name: Publish Package

on:
  release:
    types: [published]

jobs:
  publish-npm:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm run build
      - run: npm test
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

  publish-jsr:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - run: npx jsr publish
        env:
          JSR_TOKEN: ${{ secrets.JSR_TOKEN }}
```
