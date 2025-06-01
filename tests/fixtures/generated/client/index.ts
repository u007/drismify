
import { DrismifyClient, Drismify } from '../../src/client/base-client';
import { ClientOptions } from '../../src/client/types';
import { User } from './models/user';
import { Post } from './models/post';


/**
 * Drismify Client
 * Generated client for interacting with the database
 */
export class PrismaClient extends DrismifyClient {
  public readonly user: User;
  public readonly post: Post;
  

  constructor(options: ClientOptions = { datasources: { db: {} } }) {
    super(options);

    this.user = new User(this, {"type":"model","name":"User","fields":[{"name":"id","type":{"name":"Int","optional":false,"isArray":false},"attributes":[{"name":"id","args":null},{"name":"default","args":{"function":"autoincrement","args":[]}}]},{"name":"email","type":{"name":"String","optional":false,"isArray":false},"attributes":[{"name":"unique","args":null}]},{"name":"name","type":{"name":"String","optional":true,"isArray":false},"attributes":[]},{"name":"createdAt","type":{"name":"DateTime","optional":false,"isArray":false},"attributes":[{"name":"default","args":{"function":"now","args":[]}}]},{"name":"posts","type":{"name":"Post","optional":false,"isArray":true},"attributes":[]}],"attributes":[]}, 'user', this.options.debug || false, this.options.log || []);
    this.post = new Post(this, {"type":"model","name":"Post","fields":[{"name":"id","type":{"name":"Int","optional":false,"isArray":false},"attributes":[{"name":"id","args":null},{"name":"default","args":{"function":"autoincrement","args":[]}}]},{"name":"title","type":{"name":"String","optional":false,"isArray":false},"attributes":[]},{"name":"content","type":{"name":"String","optional":true,"isArray":false},"attributes":[]},{"name":"published","type":{"name":"Boolean","optional":false,"isArray":false},"attributes":[{"name":"default","args":null}]},{"name":"author","type":{"name":"User","optional":false,"isArray":false},"attributes":[{"name":"relation","args":{"fields":["authorId"],"references":["id"]}}]},{"name":"authorId","type":{"name":"Int","optional":false,"isArray":false},"attributes":[]}],"attributes":[]}, 'post', this.options.debug || false, this.options.log || []);
    
  }
}

export { User, Post, Drismify };
export * from './types';
