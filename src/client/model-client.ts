import { DatabaseAdapter } from '../adapters';
import { ExtensionContext } from '../extensions';
import { ModelClient } from './types';

/**
 * Base model client implementation
 * This is the base class for all model clients
 */
export class BaseModelClient<
  T,
  CreateInput,
  UpdateInput,
  WhereInput,
  WhereUniqueInput,
  OrderByInput,
  SelectInput,
  IncludeInput
> implements ModelClient<
  T,
  CreateInput,
  UpdateInput,
  WhereInput,
  WhereUniqueInput,
  OrderByInput,
  SelectInput,
  IncludeInput
> {
  protected adapter: DatabaseAdapter;
  protected tableName: string;
  protected debug: boolean;
  protected log: ('query' | 'info' | 'warn' | 'error')[];
  protected whereValues: any[] = [];

  /**
   * Model name for extension context
   */
  public readonly $name: string;

  constructor(
    adapter: DatabaseAdapter,
    tableName: string,
    debug: boolean = false,
    log: ('query' | 'info' | 'warn' | 'error')[] = []
  ) {
    this.adapter = adapter;
    this.tableName = tableName;
    this.debug = debug;
    this.log = log;

    // Set the model name for extension context
    // Extract model name from the table name (convert snake_case to PascalCase)
    this.$name = tableName
      .split('_')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
  }

  /**
   * Create a new record
   */
  async create(data: CreateInput): Promise<T> {
    this.logQuery('create', { data });

    const columns = Object.keys(data as Record<string, any>).join(', ');
    const placeholders = Object.keys(data as Record<string, any>)
      .map((_, i) => `$${i + 1}`)
      .join(', ');
    const values = Object.values(data as Record<string, any>);

    const query = `
      INSERT INTO ${this.tableName} (${columns})
      VALUES (${placeholders})
      RETURNING *
    `;

    const result = await this.adapter.execute<T>(query, values);
    return result.data[0];
  }

  /**
   * Create multiple records
   */
  async createMany(data: CreateInput[]): Promise<{ count: number }> {
    this.logQuery('createMany', { data });

    if (data.length === 0) {
      return { count: 0 };
    }

    const columns = Object.keys(data[0] as Record<string, any>).join(', ');
    const queries = [];

    for (const item of data) {
      const placeholders = Object.keys(item as Record<string, any>)
        .map((_, i) => `$${i + 1}`)
        .join(', ');
      const values = Object.values(item as Record<string, any>);

      queries.push({
        query: `
          INSERT INTO ${this.tableName} (${columns})
          VALUES (${placeholders})
        `,
        params: values
      });
    }

    const results = await this.adapter.batch(queries);
    return { count: results.length };
  }

  /**
   * Find a record by its unique identifier
   */
  async findUnique(args: {
    where: WhereUniqueInput;
    select?: SelectInput;
    include?: IncludeInput
  }): Promise<T | null> {
    this.logQuery('findUnique', args);

    const { where } = args;
    
    // Reset the whereValues before building the where clause
    this.whereValues = [];
    
    const whereClause = this.buildWhereClause(where as Record<string, any>);
    const values = [...this.whereValues];

    const query = `
      SELECT * FROM ${this.tableName}
      WHERE ${whereClause}
      LIMIT 1
    `;

    const result = await this.adapter.execute<T>(query, values);
    return result.data.length > 0 ? result.data[0] : null;
  }

  /**
   * Find the first record that matches the filter
   */
  async findFirst(args: {
    where?: WhereInput;
    orderBy?: OrderByInput | OrderByInput[];
    select?: SelectInput;
    include?: IncludeInput;
    skip?: number;
  }): Promise<T | null> {
    this.logQuery('findFirst', args);

    const { where, orderBy, skip } = args;
    let whereClause = '';
    let values: any[] = [];

    // Reset the whereValues before building the where clause
    this.whereValues = [];
    
    if (where) {
      whereClause = `WHERE ${this.buildWhereClause(where as Record<string, any>)}`;
      values = [...this.whereValues];
    }

    const orderByClause = this.buildOrderByClause(orderBy);
    const skipClause = skip ? `OFFSET ${skip}` : '';

    const query = `
      SELECT * FROM ${this.tableName}
      ${whereClause}
      ${orderByClause}
      LIMIT 1
      ${skipClause}
    `;

    const result = await this.adapter.execute<T>(query, values);
    return result.data.length > 0 ? result.data[0] : null;
  }

  /**
   * Find all records that match the filter
   */
  async findMany(args: {
    where?: WhereInput;
    orderBy?: OrderByInput | OrderByInput[];
    select?: SelectInput;
    include?: IncludeInput;
    skip?: number;
    take?: number;
    cursor?: WhereUniqueInput;
  } = {}): Promise<T[]> {
    this.logQuery('findMany', args);

    const { where, orderBy, skip, take, cursor } = args;
    let whereClause = '';
    let values: any[] = [];

    // Reset the whereValues before building the where clause
    this.whereValues = [];
    
    if (where) {
      whereClause = `WHERE ${this.buildWhereClause(where as Record<string, any>)}`;
      values = [...this.whereValues];
    }

    const orderByClause = this.buildOrderByClause(orderBy);
    const skipClause = skip ? `OFFSET ${skip}` : '';
    const takeClause = take ? `LIMIT ${take}` : '';

    // Handle cursor-based pagination
    if (cursor) {
      const cursorField = Object.keys(cursor)[0];
      const cursorValue = (cursor as Record<string, any>)[cursorField];

      if (whereClause) {
        whereClause += ` AND ${cursorField} > $${values.length + 1}`;
      } else {
        whereClause = `WHERE ${cursorField} > $${values.length + 1}`;
      }

      values.push(cursorValue);
    }

    const query = `
      SELECT * FROM ${this.tableName}
      ${whereClause}
      ${orderByClause}
      ${takeClause}
      ${skipClause}
    `;

    const result = await this.adapter.execute<T>(query, values);
    return result.data;
  }

  /**
   * Update a record by its unique identifier
   */
  async update(args: {
    where: WhereUniqueInput;
    data: UpdateInput;
    select?: SelectInput;
    include?: IncludeInput;
  }): Promise<T> {
    this.logQuery('update', args);

    const { where, data } = args;
    const whereClause = this.buildWhereClause(where as Record<string, any>);
    const whereValues = Object.values(where as Record<string, any>);

    const setClause = Object.keys(data as Record<string, any>)
      .map((key, i) => `${key} = $${i + 1 + whereValues.length}`)
      .join(', ');

    const values = [
      ...Object.values(data as Record<string, any>),
      ...whereValues
    ];

    const query = `
      UPDATE ${this.tableName}
      SET ${setClause}
      WHERE ${whereClause}
      RETURNING *
    `;

    const result = await this.adapter.execute<T>(query, values);

    if (result.data.length === 0) {
      throw new Error(`Record not found for update: ${JSON.stringify(where)}`);
    }

    return result.data[0];
  }

  /**
   * Update multiple records that match the filter
   */
  async updateMany(args: {
    where?: WhereInput;
    data: UpdateInput;
  }): Promise<{ count: number }> {
    this.logQuery('updateMany', args);

    const { where, data } = args;
    let whereClause = '';
    let whereValues: any[] = [];

    // Reset the whereValues before building the where clause
    this.whereValues = [];
    
    if (where) {
      whereClause = `WHERE ${this.buildWhereClause(where as Record<string, any>)}`;
      whereValues = [...this.whereValues];
    }

    const setClause = Object.keys(data as Record<string, any>)
      .map((key, i) => `${key} = $${i + 1}`)
      .join(', ');

    const values = [
      ...Object.values(data as Record<string, any>),
      ...whereValues
    ];

    const query = `
      UPDATE ${this.tableName}
      SET ${setClause}
      ${whereClause}
    `;

    const result = await this.adapter.execute(query, values);
    return { count: result.data.length };
  }

  /**
   * Delete a record by its unique identifier
   */
  async delete(args: {
    where: WhereUniqueInput;
    select?: SelectInput;
    include?: IncludeInput;
  }): Promise<T> {
    this.logQuery('delete', args);

    const { where } = args;
    const whereClause = this.buildWhereClause(where as Record<string, any>);
    const values = Object.values(where as Record<string, any>);

    const query = `
      DELETE FROM ${this.tableName}
      WHERE ${whereClause}
      RETURNING *
    `;

    const result = await this.adapter.execute<T>(query, values);

    if (result.data.length === 0) {
      throw new Error(`Record not found for delete: ${JSON.stringify(where)}`);
    }

    return result.data[0];
  }

  /**
   * Delete multiple records that match the filter
   */
  async deleteMany(args: { where?: WhereInput } = {}): Promise<{ count: number }> {
    this.logQuery('deleteMany', args);

    const { where } = args;
    let whereClause = '';
    let values: any[] = [];

    // Reset the whereValues before building the where clause
    this.whereValues = [];
    
    if (where) {
      whereClause = `WHERE ${this.buildWhereClause(where as Record<string, any>)}`;
      values = [...this.whereValues];
    }

    const query = `
      DELETE FROM ${this.tableName}
      ${whereClause}
    `;

    const result = await this.adapter.execute(query, values);
    return { count: result.data.length };
  }

  /**
   * Count the number of records that match the filter
   */
  async count(args: { where?: WhereInput } = {}): Promise<number> {
    this.logQuery('count', args);

    const { where } = args;
    let whereClause = '';
    let values: any[] = [];

    // Reset the whereValues before building the where clause
    this.whereValues = [];
    
    if (where) {
      whereClause = `WHERE ${this.buildWhereClause(where as Record<string, any>)}`;
      values = [...this.whereValues];
    }

    const query = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      ${whereClause}
    `;

    const result = await this.adapter.execute<{ count: number }>(query, values);
    return Number(result.data[0].count);
  }

  /**
   * Build a WHERE clause from a filter object
   * Supports advanced filtering operations like:
   * - contains, startsWith, endsWith
   * - gt, gte, lt, lte
   * - in, notIn
   * - not
   * - AND, OR
   */
  protected buildWhereClause(filter: Record<string, any>): string {
    const conditions: string[] = [];
    const values: any[] = [];

    // Helper function to handle nested conditions recursively
    const processFilter = (filter: Record<string, any>, parentKey = ''): { condition: string; values: any[] } => {
      const conditions: string[] = [];
      const values: any[] = [];

      for (const [key, value] of Object.entries(filter)) {
        // Skip undefined values
        if (value === undefined) continue;

        // Handle logical operators (AND, OR)
        if (key === 'AND' || key === 'OR') {
          if (Array.isArray(value) && value.length > 0) {
            const nestedConditions = value.map(condition => {
              const result = processFilter(condition);
              values.push(...result.values);
              return `(${result.condition})`;
            });
            conditions.push(`(${nestedConditions.join(` ${key} `)})`);
          }
          continue;
        }

        // Handle NOT operator
        if (key === 'NOT') {
          const result = processFilter(value);
          values.push(...result.values);
          conditions.push(`NOT (${result.condition})`);
          continue;
        }

        // Handle regular field conditions or nested operators
        const fieldName = parentKey ? `${parentKey}.${key}` : key;
        
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
          // Handle nested operators for a field
          for (const [op, opValue] of Object.entries(value)) {
            // Skip undefined values
            if (opValue === undefined) continue;

            switch (op) {
              case 'equals':
                values.push(opValue);
                conditions.push(`${fieldName} = $${values.length}`);
                break;
              case 'not':
                if (opValue === null) {
                  conditions.push(`${fieldName} IS NOT NULL`);
                } else {
                  values.push(opValue);
                  conditions.push(`${fieldName} <> $${values.length}`);
                }
                break;
              case 'contains':
                values.push(`%${opValue}%`);
                conditions.push(`${fieldName} LIKE $${values.length}`);
                break;
              case 'startsWith':
                values.push(`${opValue}%`);
                conditions.push(`${fieldName} LIKE $${values.length}`);
                break;
              case 'endsWith':
                values.push(`%${opValue}`);
                conditions.push(`${fieldName} LIKE $${values.length}`);
                break;
              case 'gt':
                values.push(opValue);
                conditions.push(`${fieldName} > $${values.length}`);
                break;
              case 'gte':
                values.push(opValue);
                conditions.push(`${fieldName} >= $${values.length}`);
                break;
              case 'lt':
                values.push(opValue);
                conditions.push(`${fieldName} < $${values.length}`);
                break;
              case 'lte':
                values.push(opValue);
                conditions.push(`${fieldName} <= $${values.length}`);
                break;
              case 'in':
                if (Array.isArray(opValue) && opValue.length > 0) {
                  const placeholders = opValue.map((_, i) => `$${values.length + i + 1}`).join(', ');
                  values.push(...opValue);
                  conditions.push(`${fieldName} IN (${placeholders})`);
                } else if (Array.isArray(opValue) && opValue.length === 0) {
                  // Empty IN clause should match nothing
                  conditions.push('1 = 0');
                }
                break;
              case 'notIn':
                if (Array.isArray(opValue) && opValue.length > 0) {
                  const placeholders = opValue.map((_, i) => `$${values.length + i + 1}`).join(', ');
                  values.push(...opValue);
                  conditions.push(`${fieldName} NOT IN (${placeholders})`);
                } else if (Array.isArray(opValue) && opValue.length === 0) {
                  // Empty NOT IN clause should match everything
                  conditions.push('1 = 1');
                }
                break;
              default:
                // Handle nested objects
                if (opValue !== null && typeof opValue === 'object') {
                  const nestedResult = processFilter({ [op]: opValue }, fieldName);
                  conditions.push(nestedResult.condition);
                  values.push(...nestedResult.values);
                }
            }
          }
        } else if (value === null) {
          // Handle null values
          conditions.push(`${fieldName} IS NULL`);
        } else {
          // Handle simple equality
          values.push(value);
          conditions.push(`${fieldName} = $${values.length}`);
        }
      }

      return {
        condition: conditions.join(' AND '),
        values,
      };
    };

    const result = processFilter(filter);
    
    // Store the processed values in the class scope for query execution
    this.whereValues = result.values;
    
    return result.condition || '1=1';
  }

  /**
   * Build an ORDER BY clause from an orderBy object or array
   */
  protected buildOrderByClause(orderBy?: OrderByInput | OrderByInput[]): string {
    if (!orderBy) {
      return '';
    }

    const orderByArray = Array.isArray(orderBy) ? orderBy : [orderBy];

    if (orderByArray.length === 0) {
      return '';
    }

    const orderByItems = orderByArray.map((item) => {
      const entries = Object.entries(item as Record<string, 'asc' | 'desc'>);
      return entries.map(([field, direction]) => `${field} ${direction.toUpperCase()}`).join(', ');
    });

    return `ORDER BY ${orderByItems.join(', ')}`;
  }

  /**
   * Log a query if debug mode is enabled
   */
  protected logQuery(operation: string, args: any): void {
    if (this.debug || this.log.includes('query')) {
      console.log(`[${this.tableName}] ${operation}:`, args);
    }
  }
}
