/**
 * Document Registry Service
 * 
 * Centralized document management system that loads document configurations
 * from the database instead of hardcoded values. Provides caching and
 * path resolution for scalable multi-document support.
 */

const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// In-memory cache for documents
let documentCache = {
    documents: [],
    lastUpdated: null,
    ttl: 5 * 60 * 1000 // 5 minutes cache TTL
};

/**
 * Load all active documents from database
 * Uses caching to reduce database queries
 */
async function loadDocuments(forceRefresh = false) {
    const now = Date.now();
    
    // Return cached documents if still valid
    if (!forceRefresh && 
        documentCache.documents.length > 0 && 
        documentCache.lastUpdated &&
        (now - documentCache.lastUpdated) < documentCache.ttl) {
        console.log('📦 Using cached document registry');
        return documentCache.documents;
    }
    
    try {
        console.log('🔄 Loading documents from database...');
        
        const { data, error } = await supabase
            .from('documents')
            .select('*')
            .eq('active', true)
            .order('created_at', { ascending: true });
        
        if (error) {
            console.error('❌ Error loading documents:', error.message);
            // Return cached documents if available, even if stale
            if (documentCache.documents.length > 0) {
                console.log('⚠️  Using stale cache due to database error');
                return documentCache.documents;
            }
            throw error;
        }
        
        // Update cache
        documentCache.documents = data || [];
        documentCache.lastUpdated = now;
        
        console.log(`✓ Loaded ${data.length} active documents from registry`);
        data.forEach(doc => {
            console.log(`  - ${doc.slug}: ${doc.title} (${doc.embedding_type})`);
        });
        
        return documentCache.documents;
    } catch (error) {
        console.error('❌ Failed to load documents:', error);
        throw error;
    }
}

/**
 * Get a single document by slug
 * @param {string} slug - Document slug identifier
 * @returns {Object|null} Document object or null if not found
 */
async function getDocumentBySlug(slug) {
    const documents = await loadDocuments();
    const doc = documents.find(d => d.slug === slug);
    
    if (!doc) {
        console.warn(`⚠️  Document not found: ${slug}`);
        return null;
    }
    
    return doc;
}

/**
 * Build full filesystem path to PDF file
 * @param {Object} doc - Document object from registry
 * @returns {string} Absolute path to PDF file
 */
function getDocumentPath(doc) {
    if (!doc) {
        throw new Error('Document object is required');
    }
    
    const basePath = path.join(__dirname, '..', 'PDFs');
    const fullPath = path.join(basePath, doc.pdf_subdirectory, doc.pdf_filename);
    
    return fullPath;
}

/**
 * Refresh the document registry cache
 * Forces a reload from database
 */
async function refreshRegistry() {
    console.log('🔄 Forcing registry refresh...');
    return await loadDocuments(true);
}

/**
 * Get all document slugs (useful for validation)
 * @returns {Array<string>} Array of active document slugs
 */
async function getActiveSlugs() {
    const documents = await loadDocuments();
    return documents.map(d => d.slug);
}

/**
 * Validate if a slug exists and is active
 * @param {string} slug - Document slug to validate
 * @returns {boolean} True if slug is valid and active
 */
async function isValidSlug(slug) {
    const slugs = await getActiveSlugs();
    return slugs.includes(slug);
}

/**
 * Get documents by embedding type
 * @param {string} embeddingType - 'openai' or 'local'
 * @returns {Array<Object>} Filtered documents
 */
async function getDocumentsByEmbeddingType(embeddingType) {
    const documents = await loadDocuments();
    return documents.filter(d => d.embedding_type === embeddingType);
}

/**
 * Get document metadata for frontend API
 * Returns only the fields needed by the frontend
 */
async function getDocumentsForAPI() {
    const documents = await loadDocuments();

    return documents.map(doc => ({
        slug: doc.slug,
        title: doc.title,
        subtitle: doc.subtitle,
        backLink: doc.back_link,
        welcomeMessage: doc.welcome_message,
        embeddingType: doc.embedding_type,
        year: doc.year,
        active: doc.active,
        owner: doc.owner,
        metadata: doc.metadata || {}
    }));
}

/**
 * Clear the cache (useful for testing)
 */
function clearCache() {
    documentCache = {
        documents: [],
        lastUpdated: null,
        ttl: 5 * 60 * 1000
    };
    console.log('🗑️  Document cache cleared');
}

/**
 * Get cache statistics
 */
function getCacheStats() {
    return {
        documentsCount: documentCache.documents.length,
        lastUpdated: documentCache.lastUpdated,
        ttl: documentCache.ttl,
        isStale: documentCache.lastUpdated ? 
            (Date.now() - documentCache.lastUpdated) > documentCache.ttl : 
            true
    };
}

module.exports = {
    loadDocuments,
    getDocumentBySlug,
    getDocumentPath,
    refreshRegistry,
    getActiveSlugs,
    isValidSlug,
    getDocumentsByEmbeddingType,
    getDocumentsForAPI,
    clearCache,
    getCacheStats
};

