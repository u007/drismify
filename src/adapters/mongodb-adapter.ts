import { MongoClient, Db, Collection, ClientSession } from 'mongodb';
import { 
  ConnectionOptions, 
  QueryResult, 
  TransactionClient, 
  TransactionOptions 
} from './types';
import { BaseDatabaseAdapter } from './base-adapter';

/**
 * Transaction client implementation for MongoDB
 */
class MongoTransactionClient implements TransactionClient {
  constructor(private session: ClientSession, private db: Db) {}

  async execute<T = any>(query: string, params?: any[]): Promise<QueryResult<T>> {
    try {
      // MongoDB doesn't use SQL queries, so we need to parse the operation
      // This is a simplified implementation - in practice, you'd need a more sophisticated query parser
      const result = await this.executeMongoOperation(query, params);
      
      return {
        data: Array.isArray(result) ? result : [result]
      };
    } catch (error) {
      throw this.formatError(error);
    }
  }

  async executeRaw<T = any>(query: string, params?: any[]): Promise<QueryResult<T>> {
    return this.execute(query, params);
  }

  private async executeMongoOperation(operation: string, params?: any[]): Promise<any> {
    // This is a placeholder implementation
    // In a real implementation, you would parse the operation and convert it to MongoDB operations
    throw new Error('MongoDB operations not yet implemented in transaction context');
  }

  private formatError(error: any): Error {
    // Format MongoDB specific errors to match Prisma error format
    if (error.code) {
      // Map MongoDB error codes to more user-friendly messages
      const errorMap: Record<number, string> = {
        11000: 'Duplicate key error',
        11001: 'Duplicate key error on update',
        2: 'Bad value',
        13: 'Unauthorized',
        18: 'Authentication failed',
        // Add more mappings as needed
      };

      const errorMessage = errorMap[error.code] || error.message;
      return new Error(`MongoDB error: ${errorMessage}`);
    }
    return error;
  }
}

/**
 * MongoDB adapter implementation
 */
export class MongoDBAdapter extends BaseDatabaseAdapter {
  private client: MongoClient | null = null;
  private db: Db | null = null;

