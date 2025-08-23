import { describe, test, expect } from 'bun:test';
import { DrismifyClient } from '../../src/client/base-client';
import { MySQLAdapter } from '../../src/adapters/mysql-adapter';
import type { ClientOptions } from '../../src/client/types';

describe('MySQL Client Integration', () => {
  describe('URL-based MySQL Detection', () => {
    test('should detect mysql:// URLs and create MySQL adapter', () => {
      const options: ClientOptions = {
        datasources: {
          db: {
            provider: 'mysql',
            url: 'mysql://root:password@localhost:3306/testdb'
          }
        }
      };

      const client = new DrismifyClient(options);
      
      expect(client.adapter).toBeInstanceOf(MySQLAdapter);
    });

    test('should detect mysql2:// URLs and create MySQL adapter', () => {
      const options: ClientOptions = {
        datasources: {
          db: {
            provider: 'mysql',
            url: 'mysql2://root:password@localhost:3306/testdb'
          }
        }
      };

      const client = new DrismifyClient(options);
      
      expect(client.adapter).toBeInstanceOf(MySQLAdapter);
    });
  });

  describe('Provider-based MySQL Detection', () => {
    test('should create MySQL adapter when provider is mysql', () => {
      const options: ClientOptions = {
        datasources: {
          db: {
            provider: 'mysql',
            url: 'mysql://root:password@localhost:3306/testdb'
          }
        }
      };

      const client = new DrismifyClient(options);
      
      expect(client.adapter).toBeInstanceOf(MySQLAdapter);
    });

    test('should create MySQL adapter when provider is mariadb', () => {
      const options: ClientOptions = {
        datasources: {
          db: {
            provider: 'mariadb',
            url: 'mysql://root:password@localhost:3306/testdb'
          }
        }
      };

      const client = new DrismifyClient(options);
      
      expect(client.adapter).toBeInstanceOf(MySQLAdapter);
    });
  });

  describe('Explicit Adapter Configuration', () => {
    test('should use explicit MySQL adapter when specified', () => {
      const options: ClientOptions = {
        adapter: 'mysql',
        datasources: {
          db: {
            provider: 'mysql',
            url: 'mysql://root:password@localhost:3306/testdb'
          }
        }
      };

      const client = new DrismifyClient(options);
      
      expect(client.adapter).toBeInstanceOf(MySQLAdapter);
    });
  });

  describe('MySQL Connection Configuration', () => {
    test('should handle MySQL URL with all parameters', () => {
      const options: ClientOptions = {
        datasources: {
          db: {
            provider: 'mysql',
            url: 'mysql://user:pass@host:3307/dbname?ssl=true&charset=utf8mb4'
          }
        }
      };

      const client = new DrismifyClient(options);
      
      expect(client.adapter).toBeInstanceOf(MySQLAdapter);
    });

    test('should handle MySQL URL with minimal parameters', () => {
      const options: ClientOptions = {
        datasources: {
          db: {
            provider: 'mysql',
            url: 'mysql://localhost/testdb'
          }
        }
      };

      const client = new DrismifyClient(options);
      
      expect(client.adapter).toBeInstanceOf(MySQLAdapter);
    });
  });

  describe('Fallback Behavior', () => {
    test('should not create MySQL adapter for non-MySQL URLs', () => {
      const options: ClientOptions = {
        datasources: {
          db: {
            provider: 'sqlite',
            url: 'file:./test.db'
          }
        }
      };

      const client = new DrismifyClient(options);
      
      expect(client.adapter).not.toBeInstanceOf(MySQLAdapter);
    });

    test('should not create MySQL adapter for MongoDB URLs', () => {
      const options: ClientOptions = {
        datasources: {
          db: {
            provider: 'mongodb',
            url: 'mongodb://localhost:27017/testdb',
            database: 'testdb'
          }
        }
      };

      const client = new DrismifyClient(options);

      expect(client.adapter).not.toBeInstanceOf(MySQLAdapter);
    });

    test('should not create MySQL adapter for TursoDB URLs', () => {
      const options: ClientOptions = {
        datasources: {
          db: {
            provider: 'turso',
            url: 'libsql://localhost:8080'
          }
        }
      };

      const client = new DrismifyClient(options);
      
      expect(client.adapter).not.toBeInstanceOf(MySQLAdapter);
    });
  });

  describe('Client Methods', () => {
    test('should expose adapter through client', () => {
      const options: ClientOptions = {
        datasources: {
          db: {
            provider: 'mysql',
            url: 'mysql://root:password@localhost:3306/testdb'
          }
        }
      };

      const client = new DrismifyClient(options);
      
      expect(client.adapter).toBeDefined();
      expect(client.adapter).toBeInstanceOf(MySQLAdapter);
    });

    test('should allow access to MySQL-specific methods', () => {
      const options: ClientOptions = {
        datasources: {
          db: {
            provider: 'mysql',
            url: 'mysql://root:password@localhost:3306/testdb'
          }
        }
      };

      const client = new DrismifyClient(options);
      const mysqlAdapter = client.adapter as MySQLAdapter;
      
      // Check that MySQL-specific methods exist
      expect(typeof mysqlAdapter.getPool).toBe('function');
      expect(typeof mysqlAdapter.getDrizzleDb).toBe('function');
      expect(typeof mysqlAdapter.getConnection).toBe('function');
      expect(typeof mysqlAdapter.releaseConnection).toBe('function');
    });
  });
});
