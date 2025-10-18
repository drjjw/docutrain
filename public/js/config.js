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
const CACHE_KEY = 'ukidney-documents-cache';
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

// Logo configuration for different document owners
const ownerLogoConfig = {
    'ukidney': {
        logo: 'logos/ukidney-logo.svg',
        alt: 'UKidney',
        link: 'https://ukidney.com',
        accentColor: '#cc0000'
    },
    'maker': {
        logo: 'logos/maker-logo.png',
        alt: 'Maker',
        link: '#', // No external link for maker
        accentColor: '#007acc' // Example maker accent color - can be adjusted
    }
    // Add more owners as needed
};

/**
 * Get logo configuration for a document owner
 */
export function getOwnerLogoConfig(owner) {
    return ownerLogoConfig[owner] || null; // Return null if owner not found (no default logo for multi-tenant app)
}

/**
 * Preload all logos to prevent layout shift when switching documents
 */
export function preloadLogos() {
    Object.values(ownerLogoConfig).forEach(config => {
        if (config.logo && config.logo.startsWith('logos/')) {
            // Only preload local logos, external ones (like ukidney.com) are already cached by browser
            const img = new Image();
            img.src = config.logo;
            console.log(`📷 Preloading logo: ${config.logo}`);
        }
    });
}

// Dynamic document configuration (loaded from API)
let docConfigCache = null;

/**
 * Fetch documents from API with caching
 */
export async function loadDocuments(forceRefresh = false) {
    try {
        // Check cache first (unless force refresh requested)
        if (!forceRefresh) {
            const cached = localStorage.getItem(CACHE_KEY);
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
        
        // Fetch from API
        console.log('🔄 Fetching documents from API...');
        const response = await fetch(`${API_URL}/api/documents`);
        
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
        localStorage.setItem(CACHE_KEY, JSON.stringify({
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
 * Get a specific document by slug
 */
export async function getDocument(slug, forceRefresh = false) {
    const config = await getDocConfig(forceRefresh);
    return config[slug] || null;
}

/**
 * Check if a document exists
 */
export async function documentExists(slug) {
    const config = await getDocConfig();
    return slug in config;
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

// Get embedding type from URL parameter (openai or local)
export function getEmbeddingType() {
    const params = new URLSearchParams(window.location.search);
    const docParam = params.get('doc');

    // ckd-dc-2025 uses local embeddings, others use OpenAI by default
    if (docParam === 'ckd-dc-2025') {
        return params.get('embedding') || 'local';
    }

    return params.get('embedding') || 'openai';
}


