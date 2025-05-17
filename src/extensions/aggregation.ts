/**
 * Aggregation Extensions for Drismify
 * This module provides aggregation functionality (sum, avg, min, max, groupBy) for the Drismify client
 */

import { Extension } from './types';
import { DrismifyClient } from '../client/base-client';

/**
 * Aggregation field options
 */
export interface AggregateFieldOptions {
  /**
   * Field to aggregate on
   */
  _sum?: string[];
  /**
   * Field to aggregate on
   */
  _avg?: string[];
  /**
   * Field to aggregate on
   */
  _min?: string[];
  /**
   * Field to aggregate on
   */
  _max?: string[];
  /**
   * Field to aggregate on
   */
  _count?: boolean | string[];
}

/**
 * Group by options
 */
export interface GroupByOptions<T = any> {
  /**
   * Fields to group by
   */
  by: (keyof T)[];
  /**
   * Fields to aggregate
   */
  _sum?: string[];
  /**
   * Fields to aggregate
   */
  _avg?: string[];
  /**
   * Fields to aggregate
   */
  _min?: string[];
  /**
   * Fields to aggregate
   */
  _max?: string[];
  /**
   * Fields to aggregate
   */
  _count?: boolean | string[];
  /**
   * WHERE clause to filter records
   */
  where?: any;
  /**
   * Fields to order by
   */
  orderBy?: any;
  /**
   * Number of records to skip
   */
  skip?: number;
  /**
   * Number of records to take
   */
  take?: number;
  /**
   * Record to start after
   */
  cursor?: any;
}

/**
 * Generic aggregate result
 */
export interface AggregateResult<T = any> {
  /**
   * Sum of numeric fields
   */
  _sum: Partial<Record<keyof T, number>> | null;
  /**
   * Average of numeric fields
   */
  _avg: Partial<Record<keyof T, number>> | null;
  /**
   * Minimum value of fields
   */
  _min: Partial<Record<keyof T, any>> | null;
  /**
   * Maximum value of fields
   */
  _max: Partial<Record<keyof T, any>> | null;
  /**
   * Count of records
   */
  _count: number | Partial<Record<keyof T, number>> | null;
}

/**
 * Group by result
 */
export interface GroupByResult<T = any> extends AggregateResult<T> {
  /**
   * Group by key
   */
  [key: string]: any;
}

/**
 * Calculate the sum of a field in an array of records
 */
function calculateSum(data: any[], field: string): number | null {
  if (!data || data.length === 0) return null;

  let sum = 0;
  let validValues = 0;

  for (const item of data) {
    const value = item[field];
    if (typeof value === 'number') {
      sum += value;
      validValues++;
    }
  }

  return validValues > 0 ? sum : null;
}

/**
 * Calculate the average of a field in an array of records
 */
function calculateAvg(data: any[], field: string): number | null {
  if (!data || data.length === 0) return null;

  let sum = 0;
  let validValues = 0;

  for (const item of data) {
    const value = item[field];
    if (typeof value === 'number') {
      sum += value;
      validValues++;
    }
  }

  return validValues > 0 ? sum / validValues : null;
}

/**
 * Find the minimum value of a field in an array of records
 */
function calculateMin(data: any[], field: string): any {
  if (!data || data.length === 0) return null;

  let min: any = null;
  let hasValue = false;

  for (const item of data) {
    const value = item[field];
    if (value !== undefined && value !== null) {
      if (!hasValue || value < min) {
        min = value;
        hasValue = true;
      }
    }
  }

  return hasValue ? min : null;
}

/**
 * Find the maximum value of a field in an array of records
 */
function calculateMax(data: any[], field: string): any {
  if (!data || data.length === 0) return null;

  let max: any = null;
  let hasValue = false;

  for (const item of data) {
    const value = item[field];
    if (value !== undefined && value !== null) {
      if (!hasValue || value > max) {
        max = value;
        hasValue = true;
      }
    }
  }

  return hasValue ? max : null;
}

/**
 * Count records or field values in an array of records
 */
function calculateCount(data: any[], field?: string): number | null {
  if (!data) return null;
  
  if (!field) {
    return data.length;
  }

  let count = 0;
  for (const item of data) {
    if (item[field] !== undefined && item[field] !== null) {
      count++;
    }
  }

  return count;
}

/**
 * Group records by specified fields
 */
function groupRecords<T = any>(data: T[], groupByFields: (keyof T)[]): Record<string, T[]> {
  const result: Record<string, T[]> = {};

  if (!data || data.length === 0 || !groupByFields || groupByFields.length === 0) {
    return result;
  }

  for (const record of data) {
    // Create a key based on the groupBy fields
    const key = groupByFields.map(field => {
      const value = record[field];
      if (typeof value === 'object') {
        return JSON.stringify(value);
      }
      return String(value);
    }).join('|');

    if (!result[key]) {
      result[key] = [];
    }

    result[key].push(record);
  }

  return result;
}

