// Document ownership and edit permissions check
import { API_URL } from './config.js';

// Helper to safely use debugLog (fallback to console if not available yet)
const log = {
    verbose: (...args) => window.debugLog ? window.debugLog.verbose(...args) : console.log(...args),
    normal: (...args) => window.debugLog ? window.debugLog.normal(...args) : console.log(...args),
    quiet: (...args) => window.debugLog ? window.debugLog.quiet(...args) : console.log(...args),
    always: (...args) => console.log(...args),
    warn: (...args) => console.warn(...args),
    error: (...args) => console.error(...args)
};

// Cache for edit permissions (keyed by document slug)
// Also track the user ID that the cache belongs to, so we can auto-clear if user changes
const editPermissionCache = {};
let cachedUserId = null;

/**
 * Refresh Supabase access token using refresh token
 */
async function refreshSupabaseToken(refreshToken) {
    try {
        const supabaseUrl = 'https://mlxctdgnojvkgfqldaob.supabase.co';
        const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1seGN0ZGdub2p2a2dmcWxkYW9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1NDE1MDgsImV4cCI6MjA3NjExNzUwOH0.f4434BqvCSAdr3HWdtLaGx5Yu0eW3auK7W2afHwb8nk';
        
        console.log(`🔧 [EDIT PERMISSION] Attempting to refresh token...`);
        
        const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
            method: 'POST',
            headers: {
                'apikey': supabaseAnonKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                refresh_token: refreshToken
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error(`🔧 [EDIT PERMISSION] Token refresh failed: ${response.status}`, errorData);
            return null;
        }

        const data = await response.json();
        console.log(`🔧 [EDIT PERMISSION] ✅ Token refreshed successfully`);
        
        // Update session in localStorage
        const sessionKey = 'sb-mlxctdgnojvkgfqldaob-auth-token';
        const existingSession = localStorage.getItem(sessionKey);
        let session = existingSession ? JSON.parse(existingSession) : {};
        
        // Update session with new tokens
        session.access_token = data.access_token;
        session.refresh_token = data.refresh_token || refreshToken; // Use new refresh token if provided, otherwise keep old one
        session.expires_at = data.expires_at;
        session.expires_in = data.expires_in;
        session.token_type = data.token_type || 'bearer';
        
        localStorage.setItem(sessionKey, JSON.stringify(session));
        console.log(`🔧 [EDIT PERMISSION] Session updated in localStorage`);
        
        return data.access_token;
    } catch (error) {
        console.error('🔧 [EDIT PERMISSION] Error refreshing token:', error);
        return null;
    }
}

/**
 * Get JWT token from Supabase localStorage, refreshing if expired
 */
async function getSupabaseToken(attemptRefresh = true) {
    try {
        const sessionKey = 'sb-mlxctdgnojvkgfqldaob-auth-token';
        const sessionData = localStorage.getItem(sessionKey);

        if (!sessionData) {
            console.log(`🔧 [EDIT PERMISSION] No session data found in localStorage with key: ${sessionKey}`);
            return null;
        }

        const session = JSON.parse(sessionData);
        console.log(`🔧 [EDIT PERMISSION] Session keys:`, Object.keys(session || {}));
        let token = session?.access_token || null;
        
        if (!token) {
            console.warn(`🔧 [EDIT PERMISSION] No access_token in session. Session has:`, Object.keys(session || {}));
            return null;
        }
        
        // Check if token is expired (basic check - decode JWT and check exp claim)
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const exp = payload.exp * 1000; // Convert to milliseconds
            const now = Date.now();
            const timeUntilExpiry = exp - now;
            
            console.log(`🔧 [EDIT PERMISSION] Token expires at: ${new Date(exp).toISOString()}, current time: ${new Date(now).toISOString()}`);
            console.log(`🔧 [EDIT PERMISSION] Time until expiry: ${Math.round(timeUntilExpiry / 1000)}s (${Math.round(timeUntilExpiry / 60000)} minutes)`);
            
            if (exp < now) {
                console.warn(`🔧 [EDIT PERMISSION] ⚠️ Token expired ${Math.round((now - exp) / 1000)}s ago`);
                
                // Try to refresh the token if we have a refresh_token
                if (attemptRefresh && session?.refresh_token) {
                    console.log(`🔧 [EDIT PERMISSION] Attempting to refresh token...`);
                    const newToken = await refreshSupabaseToken(session.refresh_token);
                    if (newToken) {
                        console.log(`🔧 [EDIT PERMISSION] ✅ Token refreshed successfully`);
                        return newToken;
                    } else {
                        console.warn(`🔧 [EDIT PERMISSION] ❌ Token refresh failed - user needs to log in again`);
                        return null;
                    }
                } else {
                    console.warn(`🔧 [EDIT PERMISSION] No refresh_token available - user needs to log in again`);
                    return null;
                }
            } else {
                console.log(`🔧 [EDIT PERMISSION] ✅ Token is valid (expires in ${Math.round(timeUntilExpiry / 1000)}s)`);
            }
        } catch (e) {
            // If we can't parse the token, assume it's valid and let the server validate it
            console.warn('🔧 [EDIT PERMISSION] Could not parse token expiration, proceeding with API call');
        }
        
        return token;
    } catch (error) {
        console.error('🔧 [EDIT PERMISSION] Error getting Supabase token:', error);
        return null;
    }
}

/**
 * Get user ID from Supabase session
 */
