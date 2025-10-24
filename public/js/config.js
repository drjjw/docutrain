// Configuration and constants

// Base URL configuration - auto-detect or use window location
export function getAPIBaseURL() {
    // Get the directory the chatbot is loaded from
    const currentPath = window.location.pathname;
    const baseDir = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
    return window.location.origin + baseDir;
}

export const API_URL = getAPIBaseURL().replace(/\/$/, ''); // Remove trailing slash

// Document configuration cache
const CACHE_KEY = 'ukidney-documents-cache-v3'; // Increment version to force cache refresh
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Fallback configuration if API fails
const fallbackDocConfig = {
    'smh': {
        slug: 'smh',
        title: 'Nephrology Manual',
        subtitle: 'St. Michael\'s Hospital · Interactive search and consultation',
        backLink: 'https://ukidney.com/nephrology-publications/nephrology-manuals/st-michael-s-hospital-nephrology-manual',
        welcomeMessage: 'SMH Housestaff Manual',
        embeddingType: 'openai',
        active: true,
        owner: 'ukidney',
        metadata: {}
    },
    'uhn': {
        slug: 'uhn',
        title: 'Nephrology Manual',
        subtitle: 'University Health Network · Interactive search and consultation',
        backLink: 'https://ukidney.com/nephrology-publications/nephrology-manuals/university-health-network-nephrology-manual',
        welcomeMessage: 'UHN Nephrology Manual',
        embeddingType: 'openai',
        active: true,
        owner: 'ukidney',
        metadata: {}
    },
    'ckd-dc-2025': {
        slug: 'ckd-dc-2025',
        title: 'CKD in Diabetes Guidelines',
        subtitle: 'Diabetes Canada Clinical Practice Guideline 2025 · Interactive search and consultation',
        backLink: 'https://ukidney.com/nephrology-publications/nephrology-manuals/ckd-diabetes-guidelines-2025',
        welcomeMessage: 'CKD in Diabetes: Clinical Practice Guideline 2025',
        embeddingType: 'local',
        active: true,
        owner: 'ukidney',
        metadata: {}
    }
};

// Cache for owner logo configurations
let ownerLogoConfigCache = null;
const OWNER_LOGO_CACHE_KEY = 'owner-logo-config-cache-v3'; // Updated version to force cache refresh
const OWNER_LOGO_CACHE_TTL = 10 * 60 * 1000; // 10 minutes (longer than document cache)

/**
 * Fetch owner logo configurations from API
 */
async function loadOwnerLogoConfigs(forceRefresh = false) {
    try {
        // Check for force refresh from URL parameter (for development)
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('refresh') === 'logos') {
            forceRefresh = true;
            console.log('🔄 Force refreshing logo cache due to URL parameter');
        }

        // Check cache first (unless force refresh requested)
        if (!forceRefresh) {
            const cached = localStorage.getItem(OWNER_LOGO_CACHE_KEY);
            if (cached) {
                const { configs, timestamp } = JSON.parse(cached);
                const age = Date.now() - timestamp;

                if (age < OWNER_LOGO_CACHE_TTL) {
                    console.log('📦 Using cached owner logo configs');
                    ownerLogoConfigCache = configs;
                    return configs;
                }
            }
        }

        // Fetch from API
        console.log('🔄 Fetching owner logo configs from API...');
        const response = await fetch(`${API_URL}/api/owners`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const configs = data.owners || {};

        // Cache the results
        localStorage.setItem(OWNER_LOGO_CACHE_KEY, JSON.stringify({
            configs,
            timestamp: Date.now()
        }));

        ownerLogoConfigCache = configs;
        console.log(`✓ Loaded logo configs for ${Object.keys(configs).length} owners`);

        return configs;
    } catch (error) {
        console.warn('⚠️  Failed to load owner logo configs from API:', error.message);
        console.log('   Using empty configuration');
        ownerLogoConfigCache = {};
        return {};
    }
}

/**
 * Get logo configuration for a document owner
 */
export async function getOwnerLogoConfig(owner) {
    if (!ownerLogoConfigCache) {
        await loadOwnerLogoConfigs();
    }
    return ownerLogoConfigCache[owner] || null; // Return null if owner not found
}

/**
 * Preload logos for documents that will be used
 * Only preloads logos for the current document's owner to avoid loading hundreds of logos
 */
export async function preloadLogos() {
    try {
        // Set default accent colors immediately to prevent flashing
        setDefaultAccentColors();
        
        // Note: We no longer preload ALL owner logos on page load
        // Document logos are loaded on-demand when a document is selected
        // User avatar logos are loaded separately via the permissions API
        console.log('🎨 Logo preloading optimized - loading on-demand');
    } catch (error) {
        console.warn('⚠️ Failed to initialize logo system:', error.message);
        // Still set default colors even if loading fails
        setDefaultAccentColors();
    }
}

/**
 * Set default accent colors to prevent flashing
 */
function setDefaultAccentColors() {
    const root = document.documentElement;
    // Set neutral gray as default (will be overridden by owner-specific colors)
    // This prevents red flashing while maintaining visual consistency
    root.style.setProperty('--accent-color', '#666666');
    root.style.setProperty('--accent-color-rgb', '102, 102, 102');
    root.style.setProperty('--accent-color-hover', '#555555');
    root.style.setProperty('--accent-color-shadow', 'rgba(102, 102, 102, 0.2)');
}

