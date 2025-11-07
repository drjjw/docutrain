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

/**
 * Sanitize HTML intro messages to prevent XSS attacks
 * Allows only safe tags and strips dangerous attributes
 */
function sanitizeIntroHTML(html) {
    if (!html || typeof html !== 'string') {
        return null;
    }
    
    // Allowed tags (safe for display)
    const allowedTags = ['strong', 'em', 'b', 'i', 'br', 'ul', 'ol', 'li', 'a', 'p', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
    
    // Remove script tags and their content
    let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    
    // Remove event handlers (onclick, onerror, etc.)
    sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
    sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '');
    
    // Remove javascript: protocol from hrefs
    sanitized = sanitized.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');
    
    // Remove style attributes (to prevent CSS injection)
    sanitized = sanitized.replace(/\s*style\s*=\s*["'][^"']*["']/gi, '');
    
    // Remove any tags not in allowed list
    const tagRegex = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
    sanitized = sanitized.replace(tagRegex, (match, tagName) => {
        if (allowedTags.includes(tagName.toLowerCase())) {
            // For anchor tags, preserve href, target, and rel attributes
            if (tagName.toLowerCase() === 'a') {
                const hrefMatch = match.match(/href\s*=\s*["']([^"']*)["']/i);
                const targetMatch = match.match(/target\s*=\s*["']([^"']*)["']/i);
                const relMatch = match.match(/rel\s*=\s*["']([^"']*)["']/i);
                
                if (hrefMatch) {
                    let attrs = `href="${hrefMatch[1]}"`;
                    if (targetMatch) {
                        attrs += ` target="${targetMatch[1]}"`;
                    }
                    if (relMatch) {
                        attrs += ` rel="${relMatch[1]}"`;
                    }
                    return `<a ${attrs}>`;
                }
                return match.includes('</') ? '</a>' : '<a>';
            }
            return match;
        }
        return ''; // Remove disallowed tags
    });
    
    return sanitized.trim() || null;
}

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Load all active documents from database
 * NO CACHING - Always fetches fresh data
 */
