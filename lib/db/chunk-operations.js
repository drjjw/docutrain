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

module.exports = {
    getChunksForDocument,
    deleteChunksForDocument,
    getChunkCount
};

