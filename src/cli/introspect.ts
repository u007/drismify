import * as fs from 'fs';
import * as path from 'path';
import { DatabaseAdapter } from '../adapters';
import { SQLiteAdapter } from '../adapters/sqlite-adapter';
import { TursoAdapter } from '../adapters/turso-adapter';

/**
 * Introspection options
 */
export interface IntrospectionOptions {
  /**
   * URL or file path for the database
   */
  url?: string;
  
  /**
   * Database provider (sqlite or turso)
   */
  provider?: 'sqlite' | 'turso';
  
  /**
   * Output path for the generated Prisma schema
   */
  output?: string;
  
  /**
   * Whether to overwrite an existing schema file
   */
  overwrite?: boolean;
  
  /**
   * Whether to save comments about table relationships
   */
  saveComments?: boolean;
  
  /**
   * Whether to print debug information
   */
  debug?: boolean;
}

/**
 * Introspect a database and generate a Prisma schema
 */
export async function introspectDatabase(options: IntrospectionOptions): Promise<string> {
  const {
    url,
    provider = 'sqlite',
    output = 'schema.prisma',
    overwrite = false,
    saveComments = true,
    debug = false
  } = options;
  
  if (!url) {
    throw new Error('Database URL is required');
  }
  
  // Check if output file exists
  if (fs.existsSync(output) && !overwrite) {
    throw new Error(`Output file already exists: ${output}. Use --overwrite to force.`);
  }
  
  // Create database adapter
  let adapter: DatabaseAdapter;
  
  if (provider === 'sqlite') {
    adapter = new SQLiteAdapter({ filename: url });
  } else if (provider === 'turso') {
    adapter = new TursoAdapter({ url });
  } else {
    throw new Error(`Unsupported provider: ${provider}`);
  }
  
  await adapter.connect();
  
  try {
    if (debug) {
      console.log(`Introspecting ${provider} database...`);
    }
    
    // Get database schema information
    const tables = await adapter.getTables();
    const columns = await adapter.getColumns();
    const foreignKeys = await adapter.getForeignKeys();
    const indexes = await adapter.getIndexes();
    
    if (debug) {
      console.log(`Found ${tables.length} tables, ${columns.length} columns, ${foreignKeys.length} foreign keys, ${indexes.length} indexes`);
    }
    
    // Generate Prisma schema
    const schema = generatePrismaSchema({
      tables,
      columns,
      foreignKeys,
      indexes,
      provider,
      url,
      saveComments
    });
    
    // Write schema to output file
    fs.writeFileSync(output, schema);
    
    if (debug) {
      console.log(`Schema written to ${output}`);
    }
    
    return schema;
  } finally {
    await adapter.disconnect();
  }
}

/**
 * Schema generation options
 */
interface SchemaGenerationOptions {
  tables: any[];
  columns: any[];
  foreignKeys: any[];
  indexes: any[];
  provider: string;
  url: string;
  saveComments: boolean;
}

/**
 * Generate a Prisma schema from database schema information
 */
