
import { DatabaseAdapter, TransactionClient } from '../../src/adapters';
import { BaseModelClient } from '../../src/client/model-client';
import { PslModelAst } from '../index';
import {
  Permission,
  PermissionCreateInput,
  PermissionUpdateInput,
  PermissionWhereInput,
  PermissionWhereUniqueInput,
  PermissionOrderByInput,
  PermissionSelectInput,
  PermissionIncludeInput
} from '../types';

/**
 * Permission model client
 */
export class Permission extends BaseModelClient<
  Permission,
  PermissionCreateInput,
  PermissionUpdateInput,
  PermissionWhereInput,
  PermissionWhereUniqueInput,
  PermissionOrderByInput,
  PermissionSelectInput,
  PermissionIncludeInput
> {
  constructor(
    client: any, // Main DrismifyClient instance
    modelAst: PslModelAst,
    // tableName is passed from PrismaClient to super as 'permission'
    debug: boolean = false,
    log: ('query' | 'info' | 'warn' | 'error')[] = [],
    dbInstance?: DatabaseAdapter | TransactionClient // Optional: for transactions
  ) {
    super(client, modelAst, 'permission', debug, log, dbInstance);
  }
}
