import { SchemaChange, SchemaChangeType } from './types';

// Import types from our parser
interface PslModelAst {
  type: 'model';
  name: string;
  fields: PslFieldAst[];
  attributes: PslAttributeAst[];
}

interface PslFieldAst {
  name: string;
  type: {
    name: string;
    optional: boolean;
    isArray: boolean;
  };
  attributes: PslAttributeAst[];
}

interface PslAttributeAst {
  name: string;
  args: any;
}

interface PslEnumAst {
  type: 'enum';
  name: string;
  values: string[];
}

type PslAstNode = PslModelAst | PslEnumAst | { type: string; [key: string]: any };

/**
 * Schema differ options
 */
export interface SchemaDifferOptions {
  /**
   * Database adapter type
   */
  adapterType?: 'sqlite' | 'turso';

  /**
   * Whether to enable debug mode
   */
  debug?: boolean;
}

/**
 * Schema differ
 * Detects changes between schemas
 */
export class SchemaDiffer {
  private options: SchemaDifferOptions;

  constructor(options: SchemaDifferOptions = {}) {
    this.options = options;
  }

  /**
   * Diff two schemas
   */
  diffSchemas(oldAst: PslAstNode[], newAst: PslAstNode[]): SchemaChange[] {
    const changes: SchemaChange[] = [];

    // Extract models from ASTs
    const oldModels = oldAst.filter(node => node.type === 'model') as PslModelAst[];
    const newModels = newAst.filter(node => node.type === 'model') as PslModelAst[];

    // Extract enums from ASTs
    const oldEnums = oldAst.filter(node => node.type === 'enum') as PslEnumAst[];
    const newEnums = newAst.filter(node => node.type === 'enum') as PslEnumAst[];

    // Create maps for faster lookup
    const oldModelMap = new Map<string, PslModelAst>();
    for (const model of oldModels) {
      oldModelMap.set(model.name, model);
    }

    const newModelMap = new Map<string, PslModelAst>();
    for (const model of newModels) {
      newModelMap.set(model.name, model);
    }

    // Find added models
    for (const model of newModels) {
      if (!oldModelMap.has(model.name)) {
        changes.push(...this.generateCreateTableChanges(model));
      }
    }

    // Find removed models
    for (const model of oldModels) {
      if (!newModelMap.has(model.name)) {
        changes.push({
          type: SchemaChangeType.DROP_TABLE,
          tableName: this.toSnakeCase(model.name),
          sql: `DROP TABLE IF EXISTS ${this.toSnakeCase(model.name)};`
        });
      }
    }

    // Find modified models
    for (const newModel of newModels) {
      const oldModel = oldModelMap.get(newModel.name);

      if (oldModel) {
        changes.push(...this.diffModels(oldModel, newModel));
      }
    }

    // Handle enums
    // SQLite doesn't support enums directly, so we don't need to generate changes for them
    // But we might want to handle them differently for other database types in the future

    return changes;
  }

