import { useState, useEffect, useCallback } from 'react';
import { getOwner, updateOwnerSettings } from '@/lib/supabase/admin';
import type { Owner } from '@/types/admin';
import { usePermissions } from '@/hooks/usePermissions';
import { clearOwnerLogoCache } from '@/hooks/useOwnerLogo';

interface UseOwnerSettingsReturn {
  owner: Owner | null;
  loading: boolean;
  error: string | null;
  saving: boolean;
  updateSettings: (updates: Partial<Owner>) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useOwnerSettings(ownerId: string | null): UseOwnerSettingsReturn {
  const [owner, setOwner] = useState<Owner | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { refetch: refetchPermissions } = usePermissions();

  const fetchOwner = useCallback(async () => {
    if (!ownerId) {
      setOwner(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const ownerData = await getOwner(ownerId);
      setOwner(ownerData);
    } catch (err) {
      console.error('Failed to fetch owner:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch owner');
    } finally {
      setLoading(false);
    }
  }, [ownerId]);

  useEffect(() => {
    fetchOwner();
  }, [fetchOwner]);

  const updateSettings = useCallback(async (updates: Partial<Owner>) => {
    if (!ownerId) {
      throw new Error('Owner ID is required');
    }

    try {
      setSaving(true);
      setError(null);
      
      const updatedOwner = await updateOwnerSettings(ownerId, updates);
      setOwner(updatedOwner);
      
      // Clear owner logo cache to ensure changes are reflected immediately
      clearOwnerLogoCache();
      
      // Refresh permissions to update UI (logo, accent color, etc.)
      await refetchPermissions();
    } catch (err) {
      console.error('Failed to update owner settings:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to update owner settings';
      setError(errorMessage);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [ownerId, refetchPermissions]);

  return {
    owner,
    loading,
    error,
    saving,
    updateSettings,
    refetch: fetchOwner,
  };
}

