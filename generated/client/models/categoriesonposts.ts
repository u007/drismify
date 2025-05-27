
import { DatabaseAdapter, TransactionClient } from '../../../src/adapters';
import { BaseModelClient } from '../../../src/client/model-client';
import { PslModelAst } from '../index';
import {
  CategoriesOnPosts,
  CategoriesOnPostsCreateInput,
  CategoriesOnPostsUpdateInput,
  CategoriesOnPostsWhereInput,
  CategoriesOnPostsWhereUniqueInput,
  CategoriesOnPostsOrderByInput,
  CategoriesOnPostsSelectInput,
  CategoriesOnPostsIncludeInput
} from '../types';

/**
 * CategoriesOnPosts model client
 */
export class CategoriesOnPosts extends BaseModelClient<
  CategoriesOnPosts,
  CategoriesOnPostsCreateInput,
  CategoriesOnPostsUpdateInput,
  CategoriesOnPostsWhereInput,
  CategoriesOnPostsWhereUniqueInput,
  CategoriesOnPostsOrderByInput,
  CategoriesOnPostsSelectInput,
  CategoriesOnPostsIncludeInput
> {
  constructor(
    client: any, // Main DrismifyClient instance
    modelAst: PslModelAst,
    // tableName is passed from PrismaClient to super as 'categories_on_posts'
    debug: boolean = false,
    log: ('query' | 'info' | 'warn' | 'error')[] = [],
    dbInstance?: DatabaseAdapter | TransactionClient // Optional: for transactions
  ) {
    super(client, modelAst, 'categories_on_posts', debug, log, dbInstance);
  }
}