  /**
   * Generate CREATE TABLE changes for a model
   */
  private generateCreateTableChanges(model: PslModelAst): SchemaChange[] {
    const tableName = this.toSnakeCase(model.name);
    const columns: string[] = [];
    const primaryKey: string[] = [];
    const uniqueConstraints: string[] = [];
    const foreignKeys: string[] = [];
    const checkConstraints: string[] = [];
    const indexes: { name: string; columns: string[] }[] = [];

    // Process fields
    for (const field of model.fields) {
      // Skip relation fields
      if (field.type.isArray) {
        continue;
      }

      const columnName = this.toSnakeCase(field.name);
      const columnType = this.mapFieldTypeToSqlType(field.type);
      let columnDef = `${columnName} ${columnType}`;

      // Add constraints
      if (!field.type.optional) {
        columnDef += ' NOT NULL';
      }

      // Check for primary key
      if (field.attributes.some(attr => attr.name === 'id')) {
        primaryKey.push(columnName);

        // Check for autoincrement
        if (field.attributes.some(attr =>
          attr.name === 'default' &&
          attr.args &&
          typeof attr.args === 'object' &&
          attr.args.type === 'function' &&
          attr.args.name === 'autoincrement'
        )) {
          columnDef += ' PRIMARY KEY AUTOINCREMENT';
        }
      }

      // Check for unique constraint
      const uniqueAttr = field.attributes.find(attr => attr.name === 'unique');
      if (uniqueAttr) {
        const constraintName = uniqueAttr.args?.name ? `CONSTRAINT ${uniqueAttr.args.name} ` : '';
        uniqueConstraints.push(`${constraintName}UNIQUE (${columnName})`);
      }

      // Check for relation/foreign key
      const relationAttr = field.attributes.find(attr => attr.name === 'relation');
      if (relationAttr && relationAttr.args && relationAttr.args.fields && relationAttr.args.references) {
        const referencedTable = this.toSnakeCase(field.type.name);
        const fieldName = relationAttr.args.fields[0];
        const referencedField = relationAttr.args.references[0];

        // Build foreign key constraint with referential actions
        const constraintName = relationAttr.args.name ? `CONSTRAINT ${relationAttr.args.name} ` : '';
        let foreignKeyConstraint = `${constraintName}FOREIGN KEY ("${this.toSnakeCase(fieldName)}") REFERENCES "${referencedTable}"("${this.toSnakeCase(referencedField)}")`;

        // Add referential actions if specified
        if (relationAttr.args.onDelete) {
          foreignKeyConstraint += ` ON DELETE ${this.mapReferentialAction(relationAttr.args.onDelete)}`;
        }
        if (relationAttr.args.onUpdate) {
          foreignKeyConstraint += ` ON UPDATE ${this.mapReferentialAction(relationAttr.args.onUpdate)}`;
        }

        foreignKeys.push(foreignKeyConstraint);
      }

      // Check for default value
      const defaultAttr = field.attributes.find(attr => attr.name === 'default');
      if (defaultAttr) {
        if (defaultAttr.args && typeof defaultAttr.args === 'object' && defaultAttr.args.type === 'function') {
          if (defaultAttr.args.name === 'now') {
            columnDef += ' DEFAULT CURRENT_TIMESTAMP';
          } else if (defaultAttr.args.name === 'uuid') {
            columnDef += ' DEFAULT (uuid())';
          } else if (defaultAttr.args.name === 'cuid') {
            columnDef += ' DEFAULT (cuid())';
          }
        } else if (typeof defaultAttr.args === 'string') {
          columnDef += ` DEFAULT '${defaultAttr.args}'`;
        } else if (typeof defaultAttr.args === 'boolean' || typeof defaultAttr.args === 'number') {
          columnDef += ` DEFAULT ${defaultAttr.args}`;
        }
      }

      columns.push(columnDef);
    }

    // Process model-level attributes
    if (model.attributes) {
      for (const attr of model.attributes) {
        if (attr.name === 'index' && attr.args && attr.args.fields && Array.isArray(attr.args.fields)) {
          const indexName = attr.args.name || `idx_${tableName}_${attr.args.fields.join('_')}`;
          indexes.push({
            name: indexName,
            columns: attr.args.fields.map((f: string) => this.toSnakeCase(f))
          });
        } else if (attr.name === 'unique' && attr.args && attr.args.fields && Array.isArray(attr.args.fields)) {
          const constraintName = attr.args.name ? `CONSTRAINT ${attr.args.name} ` : '';
          uniqueConstraints.push(`${constraintName}UNIQUE (${attr.args.fields.map((f: string) => this.toSnakeCase(f)).join(', ')})`);
        } else if (attr.name === 'check' && attr.args && attr.args.constraint) {
          const constraintName = attr.args.name ? `CONSTRAINT ${attr.args.name} ` : '';
          checkConstraints.push(`${constraintName}CHECK (${attr.args.constraint})`);
        }
      }
    }

    // Add primary key constraint if not already added to a column
    if (primaryKey.length > 0 && !columns.some(c => c.includes('PRIMARY KEY'))) {
      columns.push(`PRIMARY KEY (${primaryKey.join(', ')})`);
    }

    // Add unique constraints
    columns.push(...uniqueConstraints);

    // Add check constraints
    columns.push(...checkConstraints);

    // Add foreign keys
    columns.push(...foreignKeys);

    // Generate CREATE TABLE statement
    const createTableSql = `CREATE TABLE "${tableName}" (\n  ${columns.join(',\n  ')}\n);`;

    const changes: SchemaChange[] = [
      {
        type: SchemaChangeType.CREATE_TABLE,
        tableName,
        sql: createTableSql
      }
    ];

    // Generate CREATE INDEX statements
    for (const index of indexes) {
      changes.push({
        type: SchemaChangeType.CREATE_INDEX,
        tableName,
        indexName: index.name,
        sql: `CREATE INDEX ${index.name} ON ${tableName} (${index.columns.join(', ')});`
      });
    }

    return changes;
  }

