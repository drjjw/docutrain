import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';

/**
 * Hook to check if user can edit a document
 * Ported from vanilla JS document-ownership.js
 */
export function useCanEditDocument(documentSlug: string | null) {
  const { user } = useAuth();
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!documentSlug || !user) {
      setCanEdit(false);
      setLoading(false);
      return;
    }

    // Check cache first
    const cacheKey = `edit-permission-${documentSlug}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const { canEdit: cachedCanEdit, userId: cachedUserId, timestamp } = JSON.parse(cached);
      const cacheAge = Date.now() - timestamp;
      const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
      
      // Only use cache if it's recent and user ID matches
      if (cacheAge < CACHE_TTL && cachedUserId === user.id) {
        setCanEdit(cachedCanEdit);
        setLoading(false);
        return;
      }
    }

    async function checkPermissions() {
      try {
        // Get auth token
        const sessionKey = 'sb-mlxctdgnojvkgfqldaob-auth-token';
        const sessionData = localStorage.getItem(sessionKey);
        if (!sessionData) {
          setCanEdit(false);
          setLoading(false);
          return;
        }

        const session = JSON.parse(sessionData);
        const token = session?.access_token;
        
        if (!token) {
          setCanEdit(false);
          setLoading(false);
          return;
        }

        // Check edit permissions via API
        const response = await fetch(`/api/permissions/can-edit-document/${documentSlug}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          setCanEdit(false);
          setLoading(false);
          return;
        }

        const data = await response.json();
        const canEditResult = data.can_edit || false;

        // Cache the result
        sessionStorage.setItem(cacheKey, JSON.stringify({
          canEdit: canEditResult,
          userId: user.id,
          timestamp: Date.now()
        }));

        setCanEdit(canEditResult);
      } catch (error) {
        console.error('Error checking edit permissions:', error);
        setCanEdit(false);
      } finally {
        setLoading(false);
      }
    }

    checkPermissions();
  }, [documentSlug, user?.id]);

  // Function to clear cache (useful after edits)
  const clearCache = () => {
    if (documentSlug) {
      sessionStorage.removeItem(`edit-permission-${documentSlug}`);
    }
  };

  return { canEdit, loading, clearCache };
}
