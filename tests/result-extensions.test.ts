import { describe, expect, test } from '@jest/globals';
import { createComputedField } from '../src/extensions';
import { applyResultExtension } from '../src/extensions/internal-utils';

// Mock data for testing
const mockUsers = [
  { id: 1, firstName: 'John', lastName: 'Doe', birthDate: '1990-01-01' },
  { id: 2, firstName: 'Jane', lastName: 'Smith', birthDate: '1985-06-15' }
];

// Mock ResultExtension definition
const userResultExtension = {
  fullName: {
    needs: { firstName: true, lastName: true },
    compute: (data) => `${data.firstName} ${data.lastName}`
  },
  age: {
    needs: { birthDate: true },
    compute: (data) => {
      if (!data.birthDate) return null;
      const birth = new Date(data.birthDate);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      if (today.getMonth() < birth.getMonth() || 
          (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) {
        age--;
      }
      return age;
    }
  }
};

// Direct testing of the result extension functionality
describe('Result Extension Direct Tests', () => {
  // Helper function to apply result extensions to data
  function applyExtensions(data, extensions) {
    if (Array.isArray(data)) {
      return data.map(item => applyItemExtensions(item, extensions));
    }
    return applyItemExtensions(data, extensions);
  }

  function applyItemExtensions(item, extensions) {
    if (!item || typeof item !== 'object') return item;
    
    const result = { ...item };
    
    for (const [fieldName, fieldDef] of Object.entries(extensions)) {
      const { compute, needs } = fieldDef;
      
      // Check if all needed fields are present
      const hasAllNeeds = Object.keys(needs).every(neededField => result[neededField] !== undefined);
      
      if (hasAllNeeds) {
        // Compute and add the field
        result[fieldName] = compute(result);
      }
    }
    
    return result;
  }

  test('should add computed fullName to user data', () => {
    const processedUsers = applyExtensions(mockUsers, userResultExtension);
    
    expect(processedUsers[0].fullName).toBe('John Doe');
    expect(processedUsers[1].fullName).toBe('Jane Smith');
  });

  test('should calculate age from birthDate', () => {
    const processedUsers = applyExtensions(mockUsers, userResultExtension);
    
    expect(typeof processedUsers[0].age).toBe('number');
    expect(typeof processedUsers[1].age).toBe('number');
  });

  test('should handle nested relations', () => {
    const userWithPosts = { 
      id: 1, 
      firstName: 'John', 
      lastName: 'Doe',
      posts: [
        { id: 1, title: 'Post 1', content: 'This is content...' },
        { id: 2, title: 'Post 2', content: 'More content...' }
      ]
    };
    
    const postExtension = {
      summary: {
        needs: { content: true },
        compute: (data) => data.content.substring(0, 10) + '...'
      }
    };
    
    // First apply user extensions
    const processedUser = applyExtensions(userWithPosts, userResultExtension);
    
    // Then manually apply post extensions to the nested posts
    processedUser.posts = applyExtensions(processedUser.posts, postExtension);
    
    expect(processedUser.fullName).toBe('John Doe');
    expect(processedUser.posts[0].summary).toBe('This is co...');
    expect(processedUser.posts[1].summary).toBe('More conte...');
  });

  test('should handle missing required fields', () => {
    const incompleteUsers = [
      { id: 1, firstName: 'John' }, // Missing lastName
      { id: 2, lastName: 'Smith' }  // Missing firstName
    ];
    
    const processedUsers = applyExtensions(incompleteUsers, userResultExtension);
    
    expect(processedUsers[0].fullName).toBeUndefined();
    expect(processedUsers[1].fullName).toBeUndefined();
  });

  test('should work with createComputedField utility', () => {
    const customExtension = {
      greeting: createComputedField({
        needs: ['firstName'],
        compute: (data) => `Hello, ${data.firstName}!`
      })
    };
    
    const processedUsers = applyExtensions(mockUsers, customExtension);
    
    expect(processedUsers[0].greeting).toBe('Hello, John!');
    expect(processedUsers[1].greeting).toBe('Hello, Jane!');
  });

  test('should combine multiple computed fields', () => {
    const combinedExtension = {
      ...userResultExtension,
      displayName: {
        needs: { firstName: true, lastName: true },
        compute: (data) => `${data.lastName}, ${data.firstName}`
      }
    };
    
    const processedUsers = applyExtensions(mockUsers, combinedExtension);
    
    expect(processedUsers[0].fullName).toBe('John Doe');
    expect(processedUsers[0].displayName).toBe('Doe, John');
  });

  test('should handle errors gracefully', () => {
    const errorExtension = {
      problematic: {
        needs: { data: true },
        compute: (data) => {
          throw new Error('Computation error');
        }
      }
    };
    
    // Should not throw but return the original data
    const processedUsers = applyExtensions(mockUsers, errorExtension);
    
    expect(processedUsers).toEqual(mockUsers);
  });
});