import * as fs from 'fs';
import * as path from 'path';
import { ClientGenerator } from '../generator/client-generator';

/**
 * Options for client generation
 */
export interface GenerateOptions {
  /**
   * Path to the schema file
   */
  schemaPath?: string;

  /**
   * Output directory for the generated client
   */
  outputDir?: string;

  /**
   * Whether to generate TypeScript types
   */
  generateTypes?: boolean;

  /**
   * Whether to generate JavaScript code
   */
  generateJs?: boolean;

  /**
   * Whether to generate a package.json file
   */
  generatePackageJson?: boolean;

  /**
   * Whether to generate a README.md file
   */
  generateReadme?: boolean;

  /**
   * Whether to watch for schema changes
   */
  watch?: boolean;

  /**
   * Custom generator to use
   */
  generator?: string;
}

/**
 * Generate a client from a schema
 */
export async function generateClient(options: GenerateOptions = {}): Promise<void> {
  const {
    schemaPath = 'schema.prisma',
    outputDir,
    generateTypes = true,
    generateJs = true,
    generatePackageJson = true,
    generateReadme = true,
    watch = false,
    generator = 'drismify-client-js'
  } = options;

  // Check if the schema file exists
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema file not found: ${schemaPath}`);
  }

  // Read the schema file
  const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

  // Parse the schema
  const parser = require('../parser/generatedParser.js');
  const ast = parser.parse(schemaContent);

  // Extract generator from the AST
  const generatorNode = ast.find((node: any) => node.type === 'generator');

  // Determine output directory
  let clientOutputDir = outputDir;
  if (!clientOutputDir && generatorNode && generatorNode.assignments && generatorNode.assignments.output) {
    clientOutputDir = generatorNode.assignments.output;
  }

  if (!clientOutputDir) {
    clientOutputDir = path.join(path.dirname(schemaPath), 'generated', 'client');
  }

  // Create the output directory if it doesn't exist
  if (!fs.existsSync(clientOutputDir)) {
    fs.mkdirSync(clientOutputDir, { recursive: true });
  }

  // Generate the client
  console.log(`Generating client from: ${schemaPath}`);
  console.log(`Outputting to: ${clientOutputDir}`);

  const clientGenerator = new ClientGenerator({
    outputDir: clientOutputDir,
    generateTypes,
    generateJs,
    generatePackageJson,
    generateReadme
  });

  await clientGenerator.generateFromSchemaFile(schemaPath);
  console.log(`Client generated successfully at ${clientOutputDir}`);
  console.log("Client generated successfully");

  // Watch for schema changes if requested
  if (watch) {
    console.log(`Watching for changes to ${schemaPath}...`);

    fs.watch(schemaPath, async (eventType) => {
      if (eventType === 'change') {
        console.log(`Schema file changed, regenerating client...`);

        try {
          await clientGenerator.generateFromSchemaFile(schemaPath);
          console.log(`Client regenerated successfully at ${clientOutputDir}`);
        } catch (error) {
          console.error('Error regenerating client:', error);
        }
      }
    });
  }
}

/**
 * Generate a schema from a database
 */
export async function generateSchema(options: GenerateOptions = {}): Promise<void> {
  const {
    schemaPath = 'schema.prisma'
  } = options;

  // This is a placeholder for the actual implementation
  // In a real implementation, we would:
  // 1. Connect to the database
  // 2. Introspect the database schema
  // 3. Generate a Prisma schema file

  console.log('Schema generation from database is not yet implemented');
  console.log('This would generate a schema file from an existing database');
}
