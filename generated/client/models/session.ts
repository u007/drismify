
import { DatabaseAdapter, TransactionClient } from '../../src/adapters';
import { BaseModelClient } from '../../src/client/model-client';
import { PslModelAst } from '../index';
import {
  Session,
  SessionCreateInput,
  SessionUpdateInput,
  SessionWhereInput,
  SessionWhereUniqueInput,
  SessionOrderByInput,
  SessionSelectInput,
  SessionIncludeInput
} from '../types';

/**
 * Session model client
 */
export class Session extends BaseModelClient<
  Session,
  SessionCreateInput,
  SessionUpdateInput,
  SessionWhereInput,
  SessionWhereUniqueInput,
  SessionOrderByInput,
  SessionSelectInput,
  SessionIncludeInput
> {
  constructor(
    client: any, // Main DrismifyClient instance
    modelAst: PslModelAst,
    // tableName is passed from PrismaClient to super as 'session'
    debug: boolean = false,
    log: ('query' | 'info' | 'warn' | 'error')[] = [],
    dbInstance?: DatabaseAdapter | TransactionClient // Optional: for transactions
  ) {
    super(client, modelAst, 'session', debug, log, dbInstance);
  }
}
