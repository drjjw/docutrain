/**
 * PermissionsContext - Shared permissions state across the app
 * Prevents duplicate API calls when multiple components need permissions
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getUserPermissions, checkUserNeedsApproval } from '@/lib/supabase/permissions';
import type { UserPermissions } from '@/types/permissions';
import { useAuth } from '@/hooks/useAuth';

// Helper to add timeout to promises
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallbackValue: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => {
      console.warn(`[PermissionsContext] Operation timed out after ${timeoutMs}ms, using fallback value`);
      resolve(fallbackValue);
    }, timeoutMs))
  ]);
}

interface PermissionsContextValue {
  permissions: UserPermissions | null;
  loading: boolean;
  error: string | null;
  isSuperAdmin: boolean;
  isOwnerAdmin: boolean;
  ownerGroups: Array<{
    owner_id: string;
    owner_slug: string;
    owner_name: string;
    owner_logo_url: string | null;
    role: string;
  }>;
  needsApproval: boolean;
  refetch: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextValue | undefined>(undefined);

interface PermissionsProviderProps {
  children: React.ReactNode;
}

export function PermissionsProvider({ children }: PermissionsProviderProps) {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsApproval, setNeedsApproval] = useState(false);

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
      
      // Fetch permissions with timeout (10s on mobile, 5s on desktop)
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const timeout = isMobile ? 10000 : 5000;
      
      console.log('[PermissionsContext] Fetching permissions...');
      const perms = await withTimeout(
        getUserPermissions(user.id),
        timeout,
        { permissions: [], is_super_admin: false, owner_groups: [] }
      );
      console.log('[PermissionsContext] Fetched permissions:', perms);
      setPermissions(perms);
      
      // Check if user needs approval (has no roles or owner access)
      // This is less critical, so use shorter timeout and default to false
      console.log('[PermissionsContext] Checking approval status...');
      const needsApp = await withTimeout(
        checkUserNeedsApproval(user.id),
        isMobile ? 5000 : 3000,
        false // Default to not needing approval if check times out
      );
      console.log('[PermissionsContext] Needs approval:', needsApp);
      setNeedsApproval(needsApp);
    } catch (err) {
      console.error('[PermissionsContext] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch permissions');
      // Set default values on error
      setPermissions({ permissions: [], is_super_admin: false, owner_groups: [] });
      setNeedsApproval(false);
    } finally {
      console.log('[PermissionsContext] Loading complete');
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch if user ID actually changed (not just user object reference)
    // This prevents refetching when auth state changes but user ID is the same
    fetchPermissions();
  }, [user?.id]); // Only depends on user.id, not entire user object

  const isOwnerAdmin = permissions?.owner_groups?.some(og => og.role === 'owner_admin') || false;

  const value: PermissionsContextValue = {
    permissions,
    loading,
    error,
    isSuperAdmin: permissions?.is_super_admin || false,
    isOwnerAdmin,
    ownerGroups: (permissions?.owner_groups || []).map(og => ({
      ...og,
      owner_logo_url: og.owner_logo_url ?? null,
    })),
    needsApproval,
    refetch: fetchPermissions,
  };

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
}

