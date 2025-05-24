import type { DatabaseAdapter, TransactionClient } from '../adapters';
import type { ExtensionContext } from '../extensions';
import type { ModelClient } from './types';
import type { PslModelAst, PslFieldAst } from '../generator';

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
  protected db: DatabaseAdapter | TransactionClient;
  protected modelAst: PslModelAst;
  protected tableName: string;
  protected debug: boolean;
  protected log: ('query' | 'info' | 'warn' | 'error')[];
  protected whereValues: unknown[] = [];
  protected client: Record<string, unknown>; // Main DrismifyClient instance, assuming it's an object with string keys

  /**
   * Model name for extension context
   */
  public readonly $name: string;

  constructor(
    client: Record<string, unknown>, // Main DrismifyClient instance
    modelAst: PslModelAst,
    tableName: string,
    debug = false, // Biome: This type annotation is trivially inferred
    log: ('query' | 'info' | 'warn' | 'error')[] = [],
    dbInstance?: DatabaseAdapter | TransactionClient // Optional: for transactions
  ) {
    this.client = client;
    this.modelAst = modelAst;
    this.tableName = tableName;
    this.debug = debug;
    this.log = log;
    this.db = dbInstance || (client.$getAdapter as () => DatabaseAdapter)(); // Use provided dbInstance or default from client

    // Set the model name for extension context
    // Extract model name from the table name (convert snake_case to PascalCase)
    this.$name = tableName
      .split('_')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
  }

  /**
   * Returns a new instance of the model client that operates within the given transaction.
   */
  withTransaction(txClient: TransactionClient): this {
    // Create a new instance of the current model client, but pass the transaction client
    const ModelClientConstructor = this.constructor as new (...args: unknown[]) => this; // More specific type for constructor
    return new ModelClientConstructor(
      this.client, // Pass the main client instance
      this.modelAst,
      this.tableName,
      this.debug,
      this.log,
      txClient // Pass the transaction client
    );
  }

  /**
   * Create a new record
   */
  async create(data: CreateInput): Promise<T> {
    this.logQuery('create', { data });

    const executeCreate = async (executor: DatabaseAdapter | TransactionClient) => {
      const parentCreateData: Record<string, unknown> = {};
      const postCreateOperations: Array<{
        fieldName: string;
        fieldAst: PslFieldAst;
        fieldValue: Record<string, unknown>; // The { create: [...], connect: [...] } object
      }> = [];

      // Phase 1: Prepare parent data and separate to-many operations
      for (const fieldAst of this.modelAst.fields) {
        const fieldName = fieldAst.name;
        const fieldValue = (data as Record<string, unknown>)[fieldName] as Record<string, unknown> | undefined; // Changed 'any' to 'unknown'

        if (fieldValue === undefined) continue; // Skip undefined fields

        const relationAttribute = fieldAst.attributes.find(attr => attr.name === 'relation');

        if (relationAttribute && fieldValue && typeof fieldValue === 'object' && !Array.isArray(fieldValue)) {
          // This is a relational field with an operation object
          if (fieldAst.type.isArray) { // To-Many relation
            postCreateOperations.push({ fieldName, fieldAst, fieldValue });
            // Don't add to parentCreateData yet; will be handled after parent is created
          } else { // To-One relation
            const fkOnThisModel = relationAttribute.args?.fields && relationAttribute.args.fields.length > 0;
            if (fkOnThisModel) {
              const fkFieldName = relationAttribute.args.fields[0];
              const relatedModelName = fieldAst.type.name;
              const relatedModelClientKey = relatedModelName.charAt(0).toLowerCase() + relatedModelName.slice(1);
              const relatedModelClient = this.client[relatedModelClientKey] as BaseModelClient<unknown, CreateInput, UpdateInput, WhereInput, WhereUniqueInput, OrderByInput, SelectInput, IncludeInput>;

              if (fieldValue.connect) {
                if (typeof (fieldValue.connect as Record<string,unknown>).id !== 'undefined') {
                  parentCreateData[fkFieldName] = (fieldValue.connect as Record<string,unknown>).id;
                  this.logQuery('info', { message: `Processed to-one connect for ${fieldName}, setting ${fkFieldName}=${(fieldValue.connect as Record<string,unknown>).id}` });
                } else { this.logQuery('warn', { message: `To-one connect for ${fieldName} missing id.` }); }
              } else if (fieldValue.create) {
                if (relatedModelClient) {
                  this.logQuery('info', { message: `Processing to-one create for ${fieldName} (related model: ${relatedModelName})` });
                  const createdRelatedRecord = await relatedModelClient.withTransaction(executor as TransactionClient).create(fieldValue.create as CreateInput);
                  if (createdRelatedRecord && typeof (createdRelatedRecord as Record<string,unknown>).id !== 'undefined') {
                    parentCreateData[fkFieldName] = (createdRelatedRecord as Record<string,unknown>).id;
                  } else { this.logQuery('warn', { message: `To-one create for ${fieldName} did not return id.` }); }
                } else { this.logQuery('warn', { message: `Cannot find client for related model ${relatedModelName} for to-one create.` }); }
              } else if (fieldValue.connectOrCreate) {
                if (relatedModelClient) {
                  this.logQuery('info', { message: `Processing to-one connectOrCreate for ${fieldName} (related model: ${relatedModelName})` });
                  const { where, create } = fieldValue.connectOrCreate as { where: WhereUniqueInput, create: CreateInput };
                  let connectedId: unknown;

                  // Attempt to find the record
                  const existingRecord = await relatedModelClient.withTransaction(executor as TransactionClient).findUnique({ where });
                  if (existingRecord && typeof (existingRecord as Record<string,unknown>).id !== 'undefined') {
                    connectedId = (existingRecord as Record<string,unknown>).id;
                    this.logQuery('info', { message: `connectOrCreate: Found existing ${relatedModelName} with id ${connectedId}` });
                  } else {
                    // Create the record if not found
                    this.logQuery('info', { message: `connectOrCreate: Did not find ${relatedModelName}, creating new one.` });
                    const createdRelatedRecord = await relatedModelClient.withTransaction(executor as TransactionClient).create(create);
                    if (createdRelatedRecord && typeof (createdRelatedRecord as Record<string,unknown>).id !== 'undefined') {
                      connectedId = (createdRelatedRecord as Record<string,unknown>).id;
                    } else {
                      this.logQuery('warn', { message: `connectOrCreate: Create for ${fieldName} did not return id.` });
                    }
                  }

                  if (connectedId !== undefined) {
                    parentCreateData[fkFieldName] = connectedId;
                  } else {
                     this.logQuery('warn', { message: `connectOrCreate for ${fieldName} could not establish a connection or create a record with an ID.` });
                  }
                } else {
                  this.logQuery('warn', { message: `Cannot find client for related model ${relatedModelName} for to-one connectOrCreate.` });
                }
              }
            } else {
              // To-one relation where FK is on the other table.
              // Operations like create, connect, connectOrCreate for these are typically handled
              // by creating/updating the *other* record and setting its FK to this (future) parent's ID.
              // This requires the parent to be created first to get an ID.
              // So, these are deferred to postCreateOperations if they involve creating the related record.
              // If it's just a 'connect', it implies the related record already exists and has the FK pointing to *nothing* yet,
              // which is unusual unless the FK is nullable.
              // For now, we'll assume such operations are complex and might need to be handled differently or are not fully supported here.
              // Let's log and potentially add to postCreateOperations if it's a 'create' or 'connectOrCreate'
              if (fieldValue.create || fieldValue.connectOrCreate) {
                  this.logQuery('info', { message: `To-one relational field ${fieldName} (FK on other table) with create/connectOrCreate. Deferring to post-create.` });
                  postCreateOperations.push({ fieldName, fieldAst, fieldValue });
              } else if (fieldValue.connect) {
                  this.logQuery('warn', { message: `To-one relational field ${fieldName} (FK on other table) with 'connect' is ambiguous during parent create. The related record should already have the FK. This 'connect' might be a no-op or an error.` });
              } else {
                  this.logQuery('info', { message: `To-one relational field ${fieldName} (FK on other table) cannot be directly processed during parent create for other operations. It should be set on the child record directly or handled post-creation.` });
              }
            }
          }
        } else {
          // Scalar field or direct FK value, add to parentCreateData
          parentCreateData[fieldName] = fieldValue;
        }
      }
      
      const columns = Object.keys(parentCreateData).filter(k => {
          // Exclude any remaining relational operation objects that weren't processed into FKs
          const fieldAst = this.modelAst.fields.find(f => f.name === k);
          if (fieldAst?.attributes.find(attr => attr.name === 'relation')) { // Optional chaining
              return typeof parentCreateData[k] !== 'object' || parentCreateData[k] === null;
          }
          return true; // Keep scalar fields
      }).join(', ');

      // const values = Object.values(parentCreateData).filter(v => { // This 'values' is not used, finalValuesForSql is used.
      //     // This filter needs to align with the columns filter logic.
      //     // A simpler way is to rebuild values based on the filtered keys for columns.
      //     return true; // Temporary, will refine
      // });
      
      // Refined way to get values corresponding to the filtered columns
      const finalParentCreateDataForSql: Record<string, unknown> = {};
      const columnKeys = columns.split(', ').filter(c => c.trim() !== '');
      for(const key of columnKeys) {
          finalParentCreateDataForSql[key] = parentCreateData[key];
      }
      const finalValuesForSql = Object.values(finalParentCreateDataForSql);

      const placeholders = finalValuesForSql.map((_, i) => `$${i + 1}`).join(', ');

      if (columnKeys.length === 0 && postCreateOperations.length === 0) {
          this.logQuery('warn', { message: 'Create operation has no data for parent and no to-many/deferred to-one relations. Returning empty object.' });
          return {} as T;
      }
      
      let createdRecord = {} as T & {id?: unknown};

      if (columnKeys.length > 0) {
        const query = `
          INSERT INTO ${this.tableName} (${columns})
          VALUES (${placeholders})
          RETURNING *
        `;
        const result = await executor.execute<T & {id?: unknown}>(query, finalValuesForSql);
        createdRecord = result.data[0];
      } else {
        this.logQuery('info', { message: 'Parent record has no direct scalar data to insert. ID might not be generated unless table has defaults or is special.' });
         if (postCreateOperations.length > 0) { // No ID generated, but post ops exist
           // This is problematic. We need an ID for related records.
           // For now, we'll try to insert an empty row if the table allows it, to get an ID.
           // This assumes the table has an auto-incrementing ID or similar.
           try {
              this.logQuery('info', { message: `Attempting to insert an empty row into ${this.tableName} to get an ID for post-create operations.` });
              const emptyInsertQuery = `INSERT INTO ${this.tableName} DEFAULT VALUES RETURNING *`; // This is SQL standard, but support varies.
              const result = await executor.execute<T & {id?: unknown}>(emptyInsertQuery, []);
              if (result.data && result.data.length > 0 && result.data[0].id !== undefined) {
                  createdRecord = result.data[0];
                  this.logQuery('info', { message: `Successfully inserted empty row and got ID: ${createdRecord.id}` });
              } else {
                  this.logQuery('error', { message: `Failed to get an ID by inserting an empty row into ${this.tableName}. Post-create operations might fail.` });
              }
           } catch (e: unknown) { // Use unknown for catch variable
              this.logQuery('error', { message: `Error inserting empty row into ${this.tableName}: ${(e as Error).message}. Post-create operations might fail.` });
           }
        }
      }

      const newParentId = createdRecord.id;

      if (newParentId === undefined && postCreateOperations.length > 0) {
          this.logQuery('error', { message: `Parent ID is undefined after attempting create. Cannot process ${postCreateOperations.length} post-create operations.` });
      } else if (newParentId !== undefined && postCreateOperations.length > 0) {
        for (const op of postCreateOperations) {
          const { fieldName, fieldAst, fieldValue } = op;
          const relatedModelName = fieldAst.type.name;
          const relatedModelClientKey = relatedModelName.charAt(0).toLowerCase() + relatedModelName.slice(1);
          const relatedModelClient = this.client[relatedModelClientKey] as BaseModelClient<unknown, CreateInput, UpdateInput, WhereInput, WhereUniqueInput, OrderByInput, SelectInput, IncludeInput>;

          if (!relatedModelClient) {
            this.logQuery('warn', { message: `Cannot find client for related model ${relatedModelName} for post-create op on ${fieldName}.` });
            continue;
          }

          const currentModelName = this.modelAst.name;
          const parentRelationAttribute = fieldAst.attributes.find(attr => attr.name === 'relation');
          const fkOnThisModel = parentRelationAttribute?.args?.fields && parentRelationAttribute.args.fields.length > 0;

          if (fkOnThisModel) {
              // This case should ideally be handled before parent creation or means an issue in logic.
              // For postCreateOperations, we expect FK to be on the *other* model or it's a many-to-many join.
              this.logQuery('warn', { message: `Post-create operation for ${fieldName} where FK is on this model (${this.tableName}) is unusual. This might indicate an issue.` });
              continue;
          }
          
          // Determine FK on the related model (for one-to-many or one-to-one where FK is on other)
          // Or, if it's a many-to-many, this logic needs to target the join table.
          // For now, this simplified FK finding assumes a direct relation where FK is on the *related* model.
          let fkOnRelatedModel: string | undefined;
          const relatedModelAst: PslModelAst | undefined = relatedModelClient?.modelAst;

          if (relatedModelAst) {
            for (const relatedFieldAst of relatedModelAst.fields) {
              if (relatedFieldAst.type.name === currentModelName) { // Found the field on related model that points back to current model
                const childRelationAttribute = relatedFieldAst.attributes.find(attr => attr.name === 'relation');
                const parentRelationNameOnParent = parentRelationAttribute?.args?.name; // Renamed for clarity
                const childRelationNameOnChild = childRelationAttribute?.args?.name; // Renamed for clarity
                if (parentRelationNameOnParent && childRelationNameOnChild && parentRelationNameOnParent !== childRelationNameOnChild) continue; // Skip if named relations don't match

                if (childRelationAttribute?.args?.fields && childRelationAttribute.args.fields.length > 0) {
                  fkOnRelatedModel = childRelationAttribute.args.fields[0];
                  break;
                }
              }
            }
          }
          // Removed !fieldAst.type.isImplicitManyToMany as it's not a valid property
          if (!fkOnRelatedModel) {
            fkOnRelatedModel = `${currentModelName.charAt(0).toLowerCase() + currentModelName.slice(1)}Id`;
            this.logQuery('warn', { message: `FK determination fallback for ${relatedModelName} regarding ${fieldName}: ${fkOnRelatedModel}.` });
          }


          // Handle to-many 'create'
          if (fieldValue.create) {
            const itemsToCreate = Array.isArray(fieldValue.create) ? fieldValue.create : [fieldValue.create as CreateInput];
            for (const itemToCreate of itemsToCreate) {
              const createDataWithFk = fkOnRelatedModel ? { ...itemToCreate, [fkOnRelatedModel]: newParentId } : itemToCreate;
              await relatedModelClient.withTransaction(executor as TransactionClient).create(createDataWithFk as CreateInput);
            }
          }
          // Handle to-many 'connect'
          if (fieldValue.connect) {
            const itemsToConnect = Array.isArray(fieldValue.connect) ? fieldValue.connect : [fieldValue.connect as Record<string, unknown>];
            for (const itemToConnect of itemsToConnect) {
              if (typeof itemToConnect.id !== 'undefined' && fkOnRelatedModel) {
                await relatedModelClient.withTransaction(executor as TransactionClient).update({
                  where: { id: itemToConnect.id } as WhereUniqueInput,
                  data: { [fkOnRelatedModel]: newParentId } as UpdateInput,
                });
              } else {
                this.logQuery('warn', { message: `Cannot connect item for ${fieldName}: missing id or FK field on related model.` });
              }
            }
          }
          // Handle to-one (FK on other table) 'create' or 'connectOrCreate'
          if (!fieldAst.type.isArray && (fieldValue.create || fieldValue.connectOrCreate)) {
              let relatedRecordDataToCreate: CreateInput | undefined;
              let connectOrCreateWhere: WhereUniqueInput | undefined;

              if (fieldValue.create) {
                  relatedRecordDataToCreate = fieldValue.create as CreateInput;
              } else if (fieldValue.connectOrCreate) {
                  const connectOrCreatePayload = fieldValue.connectOrCreate as { where: WhereUniqueInput, create: CreateInput };
                  connectOrCreateWhere = connectOrCreatePayload.where;
                  const existing = await relatedModelClient.withTransaction(executor as TransactionClient).findUnique({ where: connectOrCreateWhere });
                  if (existing) {
                      if (fkOnRelatedModel && (existing as Record<string,unknown>).id !== undefined) {
                           await relatedModelClient.withTransaction(executor as TransactionClient).update({
                              where: { id: (existing as Record<string,unknown>).id } as WhereUniqueInput,
                              data: { [fkOnRelatedModel]: newParentId } as UpdateInput
                           });
                           this.logQuery('info', { message: `connectOrCreate: Connected existing ${relatedModelName} id ${(existing as Record<string,unknown>).id} to new ${this.tableName} id ${newParentId}` });
                      } else {
                          this.logQuery('warn', { message: `connectOrCreate: Found existing ${relatedModelName} but cannot determine FK or ID to update.` });
                      }
                      continue;
                  }
                  // If existing was not found, or if it was found but the update failed (though we don't check for update failure here)
                  // then we proceed to create. The 'continue' above handles the "found and updated" case.
                  relatedRecordDataToCreate = connectOrCreatePayload.create;
              }

              if (relatedRecordDataToCreate && fkOnRelatedModel) {
                  const dataForRelatedCreate = { ...relatedRecordDataToCreate, [fkOnRelatedModel]: newParentId };
                  this.logQuery('info', { message: `Post-create: Creating related ${relatedModelName} for ${fieldName} with data ${JSON.stringify(dataForRelatedCreate)}` });
                  await relatedModelClient.withTransaction(executor as TransactionClient).create(dataForRelatedCreate as CreateInput);
              } else if (relatedRecordDataToCreate && !fkOnRelatedModel) {
                  this.logQuery('warn', { message: `Post-create: Cannot create related ${relatedModelName} for ${fieldName} as FK on related model could not be determined.` });
              }
          }
        }
      }
      return createdRecord;
    };

    if ((this.db as DatabaseAdapter).transaction) {
      return (this.db as DatabaseAdapter).transaction(txClient => executeCreate(txClient));
    }
    // Already in a transaction or no transaction support on adapter, execute directly
    return executeCreate(this.db as TransactionClient);
  }

  /**
   * Create multiple records
   */
  async createMany(data: CreateInput[]): Promise<{ count: number }> {
    this.logQuery('createMany', { data });

    if (data.length === 0) {
      return { count: 0 };
    }

    const columns = Object.keys(data[0] as Record<string, unknown>).join(', ');
    const queries = [];

    for (const item of data) {
      const placeholders = Object.keys(item as Record<string, unknown>)
        .map((_, i) => `$${i + 1}`)
        .join(', ');
      const values = Object.values(item as Record<string, unknown>);

      queries.push({
        query: `
          INSERT INTO ${this.tableName} (${columns})
          VALUES (${placeholders})
        `,
        params: values
      });
    }

    const currentDb = this.db as DatabaseAdapter;
    if (!currentDb.batch) {
        this.logQuery('error', { message: 'Batch operation not supported by the current DB adapter/transaction client.' });
        throw new Error('Batch operation not supported.');
    }
    const results = await currentDb.batch(queries);
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
    
    const whereClause = this.buildWhereClause(where as Record<string, unknown>);
    const values = [...this.whereValues];

    const query = `
      SELECT * FROM ${this.tableName}
      WHERE ${whereClause}
      LIMIT 1
    `;

    const result = await (this.db as DatabaseAdapter).execute<T>(query, values); // Assuming find operations don't need to be part of an outer transaction context by default
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
    let values: unknown[] = [];

    // Reset the whereValues before building the where clause
    this.whereValues = [];
    
    if (where) {
      whereClause = `WHERE ${this.buildWhereClause(where as Record<string, unknown>)}`;
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

    const result = await (this.db as DatabaseAdapter).execute<T>(query, values);
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
    let values: unknown[] = [];

    // Reset the whereValues before building the where clause
    this.whereValues = [];
    
    if (where) {
      whereClause = `WHERE ${this.buildWhereClause(where as Record<string, unknown>)}`;
      values = [...this.whereValues];
    }

    const orderByClause = this.buildOrderByClause(orderBy);
    const skipClause = skip ? `OFFSET ${skip}` : '';
    const takeClause = take ? `LIMIT ${take}` : '';

    // Handle cursor-based pagination
    if (cursor) {
      const cursorField = Object.keys(cursor)[0];
      const cursorValue = (cursor as Record<string, unknown>)[cursorField];

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

    const result = await (this.db as DatabaseAdapter).execute<T>(query, values);
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

    const executeUpdate = async (executor: DatabaseAdapter | TransactionClient) => {
      const { where, data } = args;
      const updateDataPayload: Record<string, unknown> = { ... (data as Record<string, unknown>) }; // Clone

      for (const fieldAst of this.modelAst.fields) {
        const fieldName = fieldAst.name;
        const fieldValue = updateDataPayload[fieldName] as Record<string, unknown> | undefined;

        if (fieldValue === null && fieldAst.attributes.some(attr => attr.name === 'relation')) {
          // Handle case: author: null
          const relationAttribute = fieldAst.attributes.find(attr => attr.name === 'relation');
          if (relationAttribute?.args?.fields && relationAttribute.args.fields.length > 0) {
            const fkFieldName = relationAttribute.args.fields[0];
            updateDataPayload[fkFieldName] = null;
            delete updateDataPayload[fieldName];
            this.logQuery('info', { message: `Processed direct null for relation ${fieldName}, setting ${fkFieldName}=null` });
          }
        } else if (fieldValue && typeof fieldValue === 'object' && !Array.isArray(fieldValue)) {
          const relationAttribute = fieldAst.attributes.find(attr => attr.name === 'relation');
          if (!relationAttribute) continue;

          const fkOnThisModel = relationAttribute.args?.fields && relationAttribute.args.fields.length > 0;
          if (fkOnThisModel) {
            const fkFieldName = relationAttribute.args.fields[0];

            if (fieldValue.connect) {
              const connectValue = fieldValue.connect as Record<string, unknown>;
              if (typeof connectValue.id !== 'undefined') {
                updateDataPayload[fkFieldName] = connectValue.id;
                delete updateDataPayload[fieldName];
                this.logQuery('info', { message: `Processed connect for ${fieldName} in update, setting ${fkFieldName}=${connectValue.id}` });
              } else {
                this.logQuery('warn', { message: `Update connect operation for ${fieldName} is missing an id.` });
              }
            } else if (fieldValue.create) {
              const relatedModelName = fieldAst.type.name;
              const relatedModelClientKey = relatedModelName.charAt(0).toLowerCase() + relatedModelName.slice(1);
              const relatedModelClient = this.client[relatedModelClientKey] as BaseModelClient<unknown, CreateInput, UpdateInput, WhereInput, WhereUniqueInput, OrderByInput, SelectInput, IncludeInput>;

              if (relatedModelClient) {
                this.logQuery('info', { message: `Processing nested create for ${fieldName} in update (related model: ${relatedModelName})` });
                const relatedClientInTx = relatedModelClient.withTransaction(executor as TransactionClient);
                const createdRelatedRecord = await relatedClientInTx.create(fieldValue.create as CreateInput);
                
                if (createdRelatedRecord && typeof (createdRelatedRecord as Record<string, unknown>).id !== 'undefined') {
                  updateDataPayload[fkFieldName] = (createdRelatedRecord as Record<string, unknown>).id;
                  delete updateDataPayload[fieldName];
                  this.logQuery('info', { message: `Processed nested create for ${fieldName} in update, created ${relatedModelName} with id ${(createdRelatedRecord as Record<string, unknown>).id}, setting ${fkFieldName}=${(createdRelatedRecord as Record<string, unknown>).id}` });
                } else {
                  delete updateDataPayload[fieldName];
                  this.logQuery('warn', { message: `Nested create for ${fieldName} in update (related model: ${relatedModelName}) did not return an id. Field ${fieldName} removed.` });
                }
              } else {
                this.logQuery('warn', { message: `Could not find related model client for ${relatedModelName} (key: ${relatedModelClientKey}) for update create operation.` });
                delete updateDataPayload[fieldName];
              }
            } else if (fieldValue.disconnect === true) {
              updateDataPayload[fkFieldName] = null;
              delete updateDataPayload[fieldName];
              this.logQuery('info', { message: `Processed disconnect for ${fieldName} in update, setting ${fkFieldName}=null` });
            }
            // Other nested ops for to-one (update, upsert, delete) are out of scope for this subtask
          } else if (fieldAst.type.isArray) { // To-Many relation
            const parentId = (args.where as { id?: unknown }).id;
            if (parentId === undefined) {
              this.logQuery('warn', { message: `Parent ID not found in where clause for to-many operation on field ${fieldName}. Skipping.` });
              delete updateDataPayload[fieldName];
              continue;
            }

            const relatedModelName = fieldAst.type.name;
            const relatedModelClientKey = relatedModelName.charAt(0).toLowerCase() + relatedModelName.slice(1);
            const relatedModelClient = this.client[relatedModelClientKey] as BaseModelClient<unknown, CreateInput, UpdateInput, WhereInput, WhereUniqueInput, OrderByInput, SelectInput, IncludeInput>;

            if (!relatedModelClient) {
              this.logQuery('warn', { message: `Could not find related model client for ${relatedModelName} (key: ${relatedModelClientKey}) for to-many operation on ${fieldName}.` });
              delete updateDataPayload[fieldName];
              continue;
            }
            
            let fkOnRelatedModel: string | undefined;
            const currentModelName = this.modelAst.name;
            const parentRelationAttribute = fieldAst.attributes.find(attr => attr.name === 'relation');
            const parentRelationName = parentRelationAttribute?.args?.name;

            const relatedModelAst: PslModelAst | undefined = relatedModelClient?.modelAst;
            if (relatedModelAst) {
              for (const relatedFieldAst of relatedModelAst.fields) {
                if (relatedFieldAst.type.name === currentModelName) {
                  const childRelationAttribute = relatedFieldAst.attributes.find(attr => attr.name === 'relation');
                  const childRelationName = childRelationAttribute?.args?.name;
                  if (parentRelationName && childRelationName && parentRelationName !== childRelationName) {
                    continue;
                  }
                  if (childRelationAttribute?.args?.fields && childRelationAttribute.args.fields.length > 0) {
                    fkOnRelatedModel = childRelationAttribute.args.fields[0];
                    this.logQuery('info', { message: `Determined FK on related model ${relatedModelName} for field ${fieldName} to be ${fkOnRelatedModel} via relation ${childRelationName || 'implicit'}` });
                    break;
                  }
                }
              }
            }

            if (!fkOnRelatedModel) {
              fkOnRelatedModel = `${currentModelName.charAt(0).toLowerCase() + currentModelName.slice(1)}Id`;
              this.logQuery('warn', { message: `Could not robustly determine FK on ${relatedModelName} for relation ${fieldName}. Falling back to heuristic: ${fkOnRelatedModel}.` });
            }

            const fieldValueCreate = fieldValue.create as CreateInput[] | CreateInput | undefined;
            if (fieldValueCreate) {
              const itemsToCreate = Array.isArray(fieldValueCreate) ? fieldValueCreate : [fieldValueCreate];
              for (const itemToCreate of itemsToCreate) {
                const createData = { ...itemToCreate, [fkOnRelatedModel as string]: parentId };
                this.logQuery('info', { message: `Processing to-many create for ${fieldName}: creating ${relatedModelName} with data ${JSON.stringify(createData)}` });
                await relatedModelClient.withTransaction(executor as TransactionClient).create(createData as CreateInput);
              }
              delete updateDataPayload[fieldName];
            }

            const fieldValueConnect = fieldValue.connect as Array<{id: unknown}> | {id: unknown} | undefined;
            if (fieldValueConnect) {
              const itemsToConnect = Array.isArray(fieldValueConnect) ? fieldValueConnect : [fieldValueConnect];
              for (const itemToConnect of itemsToConnect) {
                if (typeof itemToConnect.id !== 'undefined' && fkOnRelatedModel) {
                  this.logQuery('info', { message: `Processing to-many connect for ${fieldName}: connecting ${relatedModelName} id ${itemToConnect.id} by setting ${fkOnRelatedModel}=${parentId}` });
                  await relatedModelClient.withTransaction(executor as TransactionClient).update({
                    where: { id: itemToConnect.id } as WhereUniqueInput,
                    data: { [fkOnRelatedModel]: parentId } as UpdateInput,
                  });
                }
              }
              delete updateDataPayload[fieldName];
            }
            
            const fieldValueDisconnect = fieldValue.disconnect as Array<{id: unknown}> | {id: unknown} | undefined;
            if (fieldValueDisconnect) {
              const itemsToDisconnect = Array.isArray(fieldValueDisconnect) ? fieldValueDisconnect : [fieldValueDisconnect];
              for (const itemToDisconnect of itemsToDisconnect) {
                if (typeof itemToDisconnect.id !== 'undefined' && fkOnRelatedModel) {
                  this.logQuery('info', { message: `Processing to-many disconnect for ${fieldName}: disconnecting ${relatedModelName} id ${itemToDisconnect.id} by setting ${fkOnRelatedModel}=null` });
                  await relatedModelClient.withTransaction(executor as TransactionClient).update({
                    where: { id: itemToDisconnect.id } as WhereUniqueInput,
                    data: { [fkOnRelatedModel]: null } as UpdateInput,
                  });
                }
              }
              delete updateDataPayload[fieldName];
            }

            const fieldValueDelete = fieldValue.delete as Array<{id: unknown}> | {id: unknown} | undefined;
            if (fieldValueDelete) {
               const itemsToDelete = Array.isArray(fieldValueDelete) ? fieldValueDelete : [fieldValueDelete];
              for (const itemToDelete of itemsToDelete) {
                if (typeof itemToDelete.id !== 'undefined') {
                  this.logQuery('info', { message: `Processing to-many delete for ${fieldName}: deleting ${relatedModelName} id ${itemToDelete.id}` });
                  await relatedModelClient.withTransaction(executor as TransactionClient).delete({
                    where: { id: itemToDelete.id } as WhereUniqueInput,
                  });
                }
              }
              delete updateDataPayload[fieldName];
            }
            
            const fieldValueUpdateMany = fieldValue.updateMany as Array<{where: WhereInput, data: UpdateInput}> | {where: WhereInput, data: UpdateInput} | undefined;
            if (fieldValueUpdateMany) {
              const opsToUpdateMany = Array.isArray(fieldValueUpdateMany) ? fieldValueUpdateMany : [fieldValueUpdateMany];
              for (const op of opsToUpdateMany) {
                if (op.where && op.data && fkOnRelatedModel) {
                  const finalNestedWhere = { ...(op.where as Record<string, unknown>), [fkOnRelatedModel]: parentId };
                  this.logQuery('info', { message: `Processing to-many updateMany for ${fieldName}: updating ${relatedModelName} with where ${JSON.stringify(finalNestedWhere)} and data ${JSON.stringify(op.data)}` });
                  await relatedModelClient.withTransaction(executor as TransactionClient).updateMany({
                    where: finalNestedWhere as WhereInput,
                    data: op.data,
                  });
                }
              }
              delete updateDataPayload[fieldName];
            }

            const fieldValueDeleteMany = fieldValue.deleteMany as Array<WhereInput> | WhereInput | undefined;
            if (fieldValueDeleteMany) {
              let conditions = fieldValueDeleteMany;
              if (!Array.isArray(conditions)) {
                conditions = [conditions];
              }
              for (const condition of conditions) {
                if (typeof condition === 'object' && condition !== null && fkOnRelatedModel) {
                  const finalNestedWhere = { ...(condition as Record<string, unknown>), [fkOnRelatedModel]: parentId };
                  this.logQuery('info', { message: `Processing to-many deleteMany for ${fieldName}: deleting ${relatedModelName} with where ${JSON.stringify(finalNestedWhere)}` });
                  await relatedModelClient.withTransaction(executor as TransactionClient).deleteMany({
                    where: finalNestedWhere as WhereInput,
                  });
                }
              }
              delete updateDataPayload[fieldName];
            }
          }
        }
      }
      
      const finalUpdateData = Object.fromEntries(
        Object.entries(updateDataPayload)
          .filter(([_, v]) => typeof v !== 'object' || v === null)
      );

      if (Object.keys(finalUpdateData).length === 0) {
        this.logQuery('info', { message: 'Update operation resulted in no direct scalar fields to update. Fetching current record.' });
        // If no actual fields to update (e.g. only trying to operate on relations not resulting in FK changes on this model),
        // we should still fetch and return the record based on 'where'.
        // However, the current method signature expects an update.
        // For now, we will proceed, which might lead to an empty SET clause if not careful.
        // A more robust solution might throw an error or return early if finalUpdateData is empty.
        // For this subtask, let's assume an update will usually have some scalar changes or valid FK changes.
        // If finalUpdateData is empty, the SQL construction below will likely be invalid.
        // Let's ensure setClause is not empty.
        if (Object.keys(finalUpdateData).length === 0) {
             // Re-fetch and return if no data to update. This matches Prisma behavior somewhat.
            const existingRecord = await executor.execute<T>(`SELECT * FROM ${this.tableName} WHERE ${this.buildWhereClause(where as Record<string, unknown>)} LIMIT 1`, [...this.whereValues]);
            if(existingRecord.data.length === 0) throw new Error(`Record not found for update: ${JSON.stringify(where)}`);
            return existingRecord.data[0];
        }
      }

      const whereClause = this.buildWhereClause(where as Record<string, unknown>);
      const whereValuesParams = [...this.whereValues]; // Capture whereValues after buildWhereClause

      let paramIndex = 1;
      const setParts: string[] = [];
      const setValues: unknown[] = [];

      for (const [key, value] of Object.entries(finalUpdateData)) {
        setParts.push(`${key} = $${paramIndex++}`);
        setValues.push(value);
      }
      const setClause = setParts.join(', ');
      
      const allValues = [...setValues, ...whereValuesParams];

      const query = `
        UPDATE ${this.tableName}
        SET ${setClause}
        WHERE ${whereClause}
        RETURNING *
      `;

      const updateResult = await executor.execute<T>(query, allValues); // Renamed to avoid conflict

      if (updateResult.data.length === 0) {
        throw new Error(`Record not found for update: ${JSON.stringify(where)}`);
      }
      return updateResult.data[0];
    };

    if ((this.db as DatabaseAdapter).transaction) {
      return (this.db as DatabaseAdapter).transaction(txClient => executeUpdate(txClient));
    }
    // This else clause can be omitted because previous branches break early.
    return executeUpdate(this.db as TransactionClient);
    // The 'return result.data[0]' was unreachable and 'result' was not defined in this scope.
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
    let whereValues: unknown[] = [];

    // Reset the whereValues before building the where clause
    this.whereValues = [];
    
    if (where) {
      whereClause = `WHERE ${this.buildWhereClause(where as Record<string, unknown>)}`;
      whereValues = [...this.whereValues];
    }

    const setClause = Object.keys(data as Record<string, unknown>)
      .map((key, i) => `${key} = $${i + 1}`)
      .join(', ');

    const values = [
      ...Object.values(data as Record<string, unknown>),
      ...whereValues
    ];

    const query = `
      UPDATE ${this.tableName}
      SET ${setClause}
      ${whereClause}
    `;
    // TODO: Wrap updateMany in transaction similar to create if nested writes are needed for updateMany
    const result = await (this.db as DatabaseAdapter).execute(query, values);
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
    const whereClause = this.buildWhereClause(where as Record<string, unknown>);
    const values = Object.values(where as Record<string, unknown>);

    const query = `
      DELETE FROM ${this.tableName}
      WHERE ${whereClause}
      RETURNING *
    `;
    // TODO: Wrap delete in transaction similar to create if nested writes are needed (e.g. cascading deletes managed by client)
    const result = await (this.db as DatabaseAdapter).execute<T>(query, values);

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
    let values: unknown[] = [];

    // Reset the whereValues before building the where clause
    this.whereValues = [];
    
    if (where) {
      whereClause = `WHERE ${this.buildWhereClause(where as Record<string, unknown>)}`;
      values = [...this.whereValues];
    }

    const query = `
      DELETE FROM ${this.tableName}
      ${whereClause}
    `;
    // TODO: Wrap deleteMany in transaction similar to create
    const result = await (this.db as DatabaseAdapter).execute(query, values);
    return { count: result.data.length };
  }

  /**
   * Count the number of records that match the filter
   */
  async count(args: { where?: WhereInput } = {}): Promise<number> {
    this.logQuery('count', args);

    const { where } = args;
    let whereClause = '';
    let values: unknown[] = [];

    // Reset the whereValues before building the where clause
    this.whereValues = [];
    
    if (where) {
      whereClause = `WHERE ${this.buildWhereClause(where as Record<string, unknown>)}`;
      values = [...this.whereValues];
    }

    const query = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      ${whereClause}
    `;

    const result = await (this.db as DatabaseAdapter).execute<{ count: number }>(query, values);
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
  protected buildWhereClause(filter: Record<string, unknown>): string {
    // const conditions: string[] = []; // Not used directly here
    // const values: unknown[] = []; // Not used directly here

    // Helper function to handle nested conditions recursively
    const processFilter = (currentFilter: Record<string, unknown>, parentKey = ''): { condition: string; values: unknown[] } => {
      const conditions: string[] = [];
      const localValues: unknown[] = []; // Renamed to avoid conflict with this.whereValues

      for (const [key, value] of Object.entries(currentFilter)) {
        // Skip undefined values
        if (value === undefined) continue;

        // Handle logical operators (AND, OR)
        if (key === 'AND' || key === 'OR') {
          if (Array.isArray(value) && value.length > 0) {
            const nestedConditions = value.map(condition => {
              const result = processFilter(condition as Record<string, unknown>);
              localValues.push(...result.values);
              return `(${result.condition})`;
            });
            conditions.push(`(${nestedConditions.join(` ${key} `)})`);
          }
          continue;
        }

        // Handle NOT operator
        if (key === 'NOT') {
          const result = processFilter(value as Record<string, unknown>);
          localValues.push(...result.values);
          conditions.push(`NOT (${result.condition})`);
          continue;
        }

        // Handle regular field conditions or nested operators
        const fieldName = parentKey ? `${parentKey}.${key}` : key;
        
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
          // Handle nested operators for a field
          for (const [op, opValue] of Object.entries(value as Record<string, unknown>)) {
            // Skip undefined values
            if (opValue === undefined) continue;

            switch (op) {
              case 'equals':
                localValues.push(opValue);
                conditions.push(`${fieldName} = $${localValues.length}`);
                break;
              case 'not':
                if (opValue === null) {
                  conditions.push(`${fieldName} IS NOT NULL`);
                } else {
                  localValues.push(opValue);
                  conditions.push(`${fieldName} <> $${localValues.length}`);
                }
                break;
              case 'contains':
                localValues.push(`%${opValue}%`);
                conditions.push(`${fieldName} LIKE $${localValues.length}`);
                break;
              case 'startsWith':
                localValues.push(`${opValue}%`);
                conditions.push(`${fieldName} LIKE $${localValues.length}`);
                break;
              case 'endsWith':
                localValues.push(`%${opValue}`);
                conditions.push(`${fieldName} LIKE $${localValues.length}`);
                break;
              case 'gt':
                localValues.push(opValue);
                conditions.push(`${fieldName} > $${localValues.length}`);
                break;
              case 'gte':
                localValues.push(opValue);
                conditions.push(`${fieldName} >= $${localValues.length}`);
                break;
              case 'lt':
                localValues.push(opValue);
                conditions.push(`${fieldName} < $${localValues.length}`);
                break;
              case 'lte':
                localValues.push(opValue);
                conditions.push(`${fieldName} <= $${localValues.length}`);
                break;
              case 'in':
                if (Array.isArray(opValue) && opValue.length > 0) {
                  const placeholders = opValue.map((_, i) => `$${localValues.length + i + 1}`).join(', ');
                  localValues.push(...opValue);
                  conditions.push(`${fieldName} IN (${placeholders})`);
                } else if (Array.isArray(opValue) && opValue.length === 0) {
                  // Empty IN clause should match nothing
                  conditions.push('1 = 0');
                }
                break;
              case 'notIn':
                if (Array.isArray(opValue) && opValue.length > 0) {
                  const placeholders = opValue.map((_, i) => `$${localValues.length + i + 1}`).join(', ');
                  localValues.push(...opValue);
                  conditions.push(`${fieldName} NOT IN (${placeholders})`);
                } else if (Array.isArray(opValue) && opValue.length === 0) {
                  // Empty NOT IN clause should match everything
                  conditions.push('1 = 1');
                }
                break;
              default:
                // Handle nested objects
                if (opValue !== null && typeof opValue === 'object') {
                  const nestedResult = processFilter({ [op]: opValue as Record<string, unknown> }, fieldName);
                  conditions.push(nestedResult.condition);
                  localValues.push(...nestedResult.values);
                }
            }
          }
        } else if (value === null) {
          // Handle null values
          conditions.push(`${fieldName} IS NULL`);
        } else {
          // Handle simple equality
          localValues.push(value);
          conditions.push(`${fieldName} = $${localValues.length}`);
        }
      }

      return {
        condition: conditions.join(' AND '),
        values: localValues,
      };
    };

    const result = processFilter(filter);
    
    // Store the processed values in the class scope for query execution
    this.whereValues = result.values;
    
    return result.condition || '1=1'; // Ensure a valid condition string is always returned
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
  protected logQuery(operation: string, args: Record<string, unknown>): void { // Changed 'any' to 'Record<string, unknown>'
    if (this.debug || this.log.includes('query')) {
      console.log(`[${this.tableName}] ${operation}:`, args);
    }
  }
}
