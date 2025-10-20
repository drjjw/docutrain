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
 * Build full filesystem path to PDF file (for embedding scripts only)
 * Note: Not used at runtime in RAG-only mode
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
 * Validate that all slugs belong to the same owner
 * @param {Array<string>} slugs - Array of document slugs
 * @returns {Object} { valid: boolean, owner: string|null, error: string|null }
 */
async function validateSameOwner(slugs) {
    if (!slugs || slugs.length === 0) {
        return { valid: false, owner: null, error: 'No documents provided' };
    }
    
    if (slugs.length === 1) {
        const doc = await getDocumentBySlug(slugs[0]);
        return { valid: true, owner: doc?.owner || null, error: null };
    }
    
    const documents = await loadDocuments();
    const docObjects = slugs.map(slug => documents.find(d => d.slug === slug)).filter(d => d);
    
    if (docObjects.length !== slugs.length) {
        return { valid: false, owner: null, error: 'One or more documents not found' };
    }
    
    const owners = [...new Set(docObjects.map(d => d.owner))];
    
    if (owners.length > 1) {
        return { 
            valid: false, 
            owner: null, 
            error: `Cannot combine documents from different owners: ${owners.join(', ')}`
        };
    }
    
    return { valid: true, owner: owners[0], error: null };
}

/**
 * Validate that all slugs use the same embedding type
 * @param {Array<string>} slugs - Array of document slugs
 * @returns {Object} { valid: boolean, embeddingType: string|null, error: string|null }
 */
async function validateSameEmbeddingType(slugs) {
    if (!slugs || slugs.length === 0) {
        return { valid: false, embeddingType: null, error: 'No documents provided' };
    }
    
    if (slugs.length === 1) {
        const doc = await getDocumentBySlug(slugs[0]);
        return { valid: true, embeddingType: doc?.embedding_type || null, error: null };
    }
    
    const documents = await loadDocuments();
    const docObjects = slugs.map(slug => documents.find(d => d.slug === slug)).filter(d => d);
    
    if (docObjects.length !== slugs.length) {
        return { valid: false, embeddingType: null, error: 'One or more documents not found' };
    }
    
    const embeddingTypes = [...new Set(docObjects.map(d => d.embedding_type))];
    
    if (embeddingTypes.length > 1) {
        return { 
            valid: false, 
            embeddingType: null, 
            error: `Cannot combine documents with different embedding types: ${embeddingTypes.join(', ')}`
        };
    }
    
    return { valid: true, embeddingType: embeddingTypes[0], error: null };
}

/**
 * Get documents by owner
 * @param {string} owner - Owner identifier
 * @returns {Array<Object>} Documents belonging to the owner
 */
async function getDocumentsByOwner(owner) {
    const documents = await loadDocuments();
    return documents.filter(d => d.owner === owner);
}

/**
 * Group documents by owner for UI display
 * @returns {Object} Documents grouped by owner { owner: [docs] }
 */
async function groupDocumentsByOwner() {
    const documents = await loadDocuments();
    const grouped = {};
    
    documents.forEach(doc => {
        const owner = doc.owner || 'unknown';
        if (!grouped[owner]) {
            grouped[owner] = [];
        }
        grouped[owner].push(doc);
    });
    
    return grouped;
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
 * Includes owner information with document_selector flag
 */
async function getDocumentsForAPI() {
    const documents = await loadDocuments();

    // Get all unique owner IDs
    const ownerIds = [...new Set(documents.map(doc => doc.owner_id).filter(id => id))];
    
    // Fetch owner information including document_selector
    let ownersMap = {};
    if (ownerIds.length > 0) {
        const { data: ownersData, error } = await supabase
            .from('owners')
            .select('id, slug, name, document_selector')
            .in('id', ownerIds);
        
        if (!error && ownersData) {
            ownersData.forEach(owner => {
                ownersMap[owner.id] = owner;
            });
        }
    }

    return documents.map(doc => {
        const ownerInfo = doc.owner_id ? ownersMap[doc.owner_id] : null;
        
        return {
            slug: doc.slug,
            title: doc.title,
            subtitle: doc.subtitle,
            backLink: doc.back_link,
            welcomeMessage: doc.welcome_message,
            embeddingType: doc.embedding_type,
            year: doc.year,
            active: doc.active,
            owner: doc.owner,
            metadata: doc.metadata || {},
            ownerInfo: ownerInfo ? {
                slug: ownerInfo.slug,
                name: ownerInfo.name,
                documentSelector: ownerInfo.document_selector
            } : null
        };
    });
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
    validateSameOwner,
    validateSameEmbeddingType,
    getDocumentsByOwner,
    groupDocumentsByOwner,
    getDocumentsByEmbeddingType,
    getDocumentsForAPI,
    clearCache,
    getCacheStats
};

