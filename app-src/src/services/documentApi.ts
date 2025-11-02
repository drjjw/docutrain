// Type-safe document API service

export interface DocumentInfo {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  welcomeMessage?: string;
  introMessage?: string;
  cover?: string;
  backLink?: string;
  embeddingType?: string;
  active: boolean;
  owner?: string;
  ownerInfo?: {
    slug: string;
    name: string;
    logo_url?: string;
  };
  showDocumentSelector?: boolean;
  metadata?: Record<string, any>;
}

export interface DocumentsResponse {
  documents: DocumentInfo[];
  cacheVersion?: number; // Server cache version for client-side invalidation
}

export function getAPIUrl(): string {
  // API routes are at the root, not under /app
  // If we're at /app/chat, we need to go to root for /api routes
  const pathname = window.location.pathname;
  
  // If we're in /app/*, remove /app to get the root
  if (pathname.startsWith('/app/')) {
    return window.location.origin;
  }
  
  // Otherwise, use current directory
  const baseDir = pathname.substring(0, pathname.lastIndexOf('/') + 1);
  return (window.location.origin + baseDir).replace(/\/$/, '');
}

function getAuthToken(): string | null {
  try {
    const sessionData = localStorage.getItem('sb-mlxctdgnojvkgfqldaob-auth-token');
    if (sessionData) {
      const session = JSON.parse(sessionData);
      return session?.access_token || null;
    }
  } catch (error) {
    console.log('⚠️ Could not get JWT token:', error);
  }
  return null;
}

export async function fetchDocuments(options?: {
  doc?: string | string[];
  owner?: string;
  passcode?: string;
  forceRefresh?: boolean;
}): Promise<DocumentsResponse> {
  const { doc, owner, passcode, forceRefresh = false } = options || {};
  
  // Build cache key
  const CACHE_KEY = 'docutrain-documents-cache-v1'; // Changed from ukidney-documents-cache to docutrain-documents-cache (v1)
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  
  let cacheKey = CACHE_KEY;
  let apiUrl = `${getAPIUrl()}/api/documents`;
  
  if (owner) {
    cacheKey = `${CACHE_KEY}-owner-${owner}`;
    apiUrl += `?owner=${encodeURIComponent(owner)}`;
  } else if (doc) {
    const docSlug = Array.isArray(doc) ? doc.join(',') : doc;
    cacheKey = `${CACHE_KEY}-doc-${docSlug}`;
    apiUrl += `?doc=${encodeURIComponent(docSlug)}`;
  } else {
    cacheKey = `${CACHE_KEY}-doc-smh`;
    apiUrl += '?doc=smh';
  }
  
  if (passcode) {
    apiUrl += apiUrl.includes('?') ? '&' : '?';
    apiUrl += `passcode=${encodeURIComponent(passcode)}`;
  }
  
  // Check cache first - but validate cache version if available
  if (!forceRefresh) {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const cacheData = JSON.parse(cached);
        const { documents, timestamp, cacheVersion: cachedVersion } = cacheData;
        const age = Date.now() - timestamp;
        
        // Check if cache is still valid (not expired)
        if (age < CACHE_TTL) {
          // If cache version exists, we need to validate it hasn't changed
          // Make a lightweight fetch to check version (only if we have a cached version)
          if (cachedVersion) {
            // Fetch fresh data to check cache version
            // This ensures we don't use stale cache after admin updates
            console.log('🔄 Checking cache version before using cached data...');
            // Continue to fetch below to validate cache version
          } else {
            // No cache version stored - use cache but will update with version on next fetch
            console.log('📦 Using cached documents (no version check)');
            return { documents, cacheVersion: cachedVersion };
          }
        }
      } catch (e) {
        // Invalid cache data, remove it
        localStorage.removeItem(cacheKey);
      }
    }
  }
  
  // Fetch from API (either cache expired, forceRefresh, or version check needed)
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(apiUrl, { headers });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch documents: ${response.status}`);
  }
  
  const data: DocumentsResponse = await response.json();
  
  // Check if server cache version changed (cache invalidation)
  const cached = localStorage.getItem(cacheKey);
  if (cached && data.cacheVersion) {
    try {
      const cacheData = JSON.parse(cached);
      const cachedVersion = cacheData.cacheVersion;
      
      // If server version is newer or different, cache was invalidated
      if (cachedVersion && data.cacheVersion !== cachedVersion) {
        console.log(`🔄 Cache version mismatch (cached: ${cachedVersion}, server: ${data.cacheVersion}) - cache was stale, using fresh data`);
        // Clear all related caches to ensure fresh data
        clearAllDocumentCaches();
      }
    } catch (e) {
      // Ignore cache version check errors
    }
  }
  
  // Cache the result with cache version
  try {
    localStorage.setItem(cacheKey, JSON.stringify({
      documents: data.documents,
      timestamp: Date.now(),
      cacheVersion: data.cacheVersion
    }));
  } catch (e) {
    console.warn('Failed to cache documents:', e);
  }
  
  return data;
}

export async function fetchDocument(slug: string, forceRefresh = false): Promise<DocumentInfo | null> {
  const response = await fetchDocuments({ doc: slug, forceRefresh });
  return response.documents.find(d => d.slug === slug) || null;
}

/**
 * Clear all document cache keys from localStorage
 * This includes all versioned cache keys (v1, v2, v3, etc.) and their variations
 * Also clears legacy ukidney-documents-cache keys for backward compatibility
 */
export function clearAllDocumentCaches() {
  const documentCacheKeys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('docutrain-documents-cache') || key.startsWith('ukidney-documents-cache'))) {
      documentCacheKeys.push(key);
    }
  }
  documentCacheKeys.forEach(key => {
    localStorage.removeItem(key);
    console.log(`🗑️ Cleared cache key: ${key}`);
  });
  return documentCacheKeys.length;
}

