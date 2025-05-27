
import { DatabaseAdapter, TransactionClient } from '../../../src/adapters';
import { BaseModelClient } from '../../../src/client/model-client';
import { PslModelAst } from '../index';
import {
  Profile,
  ProfileCreateInput,
  ProfileUpdateInput,
  ProfileWhereInput,
  ProfileWhereUniqueInput,
  ProfileOrderByInput,
  ProfileSelectInput,
  ProfileIncludeInput
} from '../types';

/**
 * Profile model client
 */
export class Profile extends BaseModelClient<
  Profile,
  ProfileCreateInput,
  ProfileUpdateInput,
  ProfileWhereInput,
  ProfileWhereUniqueInput,
  ProfileOrderByInput,
  ProfileSelectInput,
  ProfileIncludeInput
> {
  constructor(
    client: any, // Main DrismifyClient instance
    modelAst: PslModelAst,
    // tableName is passed from PrismaClient to super as 'profile'
    debug: boolean = false,
    log: ('query' | 'info' | 'warn' | 'error')[] = [],
    dbInstance?: DatabaseAdapter | TransactionClient // Optional: for transactions
  ) {
    super(client, modelAst, 'profile', debug, log, dbInstance);
  }
}
