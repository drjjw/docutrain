/**
 * Document cache utility
 * Centralized cache management to avoid circular dependencies
 */

// Module-level caches (shared with useDocumentConfig)
// These are accessed via getters/setters to avoid direct imports
let configCache: Map<string, any> | null = null;
let errorCache: Map<string, boolean> | null = null;
let errorDetailsCache: Map<string, any> | null = null;
let pendingRequests: Map<string, Promise<any>> | null = null;

/**
 * Register cache instances from useDocumentConfig
 * Called by useDocumentConfig to share cache instances
 */
export function registerDocumentCaches(
  config: Map<string, any>,
  error: Map<string, boolean>,
  errorDetails: Map<string, any>,
  pending: Map<string, Promise<any>>
) {
  configCache = config;
  errorCache = error;
  errorDetailsCache = errorDetails;
  pendingRequests = pending;
}

/**
 * Clear all document config caches
 * Called on logout to ensure no cached documents are accessible after logout
 */
export function clearDocumentConfigCaches() {
  console.log('[documentCache] Clearing ALL document config caches due to logout');
  if (configCache) configCache.clear();
  if (errorCache) errorCache.clear();
  if (errorDetailsCache) errorDetailsCache.clear();
  if (pendingRequests) pendingRequests.clear();
}

