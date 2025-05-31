




export type User = {
  id: number;
  email: string;
  posts: Post[];
};

export type Post = {
  id: number;
  title: string;
  author: User;
  authorId: number;
};




export type UserCreateInput = {
  id: number;
  email: string;
  posts: Post[];
};

export type UserUpdateInput = {
  id?: number;
  email?: string;
  posts?: Post[];
};

export type UserWhereInput = {
  id?: number;
  email?: string;
  posts?: Post[];
};

export type UserWhereUniqueInput = {
  id?: number;
  email?: string;
};

export type UserOrderByInput = {
  id?: 'asc' | 'desc';
  email?: 'asc' | 'desc';
  posts?: 'asc' | 'desc';
};

export type UserSelectInput = {
  id?: boolean;
  email?: boolean;
  posts?: boolean;
};

export type UserIncludeInput = {
  posts?: boolean;
};


export type PostCreateInput = {
  id: number;
  title: string;
  author: User;
  authorId: number;
};

export type PostUpdateInput = {
  id?: number;
  title?: string;
  author?: User;
  authorId?: number;
};

export type PostWhereInput = {
  id?: number;
  title?: string;
  author?: User;
  authorId?: number;
};

export type PostWhereUniqueInput = {
  id?: number;
};

export type PostOrderByInput = {
  id?: 'asc' | 'desc';
  title?: 'asc' | 'desc';
  author?: 'asc' | 'desc';
  authorId?: 'asc' | 'desc';
};

export type PostSelectInput = {
  id?: boolean;
  title?: boolean;
  author?: boolean;
  authorId?: boolean;
};

export type PostIncludeInput = {
  author?: boolean;
};



