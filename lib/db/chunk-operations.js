/**
 * Chunk Operations
 * Database operations for document chunks with transaction support
 * This is a wrapper around chunk storage that provides additional database operations
 */

const { DatabaseError } = require('../errors/processing-errors');
const { validateSupabaseClient, validateDocumentSlug } = require('../utils/input-validator');

/**
 * Get chunks for a document
 * 
 * @param {Object} supabase - Supabase client
 * @param {string} documentSlug - Document slug
 * @param {Object} options - Options (limit, offset)
 * @returns {Promise<Array>} Array of chunk records
 */
async function getChunksForDocument(supabase, documentSlug, options = {}) {
    validateSupabaseClient(supabase);
    validateDocumentSlug(documentSlug);
    
    const { limit = null, offset = 0 } = options;
    
    let query = supabase
        .from('document_chunks')
        .select('*')
        .eq('document_slug', documentSlug)
        .order('chunk_index', { ascending: true });
    
    if (limit !== null) {
        query = query.limit(limit);
    }
    
    if (offset > 0) {
        query = query.range(offset, offset + (limit || 1000) - 1);
    }
    
    const { data, error } = await query;
    
    if (error) {
        throw new DatabaseError(
            `Failed to get chunks: ${error.message}`,
            { documentSlug, errorCode: error.code }
        );
    }
    
    return data || [];
}

/**
 * Delete chunks for a document (alias for chunk-storage function)
 * This is kept here for backward compatibility
 */
async function deleteChunksForDocument(supabase, documentSlug) {
    // Re-export from chunk-storage
    const { deleteChunksForDocument: deleteChunks } = require('../processors/chunk-storage');
    return deleteChunks(supabase, documentSlug);
}

/**
 * Get chunk count for a document (alias for chunk-storage function)
 */
async function getChunkCount(supabase, documentSlug) {
    // Re-export from chunk-storage
    const { getChunkCount: count } = require('../processors/chunk-storage');
    return count(supabase, documentSlug);
}

/**
 * Get the maximum chunk_index for a document
 * 
 * @param {Object} supabase - Supabase client
 * @param {string} documentSlug - Document slug
 * @returns {Promise<number>} Maximum chunk_index, or -1 if no chunks exist
 */
async function getMaxChunkIndex(supabase, documentSlug) {
    validateSupabaseClient(supabase);
    validateDocumentSlug(documentSlug);
    
    const { data, error } = await supabase
        .from('document_chunks')
        .select('chunk_index')
        .eq('document_slug', documentSlug)
        .order('chunk_index', { ascending: false })
        .limit(1)
        .single();
    
    if (error) {
        // If no chunks exist, return -1
        if (error.code === 'PGRST116') {
            return -1;
        }
        throw new DatabaseError(
            `Failed to get max chunk index: ${error.message}`,
            { documentSlug, errorCode: error.code }
        );
    }
    
    return data?.chunk_index ?? -1;
}

/**
 * Convert database chunk records to format needed for AI generation
 * 
 * @param {Array} dbChunks - Array of chunk records from database
 * @returns {Array} Array of chunk objects in format expected by generateAbstractAndKeywords
 */
function convertDbChunksToAIFormat(dbChunks) {
    if (!Array.isArray(dbChunks)) {
        return [];
    }
    
    return dbChunks.map(c => ({
        content: c.content || '',
        index: c.chunk_index || 0,
        charStart: c.metadata?.char_start || 0,
        charEnd: c.metadata?.char_end || 0,
        pageNumber: c.metadata?.page_number || 1,
        pageMarkersFound: c.metadata?.page_markers_found || 0
    }));
}

module.exports = {
    getChunksForDocument,
    deleteChunksForDocument,
    getChunkCount,
    getMaxChunkIndex,
    convertDbChunksToAIFormat
};

