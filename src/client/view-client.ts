import { DatabaseAdapter, TransactionClient } from '../adapters';
import { PslViewAst } from '../generator/client-generator';

/**
 * Base view client interface
 */
export interface ViewClient<T, WhereInput, WhereUniqueInput, OrderByInput, SelectInput> {
  findMany(args?: {
    where?: WhereInput;
    orderBy?: OrderByInput;
    take?: number;
    skip?: number;
    select?: SelectInput;
  }): Promise<T[]>;

  findFirst(args?: {
    where?: WhereInput;
    orderBy?: OrderByInput;
    select?: SelectInput;
  }): Promise<T | null>;

  findUnique(args: {
    where: WhereUniqueInput;
    select?: SelectInput;
  }): Promise<T | null>;

  count(args?: {
    where?: WhereInput;
  }): Promise<number>;
}

/**
 * Base view client implementation
 * Views are read-only, so they only support query operations
 */
export class BaseViewClient<T, WhereInput, WhereUniqueInput, OrderByInput, SelectInput>
  implements ViewClient<T, WhereInput, WhereUniqueInput, OrderByInput, SelectInput>
{
  protected client: any;
  protected viewAst: PslViewAst;
  protected tableName: string;
  protected debug: boolean;
  protected log: ('query' | 'info' | 'warn' | 'error')[];
  protected db: DatabaseAdapter | TransactionClient;

  constructor(
    client: any,
    viewAst: PslViewAst,
    tableName: string,
    debug: boolean = false,
    log: ('query' | 'info' | 'warn' | 'error')[] = [],
    dbInstance?: DatabaseAdapter | TransactionClient
  ) {
    this.client = client;
    this.viewAst = viewAst;
    this.tableName = tableName;
    this.debug = debug;
    this.log = log;
    this.db = dbInstance || client.$getAdapter();
  }

  /**
   * Log a query or message
   */
  protected logQuery(level: 'query' | 'info' | 'warn' | 'error', data: any): void {
    if (this.log.includes(level) || this.debug) {
      console.log(`[${this.tableName}] ${level}:`, data);
    }
  }

  /**
   * Find many records
   */
  async findMany(args?: {
    where?: WhereInput;
    orderBy?: OrderByInput;
    take?: number;
    skip?: number;
    select?: SelectInput;
  }): Promise<T[]> {
    this.logQuery('query', { method: 'findMany', args });

    let query = `SELECT ${this.buildSelectClause(args?.select)} FROM ${this.tableName}`;
    const params: any[] = [];

    // Add WHERE clause
    if (args?.where) {
      const whereClause = this.buildWhereClause(args.where, params);
      if (whereClause) {
        query += ` WHERE ${whereClause}`;
      }
    }

    // Add ORDER BY clause
    if (args?.orderBy) {
      const orderByClause = this.buildOrderByClause(args.orderBy);
      if (orderByClause) {
        query += ` ORDER BY ${orderByClause}`;
      }
    }

    // Add LIMIT and OFFSET
    if (args?.take !== undefined) {
      query += ` LIMIT ?`;
      params.push(args.take);
    }

    if (args?.skip !== undefined) {
      query += ` OFFSET ?`;
      params.push(args.skip);
    }

    const result = await this.db.execute<T>(query, params);
    return result.data;
  }

  /**
   * Find first record
   */
  async findFirst(args?: {
    where?: WhereInput;
    orderBy?: OrderByInput;
    select?: SelectInput;
  }): Promise<T | null> {
    this.logQuery('query', { method: 'findFirst', args });

    const results = await this.findMany({
      ...args,
      take: 1,
    });

    return results.length > 0 ? results[0] : null;
  }

  /**
   * Find unique record
   */
  async findUnique(args: {
    where: WhereUniqueInput;
    select?: SelectInput;
  }): Promise<T | null> {
    this.logQuery('query', { method: 'findUnique', args });

    let query = `SELECT ${this.buildSelectClause(args.select)} FROM ${this.tableName}`;
    const params: any[] = [];

    // Add WHERE clause for unique fields
    const whereClause = this.buildWhereClause(args.where as any, params);
    if (whereClause) {
      query += ` WHERE ${whereClause}`;
    }

    query += ` LIMIT 1`;

    const result = await this.db.execute<T>(query, params);
    return result.data.length > 0 ? result.data[0] : null;
  }

  /**
   * Count records
   */
  async count(args?: {
    where?: WhereInput;
  }): Promise<number> {
    this.logQuery('query', { method: 'count', args });

    let query = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    const params: any[] = [];

    // Add WHERE clause
    if (args?.where) {
      const whereClause = this.buildWhereClause(args.where, params);
      if (whereClause) {
        query += ` WHERE ${whereClause}`;
      }
    }

    const result = await this.db.execute<{ count: number }>(query, params);
    return result.data[0]?.count || 0;
  }

  /**
   * Build a SELECT clause from a select object
   */
  protected buildSelectClause(select?: SelectInput): string {
    if (!select) {
      return '*';
    }

    const selectedFields = Object.entries(select as Record<string, boolean>)
      .filter(([_, include]) => include)
      .map(([field]) => field);

    if (selectedFields.length === 0) {
      return '*';
    }

    return selectedFields.join(', ');
  }

  /**
   * Build a WHERE clause from a where object
   */
  protected buildWhereClause(where: Record<string, any>, params: any[]): string {
    const conditions: string[] = [];

    for (const [field, value] of Object.entries(where)) {
      if (value === undefined || value === null) {
        continue;
      }

      if (typeof value === 'object' && !Array.isArray(value)) {
        // Handle operators like { gt: 5 }, { contains: 'text' }, etc.
        for (const [operator, operatorValue] of Object.entries(value)) {
          const condition = this.buildOperatorCondition(field, operator, operatorValue, params);
          if (condition) {
            conditions.push(condition);
          }
        }
      } else {
        // Simple equality
        conditions.push(`${field} = ?`);
        params.push(value);
      }
    }

    return conditions.join(' AND ');
  }

  /**
   * Build a condition for an operator
   */
  protected buildOperatorCondition(
    field: string,
    operator: string,
    value: any,
    params: any[]
  ): string | null {
    switch (operator) {
      case 'equals':
        params.push(value);
        return `${field} = ?`;
      case 'not':
        params.push(value);
        return `${field} != ?`;
      case 'gt':
        params.push(value);
        return `${field} > ?`;
      case 'gte':
        params.push(value);
        return `${field} >= ?`;
      case 'lt':
        params.push(value);
        return `${field} < ?`;
      case 'lte':
        params.push(value);
        return `${field} <= ?`;
      case 'contains':
        params.push(`%${value}%`);
        return `${field} LIKE ?`;
      case 'startsWith':
        params.push(`${value}%`);
        return `${field} LIKE ?`;
      case 'endsWith':
        params.push(`%${value}`);
        return `${field} LIKE ?`;
      case 'in':
        if (Array.isArray(value) && value.length > 0) {
          const placeholders = value.map(() => '?').join(', ');
          params.push(...value);
          return `${field} IN (${placeholders})`;
        }
        return null;
      case 'notIn':
        if (Array.isArray(value) && value.length > 0) {
          const placeholders = value.map(() => '?').join(', ');
          params.push(...value);
          return `${field} NOT IN (${placeholders})`;
        }
        return null;
      default:
        this.logQuery('warn', { message: `Unknown operator: ${operator}` });
        return null;
    }
  }

  /**
   * Build an ORDER BY clause from an orderBy object
   */
  protected buildOrderByClause(orderBy: Record<string, 'asc' | 'desc'>): string {
    const orderClauses = Object.entries(orderBy)
      .map(([field, direction]) => `${field} ${direction.toUpperCase()}`)
      .join(', ');

    return orderClauses;
  }

  /**
   * Create a new instance with a transaction client
   */
  withTransaction(txClient: TransactionClient): this {
    const ViewClientClass = this.constructor as new (...args: any[]) => this;
    return new ViewClientClass(
      this.client,
      this.viewAst,
      this.tableName,
      this.debug,
      this.log,
      txClient
    );
  }
}
