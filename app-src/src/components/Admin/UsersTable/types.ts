export interface EditingPermissions {
  userId: string;
  userEmail: string;
  role: 'registered' | 'owner_admin' | 'super_admin';
  owner_id: string | null;
  firstName?: string;
  lastName?: string;
}