function generatePrismaSchema(options: SchemaGenerationOptions): string {
  const {
    tables,
    columns,
    foreignKeys,
    indexes,
    provider,
    url,
    saveComments
  } = options;
  
  let schema = '';
  
  // Add generator
  schema += `generator client {\n  provider = "drismify"\n}\n\n`;
  
  // Add datasource
  schema += `datasource db {\n  provider = "${provider}"\n  url      = ${provider === 'sqlite' ? `"file:${url}"` : `env("DATABASE_URL")`}\n}\n\n`;
  
  // Add models
  for (const table of tables) {
    const tableName = table.name;
    const modelName = toPascalCase(tableName);
    
    // Start model definition
    schema += `model ${modelName} {\n`;
    
    // Add columns
    const tableColumns = columns.filter(column => column.table === tableName);
    
    for (const column of tableColumns) {
      const fieldName = toCamelCase(column.name);
      const fieldType = mapSqlTypeToPrismaType(column.type);
      const isRequired = !column.isNullable;
      const isAutoIncrement = column.isAutoIncrement;
      
      let line = `  ${fieldName} ${fieldType}`;
      
      // Add field modifiers
      if (isRequired) {
        line += ' @id';
      }
      
      if (isAutoIncrement) {
        line += ' @default(autoincrement())';
      } else if (column.defaultValue !== null) {
        line += ` @default(${formatDefaultValue(column.defaultValue, fieldType)})`;
      }
      
      // Add column mapping
      line += ` @map("${column.name}")`;
      
      schema += `${line}\n`;
    }
    
    // Add relations
    const tableRelations = foreignKeys.filter(fk => fk.foreignTable === tableName || fk.referencedTable === tableName);
    
    for (const relation of tableRelations) {
      if (relation.foreignTable === tableName) {
        // This table references another table (many-to-one)
        const referencedModelName = toPascalCase(relation.referencedTable);
        const fieldName = toCamelCase(referencedModelName);
        
        schema += `  ${fieldName} ${referencedModelName} @relation(fields: [${toCamelCase(relation.foreignKey)}], references: [${toCamelCase(relation.referencedColumn)}])\n`;
      } else {
        // Another table references this table (one-to-many)
        const foreignModelName = toPascalCase(relation.foreignTable);
        const fieldName = toCamelCase(foreignModelName) + 's';
        
        schema += `  ${fieldName} ${foreignModelName}[] @relation("${relation.name}")\n`;
      }
    }
    
    // Add indexes
    const tableIndexes = indexes.filter(index => index.table === tableName);
    
    for (const index of tableIndexes) {
      const isUnique = index.isUnique;
      const columns = index.columns.map(col => toCamelCase(col)).join(', ');
      
      if (isUnique) {
        schema += `  @@unique([${columns}])\n`;
      } else {
        schema += `  @@index([${columns}])\n`;
      }
    }
    
    // Add table mapping
    schema += `  @@map("${tableName}")\n`;
    
    // Close model definition
    schema += `}\n\n`;
  }
  
  // Add comments if requested
  if (saveComments) {
    schema += '// Relation explanations:\n';
    
    for (const relation of foreignKeys) {
      schema += `// ${toPascalCase(relation.foreignTable)}.${toCamelCase(relation.foreignKey)} -> ${toPascalCase(relation.referencedTable)}.${toCamelCase(relation.referencedColumn)}\n`;
    }
  }
  
  return schema;
}

/**
 * Map SQL type to Prisma type
 */
function mapSqlTypeToPrismaType(sqlType: string): string {
  const type = sqlType.toLowerCase();
  
  if (type.includes('int')) {
    return 'Int';
  } else if (type.includes('char') || type.includes('text') || type.includes('varchar')) {
    return 'String';
  } else if (type.includes('bool')) {
    return 'Boolean';
  } else if (type.includes('float') || type.includes('double') || type.includes('decimal') || type.includes('numeric')) {
    return 'Float';
  } else if (type.includes('date') || type.includes('time') || type.includes('timestamp')) {
    return 'DateTime';
  } else if (type.includes('json')) {
    return 'Json';
  } else if (type.includes('blob') || type.includes('binary')) {
    return 'Bytes';
  } else {
    return 'String';
  }
}

/**
 * Format default value for Prisma schema
 */
function formatDefaultValue(value: any, type: string): string {
  if (value === null) {
    return 'null';
  }
  
  if (type === 'String') {
    return `"${value}"`;
  } else if (type === 'Boolean') {
    return value ? 'true' : 'false';
  } else if (type === 'Int' || type === 'Float') {
    return value.toString();
  } else if (type === 'DateTime') {
    if (value.toLowerCase() === 'now()') {
      return 'now()';
    } else {
      return `"${value}"`;
    }
  } else {
    return `"${value}"`;
  }
}

/**
 * Convert snake_case to PascalCase
 */
function toPascalCase(str: string): string {
  return str
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

/**
 * Convert snake_case to camelCase
 */
function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}