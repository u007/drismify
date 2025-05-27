
import { DatabaseAdapter, TransactionClient } from '../../../src/adapters';
import { BaseModelClient } from '../../../src/client/model-client';
import { PslModelAst } from '../index';
import {
  User,
  UserCreateInput,
  UserUpdateInput,
  UserWhereInput,
  UserWhereUniqueInput,
  UserOrderByInput,
  UserSelectInput,
  UserIncludeInput
} from '../types';

/**
 * User model client
 */
export class User extends BaseModelClient<
  User,
  UserCreateInput,
  UserUpdateInput,
  UserWhereInput,
  UserWhereUniqueInput,
  UserOrderByInput,
  UserSelectInput,
  UserIncludeInput
> {
  constructor(
    client: any, // Main DrismifyClient instance
    modelAst: PslModelAst,
    // tableName is passed from PrismaClient to super as 'user'
    debug: boolean = false,
    log: ('query' | 'info' | 'warn' | 'error')[] = [],
    dbInstance?: DatabaseAdapter | TransactionClient // Optional: for transactions
  ) {
    super(client, modelAst, 'user', debug, log, dbInstance);
  }
}
