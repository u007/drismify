
import { DatabaseAdapter, TransactionClient } from '../../../src/adapters';
import { BaseModelClient } from '../../../src/client/model-client';
import { PslModelAst } from '../index';
import {
  Category,
  CategoryCreateInput,
  CategoryUpdateInput,
  CategoryWhereInput,
  CategoryWhereUniqueInput,
  CategoryOrderByInput,
  CategorySelectInput,
  CategoryIncludeInput
} from '../types';

/**
 * Category model client
 */
export class Category extends BaseModelClient<
  Category,
  CategoryCreateInput,
  CategoryUpdateInput,
  CategoryWhereInput,
  CategoryWhereUniqueInput,
  CategoryOrderByInput,
  CategorySelectInput,
  CategoryIncludeInput
> {
  constructor(
    client: any, // Main DrismifyClient instance
    modelAst: PslModelAst,
    // tableName is passed from PrismaClient to super as 'category'
    debug: boolean = false,
    log: ('query' | 'info' | 'warn' | 'error')[] = [],
    dbInstance?: DatabaseAdapter | TransactionClient // Optional: for transactions
  ) {
    super(client, modelAst, 'category', debug, log, dbInstance);
  }
}
