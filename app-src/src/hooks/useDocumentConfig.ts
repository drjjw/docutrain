/**
 * useDocumentConfig - Hook for fetching document configuration
 * Fetches document metadata including title, subtitle, PubMed info, owner
 * NO CACHING - Always fetches fresh data
 * Request deduplication prevents multiple simultaneous requests for the same document
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from './useAuth';
import { usePermissions } from './usePermissions';
import { supabase } from '@/lib/supabase/client';

// Check if we're in development mode for verbose logging
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - import.meta.env is available in Vite
const isDev = import.meta.env?.DEV || import.meta.env?.MODE === 'development' || false;

// Module-level request deduplication to prevent multiple simultaneous requests
const pendingRequests = new Map<string, Promise<DocumentConfig | null>>();

/**
 * Log helper - only logs in development mode
 */
const devLog = (...args: any[]) => {
  if (isDev) {
    console.log(...args);
  }
};

export interface Keyword {
  term: string;
  weight: number;
}

export interface Download {
  url: string;
  title: string;
}

interface DocumentConfig {
  slug: string;
  title: string;
  subtitle?: string;
  welcomeMessage?: string;
  introMessage?: string;
  cover?: string;
  owner?: string;
  category?: string;
  year?: string;
  showDocumentSelector?: boolean;
  showKeywords?: boolean;
  showDownloads?: boolean;
  keywords?: Keyword[];
  downloads?: Download[];
  ownerInfo?: {
    slug: string;
    name: string;
    logo_url?: string;
  };
  metadata?: {
    pubmed_pmid?: string;
    [key: string]: any;
  };
}

export interface DocumentConfigError {
  type: 'passcode_required' | 'access_denied' | 'document_not_found' | 'unknown';
  message: string;
  documentInfo?: {
    title: string;
    access_level?: string;
    requires_passcode?: boolean;
  };
}

