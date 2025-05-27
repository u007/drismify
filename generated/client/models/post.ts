
import { DatabaseAdapter, TransactionClient } from '../../../src/adapters';
import { BaseModelClient } from '../../../src/client/model-client';
import { PslModelAst } from '../index';
import {
  Post,
  PostCreateInput,
  PostUpdateInput,
  PostWhereInput,
  PostWhereUniqueInput,
  PostOrderByInput,
  PostSelectInput,
  PostIncludeInput
} from '../types';

/**
 * Post model client
 */
export class Post extends BaseModelClient<
  Post,
  PostCreateInput,
  PostUpdateInput,
  PostWhereInput,
  PostWhereUniqueInput,
  PostOrderByInput,
  PostSelectInput,
  PostIncludeInput
> {
  constructor(
    client: any, // Main DrismifyClient instance
    modelAst: PslModelAst,
    // tableName is passed from PrismaClient to super as 'post'
    debug: boolean = false,
    log: ('query' | 'info' | 'warn' | 'error')[] = [],
    dbInstance?: DatabaseAdapter | TransactionClient // Optional: for transactions
  ) {
    super(client, modelAst, 'post', debug, log, dbInstance);
  }
}
