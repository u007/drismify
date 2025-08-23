
import { DatabaseAdapter, TransactionClient } from '../../src/adapters';
import { BaseModelClient } from '../../src/client/model-client';
import { PslModelAst } from '../index';
import {
  RolePermission,
  RolePermissionCreateInput,
  RolePermissionUpdateInput,
  RolePermissionWhereInput,
  RolePermissionWhereUniqueInput,
  RolePermissionOrderByInput,
  RolePermissionSelectInput,
  RolePermissionIncludeInput
} from '../types';

/**
 * RolePermission model client
 */
export class RolePermission extends BaseModelClient<
  RolePermission,
  RolePermissionCreateInput,
  RolePermissionUpdateInput,
  RolePermissionWhereInput,
  RolePermissionWhereUniqueInput,
  RolePermissionOrderByInput,
  RolePermissionSelectInput,
  RolePermissionIncludeInput
> {
  constructor(
    client: any, // Main DrismifyClient instance
    modelAst: PslModelAst,
    // tableName is passed from PrismaClient to super as 'role_permission'
    debug: boolean = false,
    log: ('query' | 'info' | 'warn' | 'error')[] = [],
    dbInstance?: DatabaseAdapter | TransactionClient // Optional: for transactions
  ) {
    super(client, modelAst, 'role_permission', debug, log, dbInstance);
  }
}
