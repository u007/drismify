
import { DatabaseAdapter, TransactionClient } from '../../src/adapters';
import { BaseModelClient } from '../../src/client/model-client';
import { PslModelAst } from '../index';
import {
  UserRole,
  UserRoleCreateInput,
  UserRoleUpdateInput,
  UserRoleWhereInput,
  UserRoleWhereUniqueInput,
  UserRoleOrderByInput,
  UserRoleSelectInput,
  UserRoleIncludeInput
} from '../types';

/**
 * UserRole model client
 */
export class UserRole extends BaseModelClient<
  UserRole,
  UserRoleCreateInput,
  UserRoleUpdateInput,
  UserRoleWhereInput,
  UserRoleWhereUniqueInput,
  UserRoleOrderByInput,
  UserRoleSelectInput,
  UserRoleIncludeInput
> {
  constructor(
    client: any, // Main DrismifyClient instance
    modelAst: PslModelAst,
    // tableName is passed from PrismaClient to super as 'user_role'
    debug: boolean = false,
    log: ('query' | 'info' | 'warn' | 'error')[] = [],
    dbInstance?: DatabaseAdapter | TransactionClient // Optional: for transactions
  ) {
    super(client, modelAst, 'user_role', debug, log, dbInstance);
  }
}
