/**
 * useRealtimeDocumentSync - Hook for centralized Realtime subscription
 * CENTRALIZED Realtime subscription for document updates
 * This is the ONLY place we subscribe to avoid duplicate subscriptions
 * (useDocumentConfig is called by 8+ components, which would create 8+ subscriptions)
 * Ported from ChatPage.tsx
 */

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

export function useRealtimeDocumentSync(
  documentSlug: string | null,
  authLoading: boolean,
  permissionsLoading: boolean
) {
  useEffect(() => {
    // Wait for auth and permissions to fully load, and ensure we have a document
    if (!documentSlug || authLoading || permissionsLoading) {
      console.log(`[useRealtimeDocumentSync] Skipping Realtime setup - waiting. documentSlug: ${documentSlug}, authLoading: ${authLoading}, permissionsLoading: ${permissionsLoading}`);
      return;
    }

    console.log(`[useRealtimeDocumentSync] 🔌 Setting up Realtime subscription for document: ${documentSlug}`);
    
    const channel = supabase
      .channel(`document_${documentSlug}_changes`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'documents',
          filter: `slug=eq.${documentSlug}`,
        },
        (payload) => {
          console.log(`[useRealtimeDocumentSync] 📡 Realtime update received for ${documentSlug}:`, payload);
          // Dispatch browser event to notify all useDocumentConfig instances
          window.dispatchEvent(new CustomEvent('document-updated', {
            detail: { documentSlug }
          }));
        }
      )
      .subscribe((status) => {
        console.log(`[useRealtimeDocumentSync] Realtime subscription status for ${documentSlug}:`, status);
      });

    return () => {
      console.log(`[useRealtimeDocumentSync] 🔌 Cleaning up Realtime subscription for ${documentSlug}`);
      supabase.removeChannel(channel);
    };
  }, [documentSlug, authLoading, permissionsLoading]);
}

