// CLI entry point for Drismify
// This will handle commands like `drismify validate`, `drismify migrate`, etc.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { translatePslToDrizzleSchema } from './translator/pslToDrizzle'; // Import the translator
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

let parser: BasicParser;
try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    parser = require('./parser/generatedParser.js') as BasicParser;
} catch (e) {
    console.error("Failed to load parser. Did you run 'pnpm build:parser'?", e);
    process.exit(1);
}

async function main() {
    const args = process.argv.slice(2);
    console.log("Drismify CLI");
    console.log("Arguments:", args);

    const command = args[0];
    const prismaSchemaPathArg = args[1];
    const outputDrizzleSchemaPath = args[2] || 'src/db/schema.ts'; // Default output path

    // Import required modules
    const { ClientGenerator } = require('./generator/client-generator');
    const { MigrationGenerator, MigrationManager } = require('./migrations');

    if (command === 'validate' && prismaSchemaPathArg) {
        const schemaPath = path.resolve(prismaSchemaPathArg);
        console.log(`Validating schema: ${schemaPath}`);

        try {
            // Import the validate module
            const { validateSchema } = require('./cli/validate');

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
            const pslAst = parser.parse(pslContent) as any[]; // Assuming AST is an array
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
    } else if (command === 'generate-client' && prismaSchemaPathArg) {
        const schemaPath = path.resolve(prismaSchemaPathArg);
        const outputDir = args[2] || './generated/client';
        console.log(`Generating client from: ${schemaPath}`);
        console.log(`Outputting to: ${outputDir}`);
        try {
            // Ensure the output directory exists
            fs.mkdirSync(outputDir, { recursive: true });

            const generator = new ClientGenerator({
                outputDir,
                generateTypes: true,
                generateJs: true,
                generatePackageJson: true,
                generateReadme: true
            });

            await generator.generateFromSchemaFile(schemaPath);

            // Verify the files were written
            if (!fs.existsSync(path.join(outputDir, 'index.ts'))) {
                throw new Error(`Failed to generate client files in ${outputDir}`);
            }

            console.log(`Client generated successfully at ${outputDir}`);
        } catch (e: unknown) {
            console.error("Failed to generate client:");
            const error = e as { location?: { start: { line: number; column: number } }; message?: string; stack?: string };
            if (error.location?.start) {
                console.error(`Location: Line ${error.location.start.line}, Column ${error.location.start.column}`);
            }
            console.error(`Message: ${error.message}`);
            if (error.stack) console.error(`Stack: ${error.stack}`);
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

                // Generate migration
                const generator = new MigrationGenerator({
                    migrationsDir,
                    debug: true
                });

                const migrationPath = await generator.generateMigrationFromSchemaFile(schemaPath, migrationName);

                if (!migrationPath) {
                    console.log('No schema changes detected');
                    return;
                }

                console.log(`Migration generated at: ${migrationPath}`);

                // Apply migration
                const manager = new MigrationManager({
                    migrationsDir,
                    connectionOptions: {
                        filename: './dev.db'
                    },
                    debug: true
                });

                await manager.initialize();
                const results = await manager.applyPendingMigrations();

                if (results.length === 0) {
                    console.log('No migrations to apply');
                } else {
                    console.log(`Applied ${results.length} migrations`);
                    for (const result of results) {
                        console.log(`  ${result.name}: ${result.success ? 'Success' : 'Failed'} (${result.duration}ms)`);
                        if (!result.success && result.error) {
                            console.error(`    Error: ${result.error}`);
                        }
                    }
                }

                await manager.close();
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
                // Apply migrations
                const manager = new MigrationManager({
                    migrationsDir,
                    connectionOptions: {
                        filename: './dev.db'
                    },
                    debug: true
                });

                await manager.initialize();
                const results = await manager.applyPendingMigrations();

                if (results.length === 0) {
                    console.log('No migrations to apply');
                } else {
                    console.log(`Applied ${results.length} migrations`);
                    for (const result of results) {
                        console.log(`  ${result.name}: ${result.success ? 'Success' : 'Failed'} (${result.duration}ms)`);
                        if (!result.success && result.error) {
                            console.error(`    Error: ${result.error}`);
                        }
                    }
                }

                await manager.close();
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
                // Reset database
                const manager = new MigrationManager({
                    migrationsDir,
                    connectionOptions: {
                        filename: './dev.db'
                    },
                    debug: true
                });

                await manager.initialize();
                const results = await manager.resetDatabase();

                console.log(`Reset database and applied ${results.length} migrations`);
                for (const result of results) {
                    console.log(`  ${result.name}: ${result.success ? 'Success' : 'Failed'} (${result.duration}ms)`);
                    if (!result.success && result.error) {
                        console.error(`    Error: ${result.error}`);
                    }
                }

                await manager.close();
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
                // Check migration status
                const manager = new MigrationManager({
                    migrationsDir,
                    connectionOptions: {
                        filename: './dev.db'
                    },
                    debug: true
                });

                await manager.initialize();
                const status = await manager.getMigrationStatus();

                if (status.length === 0) {
                    console.log('No migrations found');
                } else {
                    console.log(`Found ${status.length} migrations:`);
                    for (const migration of status) {
                        const appliedStatus = migration.applied ?
                            `Applied at ${migration.appliedAt?.toISOString()}` :
                            'Not applied';
                        const checksumStatus = migration.checksumMismatch ?
                            ' (Checksum mismatch)' :
                            '';

                        console.log(`  ${migration.name}: ${appliedStatus}${checksumStatus}`);
                    }
                }

                await manager.close();
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
            const { initProject } = require('./cli/init');

            await initProject({
                directory,
                provider,
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
    } else if (command === 'db' && args[1]) {
        const subCommand = args[1];
        const schemaPath = args[2] ? path.resolve(args[2]) : path.resolve('./schema.prisma');

        if (subCommand === 'push') {
            // Push schema to database
            console.log(`Pushing schema to database: ${schemaPath}`);

            try {
                // Import the db module
                const { dbPush } = require('./cli/db');

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
                const { dbPull } = require('./cli/db');

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
                const { dbSeed } = require('./cli/db');

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
    } else if (command === 'generate') {
        // Generate client
        const schemaPath = args[1] ? path.resolve(args[1]) : path.resolve('./schema.prisma');
        const outputDir = args[2];

        console.log(`Generating client from: ${schemaPath}`);

        try {
            // Import the generate module
            const { generateClient } = require('./cli/generate');

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
    } else {
        console.log("Available commands:");
        console.log("  init [directory] [provider]               - Initialize a new Drismify project.");
        console.log("  validate <path-to-prisma.schema>          - Validates the Prisma schema file.");
        console.log("  generate-schema <path-to-prisma.schema> [output-path] - Generates Drizzle schema.");
        console.log("  generate-client <path-to-prisma.schema> [output-dir] - Generates client code.");
        console.log("  generate [schema-path] [output-dir] [--watch] - Generates client code.");
        console.log("  migrate <subcommand> [options]            - Manage database migrations.");
        console.log("  db <subcommand> [options]                 - Manage database.");
        if (command) {
            console.error(`Unknown command: ${command} or missing arguments.`);
        }
    }
}

main().catch(error => {
    console.error('Error in main:', error);
    process.exit(1);
});