// Set default colors immediately when this script loads to prevent flashing
setDefaultAccentColors();

// Dynamic document configuration (loaded from API)
let docConfigCache = null;

/**
 * Fetch documents from API with caching
 * Now supports filtered loading based on URL parameters
 */
export async function loadDocuments(forceRefresh = false) {
    try {
        // Get URL parameters to determine what to load
        const urlParams = new URLSearchParams(window.location.search);
        const docParam = urlParams.get('doc');
        const ownerParam = urlParams.get('owner');
        
        // Build cache key based on what we're loading
        let cacheKey = CACHE_KEY;
        let apiUrl = `${API_URL}/api/documents`;
        
        if (ownerParam) {
            // Owner mode: load all documents for this owner
            cacheKey = `${CACHE_KEY}-owner-${ownerParam}`;
            apiUrl += `?owner=${encodeURIComponent(ownerParam)}`;
            console.log('🔍 Loading documents for owner:', ownerParam);
        } else if (docParam) {
            // Doc mode: load only specific document(s)
            cacheKey = `${CACHE_KEY}-doc-${docParam}`;
            apiUrl += `?doc=${encodeURIComponent(docParam)}`;
            console.log('🔍 Loading specific document(s):', docParam);
        } else {
            // Default: load default document
            cacheKey = `${CACHE_KEY}-doc-smh`;
            apiUrl += '?doc=smh';
            console.log('🔍 Loading default document: smh');
        }
        
        // Check cache first (unless force refresh requested)
        if (!forceRefresh) {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const { documents, timestamp } = JSON.parse(cached);
                const age = Date.now() - timestamp;

                if (age < CACHE_TTL) {
                    console.log('📦 Using cached documents');
                    docConfigCache = documents;
                    return documents;
                }
            }
        }
        
        // Fetch from API with authentication if available
        console.log('🔄 Fetching documents from API...');

        // Get JWT token from Supabase localStorage (same as access-check.js)
        let headers = {
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
                    console.log('🔑 Including JWT token in documents API request');
                }
            }
        } catch (error) {
            console.log('⚠️ Could not get JWT token for documents request:', error);
        }

        const response = await fetch(apiUrl, { headers });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        const documents = {};
        
        // Convert array to object keyed by slug
        data.documents.forEach(doc => {
            documents[doc.slug] = doc;
        });
        
        // Cache the results
        localStorage.setItem(cacheKey, JSON.stringify({
            documents,
            timestamp: Date.now()
        }));
        
        docConfigCache = documents;
        console.log(`✓ Loaded ${data.documents.length} documents from registry`);

        return documents;
    } catch (error) {
        console.warn('⚠️  Failed to load documents from API:', error.message);
        console.log('   Using fallback configuration');
        docConfigCache = fallbackDocConfig;
        return fallbackDocConfig;
    }
}

/**
 * Get document configuration (with lazy loading)
 */
export async function getDocConfig(forceRefresh = false) {
    if (!docConfigCache || forceRefresh) {
        await loadDocuments(forceRefresh);
    }
    return docConfigCache;
}

/**
 * Get a specific document by slug (case-insensitive)
 */
export async function getDocument(slug, forceRefresh = false) {
    const config = await getDocConfig(forceRefresh);
    const lowerSlug = slug.toLowerCase();
    const actualKey = Object.keys(config).find(key => key.toLowerCase() === lowerSlug);
    return actualKey ? config[actualKey] : null;
}

/**
 * Check if a document exists (case-insensitive)
 */
export async function documentExists(slug, forceRefresh = false) {
    const config = await getDocConfig(forceRefresh);
    const lowerSlug = slug.toLowerCase();
    return Object.keys(config).some(key => key.toLowerCase() === lowerSlug);
}

/**
 * Clear the document cache (useful for debugging)
 */
export function clearDocumentCache() {
    localStorage.removeItem(CACHE_KEY);
    docConfigCache = null;
    console.log('🗑️  Document cache cleared');
}

// Generate a unique session ID for this browser session
export function generateSessionId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Parse document slug parameter - supports multiple documents with + separator
 * Note: In URLs, + is decoded as a space, so we need to handle both
 * @returns {Array<string>} Array of document slugs
 */
export function parseDocumentSlugs() {
    const params = new URLSearchParams(window.location.search);
    const docParam = params.get('doc') || 'smh';
    
    // Split on both + and space (since + gets decoded to space in URLs)
    // Then filter out empty strings
    const slugs = docParam.split(/[\s+]+/).map(s => s.trim()).filter(s => s);
    
    return slugs;
}

/**
 * Get embedding type from URL parameter (openai or local)
 * For multi-document queries, uses the first document's default embedding type
 */
export function getEmbeddingType() {
    const params = new URLSearchParams(window.location.search);
    const docSlugs = parseDocumentSlugs();
    const firstDoc = docSlugs[0];

    // ckd-dc-2025 uses local embeddings, others use OpenAI by default
    if (firstDoc === 'ckd-dc-2025') {
        return params.get('embedding') || 'local';
    }

    return params.get('embedding') || 'openai';
}

/**
 * Get back button URL from URL parameter
 * Returns null if no back button should be shown
 * @returns {string|null} The back button URL or null
 */
export function getBackButtonURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('back-button') || null;
}


