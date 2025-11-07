/**
 * DocumentAccessContext - Centralized document access and configuration
 * 
 * Single source of truth for:
 * - Document configuration fetching
 * - Access control (passcode, authentication, permissions)
 * - Error states (access denied, not found, etc.)
 * 
 * Replaces scattered fetch logic in useDocumentConfig, DocumentSelector, DisclaimerModal
 */

import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { getAuthHeaders } from '@/lib/api/authService';

// ============================================================================
// Types
// ============================================================================

export interface Keyword {
  term: string;
  weight: number;
}

export interface Download {
  url: string;
  title: string;
  attachment_id?: string; // Optional attachment ID for tracking downloads
}

export interface DocumentConfig {
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
  showReferences?: boolean;
  showDisclaimer?: boolean;
  disclaimerText?: string;
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

type AccessStatus = 'checking' | 'granted' | 'denied' | 'not_found';

interface DocumentAccessState {
  documentSlug: string | null;
  config: DocumentConfig | null;
  loading: boolean;
  accessStatus: AccessStatus;
  error: string | null;
  errorDetails: DocumentConfigError | null;
  isReady: boolean; // Combined auth + permissions + config ready state
  refresh: () => void;
}

// ============================================================================
// Context
// ============================================================================

export const DocumentAccessContext = createContext<DocumentAccessState | undefined>(undefined);

// ============================================================================
// Request Deduplication
// ============================================================================

type RequestResult = {
  config: DocumentConfig | null;
  errorDetails: DocumentConfigError | null;
  error: string | null;
};

// Module-level cache to prevent duplicate requests
const pendingRequests = new Map<string, Promise<RequestResult>>();

// ============================================================================
// Provider
// ============================================================================

interface DocumentAccessProviderProps {
  children: React.ReactNode;
  documentSlug: string | null; // Pass from URL params
}

export function DocumentAccessProvider({ children, documentSlug }: DocumentAccessProviderProps) {
  const { user, loading: authLoading } = useAuth();
  const permissions = usePermissions();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // State
  const [config, setConfig] = useState<DocumentConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<DocumentConfigError | null>(null);
  const [accessStatus, setAccessStatus] = useState<AccessStatus>('checking');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [passcodeTrigger, setPasscodeTrigger] = useState(0); // Track localStorage changes

  // Refs for non-reactive values
  const redirectAttemptedRef = useRef<string | null>(null);
  const fetchInProgressRef = useRef(false);
  const isSuperAdminRef = useRef(false);

  // Update ref when permissions change (doesn't trigger re-render)
  isSuperAdminRef.current = permissions.isSuperAdmin;

  // Extract passcode reactively
  const passcode = useMemo(() => {
    const passcodeFromUrl = searchParams.get('passcode');
    const passcodeFromStorage = documentSlug ? localStorage.getItem(`passcode:${documentSlug}`) : null;
    return passcodeFromUrl || passcodeFromStorage;
  }, [searchParams, documentSlug, passcodeTrigger]);
  
  // Combined ready state
  const isAuthAndPermissionsReady = !authLoading && !permissions.loading;
  const isReady = isAuthAndPermissionsReady && !loading && !!config;
  
  // Refresh function
  const refresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };
  
  // Listen for document-updated events (from Realtime or other sources)
  useEffect(() => {
    const handleDocumentUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ documentSlug?: string }>;
      const updatedSlug = customEvent.detail?.documentSlug;
      
      // Trigger refresh if it's our document or no specific slug
      if (!updatedSlug || updatedSlug === documentSlug) {
        refresh();
      }
    };

    window.addEventListener('document-updated', handleDocumentUpdate as EventListener);
    
