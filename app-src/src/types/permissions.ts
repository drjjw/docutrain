export type UserRole = 'registered' | 'owner_admin' | 'super_admin';

export interface OwnerAccess {
  owner_id: string;
  owner_slug: string;
  owner_name: string;
  owner_logo_url?: string;
  role: UserRole;
}

export interface UserPermissions {
  permissions: OwnerAccess[];
  is_super_admin: boolean;
  owner_groups: OwnerAccess[];
}

export interface PermissionCheck {
  has_access: boolean;
}

