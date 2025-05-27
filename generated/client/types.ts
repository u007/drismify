


export type User = {
  id: number;
  email: string;
  name?: string;
  profile?: Profile;
  posts: Post[];
};

export type Profile = {
  id: number;
  bio: string;
  user: User;
  userId: number;
};

export type Post = {
  id: number;
  title: string;
  published: boolean;
  author?: User;
  authorId?: number;
  categories: CategoriesOnPosts[];
};

export type Category = {
  id: number;
  name: string;
  posts: CategoriesOnPosts[];
};

export type CategoriesOnPosts = {
  post: Post;
  postId: number;
  category: Category;
  categoryId: number;
  assignedAt: Date;
};


export type UserCreateInput = {
  id: number;
  email: string;
  name?: string;
  profile?: Profile;
  posts: Post[];
};

export type UserUpdateInput = {
  id?: number;
  email?: string;
  name?: string;
  profile?: Profile;
  posts?: Post[];
};

export type UserWhereInput = {
  id?: number;
  email?: string;
  name?: string;
  profile?: Profile;
  posts?: Post[];
};

export type UserWhereUniqueInput = {
  id?: number;
  email?: string;
};

export type UserOrderByInput = {
  id?: 'asc' | 'desc';
  email?: 'asc' | 'desc';
  name?: 'asc' | 'desc';
  profile?: 'asc' | 'desc';
  posts?: 'asc' | 'desc';
};

export type UserSelectInput = {
  id?: boolean;
  email?: boolean;
  name?: boolean;
  profile?: boolean;
  posts?: boolean;
};

export type UserIncludeInput = {
  profile?: boolean;
  posts?: boolean;
};


export type ProfileCreateInput = {
  id: number;
  bio: string;
  user: User;
  userId: number;
};

export type ProfileUpdateInput = {
  id?: number;
  bio?: string;
  user?: User;
  userId?: number;
};

export type ProfileWhereInput = {
  id?: number;
  bio?: string;
  user?: User;
  userId?: number;
};

export type ProfileWhereUniqueInput = {
  id?: number;
  userId?: number;
};

export type ProfileOrderByInput = {
  id?: 'asc' | 'desc';
  bio?: 'asc' | 'desc';
  user?: 'asc' | 'desc';
  userId?: 'asc' | 'desc';
};

export type ProfileSelectInput = {
  id?: boolean;
  bio?: boolean;
  user?: boolean;
  userId?: boolean;
};

export type ProfileIncludeInput = {
  user?: boolean;
};


export type PostCreateInput = {
  id: number;
  title: string;
  published: boolean;
  author?: User;
  authorId?: number;
  categories: CategoriesOnPosts[];
};

export type PostUpdateInput = {
  id?: number;
  title?: string;
  published?: boolean;
  author?: User;
  authorId?: number;
  categories?: CategoriesOnPosts[];
};

export type PostWhereInput = {
  id?: number;
  title?: string;
  published?: boolean;
  author?: User;
  authorId?: number;
  categories?: CategoriesOnPosts[];
};

export type PostWhereUniqueInput = {
  id?: number;
};

export type PostOrderByInput = {
  id?: 'asc' | 'desc';
  title?: 'asc' | 'desc';
  published?: 'asc' | 'desc';
  author?: 'asc' | 'desc';
  authorId?: 'asc' | 'desc';
  categories?: 'asc' | 'desc';
};

export type PostSelectInput = {
  id?: boolean;
  title?: boolean;
  published?: boolean;
  author?: boolean;
  authorId?: boolean;
  categories?: boolean;
};

export type PostIncludeInput = {
  author?: boolean;
  categories?: boolean;
};


export type CategoryCreateInput = {
  id: number;
  name: string;
  posts: CategoriesOnPosts[];
};

export type CategoryUpdateInput = {
  id?: number;
  name?: string;
  posts?: CategoriesOnPosts[];
};

export type CategoryWhereInput = {
  id?: number;
  name?: string;
  posts?: CategoriesOnPosts[];
};

export type CategoryWhereUniqueInput = {
  id?: number;
  name?: string;
};

export type CategoryOrderByInput = {
  id?: 'asc' | 'desc';
  name?: 'asc' | 'desc';
  posts?: 'asc' | 'desc';
};

export type CategorySelectInput = {
  id?: boolean;
  name?: boolean;
  posts?: boolean;
};

export type CategoryIncludeInput = {
  posts?: boolean;
};


export type CategoriesOnPostsCreateInput = {
  post: Post;
  postId: number;
  category: Category;
  categoryId: number;
  assignedAt: Date;
};

export type CategoriesOnPostsUpdateInput = {
  post?: Post;
  postId?: number;
  category?: Category;
  categoryId?: number;
  assignedAt?: Date;
};

export type CategoriesOnPostsWhereInput = {
  post?: Post;
  postId?: number;
  category?: Category;
  categoryId?: number;
  assignedAt?: Date;
};

export type CategoriesOnPostsWhereUniqueInput = {

};

export type CategoriesOnPostsOrderByInput = {
  post?: 'asc' | 'desc';
  postId?: 'asc' | 'desc';
  category?: 'asc' | 'desc';
  categoryId?: 'asc' | 'desc';
  assignedAt?: 'asc' | 'desc';
};

export type CategoriesOnPostsSelectInput = {
  post?: boolean;
  postId?: boolean;
  category?: boolean;
  categoryId?: boolean;
  assignedAt?: boolean;
};

export type CategoriesOnPostsIncludeInput = {
  post?: boolean;
  category?: boolean;
};