    return () => {
      window.removeEventListener('document-updated', handleDocumentUpdate as EventListener);
    };
  }, [documentSlug]);
  
  // Listen for passcode-stored events
  useEffect(() => {
    const handlePasscodeStored = (event: CustomEvent) => {
      if (event.detail?.documentSlug === documentSlug) {
        redirectAttemptedRef.current = null;
        setPasscodeTrigger(prev => prev + 1); // Trigger passcode re-computation
        refresh();
      }
    };

    window.addEventListener('passcode-stored', handlePasscodeStored as EventListener);

    return () => {
      window.removeEventListener('passcode-stored', handlePasscodeStored as EventListener);
    };
  }, [documentSlug, refresh]);
  
  // Main effect: Fetch document configuration
  useEffect(() => {
    // No document slug = no fetch needed
    if (!documentSlug) {
      setConfig(null);
      setLoading(false);
      setError(null);
      setErrorDetails(null);
      setAccessStatus('checking');
      redirectAttemptedRef.current = null;
      return;
    }

    // Wait for auth and permissions to finish loading
    if (!isAuthAndPermissionsReady) {
      return;
    }

    // Prevent duplicate fetches
    if (fetchInProgressRef.current) {
      return;
    }

    let cancelled = false;

    // Check access requirements first (lightweight call that won't trigger 403)
    async function checkAccessRequirements(): Promise<RequestResult> {
      try {
        fetchInProgressRef.current = true;
        setLoading(true);
        setError(null);
        setErrorDetails(null);
        setAccessStatus('checking');

        const accessCheckUrl = `/api/permissions/document-access/${encodeURIComponent(documentSlug || '')}${passcode ? `?passcode=${encodeURIComponent(passcode)}` : ''}`;
        const response = await fetch(accessCheckUrl, { headers: getAuthHeaders() });

        if (!response.ok) {
          if (response.status === 404) {
            // Document doesn't exist
            const errorDetailsValue = {
              type: 'document_not_found' as const,
              message: `Document "${documentSlug || 'unknown'}" not found`
            };

            if (!cancelled) {
              setErrorDetails(errorDetailsValue);
              setError(errorDetailsValue.message);
              setConfig(null);
              setAccessStatus('not_found');
              setLoading(false);
            }

            return {
              config: null,
              errorDetails: errorDetailsValue,
              error: errorDetailsValue.message
            };
          }

          throw new Error(`HTTP ${response.status}`);
        }

        const accessData = await response.json();

        // If user has access, fetch full config
        if (accessData.has_access) {
          return await fetchDocument();
        }

        // Handle access requirements - user doesn't have access
        if (accessData.requires_passcode) {
          // Passcode required - show modal
          const errorDetailsValue = {
            type: 'passcode_required' as const,
            message: 'This document requires a passcode to access',
            documentInfo: {
              title: documentSlug || 'Unknown Document',
              requires_passcode: true
            }
          };

          if (!cancelled) {
            setErrorDetails(errorDetailsValue);
            setError(errorDetailsValue.message);
            setConfig(null);
            setAccessStatus('denied');
            setLoading(false);
          }

          return {
            config: null,
            errorDetails: errorDetailsValue,
            error: errorDetailsValue.message
          };
        }

        // If requires_auth is true OR user doesn't have access and is not authenticated, redirect to login
        // This handles owner-restricted documents that require authentication
        if ((accessData.requires_auth || (!accessData.has_access && !user)) && !user) {
          // Auth required but user not logged in
          if (!cancelled && redirectAttemptedRef.current !== documentSlug) {
            redirectAttemptedRef.current = documentSlug;
            setLoading(false);
            
            // Store owner info in sessionStorage if available (for showing owner logo on login page)
            if (accessData.owner) {
              try {
                sessionStorage.setItem('auth_owner_info', JSON.stringify({
                  id: accessData.owner.id,
                  name: accessData.owner.name,
                  slug: accessData.owner.slug,
                  logo_url: accessData.owner.logo_url
                }));
              } catch (error) {
                console.error('Failed to store owner info in sessionStorage:', error);
              }
            }
            
            // Remove /app prefix since router basename is /app
            const currentPath = window.location.pathname.replace(/^\/app/, '') || '/';
            const currentSearch = window.location.search;
            const currentUrl = currentPath + currentSearch;
            const returnUrl = encodeURIComponent(currentUrl);
            // Use window.location.href instead of navigate to preserve query params
            window.location.href = `/app/login?returnUrl=${returnUrl}`;
            return { config: null, errorDetails: null, error: null };
          }
        }

        // Access denied for other reasons
        const errorDetailsValue = {
          type: 'access_denied' as const,
          message: 'You do not have permission to access this document'
        };

        if (!cancelled) {
          setError(errorDetailsValue.message);
          setErrorDetails(errorDetailsValue);
          setConfig(null);
          setAccessStatus('denied');
          setLoading(false);
        }

        return {
          config: null,
          errorDetails: errorDetailsValue,
          error: errorDetailsValue.message
        };

      } catch (error) {
        console.error('[DocumentAccess] Access check error:', error);
        // Fall back to original behavior on error
        return await fetchDocument();
      }
    }
    
    // Create unique request key (includes refreshTrigger to bust cache on updates)
    const requestKey = `${documentSlug}:${user?.id || 'anon'}:${passcode || 'none'}:${refreshTrigger}`;

    // Check for existing pending request
    const existingRequest = pendingRequests.get(requestKey);
    if (existingRequest) {
      existingRequest.then((result) => {
        if (!cancelled) {
          setConfig(result.config);
          setErrorDetails(result.errorDetails);
          setError(result.error);
          setAccessStatus(result.config ? 'granted' : result.errorDetails?.type === 'document_not_found' ? 'not_found' : 'denied');
          setLoading(false);
        }
      });
      return;
    }

    async function fetchDocument(): Promise<RequestResult> {
      try {
        fetchInProgressRef.current = true;
        setLoading(true);
        setError(null);
        setErrorDetails(null);
        setAccessStatus('checking');
        
        // Build API URL
        let url = `/api/documents?doc=${encodeURIComponent(documentSlug || '')}`;
        if (passcode) {
          url += `&passcode=${encodeURIComponent(passcode)}`;
        }
        
        // Add timeout
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const timeout = isMobile ? 20000 : 10000;
        
        const fetchWithTimeout = Promise.race([
          fetch(url, { headers: getAuthHeaders() }),
          new Promise<Response>((_, reject) => 
            setTimeout(() => reject(new Error(`Request timed out after ${timeout}ms`)), timeout)
          )
        ]);
        
        const response = await fetchWithTimeout;
        
        // Handle errors
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
            
            // Passcode required
            if (errorData.error_type === 'passcode_required') {
              const errorMsg = errorData.error || 'This document requires a passcode to access';
              const errorDetailsValue = {
                type: 'passcode_required' as const,
                message: errorMsg,
                documentInfo: errorData.document_info
              };
              
              if (!cancelled) {
                setErrorDetails(errorDetailsValue);
                setError(errorMsg);
                setConfig(null);
                setAccessStatus('denied');
                setLoading(false);
              }
              
              return {
                config: null,
                errorDetails: errorDetailsValue,
                error: errorMsg
              };
            }
            
            // Unauthenticated user with 403 -> redirect to login
            if (!user && response.status === 403 && errorData.error_type !== 'passcode_required' && !passcode) {
              if (!cancelled && redirectAttemptedRef.current !== documentSlug) {
                redirectAttemptedRef.current = documentSlug;
                setLoading(false);
                // Remove /app prefix since router basename is /app
                const currentPath = window.location.pathname.replace(/^\/app/, '') || '/';
                const currentSearch = window.location.search;
                const currentUrl = currentPath + currentSearch;
                const returnUrl = encodeURIComponent(currentUrl);
                // Use window.location.href instead of navigate to preserve query params
                window.location.href = `/app/login?returnUrl=${returnUrl}`;
                return { config: null, errorDetails: null, error: null };
              }
            }
            
            // Authenticated user with 403 -> access denied
            if (response.status === 403 && user) {
              const errorMessage = isSuperAdminRef.current
                ? 'Unable to access document. This may be a server issue.'
                : 'You do not have permission to access this document';
              const errorDetailsValue = {
                type: 'access_denied' as const,
                message: errorMessage
              };
              
              if (!cancelled) {
                setError(errorMessage);
                setErrorDetails(errorDetailsValue);
                setConfig(null);
                setAccessStatus('denied');
                setLoading(false);
              }
              
              return {
                config: null,
                errorDetails: errorDetailsValue,
                error: errorMessage
              };
            }
            
            // 404 error
            if (response.status === 404) {
              const errorMessage = errorData.error || `Document "${documentSlug}" not found`;
              const errorDetailsValue = {
                type: 'document_not_found' as const,
                message: errorMessage
              };
              
              if (!cancelled) {
                setErrorDetails(errorDetailsValue);
                setError(errorMessage);
                setConfig(null);
                setAccessStatus('not_found');
                setLoading(false);
              }
              
              return {
                config: null,
                errorDetails: errorDetailsValue,
                error: errorMessage
              };
            }
          }
          
          throw new Error(`HTTP ${response.status}`);
        }
        
        // Success - parse response
        const data = await response.json();
        const documents = data.documents || [];
        const doc = documents.find((d: DocumentConfig) => d.slug === documentSlug);
        
        if (!cancelled) {
          if (doc) {
            setConfig(doc);
            setLoading(false);
            setErrorDetails(null);
            setError(null);
            setAccessStatus('granted');
            return {
              config: doc,
              errorDetails: null,
              error: null
            };
          } else {
            // No document found, but no error either (might need auth)
            if (!user && documents.length === 0 && !passcode) {
              if (!cancelled && redirectAttemptedRef.current !== documentSlug) {
                redirectAttemptedRef.current = documentSlug;
                setLoading(false);
                // Remove /app prefix since router basename is /app
                const currentPath = window.location.pathname.replace(/^\/app/, '') || '/';
                const currentSearch = window.location.search;
                const currentUrl = currentPath + currentSearch;
                const returnUrl = encodeURIComponent(currentUrl);
                // Use window.location.href instead of navigate to preserve query params
                window.location.href = `/app/login?returnUrl=${returnUrl}`;
                return { config: null, errorDetails: null, error: null };
              }
            }
            
            setConfig(null);
            setError(null);
            setErrorDetails(null);
            setAccessStatus('not_found');
            setLoading(false);
            return { config: null, errorDetails: null, error: null };
          }
        }
        
        return { config: null, errorDetails: null, error: null };
      } catch (err) {
        if (!cancelled) {
          const isExpectedError = err instanceof Error && (err.message.includes('HTTP 403') || err.message.includes('HTTP 404'));
          if (!isExpectedError) {
            console.error('[DocumentAccessContext] Unexpected error:', err);
            const errorMsg = err instanceof Error ? err.message : 'Failed to load document';
            const errorDetailsValue = {
              type: 'unknown' as const,
              message: errorMsg
            };
            setError(errorMsg);
            setErrorDetails(errorDetailsValue);
            setConfig(null);
            setAccessStatus('denied');
            setLoading(false);
            return {
              config: null,
              errorDetails: errorDetailsValue,
              error: errorMsg
            };
          }
        }
        return { config: null, errorDetails: null, error: null };
      }
    }
    
    // Create and track request promise - start with access check
    const requestPromise = checkAccessRequirements().finally(() => {
      pendingRequests.delete(requestKey);
      fetchInProgressRef.current = false;
    });

    pendingRequests.set(requestKey, requestPromise);

    return () => {
      // Only cancel if no fetch in progress
      if (!fetchInProgressRef.current) {
        cancelled = true;
      }
    };
  }, [documentSlug, user?.id, isAuthAndPermissionsReady, passcode, refreshTrigger, navigate]);
  
  const value: DocumentAccessState = {
    documentSlug,
    config,
    loading,
    accessStatus,
    error,
    errorDetails,
    isReady,
    refresh,
  };
  
  return (
    <DocumentAccessContext.Provider value={value}>
      {children}
    </DocumentAccessContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useDocumentAccess() {
  const context = useContext(DocumentAccessContext);
  if (context === undefined) {
    throw new Error('useDocumentAccess must be used within DocumentAccessProvider');
  }
  return context;
}

