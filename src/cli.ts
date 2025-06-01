#!/usr/bin/env node

// CLI entry point for Drismify
// This will handle commands like `drismify validate`, `drismify migrate`, etc.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { translatePslToDrizzleSchema } from './translator/pslToDrizzle.js'; // Import the translator
// Import CLI modules
import {
  initProject,
  dbPush,
  dbPull,
  dbSeed,
  validateSchema,
  generateClient,
  generateSchema,
  migrateDev,
  migrateDeploy,
  migrateReset,
  migrateStatus
} from './cli/index';

// Dynamically import the generated parser
// Note: Adjust path if your generated parser is elsewhere or has a different name
interface BasicParser {
  parse: (input: string, options?: unknown) => unknown; // The structure of the AST will be defined by the grammar
}

async function loadParser(): Promise<BasicParser> {
    try {
        // Use dynamic import for ES modules
        const parserModule = await import('./parser/generatedParser.js');
        return parserModule.default || parserModule;
    } catch (e) {
        console.error("Failed to load parser. Did you run 'pnpm build:parser'?", e);
        process.exit(1);
    }
}

async function showHelp() {
    const packageJson = await import('../package.json', { assert: { type: 'json' } });
    console.log(`
Drismify CLI v${packageJson.default.version}

Usage: drismify <command> [options]

Commands:
  init [directory]                    Initialize a new Drismify project
  generate [schema-path]              Generate client from schema
  validate [schema-path]              Validate schema syntax

  db push [--schema path]             Push schema to database
  db pull [--schema path]             Pull schema from database

  migrate dev [schema] [name]         Generate and apply migration
  migrate deploy                      Apply pending migrations
  migrate reset                       Reset database
  migrate status                      Show migration status

  introspect <url> [provider]         Introspect existing database
  seed [schema] [script]              Seed database with data
  studio [schema] [--port 5555]       Launch database studio

  help, --help, -h                    Show this help message

Examples:
  drismify init my-app                Create new project
  drismify generate schema.prisma     Generate client
  drismify db push                    Push schema changes
  drismify migrate dev                Create and apply migration
  drismify studio                     Launch database studio

For more information, visit: https://github.com/u007/drismify
`);
}

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    // Show help for help commands or no command
    if (!command || command === 'help' || command === '--help' || command === '-h') {
        await showHelp();
        return;
    }

    const packageJson = await import('../package.json', { assert: { type: 'json' } });
    console.log(`Drismify CLI v${packageJson.default.version}`);
    if (process.env.DEBUG) {
        console.log("Arguments:", args);
    }

    // Load parser
    const parser = await loadParser();

    const prismaSchemaPathArg = args[1];
    const outputDrizzleSchemaPath = args[2] || 'src/db/schema.ts'; // Default output path

    // Import required modules using dynamic imports (only when needed)
    // Note: Some CLI modules are temporarily disabled due to ES module import issues

    if (command === 'validate' && prismaSchemaPathArg) {
        const schemaPath = path.resolve(prismaSchemaPathArg);
        console.log(`Validating schema: ${schemaPath}`);

        try {
            // Import the validate module
            const { validateSchema } = await import('./cli/validate.js');

            const result = await validateSchema({
                schemaPath,
                verbose: args.includes('--verbose'),
                lint: args.includes('--lint'),
                suggestions: args.includes('--suggestions')
            });

            if (result.valid) {
                console.log("Schema is valid.");

                if (result.warnings.length > 0) {
                    console.log("\nWarnings:");
                    for (const warning of result.warnings) {
                        console.log(`  - ${warning.message}${warning.line ? ` (Line ${warning.line})` : ''}`);
                    }
                }

                if (args.includes('--suggestions') && result.suggestions.length > 0) {
                    console.log("\nSuggestions:");
                    for (const suggestion of result.suggestions) {
                        console.log(`  - ${suggestion.message}${suggestion.line ? ` (Line ${suggestion.line})` : ''}`);
                    }
                }
            } else {
                console.error("Schema validation failed:");

                for (const error of result.errors) {
                    console.error(`  - ${error.message}${error.line ? ` (Line ${error.line})` : ''}`);
                }

                if (args.includes('--suggestions') && result.suggestions.length > 0) {
                    console.log("\nSuggestions to fix errors:");
                    for (const suggestion of result.suggestions) {
                        console.log(`  - ${suggestion.message}${suggestion.line ? ` (Line ${suggestion.line})` : ''}`);
                    }
                }
            }
        } catch (e: unknown) {
            console.error("Schema validation failed:");
            const error = e as Error;
            console.error(`Message: ${error.message}`);
            console.error(`Stack: ${error.stack}`);
        }
    } else if (command === 'generate-schema' && prismaSchemaPathArg) {
        const pslPath = path.resolve(prismaSchemaPathArg);
        const drizzleSchemaOutPath = path.resolve(outputDrizzleSchemaPath);
        console.log(`Generating Drizzle schema from: ${pslPath}`);
        console.log(`Outputting to: ${drizzleSchemaOutPath}`);
        try {
            const pslContent = fs.readFileSync(pslPath, 'utf-8');
            const { parseSchema } = await import('./parser/index.js');
            const pslAst = await parseSchema(pslContent) as any[]; // Assuming AST is an array
            const drizzleSchemaContent = translatePslToDrizzleSchema(pslAst);

            // Ensure the output directory exists
            fs.mkdirSync(path.dirname(drizzleSchemaOutPath), { recursive: true });

            // Write the schema file
            fs.writeFileSync(drizzleSchemaOutPath, drizzleSchemaContent);

            // Verify the file was written
            if (!fs.existsSync(drizzleSchemaOutPath)) {
                throw new Error(`Failed to write schema file to ${drizzleSchemaOutPath}`);
            }

            console.log(`Schema generated successfully at ${drizzleSchemaOutPath}`);
            console.log("Schema generated successfully");
        } catch (e: unknown) {
            console.error("Failed to generate Drizzle schema:");
             const error = e as { location?: { start: { line: number; column: number } }; message?: string; stack?:string };
            if (error.location?.start) { // Parser errors
                console.error(`Location: Line ${error.location.start.line}, Column ${error.location.start.column}`);
            }
            console.error(`Message: ${error.message}`);
            if(error.stack) console.error(`Stack: ${error.stack}`);
        }
    } else if ((command === 'generate-client' || command === 'generate') && prismaSchemaPathArg) {
        const schemaPath = path.resolve(prismaSchemaPathArg);
        const outputDir = args[2];

        console.log(`Generating client from: ${schemaPath}`);

        try {
            // Import the generate module
            const { generateClient } = await import('./cli/generate.js');

            await generateClient({
                schemaPath,
                outputDir,
                watch: args.includes('--watch')
            });

            console.log('Client generated successfully');
        } catch (e: unknown) {
            console.error("Failed to generate client:");
            const error = e as Error;
            console.error(`Message: ${error.message}`);
            console.error(`Stack: ${error.stack}`);
        }
    } else if (command === 'migrate' && args[1]) {
        const subCommand = args[1];
        const schemaPath = args[2] ? path.resolve(args[2]) : path.resolve('./schema.prisma');

        if (subCommand === 'dev') {
            // Generate and apply migrations in development
            const migrationName = args[3] || 'migration';
            const migrationsDir = path.resolve('./migrations');

            console.log(`Generating migration from: ${schemaPath}`);
            console.log(`Migration name: ${migrationName}`);
            console.log(`Migrations directory: ${migrationsDir}`);

            try {
                // Create migrations directory if it doesn't exist
                if (!fs.existsSync(migrationsDir)) {
                    fs.mkdirSync(migrationsDir, { recursive: true });
                }

                // Import the migrate module
                const { migrateDev } = await import('./cli/migrate.js');

                await migrateDev({
                    schemaPath,
                    name: migrationName,
                    migrationsDir
                });

                console.log('Migration generated and applied successfully');
            } catch (e: unknown) {
                console.error("Failed to generate or apply migration:");
                const error = e as Error;
                console.error(`Message: ${error.message}`);
                console.error(`Stack: ${error.stack}`);
            }
        } else if (subCommand === 'deploy') {
            // Apply migrations in production
            const migrationsDir = path.resolve('./migrations');

            console.log(`Applying migrations from: ${migrationsDir}`);

            try {
                // Import the migrate module
                const { migrateDeploy } = await import('./cli/migrate.js');

                await migrateDeploy({
                    migrationsDir
                });

                console.log('Migrations applied successfully');
            } catch (e: unknown) {
                console.error("Failed to apply migrations:");
                const error = e as Error;
                console.error(`Message: ${error.message}`);
                console.error(`Stack: ${error.stack}`);
            }
        } else if (subCommand === 'reset') {
            // Reset the database
            const migrationsDir = path.resolve('./migrations');

            console.log(`Resetting database with migrations from: ${migrationsDir}`);

            try {
                // Import the migrate module
                const { migrateReset } = await import('./cli/migrate.js');

                await migrateReset({
                    migrationsDir
                });

                console.log('Database reset successfully');
            } catch (e: unknown) {
                console.error("Failed to reset database:");
                const error = e as Error;
                console.error(`Message: ${error.message}`);
                console.error(`Stack: ${error.stack}`);
            }
        } else if (subCommand === 'status') {
            // Show migration status
            const migrationsDir = path.resolve('./migrations');

            console.log(`Checking migration status from: ${migrationsDir}`);

            try {
                // Import the migrate module
                const { migrateStatus } = await import('./cli/migrate.js');

                const status = await migrateStatus({
                    migrationsDir
                });

                console.log('Migration status checked successfully');
                console.log(status);
            } catch (e: unknown) {
                console.error("Failed to check migration status:");
                const error = e as Error;
                console.error(`Message: ${error.message}`);
                console.error(`Stack: ${error.stack}`);
            }
        } else {
            console.log("Available migrate commands:");
            console.log("  migrate dev [schema-path] [migration-name] - Generate and apply migrations in development");
            console.log("  migrate deploy                            - Apply migrations in production");
            console.log("  migrate reset                             - Reset the database");
            console.log("  migrate status                            - Show migration status");
        }
    } else if (command === 'init') {
        // Initialize a new Drismify project
        const directory = args[1] || '.';
        const provider = args[2] || 'sqlite';

        console.log(`Initializing new Drismify project in: ${directory}`);
        console.log(`Database provider: ${provider}`);

        try {
            // Import the init module
            const { initProject } = await import('./cli/init.js');

            await initProject({
                directory,
                provider: provider as 'sqlite' | 'turso',
                typescript: true,
                overwrite: false
            });

            console.log(`Project initialized successfully in ${directory}`);
        } catch (e: unknown) {
            console.error("Failed to initialize project:");
            const error = e as Error;
            console.error(`Message: ${error.message}`);
            console.error(`Stack: ${error.stack}`);
        }
    } else if (command === 'introspect') {
        const databaseUrl = args[1];
        const provider = args[2] || 'sqlite';
        const outputPath = args[3] || 'schema.prisma';

        if (!databaseUrl) {
            console.error('Database URL is required for introspection');
            console.log('Usage: drismify introspect <database-url> [provider] [output-path]');
            return;
        }

        console.log(`Introspecting ${provider} database...`);
        console.log(`Database URL: ${databaseUrl}`);
        console.log(`Output path: ${outputPath}`);

        try {
            // Import the introspect module
            const { introspectDatabase } = await import('./cli/introspect.js');

            const schema = await introspectDatabase({
                url: databaseUrl,
                provider: provider as 'sqlite' | 'turso',
                output: outputPath,
                overwrite: args.includes('--overwrite'),
                saveComments: !args.includes('--no-comments'),
                debug: args.includes('--debug')
            });

            console.log(`Schema introspected successfully and written to: ${outputPath}`);
        } catch (e: unknown) {
            console.error("Failed to introspect database:");
            const error = e as Error;
            console.error(`Message: ${error.message}`);
            console.error(`Stack: ${error.stack}`);
        }
    } else if (command === 'seed') {
        const schemaPath = args[1] ? path.resolve(args[1]) : path.resolve('./schema.prisma');
        const seedScript = args[2];

        console.log(`Seeding database using schema: ${schemaPath}`);

        try {
            // Import the db module
            const { dbSeed } = await import('./cli/db.js');

            await dbSeed({
                schemaPath,
                seedScript,
                reset: args.includes('--reset')
            });

            console.log('Database seeded successfully');
        } catch (e: unknown) {
            console.error("Failed to seed database:");
            const error = e as Error;
            console.error(`Message: ${error.message}`);
            console.error(`Stack: ${error.stack}`);
        }
    } else if (command === 'studio') {
        console.error('❌ Studio command is temporarily disabled due to build issues.');
        console.log('This feature will be available in a future release.');
    } else if (command === 'db' && args[1]) {
        const subCommand = args[1];

        // Parse schema path from --schema flag or positional argument
        let schemaPath = path.resolve('./schema.prisma');
        const schemaIndex = args.indexOf('--schema');
        if (schemaIndex !== -1 && args[schemaIndex + 1]) {
            schemaPath = path.resolve(args[schemaIndex + 1]);
        } else if (args[2] && !args[2].startsWith('--')) {
            schemaPath = path.resolve(args[2]);
        }

        if (subCommand === 'push') {
            // Push schema to database
            console.log(`Pushing schema to database: ${schemaPath}`);

            try {
                // Import the db module
                const { dbPush } = await import('./cli/db.js');

                await dbPush({
                    schemaPath,
                    skipGenerate: args.includes('--skip-generate'),
                    force: args.includes('--force'),
                    reset: args.includes('--reset')
                });

                console.log('Schema pushed successfully');
            } catch (e: unknown) {
                console.error("Failed to push schema:");
                const error = e as Error;
                console.error(`Message: ${error.message}`);
                console.error(`Stack: ${error.stack}`);
            }
        } else if (subCommand === 'pull') {
            // Pull schema from database
            console.log(`Pulling schema from database to: ${schemaPath}`);

            try {
                // Import the db module
                const { dbPull } = await import('./cli/db.js');

                await dbPull({
                    schemaPath
                });

                console.log('Schema pulled successfully');
            } catch (e: unknown) {
                console.error("Failed to pull schema:");
                const error = e as Error;
                console.error(`Message: ${error.message}`);
                console.error(`Stack: ${error.stack}`);
            }
        } else if (subCommand === 'seed') {
            // Seed database
            console.log(`Seeding database using schema: ${schemaPath}`);

            try {
                // Import the db module
                const { dbSeed } = await import('./cli/db.js');

                await dbSeed({
                    schemaPath,
                    seedScript: args[2],
                    reset: args.includes('--reset')
                });

                console.log('Database seeded successfully');
            } catch (e: unknown) {
                console.error("Failed to seed database:");
                const error = e as Error;
                console.error(`Message: ${error.message}`);
                console.error(`Stack: ${error.stack}`);
            }
        } else {
            console.log("Available db commands:");
            console.log("  db push [schema-path] [--skip-generate] [--force] [--reset] - Push schema to database");
            console.log("  db pull [schema-path]                                       - Pull schema from database");
            console.log("  db seed [seed-script] [--reset]                             - Seed database");
        }
    } else if (command === 'db') {
        console.log("Available db commands:");
        console.log("  db push [schema-path] [--skip-generate] [--force] [--reset] - Push schema to database");
        console.log("  db pull [schema-path]                                       - Pull schema from database");
        console.log("  db seed [seed-script] [--reset]                             - Seed database");
    } else if (command === 'migrate') {
        console.log("Available migrate commands:");
        console.log("  migrate dev [schema-path] [migration-name] - Generate and apply migrations in development");
        console.log("  migrate deploy                            - Apply migrations in production");
        console.log("  migrate reset                             - Reset the database");
        console.log("  migrate status                            - Show migration status");
    } else {
        console.log("Available commands:");
        console.log("  init [directory] [provider]               - Initialize a new Drismify project.");
        console.log("  validate <path-to-prisma.schema>          - Validates the Prisma schema file.");
        console.log("  generate-schema <path-to-prisma.schema> [output-path] - Generates Drizzle schema.");
        console.log("  generate-client <path-to-prisma.schema> [output-dir] - Generates client code.");
        console.log("  generate [schema-path] [output-dir] [--watch] - Generates client code.");
        console.log("  migrate <subcommand> [options]            - Manage database migrations.");
        console.log("  db <subcommand> [options]                 - Manage database.");
        console.log("  introspect <database-url> [provider] [output-path] - Introspect database.");
        console.log("  seed [schema-path] [seed-script]          - Seed database.");
        console.log("  studio [schema-path] [--port 5555]        - Start Drismify Studio.");
        if (command) {
            console.error(`Unknown command: ${command} or missing arguments.`);
        }
    }
}

// Export main function for CLI wrapper
export { main };

// Run main if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error('Error in main:', error);
        process.exit(1);
    });
}
