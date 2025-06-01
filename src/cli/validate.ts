import * as fs from 'fs';
import * as path from 'path';

/**
 * Options for schema validation
 */
export interface ValidateOptions {
  /**
   * Path to the schema file
   */
  schemaPath?: string;

  /**
   * Whether to enable verbose output
   */
  verbose?: boolean;

  /**
   * Whether to enable linting
   */
  lint?: boolean;

  /**
   * Whether to show suggestions for fixing issues
   */
  suggestions?: boolean;
}

/**
 * Validation result
 */
export interface ValidationResult {
  /**
   * Whether the schema is valid
   */
  valid: boolean;

  /**
   * Validation errors
   */
  errors: ValidationError[];

  /**
   * Validation warnings
   */
  warnings: ValidationWarning[];

  /**
   * Suggestions for fixing issues
   */
  suggestions: ValidationSuggestion[];
}

/**
 * Validation error
 */
export interface ValidationError {
  /**
   * Error message
   */
  message: string;

  /**
   * Line number
   */
  line?: number;

  /**
   * Column number
   */
  column?: number;

  /**
   * Error code
   */
  code?: string;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  /**
   * Warning message
   */
  message: string;

  /**
   * Line number
   */
  line?: number;

  /**
   * Column number
   */
  column?: number;

  /**
   * Warning code
   */
  code?: string;
}

/**
 * Validation suggestion
 */
export interface ValidationSuggestion {
  /**
   * Suggestion message
   */
  message: string;

  /**
   * Line number
   */
  line?: number;

  /**
   * Column number
   */
  column?: number;

  /**
   * Suggested fix
   */
  fix?: string;
}

/**
 * Validate a Prisma schema
 */