  constructor(options: ConnectionOptions) {
    super(options);

    // Validate required options for MongoDB
    if (!options.url) {
      throw new Error('URL is required for MongoDB connection');
    }

    if (!options.database) {
      throw new Error('Database name is required for MongoDB connection');
    }
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      const url = this.options.url!;
      const database = this.options.database!;

      // Create MongoDB client
      this.client = new MongoClient(url, {
        // MongoDB connection options
        maxPoolSize: this.options.connectionLimit || 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        // Add authentication options if provided
        ...(this.options.user && this.options.password && {
          auth: {
            username: this.options.user,
            password: this.options.password
          }
        }),
        ...(this.options.authSource && {
          authSource: this.options.authSource
        })
      });

      // Connect to MongoDB
      await this.client.connect();
      
      // Get database reference
      this.db = this.client.db(database);
      
      // Test the connection
      await this.db.admin().ping();
      
      this.isConnected = true;
    } catch (error) {
      throw new Error(`Failed to connect to MongoDB: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected || !this.client) {
      return;
    }

    try {
      await this.client.close();
      this.client = null;
      this.db = null;
      this.isConnected = false;
    } catch (error) {
      throw new Error(`Failed to disconnect from MongoDB: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async execute<T = any>(query: string, params?: any[]): Promise<QueryResult<T>> {
    this.ensureConnected();

    try {
      if (!this.db) {
        throw new Error('MongoDB database connection is not initialized');
      }

      // MongoDB doesn't use SQL queries, so we need to parse the operation
      // This is a simplified implementation - in practice, you'd need a more sophisticated query parser
      const result = await this.executeMongoOperation(query, params);
      
      return {
        data: Array.isArray(result) ? result : [result]
      };
    } catch (error) {
      throw this.formatError(error);
    }
  }

  async executeRaw<T = any>(query: string, params?: any[]): Promise<QueryResult<T>> {
    return this.execute(query, params);
  }

  async transaction<T = any>(
    callback: (tx: TransactionClient) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T> {
    this.ensureConnected();

    if (!this.client || !this.db) {
      throw new Error('MongoDB client or database is not initialized');
    }

    const session = this.client.startSession();
    
    try {
      let result: T;
      
      await session.withTransaction(async () => {
        const txClient = new MongoTransactionClient(session, this.db!);
        result = await callback(txClient);
      }, {
        readConcern: { level: 'majority' },
        writeConcern: { w: 'majority' },
        readPreference: 'primary'
      });

      return result!;
    } catch (error) {
      throw this.formatError(error);
    } finally {
      await session.endSession();
    }
  }

  private async executeMongoOperation(operation: string, params?: any[]): Promise<any> {
    // This is a placeholder implementation
    // In a real implementation, you would parse the operation and convert it to MongoDB operations
    // For now, we'll throw an error to indicate this needs to be implemented
    throw new Error('MongoDB operation parsing not yet implemented. Use MongoDB-specific methods instead.');
  }

  private formatError(error: any): Error {
    // Format MongoDB specific errors to match Prisma error format
    if (error.code) {
      // Map MongoDB error codes to more user-friendly messages
      const errorMap: Record<number, string> = {
        11000: 'Duplicate key error',
        11001: 'Duplicate key error on update',
        2: 'Bad value',
        13: 'Unauthorized',
        18: 'Authentication failed',
        // Add more mappings as needed
      };

      const errorMessage = errorMap[error.code] || error.message;
      return new Error(`MongoDB error: ${errorMessage}`);
    }
    return error;
  }

  /**
   * MongoDB-specific methods
   */
  
  /**
   * Get a MongoDB collection
   */
  getCollection(name: string): Collection {
    this.ensureConnected();
    
    if (!this.db) {
      throw new Error('MongoDB database connection is not initialized');
    }
    
    return this.db.collection(name);
  }

  /**
   * Get the MongoDB database instance
   */
  getDatabase(): Db {
    this.ensureConnected();
    
    if (!this.db) {
      throw new Error('MongoDB database connection is not initialized');
    }
    
    return this.db;
  }

  /**
   * Get the MongoDB client instance
   */
  getClient(): MongoClient {
    this.ensureConnected();

    if (!this.client) {
      throw new Error('MongoDB client is not initialized');
    }

    return this.client;
  }

  /**
   * Introspection methods for MongoDB
   * These methods adapt MongoDB concepts to match the expected interface for db pull/push
   */

  /**
   * Get all collections (equivalent to tables in SQL databases)
   */
  async getTables(): Promise<any[]> {
    this.ensureConnected();

    if (!this.db) {
      throw new Error('MongoDB database connection is not initialized');
    }

    try {
      const collections = await this.db.listCollections().toArray();

      return collections.map(collection => ({
        name: collection.name,
        type: 'collection',
        // MongoDB collections don't have SQL-like CREATE statements
        sql: null
      }));
    } catch (error) {
      throw this.formatError(error);
    }
  }

  /**
   * Get document fields from collections (equivalent to columns in SQL databases)
   * This analyzes sample documents to infer the schema
   */
  async getColumns(): Promise<any[]> {
    this.ensureConnected();

    if (!this.db) {
      throw new Error('MongoDB database connection is not initialized');
    }

    try {
      const collections = await this.getTables();
      const columns: any[] = [];

      for (const collection of collections) {
        const collectionRef = this.db.collection(collection.name);

        // Sample a few documents to infer schema
        const sampleDocs = await collectionRef.find({}).limit(10).toArray();

        if (sampleDocs.length > 0) {
          // Analyze the structure of sample documents
          const fieldTypes = this.analyzeDocumentStructure(sampleDocs);

          let position = 0;
          for (const [fieldName, fieldInfo] of Object.entries(fieldTypes)) {
            columns.push({
              table: collection.name,
              name: fieldName,
              type: fieldInfo.type,
              isNullable: fieldInfo.isNullable,
              isAutoIncrement: fieldName === '_id', // MongoDB _id is auto-generated
              isPrimaryKey: fieldName === '_id',
              defaultValue: fieldInfo.defaultValue,
              position: position++
            });
          }
        }
      }

      return columns;
    } catch (error) {
      throw this.formatError(error);
    }
  }

  /**
   * MongoDB doesn't have foreign keys, but we can infer relationships from field names
   * This returns an empty array but could be extended to analyze ObjectId references
   */
  async getForeignKeys(): Promise<any[]> {
    // MongoDB doesn't have foreign keys in the traditional SQL sense
    // We could potentially analyze ObjectId fields and infer relationships
    // but for now, return empty array
    return [];
  }

  /**
   * Get indexes from MongoDB collections
   */
  async getIndexes(): Promise<any[]> {
    this.ensureConnected();

    if (!this.db) {
      throw new Error('MongoDB database connection is not initialized');
    }

    try {
      const collections = await this.getTables();
      const indexes: any[] = [];

      for (const collection of collections) {
        const collectionRef = this.db.collection(collection.name);
        const collectionIndexes = await collectionRef.indexes();

        for (const index of collectionIndexes) {
          // Skip the default _id index unless it's been modified
          if (index.name === '_id_' && Object.keys(index.key).length === 1 && index.key._id === 1) {
            continue;
          }

          const columns = Object.keys(index.key);
          const isUnique = index.unique || false;

          indexes.push({
            name: index.name,
            table: collection.name,
            columns,
            isUnique,
            isPrimary: index.name === '_id_'
          });
        }
      }

      return indexes;
    } catch (error) {
      throw this.formatError(error);
    }
  }

  /**
   * MongoDB doesn't have check constraints, but has validation rules
   * This could be extended to analyze collection validation schemas
   */
  async getCheckConstraints(): Promise<any[]> {
    // MongoDB uses validation rules instead of check constraints
    // We could potentially analyze collection validation schemas
    // but for now, return empty array
    return [];
  }

  /**
   * Get unique constraints (unique indexes) from MongoDB collections
   */
  async getUniqueConstraints(): Promise<any[]> {
    this.ensureConnected();

    if (!this.db) {
      throw new Error('MongoDB database connection is not initialized');
    }

    try {
      const collections = await this.getTables();
      const uniqueConstraints: any[] = [];

      for (const collection of collections) {
        const collectionRef = this.db.collection(collection.name);
        const collectionIndexes = await collectionRef.indexes();

        for (const index of collectionIndexes) {
          if (index.unique) {
            const columns = Object.keys(index.key);

            uniqueConstraints.push({
              name: index.name,
              table: collection.name,
              columns,
              isNamed: true
            });
          }
        }
      }

      return uniqueConstraints;
    } catch (error) {
      throw this.formatError(error);
    }
  }

  /**
   * Analyze document structure to infer field types
   */
  private analyzeDocumentStructure(documents: any[]): Record<string, any> {
    const fieldTypes: Record<string, any> = {};

    for (const doc of documents) {
      this.analyzeDocument(doc, fieldTypes, '');
    }

    return fieldTypes;
  }

  /**
   * Recursively analyze a document to extract field information
   */
  private analyzeDocument(obj: any, fieldTypes: Record<string, any>, prefix: string = ''): void {
    for (const [key, value] of Object.entries(obj)) {
      const fieldName = prefix ? `${prefix}.${key}` : key;

      if (!fieldTypes[fieldName]) {
        fieldTypes[fieldName] = {
          type: this.inferMongoType(value),
          isNullable: false,
          defaultValue: null,
          occurrences: 0
        };
      }

      fieldTypes[fieldName].occurrences++;

      // Check if field can be null
      if (value === null || value === undefined) {
        fieldTypes[fieldName].isNullable = true;
      }

      // For nested objects, analyze recursively (but limit depth to avoid infinite recursion)
      if (typeof value === 'object' && value !== null && !Array.isArray(value) && prefix.split('.').length < 3) {
        this.analyzeDocument(value, fieldTypes, fieldName);
      }
    }
  }

  /**
   * Infer MongoDB/Prisma type from JavaScript value
   */
  private inferMongoType(value: any): string {
    if (value === null || value === undefined) {
      return 'String'; // Default to String for null values
    }

    if (typeof value === 'string') {
      // Check if it's an ObjectId
      if (value.match(/^[0-9a-fA-F]{24}$/)) {
        return 'String'; // ObjectId is represented as String in Prisma
      }
      return 'String';
    }

    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'Int' : 'Float';
    }

    if (typeof value === 'boolean') {
      return 'Boolean';
    }

    if (value instanceof Date) {
      return 'DateTime';
    }

    if (Array.isArray(value)) {
      return 'Json'; // Arrays are represented as Json in Prisma for MongoDB
    }

    if (typeof value === 'object') {
      return 'Json'; // Objects are represented as Json in Prisma for MongoDB
    }

    return 'String'; // Default fallback
  }
}
