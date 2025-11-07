import { useState, useEffect } from 'react';
import { getAllOwners } from '@/lib/supabase/admin';
import type { Owner } from '@/types/admin';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';

export function useOwnersData() {
  const { user } = useAuth();
  const { isSuperAdmin, loading: permissionsLoading } = usePermissions();
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    if (!user?.id || permissionsLoading) {
      setLoading(false);
      return;
    }

    // Only super admins can manage owners
    if (!isSuperAdmin) {
      setError('You do not have permission to view owners');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const ownersData = await getAllOwners();
      setOwners(ownersData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load owners');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isSuperAdmin, permissionsLoading]);

  return {
    owners,
    setOwners,
    loading,
    error,
    setError,
    loadData,
  };
}

