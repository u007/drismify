import * as fs from 'fs';
import * as path from 'path';

// Import types from our parser
export interface PslModelAst {
  type: 'model';
  name: string;
  fields: PslFieldAst[];
  attributes: PslAttributeAst[];
}

export interface PslFieldAst {
  name: string;
  type: {
    name: string;
    optional: boolean;
    isArray: boolean;
  };
  attributes: PslAttributeAst[];
}

export interface PslAttributeAst {
  name: string;
  args: any;
}

interface PslEnumAst {
  type: 'enum';
  name: string;
  values: string[];
}

interface PslTypeAst {
  type: 'type';
  name: string;
  fields: PslFieldAst[];
}

export interface PslViewAst {
  type: 'view';
  name: string;
  fields: PslFieldAst[];
  attributes: PslAttributeAst[];
}

type PslAstNode = PslModelAst | PslEnumAst | PslTypeAst | PslViewAst | { type: string; [key: string]: any };

/**
 * Client generator options
 */
export interface ClientGeneratorOptions {
  /**
   * Output directory for the generated client
   */
  outputDir: string;

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
}

/**
 * Client generator
 * Generates a client based on a Prisma schema
 */
export class ClientGenerator {
  private options: ClientGeneratorOptions;

  constructor(options: ClientGeneratorOptions) {
    this.options = {
      generateTypes: true,
      generateJs: true,
      generatePackageJson: true,
      generateReadme: true,
      ...options
    };
  }

  /**
   * Generate a client from a Prisma schema AST
   */
  async generateFromAst(ast: PslAstNode[]): Promise<void> {
    // Create the output directory if it doesn't exist
    if (!fs.existsSync(this.options.outputDir)) {
      fs.mkdirSync(this.options.outputDir, { recursive: true });
    }

    // Extract models, enums, types, and views from the AST
    const models = ast.filter(node => node.type === 'model') as PslModelAst[];
    const enums = ast.filter(node => node.type === 'enum') as PslEnumAst[];
    const types = ast.filter(node => node.type === 'type') as PslTypeAst[];
    const views = ast.filter(node => node.type === 'view') as PslViewAst[];
    const datasource = ast.find(node => node.type === 'datasource');

    // Generate the client
    await this.generateClient(models, enums, types, views, datasource);
  }

  /**
   * Generate a client from a Prisma schema file
   */
  async generateFromSchemaFile(schemaPath: string): Promise<void> {
    // Read the schema file
    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

    // Parse the schema
    const parser = require('../parser/generatedParser.js');
    const ast = parser.parse(schemaContent) as PslAstNode[];

    // Generate the client
    await this.generateFromAst(ast);
  }

  /**
   * Generate the client
   */
  private async generateClient(
    models: PslModelAst[],
    enums: PslEnumAst[],
    types: PslTypeAst[],
    views: PslViewAst[],
    datasource: any
  ): Promise<void> {
    // Generate the index file
    await this.generateIndexFile(models, views);

    // Generate the types file
    if (this.options.generateTypes) {
      await this.generateTypesFile(models, enums, types, views);
    }

    // Generate model files
    for (const model of models) {
      await this.generateModelFile(model, models, enums, types);
    }

    // Generate view files
    for (const view of views) {
      await this.generateViewFile(view, models, enums, types, views);
    }

    // Generate package.json
    if (this.options.generatePackageJson) {
      await this.generatePackageJsonFile();
    }

    // Generate README.md
    if (this.options.generateReadme) {
      await this.generateReadmeFile();
    }
  }

