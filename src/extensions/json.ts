import { DrismifyClient } from '../client/base-client';
import { Extension } from './types';

/**
 * JSON extension for Drismify
 * Provides JSON operations and querying functionality following Prisma's approach
 */
export const jsonExtension: Extension = {
  name: 'json',
  init: (client: DrismifyClient) => {
    // Add JSON path filtering capability to the query builder
    const originalBuildWhereClause = client.adapter.buildWhereClause;
    
    client.adapter.buildWhereClause = function (where: Record<string, any>, params: any[] = []) {
      if (!where) return { clause: '', params };
      
      const whereEntries = Object.entries(where);
      const clauses: string[] = [];
      
      for (const [key, value] of whereEntries) {
        // Handle logical operators (AND, OR, NOT)
        if (key === 'AND' || key === 'OR') {
          if (Array.isArray(value)) {
            const subClauses: string[] = [];
            
            for (const subWhere of value) {
              const { clause, params: subParams } = this.buildWhereClause(subWhere, []);
              if (clause) {
                subClauses.push(`(${clause})`);
                params.push(...subParams);
              }
            }
            
            if (subClauses.length > 0) {
              clauses.push(`(${subClauses.join(` ${key} `)})`);
            }
          }
          continue;
        }
        
        if (key === 'NOT') {
          const { clause, params: subParams } = this.buildWhereClause(value, []);
          if (clause) {
            clauses.push(`NOT (${clause})`);
            params.push(...subParams);
          }
          continue;
        }
        
        // Handle JSON path filtering using dot notation
        if (key.includes('.')) {
          const [field, ...pathParts] = key.split('.');
          const jsonPath = pathParts.join('.');
          
          // Handle array indexing in the path (e.g., roles[0])
          const jsonPathWithArrays = jsonPath.replace(/\[(\d+)\]/g, '.$1');
          
          // Build the JSON path for the database
          const dbJsonPath = `$.${jsonPathWithArrays}`;
          
          // Add the JSON path filter
          clauses.push(`json_extract(${field}, ?) = ?`);
          params.push(dbJsonPath, value);
          continue;
        }
        
        // Handle JSON operators
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          // Check for JSON operators
          const jsonOperators = ['path', 'array_contains', 'string_contains'];
          const operators = Object.keys(value);
          
          if (operators.some(op => jsonOperators.includes(op))) {
            // Handle path operator
            if ('path' in value && Array.isArray(value.path) && value.path.length === 2) {
              const [path, pathValue] = value.path;
              clauses.push(`json_extract(${key}, ?) = ?`);
              params.push(path, pathValue);
              continue;
            }
            
            // Handle array_contains operator
            if ('array_contains' in value) {
              clauses.push(`json_array_contains(${key}, ?)`);
              params.push(value.array_contains);
              continue;
            }
            
            // Handle string_contains operator
            if ('string_contains' in value) {
              clauses.push(`json_extract(${key}, '$') LIKE ?`);
              params.push(`%${value.string_contains}%`);
              continue;
            }
          }
        }
        
        // Fall back to the original implementation for non-JSON operations
        const { clause, params: subParams } = originalBuildWhereClause.call(this, { [key]: value }, []);
        if (clause) {
          clauses.push(clause);
          params.push(...subParams);
        }
      }
      
      return {
        clause: clauses.length > 0 ? clauses.join(' AND ') : '',
        params
      };
    };
    
    // Add JSON update capability
    for (const model of Object.keys(client.models)) {
      client.models[model].updateJson = async function (args: { where: Record<string, any>; data: Record<string, any> }) {
        const { where, data } = args;
        
        // First, get the current record
        const record = await this.findUnique({ where });
        if (!record) {
          throw new Error(`Record not found for update: ${JSON.stringify(where)}`);
        }
        
        // Process the data to update JSON fields
        const updateData: Record<string, any> = {};
        
        for (const [key, value] of Object.entries(data)) {
          if (typeof value === 'object' && value !== null) {
            // Check if the field exists and is a JSON string
            if (key in record && typeof record[key] === 'string') {
              try {
                const currentJson = JSON.parse(record[key]);
                // Deep merge the new value into the current JSON
                const updatedJson = deepMerge(currentJson, value);
                updateData[key] = JSON.stringify(updatedJson);
              } catch (e) {
                // If not valid JSON, just set the value directly
                updateData[key] = JSON.stringify(value);
              }
            } else {
              // If field doesn't exist or isn't JSON, just set the value
              updateData[key] = JSON.stringify(value);
            }
          } else {
            // For non-object values, just set directly
            updateData[key] = value;
          }
        }
        
        // Update the record with the processed data
        return this.update({
          where,
          data: updateData
        });
      };
    }
    
    // Add support for dot notation in updates
    const originalUpdate = client.adapter.update;
    
    client.adapter.update = async function (model: string, args: { where: Record<string, any>; data: Record<string, any> }) {
      const { where, data } = args;
      
      // Check for dot notation in data keys
      const jsonUpdates: Record<string, any> = {};
      const regularUpdates: Record<string, any> = {};
      
      for (const [key, value] of Object.entries(data)) {
        if (key.includes('.')) {
          const [field, ...pathParts] = key.split('.');
          const jsonPath = pathParts.join('.');
          
          // Handle array indexing in the path (e.g., roles[0])
          const jsonPathWithArrays = jsonPath.replace(/\[(\d+)\]/g, '.$1');
          
          // Build the JSON path for the database
          const dbJsonPath = `$.${jsonPathWithArrays}`;
          
          if (!jsonUpdates[field]) {
            jsonUpdates[field] = [];
          }
          
          jsonUpdates[field].push({ path: dbJsonPath, value });
        } else {
          regularUpdates[key] = value;
        }
      }
      
      // If there are JSON updates, we need to get the current record first
      if (Object.keys(jsonUpdates).length > 0) {
        const record = await this.findUnique(model, { where });
        
        if (!record) {
          throw new Error(`Record not found for update: ${JSON.stringify(where)}`);
        }
        
        // Process each JSON field update
        for (const [field, updates] of Object.entries(jsonUpdates)) {
          if (field in record && typeof record[field] === 'string') {
            try {
              let currentJson = JSON.parse(record[field]);
              
              // Apply each path update to the JSON
              for (const update of updates as { path: string; value: any }[]) {
                currentJson = setValueAtPath(currentJson, update.path.substring(2), update.value);
              }
              
              regularUpdates[field] = JSON.stringify(currentJson);
            } catch (e) {
              // If not valid JSON, create a new object
              const newJson = {};
              for (const update of updates as { path: string; value: any }[]) {
                setValueAtPath(newJson, update.path.substring(2), update.value);
              }
              regularUpdates[field] = JSON.stringify(newJson);
            }
          } else {
            // If field doesn't exist or isn't JSON, create a new object
            const newJson = {};
            for (const update of updates as { path: string; value: any }[]) {
              setValueAtPath(newJson, update.path.substring(2), update.value);
            }
            regularUpdates[field] = JSON.stringify(newJson);
          }
        }
      }
      
      // Perform the update with the processed data
      return originalUpdate.call(this, model, { where, data: regularUpdates });
    };
    
    return client;
  }
};