async function loadDocuments() {
    try {
        console.log('🔄 Loading documents from database...');
        
        // Join with owners table to get owner's intro_message and default_cover
        const { data, error } = await supabase
            .from('documents')
            .select(`
                id,
                slug,
                title,
                subtitle,
                back_link,
                welcome_message,
                pdf_filename,
                pdf_subdirectory,
                embedding_type,
                year,
                active,
                metadata,
                created_at,
                updated_at,
                category,
                owner,
                owner_id,
                cover,
                intro_message,
                downloads,
                chunk_limit_override,
                show_document_selector,
                show_keywords,
                show_downloads,
                show_references,
                show_disclaimer,
                disclaimer_text,
                owners!documents_owner_id_fkey (
                    intro_message,
                    slug,
                    name,
                    default_cover
                )
            `)
            .eq('active', true)
            .order('created_at', { ascending: true });
        
        if (error) {
            console.error('❌ Error loading documents:', error.message);
            throw error;
        }
        
        // Flatten owner data into document object for easier access
        const processedData = (data || []).map(doc => {
            const ownerIntroMessage = doc.owners?.intro_message || null;
            const ownerSlug = doc.owners?.slug || null;
            const ownerName = doc.owners?.name || null;
            const ownerDefaultCover = doc.owners?.default_cover || null;
            
            // Remove nested owners object and add flattened fields
            const { owners, ...docWithoutOwners } = doc;
            
            // Use document cover if set, otherwise fall back to owner's default_cover
            const effectiveCover = doc.cover || ownerDefaultCover;
            
            return {
                ...docWithoutOwners,
                cover: effectiveCover, // Override with effective cover (document or owner default)
                owner_intro_message: ownerIntroMessage,
                owner_slug: ownerSlug,
                owner_name: ownerName,
                owner_default_cover: ownerDefaultCover // Keep original for reference
            };
        });
        
        console.log(`✓ Loaded ${processedData.length} active documents from registry`);
        processedData.forEach(doc => {
            console.log(`  - ${doc.slug}: ${doc.title} (${doc.embedding_type})`);
        });
        
        return processedData;
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
 * Refresh the document registry
 * Forces a reload from database
 */
async function refreshRegistry() {
    console.log('🔄 Forcing registry refresh...');
    return await loadDocuments();
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
 * Includes owner information and attachments
 */
async function getDocumentsForAPI() {
    const documents = await loadDocuments();

    // Get all unique owner IDs
    const ownerIds = [...new Set(documents.map(doc => doc.owner_id).filter(id => id))];
    
    // Fetch owner information
    let ownersMap = {};
    if (ownerIds.length > 0) {
        const { data: ownersData, error } = await supabase
            .from('owners')
            .select('id, slug, name')
            .in('id', ownerIds);
        
        if (!error && ownersData) {
            ownersData.forEach(owner => {
                ownersMap[owner.id] = owner;
            });
        }
    }

    // Get all document IDs
    const documentIds = documents.map(doc => doc.id).filter(id => id);
    
    // Fetch attachments for all documents
    let attachmentsMap = {};
    if (documentIds.length > 0) {
        const { data: attachmentsData, error: attachmentsError } = await supabase
            .from('document_attachments')
            .select('id, document_id, title, url, display_order')
            .in('document_id', documentIds)
            .order('display_order', { ascending: true });
        
        if (!attachmentsError && attachmentsData) {
            // Group attachments by document_id
            attachmentsData.forEach(attachment => {
                if (!attachmentsMap[attachment.document_id]) {
                    attachmentsMap[attachment.document_id] = [];
                }
                attachmentsMap[attachment.document_id].push({
                    title: attachment.title,
                    url: attachment.url,
                    attachment_id: attachment.id // Include attachment ID for tracking
                });
            });
        }
    }

    return documents.map(doc => {
        const ownerInfo = doc.owner_id ? ownersMap[doc.owner_id] : null;
        
        // Determine intro message: document override > owner default > null
        let introMessage = null;
        if (doc.intro_message) {
            // Document has its own intro message (override)
            introMessage = sanitizeIntroHTML(doc.intro_message);
        } else if (doc.owner_intro_message) {
            // Use owner's default intro message
            introMessage = sanitizeIntroHTML(doc.owner_intro_message);
        }
        // Otherwise remains null (no intro message)
        
        // Extract keywords from metadata if available
        const keywords = doc.metadata?.keywords || null;
        console.log(`🔑 [DEBUG] Document ${doc.slug}: keywords=${keywords ? keywords.length : 'null'}`);
        
        // Get attachments for this document, fallback to legacy downloads JSONB if no attachments
        const attachments = attachmentsMap[doc.id] || [];
        const legacyDownloads = doc.downloads || [];
        const downloads = attachments.length > 0 ? attachments : legacyDownloads;
        
        return {
            slug: doc.slug,
            title: doc.title,
            subtitle: doc.subtitle,
            cover: doc.cover,
            backLink: doc.back_link,
            welcomeMessage: doc.welcome_message,
            introMessage: introMessage, // New field for HTML intro
            embeddingType: doc.embedding_type,
            year: doc.year,
            category: doc.category,
            active: doc.active,
            owner: doc.owner,
            metadata: doc.metadata || {},
            keywords: keywords, // Extract keywords for easy access
            downloads: downloads, // Attachments from new table, fallback to legacy JSONB
            showDocumentSelector: doc.show_document_selector !== false, // Controls document selector visibility (default true)
            showKeywords: doc.show_keywords !== false, // Controls keywords visibility (default true)
            showDownloads: doc.show_downloads !== false, // Controls downloads visibility (default true)
            showReferences: doc.show_references !== false, // Controls references visibility (default true)
            showDisclaimer: doc.show_disclaimer === true, // Controls disclaimer visibility
            disclaimerText: doc.disclaimer_text || null, // Custom disclaimer text (null uses default)
            ownerInfo: ownerInfo ? {
                slug: ownerInfo.slug,
                name: ownerInfo.name
            } : null
        };
    });
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
    sanitizeIntroHTML
};

