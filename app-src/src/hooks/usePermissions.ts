import { useState, useEffect } from 'react';
import { getUserPermissions } from '@/lib/supabase/permissions';
import type { UserPermissions } from '@/types/permissions';
import { useAuth } from './useAuth';

export function usePermissions() {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPermissions = async () => {
      if (!user) {
        setPermissions(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const perms = await getUserPermissions(user.id);
        setPermissions(perms);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch permissions');
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
  };
}

