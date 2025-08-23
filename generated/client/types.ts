
export type PostType = 'TEXT' | 'AUDIO' | 'VIDEO' | 'IMAGE';



export type User = {
  id: number;
  email: string;
  username?: string;
  name?: string;
  password: string;
  active: boolean;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  posts: Post[];
  userRoles: UserRole[];
  sessions: Session[];
};

export type Role = {
  id: number;
  name: string;
  description?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  userRoles: UserRole[];
  rolePermissions: RolePermission[];
};

export type Permission = {
  id: number;
  name: string;
  resource: string;
  action: string;
  description?: string;
  createdAt: Date;
  rolePermissions: RolePermission[];
};

export type UserRole = {
  id: number;
  userId: number;
  roleId: number;
  assignedAt: Date;
  assignedBy?: number;
  user: User;
  role: Role;
};

export type RolePermission = {
  id: number;
  roleId: number;
  permissionId: number;
  role: Role;
  permission: Permission;
};

export type Session = {
  id: string;
  userId: number;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  userAgent?: string;
  ipAddress?: string;
  user: User;
};

export type Post = {
  id: number;
  title: string;
  content?: string;
  published: boolean;
  type: PostType;
  createdAt: Date;
  updatedAt: Date;
  author: User;
  authorId: number;
};




export type UserCreateInput = {
  id: number;
  email: string;
  username?: string;
  name?: string;
  password: string;
  active: boolean;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  posts: Post[];
  userRoles: UserRole[];
  sessions: Session[];
};

export type UserUpdateInput = {
  id?: number;
  email?: string;
  username?: string;
  name?: string;
  password?: string;
  active?: boolean;
  verified?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  lastLoginAt?: Date;
  posts?: Post[];
  userRoles?: UserRole[];
  sessions?: Session[];
};

export type UserWhereInput = {
  id?: number;
  email?: string;
  username?: string;
  name?: string;
  password?: string;
  active?: boolean;
  verified?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  lastLoginAt?: Date;
  posts?: Post[];
  userRoles?: UserRole[];
  sessions?: Session[];
};

export type UserWhereUniqueInput = {
  id?: number;
  email?: string;
  username?: string;
};

export type UserOrderByInput = {
  id?: 'asc' | 'desc';
  email?: 'asc' | 'desc';
  username?: 'asc' | 'desc';
  name?: 'asc' | 'desc';
  password?: 'asc' | 'desc';
  active?: 'asc' | 'desc';
  verified?: 'asc' | 'desc';
  createdAt?: 'asc' | 'desc';
  updatedAt?: 'asc' | 'desc';
  lastLoginAt?: 'asc' | 'desc';
  posts?: 'asc' | 'desc';
  userRoles?: 'asc' | 'desc';
  sessions?: 'asc' | 'desc';
};

export type UserSelectInput = {
  id?: boolean;
  email?: boolean;
  username?: boolean;
  name?: boolean;
  password?: boolean;
  active?: boolean;
  verified?: boolean;
  createdAt?: boolean;
  updatedAt?: boolean;
  lastLoginAt?: boolean;
  posts?: boolean;
  userRoles?: boolean;
  sessions?: boolean;
};

export type UserIncludeInput = {
  posts?: boolean;
  userRoles?: boolean;
  sessions?: boolean;
};


export type RoleCreateInput = {
  id: number;
  name: string;
  description?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  userRoles: UserRole[];
  rolePermissions: RolePermission[];
};

export type RoleUpdateInput = {
  id?: number;
  name?: string;
  description?: string;
  active?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  userRoles?: UserRole[];
  rolePermissions?: RolePermission[];
};

export type RoleWhereInput = {
  id?: number;
  name?: string;
  description?: string;
  active?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  userRoles?: UserRole[];
  rolePermissions?: RolePermission[];
};

export type RoleWhereUniqueInput = {
  id?: number;
  name?: string;
};

export type RoleOrderByInput = {
  id?: 'asc' | 'desc';
  name?: 'asc' | 'desc';
  description?: 'asc' | 'desc';
  active?: 'asc' | 'desc';
  createdAt?: 'asc' | 'desc';
  updatedAt?: 'asc' | 'desc';
  userRoles?: 'asc' | 'desc';
  rolePermissions?: 'asc' | 'desc';
};

export type RoleSelectInput = {
  id?: boolean;
  name?: boolean;
  description?: boolean;
  active?: boolean;
  createdAt?: boolean;
  updatedAt?: boolean;
  userRoles?: boolean;
  rolePermissions?: boolean;
};

export type RoleIncludeInput = {
  userRoles?: boolean;
  rolePermissions?: boolean;
};


export type PermissionCreateInput = {
  id: number;
  name: string;
  resource: string;
  action: string;
  description?: string;
  createdAt: Date;
  rolePermissions: RolePermission[];
};

export type PermissionUpdateInput = {
  id?: number;
  name?: string;
  resource?: string;
  action?: string;
  description?: string;
  createdAt?: Date;
  rolePermissions?: RolePermission[];
};

export type PermissionWhereInput = {
  id?: number;
  name?: string;
  resource?: string;
  action?: string;
  description?: string;
  createdAt?: Date;
  rolePermissions?: RolePermission[];
};

export type PermissionWhereUniqueInput = {
  id?: number;
  name?: string;
};

