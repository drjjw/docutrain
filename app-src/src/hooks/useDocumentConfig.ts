/**
 * useDocumentConfig - Hook for fetching document configuration
 * Fetches document metadata including title, subtitle, PubMed info, owner
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from './useAuth';
import { usePermissions } from './usePermissions';

import { registerDocumentCaches, clearDocumentConfigCaches as clearCaches } from '@/utils/documentCache';
import { clearAllDocumentCaches } from '@/services/documentApi';

// Module-level tracking to prevent duplicate requests across hook instances
const pendingRequests = new Map<string, Promise<DocumentConfig | null>>();
const errorCache = new Map<string, boolean>(); // Track which documents have errors
const configCache = new Map<string, DocumentConfig>(); // Cache successful configs
const errorDetailsCache = new Map<string, DocumentConfigError>(); // Cache error details for passcode_required etc

// Check if we're in development mode for verbose logging
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - import.meta.env is available in Vite
const isDev = import.meta.env?.DEV || import.meta.env?.MODE === 'development' || false;

/**
 * Log helper - only logs in development mode
 */
const devLog = (...args: any[]) => {
  if (isDev) {
    console.log(...args);
  }
};

// Register caches with the utility module so logout can clear them
registerDocumentCaches(configCache, errorCache, errorDetailsCache, pendingRequests);

/**
 * Clear all document config caches
 * Called on logout to ensure no cached documents are accessible after logout
 */
