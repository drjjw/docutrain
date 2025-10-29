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
const editPermissionCache = {};

/**
 * Get JWT token from Supabase localStorage
 */
function getSupabaseToken() {
    try {
        const sessionKey = 'sb-mlxctdgnojvkgfqldaob-auth-token';
        const sessionData = localStorage.getItem(sessionKey);

        if (!sessionData) {
            return null;
        }

        const session = JSON.parse(sessionData);
        return session?.access_token || null;
    } catch (error) {
        console.error('Error getting Supabase token:', error);
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

    // Check cache first (but log it so we can debug)
    if (editPermissionCache[documentSlug] !== undefined) {
        console.log(`🔧 [EDIT PERMISSION] Using cached value for ${documentSlug}: ${editPermissionCache[documentSlug]}`);
        log.verbose(`🔐 Using cached edit permission for ${documentSlug}: ${editPermissionCache[documentSlug]}`);
        return editPermissionCache[documentSlug];
    }
    
    console.log(`🔧 [EDIT PERMISSION] No cache for ${documentSlug} - fetching from API`);

    try {
        const token = getSupabaseToken();
        const userId = getUserId();

        // Not authenticated = cannot edit
        if (!token || !userId) {
            log.verbose('🔒 User not authenticated - cannot edit document');
            editPermissionCache[documentSlug] = false;
            return false;
        }

        // Check edit permissions via API
        const response = await fetch(`${API_URL}/api/permissions/can-edit-document/${documentSlug}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        log.verbose(`🔐 Edit permission API response for ${documentSlug}: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            if (response.status === 401) {
                log.verbose('🔒 Unauthorized - token expired or invalid');
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
    console.log(`🔧 [EDIT PERMISSION] Cleared all cache`);
    log.verbose('🔄 Cleared edit permission cache');
}

// Expose globally for use in inline-editor.js
window.clearEditPermissionCacheForDocument = clearEditPermissionCacheForDocument;
window.clearEditPermissionCache = clearEditPermissionCache;