export function useDocumentConfig(documentSlug: string | null) {
  const [config, setConfig] = useState<DocumentConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<DocumentConfigError | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const permissions = usePermissions();
  const redirectAttemptedRef = useRef<string | null>(null);
  const passcodeRequiredRef = useRef<boolean>(false);
  
  // Extract passcode value
  const passcodeFromUrl = searchParams.get('passcode');
  const passcodeFromStorage = documentSlug ? localStorage.getItem(`passcode:${documentSlug}`) : null;
  const passcode = passcodeFromUrl || passcodeFromStorage;
  
  const isSuperAdmin = permissions.isSuperAdmin;
  const isLoading = authLoading || permissions.loading;

  // Listen for document-updated events (same browser window)
  useEffect(() => {
    const handleDocumentUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ documentSlug?: string }>;
      const updatedSlug = customEvent.detail?.documentSlug;
      
      devLog(`[useDocumentConfig] document-updated event received`, {
        documentSlug,
        updatedSlug
      });
      
      // Trigger refresh if it's our document or no specific slug
      if (!updatedSlug || updatedSlug === documentSlug) {
        setRefreshTrigger(prev => prev + 1);
      }
    };

    window.addEventListener('document-updated', handleDocumentUpdate as EventListener);
    
    return () => {
      window.removeEventListener('document-updated', handleDocumentUpdate as EventListener);
    };
  }, [documentSlug]);

  // NOTE: Realtime subscription moved to ChatPage to avoid duplicate subscriptions
  // Multiple components use useDocumentConfig, which would create multiple subscriptions
  // Instead, ChatPage creates ONE subscription and dispatches 'document-updated' events

  // Main effect to load document config
  useEffect(() => {
    devLog(`[useDocumentConfig] Effect running for: ${documentSlug}, isLoading: ${isLoading}, user: ${user?.id || 'null'}`);
    
    if (!documentSlug) {
      setConfig(null);
      setLoading(false);
      setError(null);
      setErrorDetails(null);
      passcodeRequiredRef.current = false;
      redirectAttemptedRef.current = null;
      return;
    }

    // Wait for auth and permissions to finish loading
    if (isLoading) {
      devLog(`[useDocumentConfig] Still loading (auth or permissions), waiting...`);
      return;
    }

    let cancelled = false;

    // Create a unique key for this request (include refreshTrigger to bust cache on updates)
    const requestKey = `${documentSlug}:${user?.id || 'anon'}:${passcode || 'none'}:${refreshTrigger}`;

    // Check if there's already a pending request for this exact configuration
    const existingRequest = pendingRequests.get(requestKey);
    if (existingRequest) {
      devLog(`[useDocumentConfig] Reusing existing request for: ${requestKey}`);
      existingRequest.then((result) => {
        if (!cancelled && result) {
          setConfig(result);
          setLoading(false);
          setError(null);
          setErrorDetails(null);
        }
      }).catch(() => {
        // Error handled by the original request
      });
      return;
    }

    async function loadConfig(): Promise<DocumentConfig | null> {
      try {
        devLog(`[useDocumentConfig] Loading config for: ${documentSlug}`);
        
        const currentPasscode = passcodeFromUrl || passcodeFromStorage;
        devLog(`[useDocumentConfig] Passcode check - URL: ${passcodeFromUrl || 'none'}, localStorage: ${passcodeFromStorage || 'none'}`);
        
        setLoading(true);
        setError(null);
        if (!passcodeRequiredRef.current) {
          setErrorDetails(null);
          passcodeRequiredRef.current = false;
        }

        // Build API URL
        let url = `/api/documents?doc=${encodeURIComponent(documentSlug)}`;
        
        if (currentPasscode) {
          url += `&passcode=${encodeURIComponent(currentPasscode)}`;
        }
        
        // Get JWT token for authentication
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
        };
        
        try {
          const sessionKey = 'sb-mlxctdgnojvkgfqldaob-auth-token';
          const sessionData = localStorage.getItem(sessionKey);
          if (sessionData) {
            const session = JSON.parse(sessionData);
            const token = session?.access_token;
            if (token) {
              headers['Authorization'] = `Bearer ${token}`;
              devLog(`[useDocumentConfig] Added Authorization header`);
            }
          }
        } catch (error) {
          // Ignore token errors
        }
        
        devLog(`[useDocumentConfig] Fetching: ${url}`);
        const response = await fetch(url, { headers });
        devLog(`[useDocumentConfig] Response status: ${response.status}`);
        
        if (!response.ok) {
          if (response.status === 403 || response.status === 404) {
            let errorData;
            try {
              errorData = await response.json();
            } catch (e) {
              errorData = { 
                error: `HTTP ${response.status}`, 
                error_type: response.status === 403 ? 'access_denied' : 'document_not_found' 
              };
            }
            devLog(`[useDocumentConfig] Error data:`, errorData);
            
            // Check for passcode_required error
            if (errorData.error_type === 'passcode_required') {
              if (!cancelled) {
                passcodeRequiredRef.current = true;
                const errorDetailsValue = {
                  type: 'passcode_required' as const,
                  message: errorData.error || 'This document requires a passcode to access',
                  documentInfo: errorData.document_info
                };
                setErrorDetails(errorDetailsValue);
                setError(errorData.error || 'This document requires a passcode to access');
                setConfig(null);
                setLoading(false);
              }
              return;
            }
            
            // If user is not authenticated and access is denied, redirect to login
            if (!isLoading && !user && (response.status === 403 || errorData.error_type === 'access_denied') 
                && errorData.error_type !== 'passcode_required' && !currentPasscode) {
              if (!cancelled && redirectAttemptedRef.current !== documentSlug) {
                redirectAttemptedRef.current = documentSlug;
                setLoading(false);
                const currentUrl = window.location.pathname + window.location.search;
                const returnUrl = encodeURIComponent(currentUrl);
                devLog(`[useDocumentConfig] REDIRECTING TO LOGIN`);
                navigate(`/login?returnUrl=${returnUrl}`, { replace: true });
                return;
              }
            }
            
            // For authenticated users with 403, set error
            if (response.status === 403 && user) {
              if (!cancelled) {
                const errorMessage = isSuperAdmin 
                  ? 'Unable to access document. This may be a server issue.' 
                  : 'You do not have permission to access this document';
                setError(errorMessage);
                setErrorDetails({
                  type: 'access_denied',
                  message: errorMessage
                });
                setConfig(null);
                setLoading(false);
                return;
              }
            }
            
            // For 404 errors
            if (response.status === 404) {
              if (!cancelled) {
                const errorMessage = errorData.error || `Document "${documentSlug}" not found`;
                const errorDetailsValue = {
                  type: 'document_not_found' as const,
                  message: errorMessage
                };
                setErrorDetails(errorDetailsValue);
                setError(errorMessage);
                setConfig(null);
                setLoading(false);
              }
            }
            
            if (response.status !== 403 && response.status !== 404) {
              throw new Error(`HTTP ${response.status}`);
            }
            return;
          }
          
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        devLog(`[useDocumentConfig] Response data:`, data);
        const documents = data.documents || [];
        devLog(`[useDocumentConfig] Documents array length: ${documents.length}`);
        
        // Find the document with matching slug
        const doc = documents.find((d: DocumentConfig) => d.slug === documentSlug);
        devLog(`[useDocumentConfig] Found document:`, doc ? 'YES' : 'NO');

        if (!cancelled) {
          if (doc) {
            // DEBUG: Log keywords from API response
            console.log('[useDocumentConfig] 🔍 DEBUG - Keywords in API response:', {
              hasKeywords: !!doc.keywords,
              keywordsType: typeof doc.keywords,
              isArray: Array.isArray(doc.keywords),
              keywordsLength: Array.isArray(doc.keywords) ? doc.keywords.length : 'N/A',
              keywords: doc.keywords,
              keywordsDetails: Array.isArray(doc.keywords) ? doc.keywords.map((k: any, i: number) => ({
                index: i,
                keyword: k,
                hasTerm: !!k?.term,
                term: k?.term,
                termType: typeof k?.term,
                weight: k?.weight
              })) : 'N/A',
              showKeywords: doc.showKeywords,
              fullDoc: doc
            });
            
            devLog(`[useDocumentConfig] Setting config to:`, doc);
            setConfig(doc);
            setLoading(false);
            passcodeRequiredRef.current = false;
            setErrorDetails(null);
            setError(null);
            return doc;
          } else {
            devLog(`[useDocumentConfig] Document not found in array`);
            
            // If no document found and user is not authenticated, redirect to login
            if (!isLoading && !user && documents.length === 0 && !currentPasscode) {
              if (!cancelled && redirectAttemptedRef.current !== documentSlug) {
                redirectAttemptedRef.current = documentSlug;
                setLoading(false);
                const currentUrl = window.location.pathname + window.location.search;
                const returnUrl = encodeURIComponent(currentUrl);
                devLog(`[useDocumentConfig] REDIRECTING TO LOGIN - no documents found`);
                navigate(`/login?returnUrl=${returnUrl}`, { replace: true });
                return null;
              }
            }
            
            setConfig(null);
            setError(null);
            if (!passcodeRequiredRef.current) {
              setErrorDetails(null);
            }
            setLoading(false);
            return null;
          }
        }
        return null;
      } catch (err) {
        if (!cancelled) {
          const isExpectedError = err instanceof Error && (err.message.includes('HTTP 403') || err.message.includes('HTTP 404'));
          if (!isExpectedError) {
            console.error('[useDocumentConfig] Unexpected error:', err);
            setError(err instanceof Error ? err.message : 'Failed to load document config');
            setErrorDetails({
              type: 'unknown',
              message: err instanceof Error ? err.message : 'Failed to load document config'
            });
            setConfig(null);
            setLoading(false);
          }
        }
        return null;
      }
    }

    // Create and track the request promise
    const requestPromise = loadConfig().finally(() => {
      pendingRequests.delete(requestKey);
    });
    
    pendingRequests.set(requestKey, requestPromise);

    // Listen for passcode storage events
    const handlePasscodeStored = (event: CustomEvent) => {
      if (!cancelled && event.detail?.documentSlug === documentSlug) {
        devLog(`[useDocumentConfig] Passcode stored event received for ${documentSlug}`);
        passcodeRequiredRef.current = false;
        redirectAttemptedRef.current = null;
        setTimeout(() => {
          if (!cancelled) {
            setRefreshTrigger(prev => prev + 1);
          }
        }, 50);
      }
    };
    
    window.addEventListener('passcode-stored', handlePasscodeStored as EventListener);

    return () => {
      cancelled = true;
      window.removeEventListener('passcode-stored', handlePasscodeStored as EventListener);
      devLog(`[useDocumentConfig] Effect cleanup for: ${documentSlug}`);
    };
  }, [documentSlug, user?.id, isLoading, isSuperAdmin, passcode, refreshTrigger, navigate, passcodeFromUrl, passcodeFromStorage]);

  return { config, loading, error, errorDetails };
}
