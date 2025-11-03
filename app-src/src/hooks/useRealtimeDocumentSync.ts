/**
 * useRealtimeDocumentSync - Hook for centralized Realtime subscription
 * CENTRALIZED Realtime subscription for document updates
 * This is the ONLY place we subscribe to avoid duplicate subscriptions
 * (useDocumentConfig is called by 8+ components, which would create 8+ subscriptions)
 * Ported from ChatPage.tsx
 * 
 * Mobile-optimized with error handling and graceful degradation
 * Realtime is OPTIONAL - app works fine without it (updates on page refresh)
 */

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js';

// Detect if we're on mobile
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Global flag to disable realtime if it's causing issues
let realtimeDisabledGlobally = false;

export function useRealtimeDocumentSync(
  documentSlug: string | null,
  authLoading: boolean,
  permissionsLoading: boolean
) {
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const maxRetries = isMobile ? 1 : 2; // Very conservative on mobile - just 1 retry
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<any>(null);
  const isSubscribingRef = useRef(false);
  const hasLoggedDisabledRef = useRef(false);

  useEffect(() => {
    // If realtime has been globally disabled due to persistent errors, don't even try
    if (realtimeDisabledGlobally) {
      if (!hasLoggedDisabledRef.current) {
        console.log(`[useRealtimeDocumentSync] ℹ️ Realtime disabled globally. App will work normally with updates on page refresh.`);
        hasLoggedDisabledRef.current = true;
      }
      return;
    }

    // Wait for auth and permissions to fully load, and ensure we have a document
    if (!documentSlug || authLoading || permissionsLoading) {
      return;
    }

    // Don't retry indefinitely - after max retries, disable globally
    if (connectionAttempts >= maxRetries) {
      console.warn(`[useRealtimeDocumentSync] ⚠️ Max connection attempts (${maxRetries}) reached. Disabling realtime globally.`);
      console.log(`[useRealtimeDocumentSync] ℹ️ App will continue to work normally. Updates will appear on page refresh.`);
      realtimeDisabledGlobally = true;
      return;
    }

    // Prevent multiple simultaneous subscription attempts
    if (isSubscribingRef.current) {
      return;
    }

    isSubscribingRef.current = true;
    
    // Add a delay on mobile to let the network stabilize, and on retries
    const setupDelay = (isMobile || connectionAttempts > 0) ? 2000 : 500;
    
    const setupTimeout = setTimeout(() => {
      try {
        console.log(`[useRealtimeDocumentSync] 🔌 Attempting Realtime connection for ${documentSlug} (attempt ${connectionAttempts + 1}/${maxRetries + 1})`);
        
        const channel = supabase
          .channel(`document_${documentSlug}_changes`, {
            config: {
              broadcast: { self: false },
              presence: { key: '' },
            },
          })
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
              // Reset connection attempts on successful message
              setConnectionAttempts(0);
              // Dispatch browser event to notify all useDocumentConfig instances
              window.dispatchEvent(new CustomEvent('document-updated', {
                detail: { documentSlug }
              }));
            }
          )
          .subscribe((status, err) => {
            // Handle different subscription states
            if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
              console.log(`[useRealtimeDocumentSync] ✅ Realtime connected successfully`);
              setConnectionAttempts(0); // Reset on success
              isSubscribingRef.current = false;
            } else if (status === REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR) {
              console.warn(`[useRealtimeDocumentSync] ⚠️ Realtime connection error:`, err);
              isSubscribingRef.current = false;
              
              // Only retry if we haven't exceeded max attempts
              if (connectionAttempts < maxRetries) {
                const retryDelay = isMobile ? 5000 : 3000;
                console.log(`[useRealtimeDocumentSync] 🔄 Will retry in ${retryDelay / 1000}s...`);
                retryTimeoutRef.current = setTimeout(() => {
                  setConnectionAttempts(prev => prev + 1);
                }, retryDelay);
              } else {
                console.log(`[useRealtimeDocumentSync] ℹ️ Realtime unavailable. App will work normally with updates on refresh.`);
              }
            } else if (status === REALTIME_SUBSCRIBE_STATES.TIMED_OUT) {
              console.warn(`[useRealtimeDocumentSync] ⏱️ Realtime connection timed out`);
              isSubscribingRef.current = false;
              
              // On timeout, only retry once more
              if (connectionAttempts < maxRetries) {
                const retryDelay = isMobile ? 5000 : 3000;
                retryTimeoutRef.current = setTimeout(() => {
                  setConnectionAttempts(prev => prev + 1);
                }, retryDelay);
              }
            } else if (status === REALTIME_SUBSCRIBE_STATES.CLOSED) {
              console.log(`[useRealtimeDocumentSync] 🔌 Realtime connection closed`);
              isSubscribingRef.current = false;
            }
          });

        channelRef.current = channel;
      } catch (error) {
        console.warn(`[useRealtimeDocumentSync] ⚠️ Error setting up realtime:`, error);
        isSubscribingRef.current = false;
        
        // On error, only retry if we haven't exceeded max attempts
        if (connectionAttempts < maxRetries) {
          retryTimeoutRef.current = setTimeout(() => {
            setConnectionAttempts(prev => prev + 1);
          }, isMobile ? 5000 : 3000);
        } else {
          console.log(`[useRealtimeDocumentSync] ℹ️ Realtime unavailable. App will work normally with updates on refresh.`);
        }
      }
    }, setupDelay);

    return () => {
      clearTimeout(setupTimeout);
      
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current).catch(() => {
          // Silently fail - we're cleaning up anyway
        });
        channelRef.current = null;
      }
      
      isSubscribingRef.current = false;
    };
  }, [documentSlug, authLoading, permissionsLoading, connectionAttempts]);
}

