
import { DrismifyClient, Drismify } from '../../src/client/base-client';
import type { ClientOptions } from '../../src/client/types';
import { User } from './models/user';
import { Profile } from './models/profile';
import { Post } from './models/post';
import { Category } from './models/category';
import { CategoriesOnPosts } from './models/categoriesonposts';

/**
 * Drismify Client
 * Generated client for interacting with the database
 */
export class PrismaClient extends DrismifyClient {
  public readonly user: User;
  public readonly profile: Profile;
  public readonly post: Post;
  public readonly category: Category;
  public readonly categoriesOnPosts: CategoriesOnPosts;

  constructor(options: ClientOptions = { datasources: { db: {} } }) {
    super(options);

    this.user = new User(this, {"type":"model","name":"User","fields":[{"name":"id","type":{"name":"Int","optional":false,"isArray":false},"attributes":[{"name":"id","args":null},{"name":"default","args":{"function":"autoincrement","args":[]}}]},{"name":"email","type":{"name":"String","optional":false,"isArray":false},"attributes":[{"name":"unique","args":null}]},{"name":"name","type":{"name":"String","optional":true,"isArray":false},"attributes":[]},{"name":"profile","type":{"name":"Profile","optional":true,"isArray":false},"attributes":[]},{"name":"posts","type":{"name":"Post","optional":false,"isArray":true},"attributes":[]}],"attributes":[]}, 'user', this.options.debug || false, this.options.log || []);
    this.profile = new Profile(this, {"type":"model","name":"Profile","fields":[{"name":"id","type":{"name":"Int","optional":false,"isArray":false},"attributes":[{"name":"id","args":null},{"name":"default","args":{"function":"autoincrement","args":[]}}]},{"name":"bio","type":{"name":"String","optional":false,"isArray":false},"attributes":[]},{"name":"user","type":{"name":"User","optional":false,"isArray":false},"attributes":[{"name":"relation","args":{"fields":["userId"],"references":["id"]}}]},{"name":"userId","type":{"name":"Int","optional":false,"isArray":false},"attributes":[{"name":"unique","args":null}]}],"attributes":[]}, 'profile', this.options.debug || false, this.options.log || []);
    this.post = new Post(this, {"type":"model","name":"Post","fields":[{"name":"id","type":{"name":"Int","optional":false,"isArray":false},"attributes":[{"name":"id","args":null},{"name":"default","args":{"function":"autoincrement","args":[]}}]},{"name":"title","type":{"name":"String","optional":false,"isArray":false},"attributes":[]},{"name":"published","type":{"name":"Boolean","optional":false,"isArray":false},"attributes":[{"name":"default","args":null}]},{"name":"author","type":{"name":"User","optional":true,"isArray":false},"attributes":[{"name":"relation","args":{"fields":["authorId"],"references":["id"]}}]},{"name":"authorId","type":{"name":"Int","optional":true,"isArray":false},"attributes":[]},{"name":"categories","type":{"name":"CategoriesOnPosts","optional":false,"isArray":true},"attributes":[]}],"attributes":[]}, 'post', this.options.debug || false, this.options.log || []);
    this.category = new Category(this, {"type":"model","name":"Category","fields":[{"name":"id","type":{"name":"Int","optional":false,"isArray":false},"attributes":[{"name":"id","args":null},{"name":"default","args":{"function":"autoincrement","args":[]}}]},{"name":"name","type":{"name":"String","optional":false,"isArray":false},"attributes":[{"name":"unique","args":null}]},{"name":"posts","type":{"name":"CategoriesOnPosts","optional":false,"isArray":true},"attributes":[]}],"attributes":[]}, 'category', this.options.debug || false, this.options.log || []);
    this.categoriesOnPosts = new CategoriesOnPosts(this, {"type":"model","name":"CategoriesOnPosts","fields":[{"name":"post","type":{"name":"Post","optional":false,"isArray":false},"attributes":[{"name":"relation","args":{"fields":["postId"],"references":["id"]}}]},{"name":"postId","type":{"name":"Int","optional":false,"isArray":false},"attributes":[]},{"name":"category","type":{"name":"Category","optional":false,"isArray":false},"attributes":[{"name":"relation","args":{"fields":["categoryId"],"references":["id"]}}]},{"name":"categoryId","type":{"name":"Int","optional":false,"isArray":false},"attributes":[]},{"name":"assignedAt","type":{"name":"DateTime","optional":false,"isArray":false},"attributes":[{"name":"default","args":{"function":"now","args":[]}}]}],"attributes":[{"name":"id","args":"[postId, categoryId]"}]}, 'categories_on_posts', this.options.debug || false, this.options.log || []);
  }
}

export { User, Profile, Post, Category, CategoriesOnPosts, Drismify };
export * from './types';