function getUserId() {
    try {
        const sessionKey = 'sb-mlxctdgnojvkgfqldaob-auth-token';
        const sessionData = localStorage.getItem(sessionKey);

        if (!sessionData) {
            return null;
        }

        const session = JSON.parse(sessionData);
        return session?.user?.id || null;
    } catch (error) {
        console.error('Error getting user ID:', error);
        return null;
    }
}

/**
 * Check if current user can edit a document
 * Checks:
 * - Super admin (can edit any document)
 * - Owner admin for document's owner group
 * - Future: Document creator (requires created_by field migration)
 * 
 * @param {string} documentSlug - The document slug to check
 * @returns {Promise<boolean>} - True if user can edit, false otherwise
 */
export async function canEditDocument(documentSlug) {
    if (!documentSlug) {
        return false;
    }

    const currentUserId = getUserId();
    
    // Clear cache if user ID has changed (user logged in/out or switched accounts)
    if (cachedUserId !== null && cachedUserId !== currentUserId) {
        console.log(`🔧 [EDIT PERMISSION] User ID changed from ${cachedUserId} to ${currentUserId} - clearing cache`);
        clearEditPermissionCache();
    }
    cachedUserId = currentUserId;

    // Check cache first (but log it so we can debug)
    if (editPermissionCache[documentSlug] !== undefined) {
        console.log(`🔧 [EDIT PERMISSION] Using cached value for ${documentSlug}: ${editPermissionCache[documentSlug]}`);
        log.verbose(`🔐 Using cached edit permission for ${documentSlug}: ${editPermissionCache[documentSlug]}`);
        return editPermissionCache[documentSlug];
    }
    
    console.log(`🔧 [EDIT PERMISSION] No cache for ${documentSlug} - fetching from API`);

    try {
        const token = await getSupabaseToken(true); // Attempt to refresh if expired
        const userId = getUserId();

        console.log(`🔧 [EDIT PERMISSION] Token check: token=${!!token}, userId=${userId || 'null'}`);

        // Not authenticated = cannot edit
        if (!token || !userId) {
            console.log(`🔧 [EDIT PERMISSION] Not authenticated - token: ${!!token}, userId: ${!!userId}`);
            log.verbose('🔒 User not authenticated - cannot edit document');
            editPermissionCache[documentSlug] = false;
            return false;
        }

        console.log(`🔧 [EDIT PERMISSION] Making API request to: ${API_URL}/api/permissions/can-edit-document/${documentSlug}`);
        console.log(`🔧 [EDIT PERMISSION] Token length: ${token.length}, starts with: ${token.substring(0, 20)}...`);

        // Check edit permissions via API
        const response = await fetch(`${API_URL}/api/permissions/can-edit-document/${documentSlug}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log(`🔧 [EDIT PERMISSION] API response: ${response.status} ${response.statusText}`);
        log.verbose(`🔐 Edit permission API response for ${documentSlug}: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            if (response.status === 401) {
                // Try to get error details from response
                let errorDetails = '';
                try {
                    const errorData = await response.json();
                    errorDetails = errorData.details || errorData.error || '';
                    console.error(`🔧 [EDIT PERMISSION] 401 Unauthorized - Details: ${errorDetails}`);
                } catch (e) {
                    console.error(`🔧 [EDIT PERMISSION] 401 Unauthorized - Could not parse error response`);
                }
                
                // Clear cache so we don't keep using stale permission data
                delete editPermissionCache[documentSlug];
                console.log(`🔧 [EDIT PERMISSION] Cleared cache for ${documentSlug} due to 401 error`);
                log.verbose('🔒 Unauthorized - token expired or invalid. Please refresh your session or log in again.');
                editPermissionCache[documentSlug] = false;
                return false;
            }
            
            // Try to get error details
            let errorMessage = `HTTP ${response.status}`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
                log.warn(`⚠️ Failed to check edit permissions: ${errorMessage}`);
            } catch (e) {
                log.warn(`⚠️ Failed to check edit permissions: ${response.status}`);
            }
            
            editPermissionCache[documentSlug] = false;
            return false;
        }

        const data = await response.json();
        console.log(`🔧 [EDIT PERMISSION] API Response:`, data);
        const canEdit = data.can_edit || false;

        // Cache the result
        editPermissionCache[documentSlug] = canEdit;

        log.verbose(`🔐 Edit permission for ${documentSlug}: ${canEdit}`);
        return canEdit;

    } catch (error) {
        console.error('Error checking edit permissions:', error);
        editPermissionCache[documentSlug] = false;
        return false;
    }
}

/**
 * Clear edit permission cache for a specific document
 */
export function clearEditPermissionCacheForDocument(documentSlug) {
    if (editPermissionCache[documentSlug] !== undefined) {
        delete editPermissionCache[documentSlug];
        console.log(`🔧 [EDIT PERMISSION] Cleared cache for ${documentSlug}`);
        log.verbose(`🔄 Cleared edit permission cache for ${documentSlug}`);
    }
}

/**
 * Clear ALL edit permission cache (useful when user logs in/out or permissions change)
 */
export function clearEditPermissionCache() {
    Object.keys(editPermissionCache).forEach(key => delete editPermissionCache[key]);
    cachedUserId = null;
    console.log(`🔧 [EDIT PERMISSION] Cleared all cache`);
    log.verbose('🔄 Cleared edit permission cache');
}

// Expose globally for use in inline-editor.js
window.clearEditPermissionCacheForDocument = clearEditPermissionCacheForDocument;
window.clearEditPermissionCache = clearEditPermissionCache;

