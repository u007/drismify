import { describe, expect, test } from '@jest/globals';
import { createSoftDeleteExtension, SoftDeleteOptions } from '../src/extensions/advanced';

// Direct testing of soft delete extension functionality
describe('Soft Delete Extension Direct Tests', () => {
  // Mock data
  let users = [
    { id: 1, name: 'Alice', deleted: false, deletedAt: null },
    { id: 2, name: 'Bob', deleted: false, deletedAt: null },
    { id: 3, name: 'Charlie', deleted: true, deletedAt: new Date() }
  ];

  // Function to reset data
  function resetData() {
    users = [
      { id: 1, name: 'Alice', deleted: false, deletedAt: null },
      { id: 2, name: 'Bob', deleted: false, deletedAt: null },
      { id: 3, name: 'Charlie', deleted: true, deletedAt: new Date() }
    ];
  }

  // Direct testing of query modification
  test('should filter out deleted records in queries', () => {
    resetData();
    const extension = createSoftDeleteExtension();
    
    // Test $allModels findMany
    let findManyArgs = { where: { name: 'Bob' } };
    const modifiedFindManyArgs = extension.query?.$allModels?.findMany(findManyArgs);
    expect(modifiedFindManyArgs?.where.deleted).toBe(false);
    
    // Test $allModels findFirst
    let findFirstArgs = { where: { id: 1 } };
    const modifiedFindFirstArgs = extension.query?.$allModels?.findFirst(findFirstArgs);
    expect(modifiedFindFirstArgs?.where.deleted).toBe(false);
    
    // Test $allModels findUnique
    let findUniqueArgs = { where: { id: 1 } };
    const modifiedFindUniqueArgs = extension.query?.$allModels?.findUnique(findUniqueArgs);
    expect(modifiedFindUniqueArgs?.where.deleted).toBe(false);
    
    // Test $allModels count
    let countArgs = { where: { name: { contains: 'A' } } };
    const modifiedCountArgs = extension.query?.$allModels?.count(countArgs);
    expect(modifiedCountArgs?.where.deleted).toBe(false);
  });

  // Test model extension methods
  test('should add model methods for soft deletion', async () => {
    resetData();
    const extension = createSoftDeleteExtension();
    
    // Create mock model with methods from extension
    const modelMethods = extension.model?.$allModels || {};
    
    // Mock model context
    const mockModel = {
      // Mock update method
      updateMany: async (args: any) => {
        const { where, data } = args;
        const matched = users.filter(u => {
          if (where.id !== undefined && u.id !== where.id) return false;
          if (where.deleted !== undefined && u.deleted !== where.deleted) return false;
          return true;
        });
        
        matched.forEach(u => {
          Object.assign(u, data);
        });
        
        return { count: matched.length };
      },
      
      // Mock delete method
      deleteMany: async (args: any) => {
        const { where } = args;
        const initialCount = users.length;
        
        users = users.filter(u => {
          if (where.id !== undefined && u.id === where.id) return false;
          return true;
        });
        
        return { count: initialCount - users.length };
      },
      
      // Mock findMany method
      findMany: async (args: any = {}) => {
        const { where = {} } = args;
        return users.filter(u => {
          if (where.id !== undefined && u.id !== where.id) return false;
          if (where.deleted !== undefined && u.deleted !== where.deleted) return false;
          return true;
        });
      },
    };
    
    // Add all the extension methods to our mock model
    const testModel = { ...mockModel };
    Object.keys(modelMethods).forEach(key => {
      testModel[key] = modelMethods[key].bind(testModel);
    });
    
    // Test softDelete
    await testModel.softDelete({ where: { id: 2 } });
    const user2 = users.find(u => u.id === 2);
    expect(user2?.deleted).toBe(true);
    expect(user2?.deletedAt).toBeInstanceOf(Date);
    
    // Test findDeleted
    const deletedUsers = await testModel.findDeleted();
    expect(deletedUsers.length).toBe(2); // Now both Charlie and Bob are deleted
    
    // Test findWithDeleted
    const allUsers = await testModel.findWithDeleted();
    expect(allUsers.length).toBe(3); // All users
    
    // Test restore
    await testModel.restore({ where: { id: 3 } });
    const user3 = users.find(u => u.id === 3);
    expect(user3?.deleted).toBe(false);
    expect(user3?.deletedAt).toBeNull();
    
    // Test hardDelete
    await testModel.hardDelete({ where: { id: 2 } });
    expect(users.find(u => u.id === 2)).toBeUndefined();
    expect(users.length).toBe(2);
  });

  // Test custom configuration options
  test('should support custom field names and options', () => {
    // Setup with custom config
    const customOptions: SoftDeleteOptions = {
      deletedField: 'isRemoved',
      deletedAtField: 'removedAt',
      includeDeletedInRelations: true
    };
    
    const extension = createSoftDeleteExtension(customOptions);
    
    // Test field names in queries
    let findArgs = { where: { name: 'Alice' } };
    const modifiedArgs = extension.query?.$allModels?.findMany(findArgs);
    
    expect(modifiedArgs?.where.isRemoved).toBe(false);
    expect(modifiedArgs?.where.deleted).toBeUndefined();
  });

  // Test configuration utilities
  test('should provide configuration utilities', () => {
    const extension = createSoftDeleteExtension({
      deletedField: 'deleted'
    });
    
    // Check client extension methods exist
    expect(typeof extension.client?.$configureSoftDelete).toBe('function');
    expect(typeof extension.client?.$getSoftDeleteConfig).toBe('function');
  });

  // Test custom deleted filter
  test('should support custom deleted filter', () => {
    const extension = createSoftDeleteExtension({
      customDeletedFilter: (args: any) => {
        args = args || {};
        args.where = args.where || {};
        args.where.status = 'ACTIVE';  // Custom business logic
        return args;
      }
    });
    
    let findArgs = { where: { name: 'Alice' } };
    const modifiedArgs = extension.query?.$allModels?.findMany(findArgs);
    
    expect(modifiedArgs?.where.status).toBe('ACTIVE');
    expect(modifiedArgs?.where.deleted).toBeUndefined();
  });
});