export function clearDocumentConfigCaches() {
  clearCaches();
}

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
  const [loading, setLoading] = useState(false); // Start as false when no slug
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<DocumentConfigError | null>(null);
  const [forceRefreshCounter, setForceRefreshCounter] = useState(0); // Counter to force re-fetch
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const permissions = usePermissions();
  const redirectAttemptedRef = useRef<string | null>(null); // Track which document we've attempted redirect for
  const errorHandledRef = useRef<string | null>(null); // Track which document we've already handled an error for
  const previousUserIdRef = useRef<string | undefined>(undefined); // Track previous user ID for cache clearing
  const passcodeRequiredRef = useRef<boolean>(false); // Track if we've set passcode_required error
  
  // Extract passcode value to avoid dependency issues with searchParams object
  // Check URL first, then localStorage as fallback
  const passcodeFromUrl = searchParams.get('passcode');
  const passcodeFromStorage = documentSlug ? localStorage.getItem(`passcode:${documentSlug}`) : null;
  const passcode = passcodeFromUrl || passcodeFromStorage;
  
  // Memoize isSuperAdmin to prevent unnecessary re-renders
  const isSuperAdmin = useMemo(() => permissions.isSuperAdmin, [permissions.isSuperAdmin]);
  
  // Wait for both auth and permissions to finish loading
  const isLoading = authLoading || permissions.loading;

  // Set up document-updated event listener (separate from main effect to avoid re-registering)
  useEffect(() => {
    const handleDocumentUpdate = (event: Event) => {
      // Handle both regular Event and CustomEvent
      const customEvent = event as CustomEvent<{ documentSlug?: string }>;
      const updatedSlug = customEvent.detail?.documentSlug;
      
      devLog(`[useDocumentConfig] document-updated event received, clearing caches and incrementing forceRefreshCounter`, {
        documentSlug,
        updatedSlug
      });
      
      // Clear caches for both current document slug and updated slug (in case slug changed)
      const slugsToClear = [documentSlug, updatedSlug].filter(Boolean) as string[];
      
      slugsToClear.forEach(slug => {
        if (!slug) return;
        
        errorCache.delete(slug);
        
        // Clear all config cache entries for this document (all user IDs and passcodes)
        const keysToDelete: string[] = [];
        configCache.forEach((_, key) => {
          if (key.startsWith(`${slug}:`)) {
            keysToDelete.push(key);
          }
        });
        keysToDelete.forEach(key => {
          devLog(`[useDocumentConfig] Clearing cache key: ${key}`);
          configCache.delete(key);
        });
        
        // Clear error details cache
        const errorKeysToDelete: string[] = [];
        errorDetailsCache.forEach((_, key) => {
          if (key.startsWith(`${slug}:`)) {
            errorKeysToDelete.push(key);
          }
        });
        errorKeysToDelete.forEach(key => errorDetailsCache.delete(key));
        
        // Clear localStorage cache for this document
        const documentCacheKeys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (
            key.startsWith('docutrain-documents-cache') || 
            key.startsWith('ukidney-documents-cache')
          ) && key.includes(slug)) {
            documentCacheKeys.push(key);
          }
        }
        documentCacheKeys.forEach(key => {
          localStorage.removeItem(key);
          devLog(`[useDocumentConfig] Cleared localStorage cache key: ${key}`);
        });
        
        // Also clear any other localStorage keys that might contain the slug (case-insensitive)
        // This handles edge cases or library-specific cache keys
        const additionalKeysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.toLowerCase().includes(slug.toLowerCase())) {
            // Skip keys we already cleared above
            if (!documentCacheKeys.includes(key)) {
              additionalKeysToRemove.push(key);
            }
          }
        }
        additionalKeysToRemove.forEach(key => {
          localStorage.removeItem(key);
          devLog(`[useDocumentConfig] Cleared additional cache key containing slug: ${key}`);
        });
      });
      
      // Increment counter to trigger re-fetch
      setForceRefreshCounter(prev => prev + 1);
    };

    window.addEventListener('document-updated', handleDocumentUpdate as EventListener);
    
    return () => {
      window.removeEventListener('document-updated', handleDocumentUpdate as EventListener);
    };
  }, [documentSlug]); // Include documentSlug so we clear the right caches

  // Clear cache when user changes (login/logout) to ensure access is re-checked
  useEffect(() => {
    if (documentSlug) {
      const previousUserId = previousUserIdRef.current;
      const currentUserId = user?.id;
      
      // If user logged out (went from user ID to null), clear ALL caches immediately
      if (previousUserId && !currentUserId) {
        devLog(`[useDocumentConfig] User logged out - clearing ALL caches immediately`);
        clearDocumentConfigCaches();
        setConfig(null);
        setError(null);
        setErrorDetails(null);
        passcodeRequiredRef.current = false;
        previousUserIdRef.current = undefined;
        return;
      }
      
      // Clear all cache entries for this document slug (for all user IDs and passcodes)
      // This ensures we re-check access when user logs in/out
      const keysToDelete: string[] = [];
      configCache.forEach((_, key) => {
        if (key.startsWith(`${documentSlug}:`)) {
          keysToDelete.push(key);
        }
      });
      
      devLog(`[useDocumentConfig] Cache clearing effect: user?.id changed from ${previousUserId || 'null'} to ${currentUserId || 'null'}, found ${keysToDelete.length} cache entries to clear`);
      
      if (keysToDelete.length > 0 || previousUserId !== currentUserId) {
        if (keysToDelete.length > 0) {
          keysToDelete.forEach(key => {
            devLog(`[useDocumentConfig] Clearing cache for key: ${key} due to user change`);
            configCache.delete(key);
          });
        }
        // Also clear error cache for this document
        errorCache.delete(documentSlug);
        // Clear error details cache for this document
        const keysToDeleteErrorDetails: string[] = [];
        errorDetailsCache.forEach((_, key) => {
          if (key.startsWith(`${documentSlug}:`)) {
            keysToDeleteErrorDetails.push(key);
          }
        });
        keysToDeleteErrorDetails.forEach(key => errorDetailsCache.delete(key));
        // Clear local state to force re-fetch
        setConfig(null);
        setError(null);
        setErrorDetails(null);
        passcodeRequiredRef.current = false; // Clear passcode flag
        devLog(`[useDocumentConfig] Cache cleared, config and error reset`);
      }
      
      previousUserIdRef.current = currentUserId;
    } else {
      // No document slug - still update previousUserIdRef to track logout
      previousUserIdRef.current = user?.id;
    }
  }, [user?.id, documentSlug]);

  useEffect(() => {
    devLog(`[useDocumentConfig] Effect running for: ${documentSlug}, isLoading: ${isLoading}, isSuperAdmin: ${isSuperAdmin}, user: ${user?.id || 'null'}`);
      if (!documentSlug) {
      setConfig(null);
      setLoading(false);
      setError(null);
      setErrorDetails(null);
      passcodeRequiredRef.current = false; // Reset passcode required flag
      redirectAttemptedRef.current = null; // Reset redirect flag
      errorHandledRef.current = null; // Reset error handled flag
      // Note: Don't clear errorCache here as it's shared across instances
      return;
    }

    // Wait for auth and permissions to finish loading before making decisions about redirects
    if (isLoading) {
      devLog(`[useDocumentConfig] Still loading (auth or permissions), waiting...`);
      return;
    }

    // Check module-level error cache - if this document already has an error, skip
    // BUT: Don't skip for super admins - they should always be able to retry
    // Also don't skip if passcode is provided (might be validating passcode)
    // Check both URL and localStorage for passcode
    const hasPasscode = passcode || (documentSlug ? localStorage.getItem(`passcode:${documentSlug}`) : null);
    devLog(`[useDocumentConfig] Error cache check - documentSlug: ${documentSlug}, hasPasscode: ${hasPasscode || 'none'}, errorCache.has: ${errorCache.has(documentSlug!)}`);
    if (errorCache.has(documentSlug) && !isSuperAdmin && !hasPasscode) {
      setError('You do not have permission to access this document');
      setConfig(null);
      setLoading(false);
      return;
    }

    // Create a cache key that includes passcode and user ID to handle different access levels
    // Including user ID ensures different users (or logged out) don't share cached configs
    // Check both URL and localStorage for passcode when building cache key
    const userId = user?.id || 'anonymous';
    const passcodeForCacheKey = passcode || (documentSlug ? localStorage.getItem(`passcode:${documentSlug}`) : null);
    const cacheKey = passcodeForCacheKey 
      ? `${documentSlug}:${passcodeForCacheKey}:${userId}` 
      : `${documentSlug}:${userId}`;
    
        // Check for forceRefresh parameter in URL
        const forceRefreshParam = searchParams.get('forceRefresh') === 'true';
        
        // If forceRefresh is requested, clear localStorage cache for this document
        if (forceRefreshParam && documentSlug) {
          devLog(`[useDocumentConfig] forceRefresh=true - clearing localStorage cache for: ${documentSlug}`);
          // Clear all possible localStorage cache keys for this document
          const cacheKeysToClear: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (
              key.startsWith('docutrain-documents-cache') || 
              key.startsWith('ukidney-documents-cache')
            ) && key.includes(documentSlug)) {
              cacheKeysToClear.push(key);
            }
          }
          cacheKeysToClear.forEach(key => {
            localStorage.removeItem(key);
            devLog(`[useDocumentConfig] Cleared localStorage cache key: ${key}`);
          });
        }
        
        // Check cache first (but NEVER use cache when logged out - always re-check access)
        // Also skip cache if forceRefresh is requested
        // This ensures logout immediately invalidates cached documents
        const cachedConfig = (!user || forceRefreshParam) ? null : configCache.get(cacheKey);
        const cachedErrorDetails = errorDetailsCache.get(cacheKey); // Check for cached error details
        devLog(`[useDocumentConfig] Cache check: user=${user?.id || 'null'}, cacheKey=${cacheKey}, forceRefresh=${forceRefreshParam}, cachedConfig=${cachedConfig ? 'EXISTS' : 'NONE'}, cachedErrorDetails=${cachedErrorDetails ? 'EXISTS' : 'NONE'}, willUseCache=${!!cachedConfig && !!user && !forceRefreshParam}`);
        
        // IMPORTANT: If we're forcing refresh or cache was cleared, skip using cached config
        // This ensures document updates are immediately visible
        // Also: Don't use cache if forceRefreshCounter was incremented (document was updated)
        if (cachedConfig && !forceRefreshParam && user && forceRefreshCounter === 0) {
          devLog(`[useDocumentConfig] Using cached config for: ${cacheKey}`);
          setConfig(cachedConfig);
          setLoading(false);
          setError(null);
          setErrorDetails(null);
          passcodeRequiredRef.current = false; // Clear passcode flag when using cache
          return;
        }
        
        // If forceRefresh is requested or counter was incremented, clear the in-memory cache for this document
        if ((forceRefreshParam || forceRefreshCounter > 0) && cachedConfig) {
          devLog(`[useDocumentConfig] forceRefresh=${forceRefreshParam} or counter=${forceRefreshCounter} - clearing in-memory cached config for: ${cacheKey}`);
          configCache.delete(cacheKey);
        }
        
        // If we have cached error details (e.g., passcode_required), use them
        if (cachedErrorDetails) {
          devLog(`[useDocumentConfig] Using cached error details:`, cachedErrorDetails);
          setErrorDetails(cachedErrorDetails);
          setError(cachedErrorDetails.message);
          setConfig(null);
          setLoading(false);
          if (cachedErrorDetails.type === 'passcode_required') {
            passcodeRequiredRef.current = true;
          }
          return;
        }
    
    // Check if there's already a pending request for this document
    const existingRequest = pendingRequests.get(cacheKey);
    if (existingRequest) {
      devLog(`[useDocumentConfig] Waiting for existing request: ${cacheKey}`);
      // Check if errorDetails are already cached (e.g., from another instance)
      const cachedErrorDetails = errorDetailsCache.get(cacheKey);
      if (cachedErrorDetails) {
        devLog(`[useDocumentConfig] Found cached error details while waiting:`, cachedErrorDetails);
        setErrorDetails(cachedErrorDetails);
        setError(cachedErrorDetails.message);
        setConfig(null);
        setLoading(false);
        if (cachedErrorDetails.type === 'passcode_required') {
          passcodeRequiredRef.current = true;
        }
        return;
      }
      
      // Wait for existing request to complete and use its result
      existingRequest.then((result) => {
        if (result) {
          setConfig(result);
          setLoading(false);
          setError(null);
          setErrorDetails(null);
          passcodeRequiredRef.current = false; // Clear passcode flag on success
        } else {
          // Result is null - check if errorDetails are cached
          const cachedErrorDetails = errorDetailsCache.get(cacheKey);
          if (cachedErrorDetails) {
            devLog(`[useDocumentConfig] Using cached error details after request:`, cachedErrorDetails);
            setErrorDetails(cachedErrorDetails);
            setError(cachedErrorDetails.message);
            setConfig(null);
            setLoading(false);
            if (cachedErrorDetails.type === 'passcode_required') {
              passcodeRequiredRef.current = true;
            }
          } else if (!passcodeRequiredRef.current && errorCache.has(documentSlug)) {
            setError('You do not have permission to access this document');
            setErrorDetails({
              type: 'access_denied',
              message: 'You do not have permission to access this document'
            });
            setConfig(null);
            setLoading(false);
          }
          // If passcode_required was set by the main request, we keep it
          // (errorDetails should already be set by the main request handler)
        }
      }).catch(() => {
        // Request failed, but we'll handle it in the main request
      });
      return;
    }

    let cancelled = false;

    async function loadConfig(forceRefresh = false): Promise<DocumentConfig | null> {
      try {
        devLog(`[useDocumentConfig] Loading config for: ${documentSlug}, forceRefresh: ${forceRefresh}, cacheKey: ${cacheKey}`);
        
        // Check for passcode in URL or localStorage (check localStorage directly here to ensure latest value)
        const passcodeFromUrl = searchParams.get('passcode');
        const passcodeFromStorage = documentSlug ? localStorage.getItem(`passcode:${documentSlug}`) : null;
        const currentPasscode = passcodeFromUrl || passcodeFromStorage;
        devLog(`[useDocumentConfig] Passcode check - URL: ${passcodeFromUrl || 'none'}, localStorage: ${passcodeFromStorage || 'none'}, using: ${currentPasscode || 'none'}`);
        
        setLoading(true);
        setError(null);
        // Don't clear errorDetails if it's already passcode_required and we're not forcing refresh
        // (user might be entering passcode, or passcode was added to URL)
        if (!passcodeRequiredRef.current || forceRefresh) {
          setErrorDetails(null);
          passcodeRequiredRef.current = false;
        }
        
        // If passcode is in URL or localStorage, clear error cache for this document to allow retry
        if (currentPasscode) {
          errorCache.delete(documentSlug!);
          errorDetailsCache.delete(cacheKey); // Clear error details cache when passcode is provided
          devLog(`[useDocumentConfig] Passcode found (${passcodeFromUrl ? 'URL' : 'localStorage'}) - cleared error cache for: ${documentSlug}`);
        }

        // Add forceRefresh parameter to bypass cache
        // documentSlug is guaranteed to be non-null here due to check above
        let url = `/api/documents?doc=${encodeURIComponent(documentSlug!)}${forceRefresh ? '&forceRefresh=true' : ''}`;
        
        // Get passcode from URL or localStorage (for passcode-protected documents)
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
          // Ignore token errors - will proceed without auth header
        }
        
        devLog(`[useDocumentConfig] Fetching: ${url}`);
        // Fetch document config from API
        const response = await fetch(url, { headers });
        devLog(`[useDocumentConfig] Response status: ${response.status}`);
        
        if (!response.ok) {
          devLog(`[useDocumentConfig] Response not OK, status: ${response.status}`);
          // Check if it's a 403 or 404 error
          if (response.status === 403 || response.status === 404) {
            let errorData;
            try {
              errorData = await response.json();
            } catch (e) {
              errorData = { error: `HTTP ${response.status}`, error_type: response.status === 403 ? 'access_denied' : 'document_not_found' };
            }
            devLog(`[useDocumentConfig] Error data:`, errorData);
            
            // Check for passcode_required error FIRST (before checking auth status)
            if (errorData.error_type === 'passcode_required') {
              devLog(`[useDocumentConfig] Passcode required error detected, cancelled:`, cancelled);
              if (!cancelled) {
                passcodeRequiredRef.current = true; // Mark that we've set passcode_required
                const errorDetailsValue = {
                  type: 'passcode_required' as const,
                  message: errorData.error || 'This document requires a passcode to access',
                  documentInfo: errorData.document_info
                };
                devLog(`[useDocumentConfig] Setting errorDetails:`, errorDetailsValue);
                // Cache error details so other instances can use them
                errorDetailsCache.set(cacheKey, errorDetailsValue);
                setErrorDetails(errorDetailsValue);
                setError(errorData.error || 'This document requires a passcode to access');
                setConfig(null);
                setLoading(false);
                devLog(`[useDocumentConfig] State updated - errorDetails should be set`);
              } else {
                devLog(`[useDocumentConfig] Request was cancelled, not setting errorDetails`);
              }
              return null;
            }
            
            // If user is not authenticated (and loading has finished) and access is denied, redirect to login
            // BUT: Don't redirect if it's a passcode_required error (already handled above) or if passcode is available
            // CRITICAL: Check localStorage AGAIN here in case it was just stored
            const passcodeCheckRetry = searchParams.get('passcode') || (documentSlug ? localStorage.getItem(`passcode:${documentSlug}`) : null);
            devLog(`[useDocumentConfig] Redirect check - user: ${user?.id || 'null'}, isLoading: ${isLoading}, status: ${response.status}, error_type: ${errorData.error_type}, passcode: ${passcodeCheckRetry || 'none'}`);
            if (!isLoading && !user && (response.status === 403 || errorData.error_type === 'access_denied') 
                && errorData.error_type !== 'passcode_required' && !passcodeCheckRetry) {
              if (!cancelled && redirectAttemptedRef.current !== documentSlug) {
                redirectAttemptedRef.current = documentSlug; // Mark redirect as attempted for this document
                setLoading(false); // Set loading to false before redirecting
                // Redirect to login with return URL (include full path with /app base)
                // Use replace to avoid adding to history stack
                const currentUrl = window.location.pathname + window.location.search;
                const returnUrl = encodeURIComponent(currentUrl);
                // Only log redirect in dev mode - this is expected behavior
                devLog(`[useDocumentConfig] REDIRECTING TO LOGIN - no passcode found`);
                navigate(`/login?returnUrl=${returnUrl}`, { replace: true });
                return null;
              }
            } else if (passcodeCheckRetry) {
              devLog(`[useDocumentConfig] NOT redirecting - passcode found: ${passcodeCheckRetry.substring(0, 3)}...`);
            }
            
            // For authenticated users with 403, set error and stop retrying
            // BUT: Don't cache errors for super admins - they should be able to retry
            if (response.status === 403 && user) {
              if (!cancelled) {
                if (!isSuperAdmin) {
                  // Mark error in module-level cache so all hook instances see it
                  // documentSlug is guaranteed to be non-null here due to check above
                  errorCache.set(documentSlug!, true);
                  errorHandledRef.current = documentSlug; // Mark error as handled for this document
                }
                // Super admins shouldn't see permission errors - this might be a server bug
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
                // Return early to prevent throwing error - super admins can retry when effect re-runs
                return null;
              }
            }
            
            // For other errors (404, etc), mark as handled to prevent infinite retries
            if (response.status === 404) {
              if (!cancelled) {
                // documentSlug is guaranteed to be non-null here due to check above
                errorCache.set(documentSlug!, true);
                errorHandledRef.current = documentSlug;
                const errorMessage = errorData.error || `Document "${documentSlug}" not found`;
                const errorDetailsValue = {
                  type: 'document_not_found' as const,
                  message: errorMessage
                };
                errorDetailsCache.set(cacheKey, errorDetailsValue);
                setErrorDetails(errorDetailsValue);
                setError(errorMessage);
                setConfig(null);
                setLoading(false);
              }
            }
            
            // Don't throw error for 403/404 - we've handled them gracefully
            // Only throw for other unexpected errors
            if (response.status !== 403 && response.status !== 404) {
              throw new Error(`HTTP ${response.status}`);
            }
            return null;
          }
          
          // For other HTTP errors, throw normally
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        devLog(`[useDocumentConfig] Response data:`, data);
        const documents = data.documents || [];
        const serverCacheVersion = data.cacheVersion;
        devLog(`[useDocumentConfig] Documents array length: ${documents.length}, looking for slug: ${documentSlug}`);
        devLog(`[useDocumentConfig] Current user: ${user?.id || 'null (logged out)'}`);
        devLog(`[useDocumentConfig] Server cache version: ${serverCacheVersion || 'not provided'}`);
        
        // Check if server cache version changed (cache invalidation)
        // If cache version is newer, clear our in-memory cache to force fresh data
        if (serverCacheVersion && configCache.has(cacheKey)) {
          const cachedConfig = configCache.get(cacheKey);
          // If we have a cached version stored, compare it
          // For now, if server version exists and is different, clear cache
          // This ensures all users get fresh data when admin updates documents
          devLog(`[useDocumentConfig] Server cache version check: ${serverCacheVersion}`);
          // Clear cache for this document to ensure fresh data
          configCache.delete(cacheKey);
          devLog(`[useDocumentConfig] Cleared in-memory cache due to cache version change`);
        }
        
        // Also check localStorage cache version and clear if stale
        if (serverCacheVersion) {
          const localStorageCacheKey = `docutrain-documents-cache-v1-doc-${documentSlug}`;
          const cached = localStorage.getItem(localStorageCacheKey);
          if (cached) {
            try {
              const cacheData = JSON.parse(cached);
              const cachedVersion = cacheData.cacheVersion;
              if (cachedVersion && serverCacheVersion !== cachedVersion) {
                devLog(`[useDocumentConfig] localStorage cache version mismatch - clearing`);
                localStorage.removeItem(localStorageCacheKey);
                // Also clear related cache keys
                clearAllDocumentCaches();
              }
            } catch (e) {
              // Ignore cache check errors
            }
          }
        }
        
        // Find the document with matching slug
        const doc = documents.find((d: DocumentConfig) => d.slug === documentSlug);
        devLog(`[useDocumentConfig] Found document:`, doc ? 'YES' : 'NO');
        if (doc) {
          devLog(`[useDocumentConfig] Document access check: user=${user?.id || 'null'}, document returned=${!!doc}`);
        }

        if (!cancelled) {
          devLog(`[useDocumentConfig] Not cancelled, setting config...`);
          if (doc) {
            devLog(`[useDocumentConfig] Setting config to:`, doc);
            devLog(`[useDocumentConfig] Config details:`, {
              slug: doc.slug,
              title: doc.title,
              cover: doc.cover,
              introMessage: doc.introMessage,
              welcomeMessage: doc.welcomeMessage,
              showDocumentSelector: doc.showDocumentSelector
            });
            // Cache the successful result (only if user is logged in)
            devLog(`[useDocumentConfig] About to cache: user=${user?.id || 'null'}, willCache=${!!user}`);
            if (user) {
              configCache.set(cacheKey, doc);
              devLog(`[useDocumentConfig] Cached config with key: ${cacheKey}`);
            } else {
              devLog(`[useDocumentConfig] NOT caching config - user is logged out`);
            }
            setConfig(doc);
            setLoading(false);
            passcodeRequiredRef.current = false; // Clear passcode required flag on success
            // Clear error details cache on success
            errorDetailsCache.delete(cacheKey);
            return doc; // Return the config
          } else {
            devLog(`[useDocumentConfig] Document not found in array`);
            // If no document found and user is not authenticated (and loading has finished), it might require auth
            // BUT: Don't redirect if passcode is available (might be waiting for passcode validation)
            // CRITICAL: Check localStorage AGAIN here in case it was just stored
            const passcodeCheckRetry2 = searchParams.get('passcode') || (documentSlug ? localStorage.getItem(`passcode:${documentSlug}`) : null);
            devLog(`[useDocumentConfig] Document not found redirect check - user: ${user?.id || 'null'}, isLoading: ${isLoading}, documents.length: ${documents.length}, passcode: ${passcodeCheckRetry2 || 'none'}`);
            if (!isLoading && !user && documents.length === 0 && !passcodeCheckRetry2) {
              if (!cancelled && redirectAttemptedRef.current !== documentSlug) {
                redirectAttemptedRef.current = documentSlug; // Mark redirect as attempted for this document
                setLoading(false); // Set loading to false before redirecting
                // Redirect to login with return URL (include full path with /app base)
                // Use replace to avoid adding to history stack
                const currentUrl = window.location.pathname + window.location.search;
                const returnUrl = encodeURIComponent(currentUrl);
                devLog(`[useDocumentConfig] REDIRECTING TO LOGIN - no documents found and no passcode`);
                navigate(`/login?returnUrl=${returnUrl}`, { replace: true });
                return null;
              }
            } else if (passcodeCheckRetry2) {
              devLog(`[useDocumentConfig] NOT redirecting - passcode found: ${passcodeCheckRetry2.substring(0, 3)}...`);
            }
            
            setConfig(null);
            setError(null);
            // Don't clear errorDetails if passcode is in URL (might be validating)
            // Only clear if we're not in a passcode_required state
            if (!passcodeRequiredRef.current) {
              setErrorDetails(null);
            }
            setLoading(false);
            return null;
          }
        } else {
          devLog(`[useDocumentConfig] Request was cancelled, not updating state`);
          return null;
        }
      } catch (err) {
        if (!cancelled) {
          // Only log errors that aren't expected 403/404 (those are handled gracefully above)
          // This prevents console noise for expected access denials
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
          // Expected 403/404 are handled above and don't need error state or logging
        }
        return null;
      }
    }

    // Create and track the request promise
    const requestPromise = loadConfig(forceRefreshParam).finally(() => {
      pendingRequests.delete(cacheKey);
    });
    
    pendingRequests.set(cacheKey, requestPromise);

    // Listen for passcode storage events to trigger re-check
    const handlePasscodeStored = (event: CustomEvent) => {
      if (!cancelled && event.detail?.documentSlug === documentSlug) {
        devLog(`[useDocumentConfig] Passcode stored event received for ${documentSlug}, triggering reload`);
        errorCache.delete(documentSlug);
        // Recompute cache key with new passcode
        const newPasscode = event.detail?.passcode || localStorage.getItem(`passcode:${documentSlug}`);
        const newCacheKey = newPasscode 
          ? `${documentSlug}:${newPasscode}:${user?.id || 'anonymous'}` 
          : `${documentSlug}:${user?.id || 'anonymous'}`;
        errorDetailsCache.delete(newCacheKey);
        passcodeRequiredRef.current = false;
        redirectAttemptedRef.current = null; // Reset redirect attempt to allow retry
        // Use a small delay to ensure localStorage is fully updated
        setTimeout(() => {
          if (!cancelled) {
            loadConfig(true);
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
  }, [documentSlug, user?.id, isLoading, isSuperAdmin, passcode, forceRefreshCounter]); // Added forceRefreshCounter to trigger re-fetch

  return { config, loading, error, errorDetails };
}
