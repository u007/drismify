/**
 * Internal utility functions for extensions
 * These functions are used internally by the extension system and are exported for testing
 */

import { ResultField } from './types';

/**
 * Apply result extensions to data
 * This is an internal function used for processing result fields
 * 
 * @param data The data to process (single item or array)
 * @param extensions The result extensions to apply
 * @param computationTimings Optional object to track computation times
 * @returns The processed data with computed fields
 */
export function applyResultExtension(data: any, extensions: Record<string, ResultField>, computationTimings: Record<string, number> = {}): any {
  if (Array.isArray(data)) {
    return data.map(item => processResultItem(item, extensions, computationTimings));
  }
  return processResultItem(data, extensions, computationTimings);
}

/**
 * Process a single result item
 * This adds computed fields based on the result extension
 * 
 * @param item The item to process
 * @param fields The result fields to apply
 * @param timings Optional object to track computation times
 * @returns The processed item with computed fields
 */
function processResultItem(item: any, fields: Record<string, ResultField>, timings: Record<string, number> = {}): any {
  if (!item || typeof item !== 'object') return item;
  
  const result = { ...item };
  
  // Apply each computed field
  for (const [fieldName, fieldDef] of Object.entries(fields)) {
    const { compute, needs } = fieldDef;
    
    // Skip if the field already exists in the result (don't override)
    if (fieldName in result) continue;
    
    // Check if all needed fields are present
    const hasAllNeeds = Object.keys(needs).every(neededField => result[neededField] !== undefined);
    
    if (hasAllNeeds) {
      // Measure computation time
      const startTime = Date.now();
      
      try {
        // Compute and add the field
        result[fieldName] = compute(result);
      } catch (error) {
        // Handle computation errors
        console.error(`Error computing field '${fieldName}':`, error);
        // Set to null to indicate computation failed
        result[fieldName] = null;
      }
      
      // Record computation time
      timings[fieldName] = Date.now() - startTime;
    }
  }
  
  return result;
}

/**
 * Recursively process nested results
 * This adds computed fields to all objects in a nested structure
 * 
 * @param item The root item with nested relations
 * @param fields The result fields to apply
 * @param timings Optional object to track computation times
 * @returns The processed item with computed fields in all nested objects
 */
export function processNestedResults(item: any, fields: Record<string, ResultField>, timings: Record<string, number> = {}): any {
  if (!item || typeof item !== 'object') return item;
  
  // First process the item itself
  const result = processResultItem(item, fields, timings);
  
  // Then recursively process all nested objects and arrays
  for (const key in result) {
    const value = result[key];
    
    if (Array.isArray(value)) {
      // Process each item in the array
      result[key] = value.map(arrayItem => 
        typeof arrayItem === 'object' && arrayItem !== null
          ? processResultItem(arrayItem, fields, timings)
          : arrayItem
      );
    } else if (value && typeof value === 'object') {
      // Process nested object
      result[key] = processResultItem(value, fields, timings);
    }
  }
  
  return result;
}

/**
 * Check if an object has nested relations
 * 
 * @param obj The object to check
 * @returns True if the object has nested relations
 */
export function hasNestedRelations(obj: any): boolean {
  if (!obj || typeof obj !== 'object') return false;
  
  for (const key in obj) {
    const value = obj[key];
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
      return true;
    }
    if (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0) {
      // Check if this looks like a relation object and not a scalar/JSON
      if (!('_count' in value)) {
        return true;
      }
    }
  }
  
  return false;
}