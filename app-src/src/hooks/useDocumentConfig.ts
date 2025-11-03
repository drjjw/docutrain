/**
 * useDocumentConfig - Thin wrapper around DocumentAccessContext
 * 
 * DEPRECATED: This hook now delegates to DocumentAccessContext for backwards compatibility.
 * New code should use useDocumentAccess() directly.
 * 
 * This maintains the same API as before but eliminates duplicate fetching logic.
 */

import { useDocumentAccess } from '@/contexts/DocumentAccessContext';

// Re-export types for backwards compatibility
export type {
  DocumentConfig,
  DocumentConfigError,
  Keyword,
  Download,
} from '@/contexts/DocumentAccessContext';

/**
 * Hook for fetching document configuration
 * Now delegates to DocumentAccessContext
 * @deprecated Use useDocumentAccess() directly
 */
export function useDocumentConfig(documentSlug: string | null) {
  const { config, loading, error, errorDetails } = useDocumentAccess();
  
  // Note: documentSlug parameter is ignored - context manages this via provider
  // This is intentional for backwards compatibility
  
  return { config, loading, error, errorDetails };
}