  /**
   * Generate the index file
   */
  private async generateIndexFile(models: PslModelAst[], views: PslViewAst[]): Promise<void> {
    const modelImports = models.map(model => {
      const modelName = model.name;
      return `import { ${modelName} } from './models/${modelName.toLowerCase()}';`;
    }).join('\n');

    const viewImports = views.map(view => {
      const viewName = view.name;
      return `import { ${viewName} } from './views/${viewName.toLowerCase()}';`;
    }).join('\n');

    const modelExports = models.map(model => model.name).join(', ');
    const viewExports = views.map(view => view.name).join(', ');
    const allExports = [modelExports, viewExports].filter(Boolean).join(', ');

    const content = `
import { DrismifyClient, Drismify } from '../../client/base-client';
import { ClientOptions } from '../../client/types';
${modelImports}
${viewImports}

/**
 * Drismify Client
 * Generated client for interacting with the database
 */
export class PrismaClient extends DrismifyClient {
  ${models.map(model => {
    const modelName = model.name;
    const modelVarName = modelName.charAt(0).toLowerCase() + modelName.slice(1);
    return `public readonly ${modelVarName}: ${modelName};`;
  }).join('\n  ')}
  ${views.map(view => {
    const viewName = view.name;
    const viewVarName = viewName.charAt(0).toLowerCase() + viewName.slice(1);
    return `public readonly ${viewVarName}: ${viewName};`;
  }).join('\n  ')}

  constructor(options: ClientOptions = { datasources: { db: {} } }) {
    super(options);

    ${models.map(model => {
      const modelName = model.name;
      const modelVarName = modelName.charAt(0).toLowerCase() + modelName.slice(1);
      const tableName = this.toSnakeCase(modelName);
      return `this.${modelVarName} = new ${modelName}(this, ${JSON.stringify(model)}, '${tableName}', this.options.debug || false, this.options.log || []);`;
    }).join('\n    ')}
    ${views.map(view => {
      const viewName = view.name;
      const viewVarName = viewName.charAt(0).toLowerCase() + viewName.slice(1);
      const tableName = this.toSnakeCase(viewName);
      return `this.${viewVarName} = new ${viewName}(this, ${JSON.stringify(view)}, '${tableName}', this.options.debug || false, this.options.log || []);`;
    }).join('\n    ')}
  }
}

export { ${allExports}, Drismify };
export * from './types';
`;

    fs.writeFileSync(path.join(this.options.outputDir, 'index.ts'), content);
  }

  /**
   * Generate the types file
   */
  private async generateTypesFile(
    models: PslModelAst[],
    enums: PslEnumAst[],
    types: PslTypeAst[],
    views: PslViewAst[]
  ): Promise<void> {
    const enumTypes = enums.map(enumDef => {
      const enumName = enumDef.name;
      const enumValues = enumDef.values.map(value => `'${value}'`).join(' | ');
      return `export type ${enumName} = ${enumValues};`;
    }).join('\n\n');

    const modelTypes = models.map(model => {
      const modelName = model.name;
      const fields = model.fields.map(field => {
        const fieldName = field.name;
        const fieldType = this.mapFieldType(field.type, enums, types);
        const isOptional = field.type.optional ? '?' : '';
        return `  ${fieldName}${isOptional}: ${fieldType};`;
      }).join('\n');

      return `export type ${modelName} = {\n${fields}\n};`;
    }).join('\n\n');

    const inputTypes = models.map(model => {
      const modelName = model.name;

      // Generate create input type
      const createFields = model.fields.map(field => {
        const fieldName = field.name;
        const fieldType = this.mapFieldType(field.type, enums, types);
        const isOptional = field.type.optional ? '?' : '';
        return `  ${fieldName}${isOptional}: ${fieldType};`;
      }).join('\n');

      // Generate update input type
      const updateFields = model.fields.map(field => {
        const fieldName = field.name;
        const fieldType = this.mapFieldType(field.type, enums, types);
        return `  ${fieldName}?: ${fieldType};`;
      }).join('\n');

      // Generate where input type
      const whereFields = model.fields.map(field => {
        const fieldName = field.name;
        const fieldType = this.mapFieldType(field.type, enums, types);
        return `  ${fieldName}?: ${fieldType};`;
      }).join('\n');

      // Generate where unique input type
      const uniqueFields = model.fields
        .filter(field => field.attributes.some(attr => attr.name === 'id' || attr.name === 'unique'))
        .map(field => {
          const fieldName = field.name;
          const fieldType = this.mapFieldType(field.type, enums, types);
          return `  ${fieldName}?: ${fieldType};`;
        }).join('\n');

      // Generate order by input type
      const orderByFields = model.fields.map(field => {
        const fieldName = field.name;
        return `  ${fieldName}?: 'asc' | 'desc';`;
      }).join('\n');

      return `
export type ${modelName}CreateInput = {
${createFields}
};

export type ${modelName}UpdateInput = {
${updateFields}
};

export type ${modelName}WhereInput = {
${whereFields}
};

export type ${modelName}WhereUniqueInput = {
${uniqueFields}
};

export type ${modelName}OrderByInput = {
${orderByFields}
};

export type ${modelName}SelectInput = {
${model.fields.map(field => `  ${field.name}?: boolean;`).join('\n')}
};

export type ${modelName}IncludeInput = {
${model.fields
  .filter(field => field.type.isArray || models.some(m => m.name === field.type.name))
  .map(field => `  ${field.name}?: boolean;`)
  .join('\n')}
};
`;
    }).join('\n');

    // Generate view types (similar to models but read-only)
    const viewTypes = views.map(view => {
      const viewName = view.name;
      const fields = view.fields.map(field => {
        const fieldName = field.name;
        const fieldType = this.mapFieldType(field.type, enums, types);
        const isOptional = field.type.optional ? '?' : '';
        return `  ${fieldName}${isOptional}: ${fieldType};`;
      }).join('\n');

      return `export type ${viewName} = {\n${fields}\n};`;
    }).join('\n\n');

    // Generate view input types (read-only, so no create/update)
    const viewInputTypes = views.map(view => {
      const viewName = view.name;

      // Generate where input type
      const whereFields = view.fields.map(field => {
        const fieldName = field.name;
        const fieldType = this.mapFieldType(field.type, enums, types);
        return `  ${fieldName}?: ${fieldType};`;
      }).join('\n');

      // Generate where unique input type
      const uniqueFields = view.fields
        .filter(field => field.attributes.some(attr => attr.name === 'id' || attr.name === 'unique'))
        .map(field => {
          const fieldName = field.name;
          const fieldType = this.mapFieldType(field.type, enums, types);
          return `  ${fieldName}?: ${fieldType};`;
        }).join('\n');

      // Generate order by input type
      const orderByFields = view.fields.map(field => {
        const fieldName = field.name;
        return `  ${fieldName}?: 'asc' | 'desc';`;
      }).join('\n');

      return `
export type ${viewName}WhereInput = {
${whereFields}
};

export type ${viewName}WhereUniqueInput = {
${uniqueFields}
};

export type ${viewName}OrderByInput = {
${orderByFields}
};

export type ${viewName}SelectInput = {
${view.fields.map(field => `  ${field.name}?: boolean;`).join('\n')}
};
`;
    }).join('\n');

    const content = `
${enumTypes}

${modelTypes}

${viewTypes}

${inputTypes}

${viewInputTypes}
`;

    fs.writeFileSync(path.join(this.options.outputDir, 'types.ts'), content);
  }