/**
 * Deep merge two objects
 */
function deepMerge(target: any, source: any): any {
  const output = { ...target };
  
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  
  return output;
}

/**
 * Check if value is an object
 */
function isObject(item: any): boolean {
  return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Set a value at a specific path in an object
 */
function setValueAtPath(obj: any, path: string, value: any): any {
  // Handle array indices in the path
  const parts = path.split('.');
  let current = obj;
  
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    
    if (arrayMatch) {
      // Handle array access
      const [, arrayName, indexStr] = arrayMatch;
      const index = parseInt(indexStr, 10);
      
      if (!current[arrayName]) {
        current[arrayName] = [];
      }
      
      // Ensure the array is long enough
      while (current[arrayName].length <= index) {
        current[arrayName].push(null);
      }
      
      if (!current[arrayName][index] || typeof current[arrayName][index] !== 'object') {
        current[arrayName][index] = {};
      }
      
      current = current[arrayName][index];
    } else {
      // Regular object property
      if (!current[part] || typeof current[part] !== 'object') {
        current[part] = {};
      }
      
      current = current[part];
    }
  }
  
  // Set the final value
  const lastPart = parts[parts.length - 1];
  const arrayMatch = lastPart.match(/^(\w+)\[(\d+)\]$/);
  
  if (arrayMatch) {
    // Handle array access in the last part
    const [, arrayName, indexStr] = arrayMatch;
    const index = parseInt(indexStr, 10);
    
    if (!current[arrayName]) {
      current[arrayName] = [];
    }
    
    // Ensure the array is long enough
    while (current[arrayName].length <= index) {
      current[arrayName].push(null);
    }
    
    current[arrayName][index] = value;
  } else {
    // Regular property
    current[lastPart] = value;
  }
  
  return obj;
}
