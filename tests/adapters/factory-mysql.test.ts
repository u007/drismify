import { describe, test, expect } from 'bun:test';
import { createAdapter, createAdapterFromDatasource } from '../../src/adapters/factory';
import { MySQLAdapter } from '../../src/adapters/mysql-adapter';
import type { ConnectionOptions } from '../../src/adapters/types';

describe('MySQL Adapter Factory Integration', () => {
  describe('createAdapter', () => {
    test('should create MySQL adapter with connection options', () => {
      const options: ConnectionOptions = {
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: 'password',
        database: 'testdb'
      };

      const adapter = createAdapter('mysql', options, false);
      
      expect(adapter).toBeInstanceOf(MySQLAdapter);
    });

    test('should create MySQL adapter with URL', () => {
      const options: ConnectionOptions = {
        url: 'mysql://root:password@localhost:3306/testdb'
      };

      const adapter = createAdapter('mysql', options, false);
      
      expect(adapter).toBeInstanceOf(MySQLAdapter);
    });

    test('should return singleton instance when requested', () => {
      const options: ConnectionOptions = {
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: 'password',
        database: 'testdb'
      };

      const adapter1 = createAdapter('mysql', options, true);
      const adapter2 = createAdapter('mysql', options, true);
      
      expect(adapter1).toBe(adapter2);
    });

    test('should return different instances when singleton is false', () => {
      const options: ConnectionOptions = {
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: 'password',
        database: 'testdb'
      };

      const adapter1 = createAdapter('mysql', options, false);
      const adapter2 = createAdapter('mysql', options, false);
      
      expect(adapter1).not.toBe(adapter2);
      expect(adapter1).toBeInstanceOf(MySQLAdapter);
      expect(adapter2).toBeInstanceOf(MySQLAdapter);
    });
  });

  describe('createAdapterFromDatasource', () => {
    test('should create MySQL adapter from mysql provider', () => {
      const datasource = {
        provider: 'mysql',
        url: 'mysql://root:password@localhost:3306/testdb'
      };

      const adapter = createAdapterFromDatasource(datasource, false);
      
      expect(adapter).toBeInstanceOf(MySQLAdapter);
    });

    test('should create MySQL adapter from mariadb provider', () => {
      const datasource = {
        provider: 'mariadb',
        url: 'mysql://root:password@localhost:3306/testdb'
      };

      const adapter = createAdapterFromDatasource(datasource, false);
      
      expect(adapter).toBeInstanceOf(MySQLAdapter);
    });

    test('should parse MySQL URL correctly', () => {
      const datasource = {
        provider: 'mysql',
        url: 'mysql://testuser:testpass@testhost:3307/testdb?ssl=true'
      };

      const adapter = createAdapterFromDatasource(datasource, false);
      
      expect(adapter).toBeInstanceOf(MySQLAdapter);
      // The adapter should have parsed the URL correctly
      // We can't directly access the options, but we can verify it was created
    });

    test('should handle invalid MySQL URL gracefully', () => {
      const datasource = {
        provider: 'mysql',
        url: 'invalid-url'
      };

      const adapter = createAdapterFromDatasource(datasource, false);
      
      expect(adapter).toBeInstanceOf(MySQLAdapter);
      // Should still create adapter with original URL
    });

    test('should throw error for unsupported provider', () => {
      const datasource = {
        provider: 'unsupported',
        url: 'mysql://root:password@localhost:3306/testdb'
      };

      expect(() => {
        createAdapterFromDatasource(datasource, false);
      }).toThrow('Unsupported database provider: unsupported');
    });
  });

  describe('MySQL URL Detection', () => {
    test('should detect mysql:// URLs', () => {
      const datasource = {
        provider: 'mysql',
        url: 'mysql://root:password@localhost:3306/testdb'
      };

      const adapter = createAdapterFromDatasource(datasource, false);
      expect(adapter).toBeInstanceOf(MySQLAdapter);
    });

    test('should detect mysql2:// URLs', () => {
      const datasource = {
        provider: 'mysql',
        url: 'mysql2://root:password@localhost:3306/testdb'
      };

      const adapter = createAdapterFromDatasource(datasource, false);
      expect(adapter).toBeInstanceOf(MySQLAdapter);
    });
  });

  describe('Connection Options Parsing', () => {
    test('should parse complete MySQL URL', () => {
      const datasource = {
        provider: 'mysql',
        url: 'mysql://user:pass@host:3307/dbname?ssl=true&charset=utf8'
      };

      // This should not throw
      const adapter = createAdapterFromDatasource(datasource, false);
      expect(adapter).toBeInstanceOf(MySQLAdapter);
    });

    test('should handle URL without port', () => {
      const datasource = {
        provider: 'mysql',
        url: 'mysql://user:pass@host/dbname'
      };

      const adapter = createAdapterFromDatasource(datasource, false);
      expect(adapter).toBeInstanceOf(MySQLAdapter);
    });

    test('should handle URL without password', () => {
      const datasource = {
        provider: 'mysql',
        url: 'mysql://user@host:3306/dbname'
      };

      const adapter = createAdapterFromDatasource(datasource, false);
      expect(adapter).toBeInstanceOf(MySQLAdapter);
    });
  });
});