  /**
   * Generate a model file
   */
  private async generateModelFile(
    model: PslModelAst,
    models: PslModelAst[],
    enums: PslEnumAst[],
    types: PslTypeAst[]
  ): Promise<void> {
    const modelName = model.name;
    const tableName = this.toSnakeCase(modelName);

    const content = `
import { DatabaseAdapter, TransactionClient } from '../../adapters';
import { BaseModelClient } from '../../client/model-client';
import { PslModelAst } from '../index';
import {
  ${modelName},
  ${modelName}CreateInput,
  ${modelName}UpdateInput,
  ${modelName}WhereInput,
  ${modelName}WhereUniqueInput,
  ${modelName}OrderByInput,
  ${modelName}SelectInput,
  ${modelName}IncludeInput
} from '../types';

/**
 * ${modelName} model client
 */
export class ${modelName} extends BaseModelClient<
  ${modelName},
  ${modelName}CreateInput,
  ${modelName}UpdateInput,
  ${modelName}WhereInput,
  ${modelName}WhereUniqueInput,
  ${modelName}OrderByInput,
  ${modelName}SelectInput,
  ${modelName}IncludeInput
> {
  constructor(
    client: any, // Main DrismifyClient instance
    modelAst: PslModelAst,
    // tableName is passed from PrismaClient to super as '${tableName}'
    debug: boolean = false,
    log: ('query' | 'info' | 'warn' | 'error')[] = [],
    dbInstance?: DatabaseAdapter | TransactionClient // Optional: for transactions
  ) {
    super(client, modelAst, '${tableName}', debug, log, dbInstance);
  }
}
`;

    // Create the models directory if it doesn't exist
    const modelsDir = path.join(this.options.outputDir, 'models');
    if (!fs.existsSync(modelsDir)) {
      fs.mkdirSync(modelsDir, { recursive: true });
    }

    fs.writeFileSync(path.join(modelsDir, `${modelName.toLowerCase()}.ts`), content);
  }