export async function validateSchema(options: ValidateOptions = {}): Promise<ValidationResult> {
  const {
    schemaPath = 'schema.prisma',
    verbose = false,
    lint = false,
    suggestions = false
  } = options;

  // Check if the schema file exists
  if (!fs.existsSync(schemaPath)) {
    return {
      valid: false,
      errors: [
        {
          message: `Schema file not found: ${schemaPath}`,
          code: 'FILE_NOT_FOUND'
        }
      ],
      warnings: [],
      suggestions: []
    };
  }

  // Read the schema file
  const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

  // Parse the schema
  const parser = await import('../parser/generatedParser.js');

  try {
    const ast = parser.parse(schemaContent);

    // Basic validation
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const validationSuggestions: ValidationSuggestion[] = [];

    // Check for datasource
    const datasource = ast.find((node: any) => node.type === 'datasource');
    if (!datasource) {
      errors.push({
        message: 'No datasource found in the schema',
        code: 'NO_DATASOURCE'
      });

      if (suggestions) {
        validationSuggestions.push({
          message: 'Add a datasource block to the schema',
          fix: `
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
`
        });
      }
    } else {
      // Check datasource provider
      const provider = datasource.assignments?.provider;
      if (!provider) {
        errors.push({
          message: 'No provider specified in datasource',
          code: 'NO_PROVIDER'
        });

        if (suggestions) {
          validationSuggestions.push({
            message: 'Add a provider to the datasource block',
            fix: `
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
`
          });
        }
      } else if (provider !== 'sqlite' && provider !== 'turso' && provider !== 'libsql') {
        warnings.push({
          message: `Provider "${provider}" may not be fully supported. Supported providers are: sqlite, turso, libsql`,
          code: 'UNSUPPORTED_PROVIDER'
        });
      }

      // Check datasource URL
      const url = datasource.assignments?.url;
      if (!url) {
        errors.push({
          message: 'No URL specified in datasource',
          code: 'NO_URL'
        });

        if (suggestions) {
          validationSuggestions.push({
            message: 'Add a URL to the datasource block',
            fix: `
datasource db {
  provider = "${provider || 'sqlite'}"
  url      = env("DATABASE_URL")
}
`
          });
        }
      }
    }

    // Check for generator
    const generator = ast.find((node: any) => node.type === 'generator');
    if (!generator) {
      warnings.push({
        message: 'No generator found in the schema',
        code: 'NO_GENERATOR'
      });

      if (suggestions) {
        validationSuggestions.push({
          message: 'Add a generator block to the schema',
          fix: `
generator client {
  provider = "drismify-client-js"
  output   = "../generated/client"
}
`
        });
      }
    } else {
      // Check generator provider
      const provider = generator.assignments?.provider;
      if (!provider) {
        errors.push({
          message: 'No provider specified in generator',
          code: 'NO_GENERATOR_PROVIDER'
        });

        if (suggestions) {
          validationSuggestions.push({
            message: 'Add a provider to the generator block',
            fix: `
generator client {
  provider = "drismify-client-js"
  output   = "../generated/client"
}
`
          });
        }
      } else if (provider !== 'drismify-client-js' && provider !== 'prisma-client-js') {
        warnings.push({
          message: `Provider "${provider}" may not be fully supported. Supported providers are: drismify-client-js, prisma-client-js`,
          code: 'UNSUPPORTED_GENERATOR_PROVIDER'
        });
      }
    }

    // Check for models
    const models = ast.filter((node: any) => node.type === 'model');
    if (models.length === 0) {
      warnings.push({
        message: 'No models found in the schema',
        code: 'NO_MODELS'
      });

      if (suggestions) {
        validationSuggestions.push({
          message: 'Add at least one model to the schema',
          fix: `
model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
`
        });
      }
    } else {
      // Check each model
      for (const model of models) {
        // Check if model has fields
        if (!model.fields || model.fields.length === 0) {
          errors.push({
            message: `Model "${model.name}" has no fields`,
            code: 'MODEL_NO_FIELDS'
          });

          if (suggestions) {
            validationSuggestions.push({
              message: `Add fields to model "${model.name}"`,
              fix: `
model ${model.name} {
  id        Int      @id @default(autoincrement())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
`
            });
          }
        } else {
          // Check if model has an ID field
          const idField = model.fields.find((field: any) =>
            field.attributes && field.attributes.some((attr: any) => attr.name === 'id')
          );

          if (!idField) {
            warnings.push({
              message: `Model "${model.name}" has no ID field`,
              code: 'MODEL_NO_ID'
            });

            if (suggestions) {
              validationSuggestions.push({
                message: `Add an ID field to model "${model.name}"`,
                fix: `id Int @id @default(autoincrement())`
              });
            }
          }
        }
      }
    }

    // Additional linting if enabled
    if (lint) {
      // Check for naming conventions
      for (const model of models) {
        // Model names should be PascalCase
        if (model.name && !/^[A-Z][a-zA-Z0-9]*$/.test(model.name)) {
          warnings.push({
            message: `Model name "${model.name}" should be PascalCase`,
            code: 'MODEL_NAME_CONVENTION'
          });

          if (suggestions) {
            const pascalCaseName = model.name
              .replace(/[^a-zA-Z0-9]/g, ' ')
              .split(' ')
              .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
              .join('');

            validationSuggestions.push({
              message: `Rename model "${model.name}" to "${pascalCaseName}"`,
              fix: `model ${pascalCaseName} {`
            });
          }
        }

        // Check field names
        if (model.fields) {
          for (const field of model.fields) {
            // Field names should be camelCase
            if (field.name && !/^[a-z][a-zA-Z0-9]*$/.test(field.name)) {
              warnings.push({
                message: `Field name "${field.name}" in model "${model.name}" should be camelCase`,
                code: 'FIELD_NAME_CONVENTION'
              });

              if (suggestions) {
                const camelCaseName = field.name
                  .replace(/[^a-zA-Z0-9]/g, ' ')
                  .split(' ')
                  .map((word: string, index: number) =>
                    index === 0
                      ? word.toLowerCase()
                      : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                  )
                  .join('');

                validationSuggestions.push({
                  message: `Rename field "${field.name}" to "${camelCaseName}"`,
                  fix: `${camelCaseName} ${field.type.name}${field.type.optional ? '?' : ''}`
                });
              }
            }
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions: validationSuggestions
    };
  } catch (error: any) {
    // Parse error
    const location = error.location;

    return {
      valid: false,
      errors: [
        {
          message: error.message,
          line: location?.start.line,
          column: location?.start.column,
          code: 'PARSE_ERROR'
        }
      ],
      warnings: [],
      suggestions: suggestions ? [
        {
          message: 'Fix the syntax error in your schema',
          line: location?.start.line,
          column: location?.start.column
        }
      ] : []
    };
  }
}