export type PermissionOrderByInput = {
  id?: 'asc' | 'desc';
  name?: 'asc' | 'desc';
  resource?: 'asc' | 'desc';
  action?: 'asc' | 'desc';
  description?: 'asc' | 'desc';
  createdAt?: 'asc' | 'desc';
  rolePermissions?: 'asc' | 'desc';
};

export type PermissionSelectInput = {
  id?: boolean;
  name?: boolean;
  resource?: boolean;
  action?: boolean;
  description?: boolean;
  createdAt?: boolean;
  rolePermissions?: boolean;
};

export type PermissionIncludeInput = {
  rolePermissions?: boolean;
};


export type UserRoleCreateInput = {
  id: number;
  userId: number;
  roleId: number;
  assignedAt: Date;
  assignedBy?: number;
  user: User;
  role: Role;
};

export type UserRoleUpdateInput = {
  id?: number;
  userId?: number;
  roleId?: number;
  assignedAt?: Date;
  assignedBy?: number;
  user?: User;
  role?: Role;
};

export type UserRoleWhereInput = {
  id?: number;
  userId?: number;
  roleId?: number;
  assignedAt?: Date;
  assignedBy?: number;
  user?: User;
  role?: Role;
};

export type UserRoleWhereUniqueInput = {
  id?: number;
};

export type UserRoleOrderByInput = {
  id?: 'asc' | 'desc';
  userId?: 'asc' | 'desc';
  roleId?: 'asc' | 'desc';
  assignedAt?: 'asc' | 'desc';
  assignedBy?: 'asc' | 'desc';
  user?: 'asc' | 'desc';
  role?: 'asc' | 'desc';
};

export type UserRoleSelectInput = {
  id?: boolean;
  userId?: boolean;
  roleId?: boolean;
  assignedAt?: boolean;
  assignedBy?: boolean;
  user?: boolean;
  role?: boolean;
};

export type UserRoleIncludeInput = {
  user?: boolean;
  role?: boolean;
};


export type RolePermissionCreateInput = {
  id: number;
  roleId: number;
  permissionId: number;
  role: Role;
  permission: Permission;
};

export type RolePermissionUpdateInput = {
  id?: number;
  roleId?: number;
  permissionId?: number;
  role?: Role;
  permission?: Permission;
};

export type RolePermissionWhereInput = {
  id?: number;
  roleId?: number;
  permissionId?: number;
  role?: Role;
  permission?: Permission;
};

export type RolePermissionWhereUniqueInput = {
  id?: number;
};

export type RolePermissionOrderByInput = {
  id?: 'asc' | 'desc';
  roleId?: 'asc' | 'desc';
  permissionId?: 'asc' | 'desc';
  role?: 'asc' | 'desc';
  permission?: 'asc' | 'desc';
};

export type RolePermissionSelectInput = {
  id?: boolean;
  roleId?: boolean;
  permissionId?: boolean;
  role?: boolean;
  permission?: boolean;
};

export type RolePermissionIncludeInput = {
  role?: boolean;
  permission?: boolean;
};


export type SessionCreateInput = {
  id: string;
  userId: number;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  userAgent?: string;
  ipAddress?: string;
  user: User;
};

export type SessionUpdateInput = {
  id?: string;
  userId?: number;
  token?: string;
  expiresAt?: Date;
  createdAt?: Date;
  userAgent?: string;
  ipAddress?: string;
  user?: User;
};

export type SessionWhereInput = {
  id?: string;
  userId?: number;
  token?: string;
  expiresAt?: Date;
  createdAt?: Date;
  userAgent?: string;
  ipAddress?: string;
  user?: User;
};

export type SessionWhereUniqueInput = {
  id?: string;
  token?: string;
};

export type SessionOrderByInput = {
  id?: 'asc' | 'desc';
  userId?: 'asc' | 'desc';
  token?: 'asc' | 'desc';
  expiresAt?: 'asc' | 'desc';
  createdAt?: 'asc' | 'desc';
  userAgent?: 'asc' | 'desc';
  ipAddress?: 'asc' | 'desc';
  user?: 'asc' | 'desc';
};

export type SessionSelectInput = {
  id?: boolean;
  userId?: boolean;
  token?: boolean;
  expiresAt?: boolean;
  createdAt?: boolean;
  userAgent?: boolean;
  ipAddress?: boolean;
  user?: boolean;
};

export type SessionIncludeInput = {
  user?: boolean;
};


export type PostCreateInput = {
  id: number;
  title: string;
  content?: string;
  published: boolean;
  type: PostType;
  createdAt: Date;
  updatedAt: Date;
  author: User;
  authorId: number;
};

export type PostUpdateInput = {
  id?: number;
  title?: string;
  content?: string;
  published?: boolean;
  type?: PostType;
  createdAt?: Date;
  updatedAt?: Date;
  author?: User;
  authorId?: number;
};

export type PostWhereInput = {
  id?: number;
  title?: string;
  content?: string;
  published?: boolean;
  type?: PostType;
  createdAt?: Date;
  updatedAt?: Date;
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
  type?: 'asc' | 'desc';
  createdAt?: 'asc' | 'desc';
  updatedAt?: 'asc' | 'desc';
  author?: 'asc' | 'desc';
  authorId?: 'asc' | 'desc';
};

export type PostSelectInput = {
  id?: boolean;
  title?: boolean;
  content?: boolean;
  published?: boolean;
  type?: boolean;
  createdAt?: boolean;
  updatedAt?: boolean;
  author?: boolean;
  authorId?: boolean;
};

export type PostIncludeInput = {
  author?: boolean;
};



