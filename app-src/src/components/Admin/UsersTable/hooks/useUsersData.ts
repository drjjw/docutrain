import { useState, useEffect } from 'react';
import { getUsers, getOwners, getPendingInvitations } from '@/lib/supabase/admin';
import type { UserWithRoles, Owner, PendingInvitation } from '@/types/admin';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';

export function useUsersData() {
  const { user } = useAuth();
  const { isSuperAdmin, isOwnerAdmin, loading: permissionsLoading } = usePermissions();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    if (!user?.id || permissionsLoading) {
      setLoading(false);
      return;
    }

    // Allow both super admins and owner admins
    const hasAdminAccess = isSuperAdmin || isOwnerAdmin;
    if (!hasAdminAccess) {
      setError('You do not have permission to view users');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const [usersData, ownersList, invitationsData] = await Promise.all([
        getUsers(),
        getOwners(),
        getPendingInvitations().catch(err => {
          console.error('Failed to load pending invitations:', err);
          return []; // Return empty array on error so users can still be loaded
        }),
      ]);
      setUsers(usersData);
      setOwners(ownersList);
      setPendingInvitations(invitationsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isSuperAdmin, permissionsLoading]);

  return {
    users,
    setUsers,
    pendingInvitations,
    setPendingInvitations,
    owners,
    setOwners,
    loading,
    error,
    setError,
    loadData,
  };
}