/**
 * Process the aggregation for a dataset
 */
function processAggregation<T = any>(data: T[], options: AggregateFieldOptions): AggregateResult<T> {
  const result: AggregateResult<T> = {
    _sum: null,
    _avg: null,
    _min: null,
    _max: null,
    _count: null,
  };

  // Process sum fields
  if (options._sum && options._sum.length > 0) {
    result._sum = {} as any;
    for (const field of options._sum) {
      (result._sum as any)[field] = calculateSum(data, field);
    }
  }

  // Process avg fields
  if (options._avg && options._avg.length > 0) {
    result._avg = {} as any;
    for (const field of options._avg) {
      (result._avg as any)[field] = calculateAvg(data, field);
    }
  }

  // Process min fields
  if (options._min && options._min.length > 0) {
    result._min = {} as any;
    for (const field of options._min) {
      (result._min as any)[field] = calculateMin(data, field);
    }
  }

  // Process max fields
  if (options._max && options._max.length > 0) {
    result._max = {} as any;
    for (const field of options._max) {
      (result._max as any)[field] = calculateMax(data, field);
    }
  }

  // Process count
  if (options._count !== undefined) {
    if (typeof options._count === 'boolean' && options._count) {
      result._count = data.length;
    } else if (Array.isArray(options._count) && options._count.length > 0) {
      result._count = {} as any;
      for (const field of options._count) {
        (result._count as any)[field] = calculateCount(data, field);
      }
    }
  }

  return result;
}

/**
 * Create an extension that adds aggregation capabilities to all models
 */
export function createAggregateExtension(): Extension {
  return {
    name: 'AggregateExtension',
    model: {
      $allModels: {
        /**
         * Aggregate data with various aggregation functions
         */
        async aggregate(this: any, options: AggregateFieldOptions = {}): Promise<AggregateResult> {
          // First get all the data
          const data = await this.findMany({});

          // Process the aggregations
          return processAggregation(data, options);
        },

        /**
         * Group data by specified fields and apply aggregations
         */
        async groupBy(this: any, options: GroupByOptions): Promise<GroupByResult[]> {
          if (!options.by || options.by.length === 0) {
            throw new Error('groupBy requires at least one field to group by');
          }

          // Get filtered data if where clause is provided
          const queryOptions = {};
          
          if (options.where) queryOptions['where'] = options.where;
          if (options.orderBy) queryOptions['orderBy'] = options.orderBy;
          if (options.skip) queryOptions['skip'] = options.skip;
          if (options.take) queryOptions['take'] = options.take;
          if (options.cursor) queryOptions['cursor'] = options.cursor;
          
          const data = await this.findMany(queryOptions);

          // Group the data by the specified fields
          const groupedData = groupRecords(data, options.by);

          // Process each group with the aggregation functions
          const result: GroupByResult[] = [];

          for (const [key, group] of Object.entries(groupedData)) {
            // Extract the grouped values
            const keyParts = key.split('|');
            const groupEntry: any = {};

            // Add the group by fields to the result
            for (let i = 0; i < options.by.length; i++) {
              const field = options.by[i];
              let value = keyParts[i];

              // Try to parse the value if it's a number or boolean
              if (value === 'true') {
                value = true;
              } else if (value === 'false') {
                value = false;
              } else if (!isNaN(Number(value))) {
                value = Number(value);
              } else {
                // Try to parse as JSON for objects
                try {
                  value = JSON.parse(value);
                } catch (e) {
                  // Keep as string if not valid JSON
                }
              }

              groupEntry[field] = value;
            }

            // Add the aggregations
            const aggregateOptions: AggregateFieldOptions = {
              _sum: options._sum,
              _avg: options._avg,
              _min: options._min,
              _max: options._max,
              _count: options._count,
            };

            const aggregation = processAggregation(group, aggregateOptions);

            // Combine group data with aggregations
            result.push({
              ...groupEntry,
              ...aggregation,
            });
          }

          return result;
        }
      }
    }
  };
}

/**
 * Create a utility that adds aggregate functions for specific models
 * Use this to implement specific, optimized aggregation for certain models
 */
export function createModelAggregateExtension(modelAggregations: Record<string, any>): Extension {
  return {
    name: 'ModelAggregateExtension',
    model: Object.entries(modelAggregations).reduce((acc, [modelName, aggregations]) => {
      acc[modelName] = {
        ...aggregations
      };
      return acc;
    }, {} as Record<string, any>)
  };
}

// Export the extension instances for easy use
export const aggregationExtension = createAggregateExtension();

// Add the extensions to the Drismify namespace
export function extendDrismifyWithAggregation(Drismify: any) {
  Drismify.Aggregation = {
    createAggregateExtension,
    createModelAggregateExtension,
    aggregationExtension
  };
}