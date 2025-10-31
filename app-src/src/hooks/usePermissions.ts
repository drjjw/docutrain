import { useState, useEffect } from 'react';
import { getUserPermissions, checkUserNeedsApproval } from '@/lib/supabase/permissions';
import type { UserPermissions } from '@/types/permissions';
import { useAuth } from './useAuth';

export function usePermissions() {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsApproval, setNeedsApproval] = useState(false);

  useEffect(() => {
    const fetchPermissions = async () => {
      if (!user) {
        setPermissions(null);
        setNeedsApproval(false);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const perms = await getUserPermissions(user.id);
        setPermissions(perms);
        
        // Check if user needs approval (has no roles or owner access)
        const needsApp = await checkUserNeedsApproval(user.id);
        setNeedsApproval(needsApp);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch permissions');
        // If we can't check, assume approval is needed
        setNeedsApproval(true);
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, [user?.id]);

  return {
    permissions,
    loading,
    error,
    isSuperAdmin: permissions?.is_super_admin || false,
    ownerGroups: permissions?.owner_groups || [],
    needsApproval,
  };
}

