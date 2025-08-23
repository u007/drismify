
import { DatabaseAdapter, TransactionClient } from '../../src/adapters';
import { BaseModelClient } from '../../src/client/model-client';
import { PslModelAst } from '../index';
import {
  Role,
  RoleCreateInput,
  RoleUpdateInput,
  RoleWhereInput,
  RoleWhereUniqueInput,
  RoleOrderByInput,
  RoleSelectInput,
  RoleIncludeInput
} from '../types';

/**
 * Role model client
 */
export class Role extends BaseModelClient<
  Role,
  RoleCreateInput,
  RoleUpdateInput,
  RoleWhereInput,
  RoleWhereUniqueInput,
  RoleOrderByInput,
  RoleSelectInput,
  RoleIncludeInput
> {
  constructor(
    client: any, // Main DrismifyClient instance
    modelAst: PslModelAst,
    // tableName is passed from PrismaClient to super as 'role'
    debug: boolean = false,
    log: ('query' | 'info' | 'warn' | 'error')[] = [],
    dbInstance?: DatabaseAdapter | TransactionClient // Optional: for transactions
  ) {
    super(client, modelAst, 'role', debug, log, dbInstance);
  }
}