  /**
   * Generate a view file
   */
  private async generateViewFile(
    view: PslViewAst,
    models: PslModelAst[],
    enums: PslEnumAst[],
    types: PslTypeAst[],
    views: PslViewAst[]
  ): Promise<void> {
    const viewName = view.name;
    const tableName = this.toSnakeCase(viewName);

    const content = `
import { DatabaseAdapter, TransactionClient } from '../../adapters';
import { BaseViewClient } from '../../client/view-client';
import { PslViewAst } from '../index';
import {
  ${viewName},
  ${viewName}WhereInput,
  ${viewName}WhereUniqueInput,
  ${viewName}OrderByInput,
  ${viewName}SelectInput
} from '../types';

/**
 * ${viewName} view client
 */
export class ${viewName} extends BaseViewClient<
  ${viewName},
  ${viewName}WhereInput,
  ${viewName}WhereUniqueInput,
  ${viewName}OrderByInput,
  ${viewName}SelectInput
> {
  constructor(
    client: any, // Main DrismifyClient instance
    viewAst: PslViewAst,
    // tableName is passed from PrismaClient to super as '${tableName}'
    debug: boolean = false,
    log: ('query' | 'info' | 'warn' | 'error')[] = [],
    dbInstance?: DatabaseAdapter | TransactionClient // Optional: for transactions
  ) {
    super(client, viewAst, '${tableName}', debug, log, dbInstance);
  }
}
`;

    // Create the views directory if it doesn't exist
    const viewsDir = path.join(this.options.outputDir, 'views');
    if (!fs.existsSync(viewsDir)) {
      fs.mkdirSync(viewsDir, { recursive: true });
    }

    fs.writeFileSync(path.join(viewsDir, `${viewName.toLowerCase()}.ts`), content);
  }

  /**
   * Generate the package.json file
   */
  private async generatePackageJsonFile(): Promise<void> {
    const content = `{
  "name": "drismify-client",
  "version": "0.0.1",
  "description": "Generated Drismify client",
  "main": "index.js",
  "types": "index.d.ts",
  "dependencies": {
    "@libsql/client": "^0.7.0",
    "better-sqlite3": "^9.0.0"
  }
}
`;

    fs.writeFileSync(path.join(this.options.outputDir, 'package.json'), content);
  }

  /**
   * Generate the README.md file
   */
  private async generateReadmeFile(): Promise<void> {
    const content = `# Drismify Client

This is a generated client for interacting with your database using Drismify.

## Usage

\`\`\`typescript
import { PrismaClient } from './index';

const prisma = new PrismaClient();

async function main() {
  // Connect to the database
  await prisma.connect();

  // Use the client
  const users = await prisma.user.findMany();
  console.log(users);

  // Disconnect from the database
  await prisma.disconnect();
}

main().catch(console.error);
\`\`\`
`;

    fs.writeFileSync(path.join(this.options.outputDir, 'README.md'), content);
  }

  /**
   * Map a field type to a TypeScript type
   */
  private mapFieldType(
    fieldType: { name: string; optional: boolean; isArray: boolean },
    enums: PslEnumAst[],
    types: PslTypeAst[]
  ): string {
    const { name, isArray } = fieldType;

    // Check if the type is an enum
    const isEnum = enums.some(e => e.name === name);
    if (isEnum) {
      return isArray ? `${name}[]` : name;
    }

    // Check if the type is a custom type
    const isCustomType = types.some(t => t.name === name);
    if (isCustomType) {
      return isArray ? `${name}[]` : name;
    }

    // Map Prisma types to TypeScript types
    switch (name) {
      case 'String':
        return isArray ? 'string[]' : 'string';
      case 'Int':
      case 'Float':
        return isArray ? 'number[]' : 'number';
      case 'Boolean':
        return isArray ? 'boolean[]' : 'boolean';
      case 'DateTime':
        return isArray ? 'Date[]' : 'Date';
      case 'Json':
        return isArray ? 'any[]' : 'any';
      case 'Bytes':
        return isArray ? 'Buffer[]' : 'Buffer';
      default:
        // Assume it's a model reference
        return isArray ? `${name}[]` : name;
    }
  }

  /**
   * Convert a string from PascalCase to snake_case
   */
  private toSnakeCase(str: string): string {
    return str
      .replace(/(?:^|\.?)([A-Z])/g, (_, char) => `_${char.toLowerCase()}`)
      .replace(/^_/, '');
  }
}
