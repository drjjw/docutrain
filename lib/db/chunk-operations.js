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
 * Get random chunks for a document
 * 
 * @param {Object} supabase - Supabase client
 * @param {string} documentSlug - Document slug
 * @param {number} count - Number of random chunks to retrieve
 * @returns {Promise<Array>} Array of random chunk records
 */
async function getRandomChunks(supabase, documentSlug, count) {
    validateSupabaseClient(supabase);
    validateDocumentSlug(documentSlug);
    
    if (!Number.isInteger(count) || count < 1) {
        throw new Error('count must be a positive integer');
    }
    
    try {
        // Use PostgreSQL's random() function to get random chunks
        // First, get total chunk count to ensure we don't request more than available
        const totalCount = await getChunkCount(supabase, documentSlug);
        
        if (!totalCount || totalCount === 0) {
            return [];
        }
        
        // If requesting more chunks than available, return all chunks
        const limit = Math.min(count, totalCount);
        
        // Use RPC call or direct query with ORDER BY RANDOM()
        // Supabase doesn't have a direct RANDOM() function in the query builder,
        // so we'll fetch all chunks and randomize in JavaScript for smaller datasets,
        // or use a more efficient approach for larger datasets
        
        // For efficiency, if we need fewer chunks than total, fetch a larger sample
        // and then randomly select from it
        const sampleSize = Math.min(totalCount, Math.max(limit * 3, 50));
        
        const { data, error } = await supabase
            .from('document_chunks')
            .select('*')
            .eq('document_slug', documentSlug)
            .limit(sampleSize);
        
        if (error) {
            throw new DatabaseError(
                `Failed to get random chunks: ${error.message}`,
                { documentSlug, errorCode: error.code }
            );
        }
        
        if (!data || data.length === 0) {
            return [];
        }
        
        // Randomize and select the requested count
        const shuffled = [...data].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, limit);
    } catch (error) {
        // Re-throw DatabaseError as-is, wrap others
        if (error instanceof DatabaseError) {
            throw error;
        }
        throw new DatabaseError(
            `Failed to get random chunks: ${error.message}`,
            { documentSlug, originalError: error.message }
        );
    }
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
    getRandomChunks,
    convertDbChunksToAIFormat
};

