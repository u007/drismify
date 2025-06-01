




export type User = {
  id: number;
  email: string;
  name?: string;
  createdAt: Date;
  posts: Post[];
};

export type Post = {
  id: number;
  title: string;
  content?: string;
  published: boolean;
  author: User;
  authorId: number;
};




export type UserCreateInput = {
  id: number;
  email: string;
  name?: string;
  createdAt: Date;
  posts: Post[];
};

export type UserUpdateInput = {
  id?: number;
  email?: string;
  name?: string;
  createdAt?: Date;
  posts?: Post[];
};

export type UserWhereInput = {
  id?: number;
  email?: string;
  name?: string;
  createdAt?: Date;
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
  createdAt?: 'asc' | 'desc';
  posts?: 'asc' | 'desc';
};

export type UserSelectInput = {
  id?: boolean;
  email?: boolean;
  name?: boolean;
  createdAt?: boolean;
  posts?: boolean;
};

export type UserIncludeInput = {
  posts?: boolean;
};


export type PostCreateInput = {
  id: number;
  title: string;
  content?: string;
  published: boolean;
  author: User;
  authorId: number;
};

export type PostUpdateInput = {
  id?: number;
  title?: string;
  content?: string;
  published?: boolean;
  author?: User;
  authorId?: number;
};

export type PostWhereInput = {
  id?: number;
  title?: string;
  content?: string;
  published?: boolean;
  author?: User;
  authorId?: number;
};

export type PostWhereUniqueInput = {
  id?: number;
};

export type PostOrderByInput = {
  id?: 'asc' | 'desc';
  title?: 'asc' | 'desc';
  content?: 'asc' | 'desc';
  published?: 'asc' | 'desc';
  author?: 'asc' | 'desc';
  authorId?: 'asc' | 'desc';
};

export type PostSelectInput = {
  id?: boolean;
  title?: boolean;
  content?: boolean;
  published?: boolean;
  author?: boolean;
  authorId?: boolean;
};

export type PostIncludeInput = {
  author?: boolean;
};