  /**
   * Diff two models
   */
  private diffModels(oldModel: PslModelAst, newModel: PslModelAst): SchemaChange[] {
    const changes: SchemaChange[] = [];
    const tableName = this.toSnakeCase(newModel.name);

    // Create maps for faster lookup
    const oldFieldMap = new Map<string, PslFieldAst>();
    for (const field of oldModel.fields) {
      if (!field.type.isArray) { // Skip relation fields
        oldFieldMap.set(field.name, field);
      }
    }

    const newFieldMap = new Map<string, PslFieldAst>();
    for (const field of newModel.fields) {
      if (!field.type.isArray) { // Skip relation fields
        newFieldMap.set(field.name, field);
      }
    }

    // Find added fields
    for (const field of newModel.fields) {
      if (!field.type.isArray && !oldFieldMap.has(field.name)) {
        const columnName = this.toSnakeCase(field.name);
        const columnType = this.mapFieldTypeToSqlType(field.type);
        let columnDef = `${columnType}`;

        // Add constraints
        if (!field.type.optional) {
          columnDef += ' NOT NULL';
        }

        // Check for default value
        const defaultAttr = field.attributes.find(attr => attr.name === 'default');
        if (defaultAttr) {
          if (defaultAttr.args && typeof defaultAttr.args === 'object' && defaultAttr.args.type === 'function') {
            if (defaultAttr.args.name === 'now') {
              columnDef += ' DEFAULT CURRENT_TIMESTAMP';
            } else if (defaultAttr.args.name === 'uuid') {
              columnDef += ' DEFAULT (uuid())';
            } else if (defaultAttr.args.name === 'cuid') {
              columnDef += ' DEFAULT (cuid())';
            }
          } else if (typeof defaultAttr.args === 'string') {
            columnDef += ` DEFAULT '${defaultAttr.args}'`;
          } else if (typeof defaultAttr.args === 'boolean' || typeof defaultAttr.args === 'number') {
            columnDef += ` DEFAULT ${defaultAttr.args}`;
          }
        }

        changes.push({
          type: SchemaChangeType.ALTER_TABLE_ADD_COLUMN,
          tableName,
          columnName,
          sql: `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef};`
        });
      }
    }

    // Find removed fields
    // SQLite doesn't support dropping columns directly, so we need to recreate the table
    // For simplicity, we'll skip this for now

    // Find modified fields
    // SQLite doesn't support altering columns directly, so we need to recreate the table
    // For simplicity, we'll skip this for now

    // Find added indexes
    const oldIndexes = this.extractIndexes(oldModel);
    const newIndexes = this.extractIndexes(newModel);

    for (const newIndex of newIndexes) {
      const oldIndex = oldIndexes.find(idx => idx.name === newIndex.name);

      if (!oldIndex) {
        changes.push({
          type: SchemaChangeType.CREATE_INDEX,
          tableName,
          indexName: newIndex.name,
          sql: `CREATE INDEX ${newIndex.name} ON ${tableName} (${newIndex.columns.join(', ')});`
        });
      }
    }

    // Find removed indexes
    for (const oldIndex of oldIndexes) {
      const newIndex = newIndexes.find(idx => idx.name === oldIndex.name);

      if (!newIndex) {
        changes.push({
          type: SchemaChangeType.DROP_INDEX,
          tableName,
          indexName: oldIndex.name,
          sql: `DROP INDEX IF EXISTS ${oldIndex.name};`
        });
      }
    }

    return changes;
  }

  /**
   * Extract indexes from a model
   */
  private extractIndexes(model: PslModelAst): { name: string; columns: string[] }[] {
    const tableName = this.toSnakeCase(model.name);
    const indexes: { name: string; columns: string[] }[] = [];

    if (model.attributes) {
      for (const attr of model.attributes) {
        if (attr.name === 'index' && attr.args && attr.args.fields && Array.isArray(attr.args.fields)) {
          const indexName = attr.args.name || `idx_${tableName}_${attr.args.fields.join('_')}`;
          indexes.push({
            name: indexName,
            columns: attr.args.fields.map((f: string) => this.toSnakeCase(f))
          });
        }
      }
    }

    return indexes;
  }

  /**
   * Map a field type to a SQL type
   */
  private mapFieldTypeToSqlType(fieldType: { name: string; optional: boolean; isArray: boolean }): string {
    const { name } = fieldType;

    switch (name) {
      case 'String':
        return 'TEXT';
      case 'Int':
        return 'INTEGER';
      case 'Float':
        return 'REAL';
      case 'Boolean':
        return 'INTEGER'; // SQLite doesn't have a boolean type
      case 'DateTime':
        return 'TIMESTAMP';
      case 'Json':
        return 'TEXT'; // Store JSON as text
      case 'Bytes':
        return 'BLOB';
      default:
        // Assume it's a reference to another model or an enum
        return 'INTEGER'; // Foreign keys are typically integers
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

  /**
   * Map Prisma referential action to SQL referential action
   */
  private mapReferentialAction(action: string): string {
    switch (action) {
      case 'Cascade':
        return 'CASCADE';
      case 'Restrict':
        return 'RESTRICT';
      case 'SetNull':
        return 'SET NULL';
      case 'SetDefault':
        return 'SET DEFAULT';
      case 'NoAction':
        return 'NO ACTION';
      default:
        // Default to RESTRICT if unknown action
        return 'RESTRICT';
    }
  }
}
