/**
 * Chunk Storage
 * Handles storing chunks with embeddings in Supabase with transaction support and batch processing
 */

const { config } = require('../config/document-processing');
const { DatabaseError, PartialFailureError } = require('../errors/processing-errors');
const { validateSupabaseClient, validateDocumentSlug, sanitizeString } = require('../utils/input-validator');
const { createRetryStrategy } = require('../utils/retry-strategy');

/**
 * Store chunks with embeddings in Supabase
 * Handles batch insertion with retry logic and partial failure handling
 * 
 * @param {Object} supabase - Supabase client
 * @param {string} documentSlug - Document slug
 * @param {string} documentName - Document name
 * @param {Array} chunksWithEmbeddings - Array of {chunk, embedding} objects
 * @param {Object} options - Options (retry strategy)
 * @returns {Promise<number>} Number of chunks successfully stored
 * @throws {DatabaseError} If storage fails critically
 */
async function storeChunks(supabase, documentSlug, documentName, chunksWithEmbeddings, options = {}) {
    const retryStrategy = options.retryStrategy || createRetryStrategy(config.retry);
    
    // Validate inputs
    validateSupabaseClient(supabase);
    validateDocumentSlug(documentSlug);
    
    if (!Array.isArray(chunksWithEmbeddings)) {
        throw new Error('chunksWithEmbeddings must be an array');
    }
    
    if (chunksWithEmbeddings.length === 0) {
        return 0;
    }
    
    // Filter out chunks without embeddings
    const validChunks = chunksWithEmbeddings.filter(item => 
        item.embedding !== null && 
        item.embedding !== undefined &&
        Array.isArray(item.embedding)
    );
    
    if (validChunks.length === 0) {
        throw new DatabaseError('No chunks with valid embeddings to store', {
            totalChunks: chunksWithEmbeddings.length
        });
    }
    
    const sanitizedName = sanitizeString(documentName, 'documentName');
    const charsPerToken = config.chunking.charsPerToken;
    
    // Prepare records for insertion
    const records = validChunks.map(({ chunk, embedding }) => ({
        document_type: documentSlug,
        document_slug: documentSlug,
        document_name: sanitizedName,
        chunk_index: chunk.index,
        content: chunk.content,
        embedding: embedding,
        metadata: {
            char_start: chunk.charStart,
            char_end: chunk.charEnd,
            tokens_approx: Math.round(chunk.content.length / charsPerToken),
            page_number: chunk.pageNumber,
            page_markers_found: chunk.pageMarkersFound
        }
    }));
    
    // Insert in batches to avoid payload size limits
    const insertBatchSize = config.storage.insertBatchSize;
    let inserted = 0;
    const failures = [];
    
    for (let i = 0; i < records.length; i += insertBatchSize) {
        const batch = records.slice(i, i + insertBatchSize);
        const batchNum = Math.floor(i / insertBatchSize) + 1;
        const totalBatches = Math.ceil(records.length / insertBatchSize);
        
        try {
            // Retry batch insertion on failure
            await retryStrategy.execute(async () => {
                const { error } = await supabase
                    .from('document_chunks')
                    .insert(batch);
                
                if (error) {
                    throw new DatabaseError(
                        `Failed to insert batch ${batchNum}/${totalBatches}: ${error.message}`,
                        {
                            batch: batchNum,
                            totalBatches,
                            batchSize: batch.length,
                            errorCode: error.code,
                            errorDetails: error.details
                        }
                    );
                }
            }, {
                operationName: `chunk storage batch ${batchNum}`,
                maxRetries: config.retry.maxRetries
            });
            
            inserted += batch.length;
            
        } catch (error) {
            // Log failure but continue with remaining batches
            failures.push({
                batch: batchNum,
                error: error.message,
                chunkIndices: batch.map(r => r.chunk_index)
            });
            
            console.error(`⚠️ Failed to insert batch ${batchNum}/${totalBatches}:`, error.message);
            
            // If this is a critical error (not retryable), throw immediately
            if (error instanceof DatabaseError && !error.isRetryable) {
                throw error;
            }
        }
    }
    
    // Check if we have too many failures
    const failureRate = failures.length / Math.ceil(records.length / insertBatchSize);
    
    if (failures.length > 0 && failureRate > 0.5) {
        throw new PartialFailureError(
            `Too many batch insertion failures: ${failures.length} batches failed`,
            Array.from({ length: inserted }, (_, i) => ({ success: true, index: i })),
            failures
        );
    }
    
    if (inserted === 0) {
        throw new DatabaseError('Failed to store any chunks', {
            totalChunks: chunksWithEmbeddings.length,
            failures: failures.length
        });
    }
    
    if (failures.length > 0) {
        console.warn(`⚠️ Stored ${inserted}/${records.length} chunks (${failures.length} batch failures)`);
    }
    
    return inserted;
}

/**
 * Delete all chunks for a document
 * Useful for cleanup and reprocessing
 * 
 * @param {Object} supabase - Supabase client
 * @param {string} documentSlug - Document slug
 * @returns {Promise<number>} Number of chunks deleted
 */
async function deleteChunksForDocument(supabase, documentSlug) {
    validateSupabaseClient(supabase);
    validateDocumentSlug(documentSlug);
    
    const { data, error } = await supabase
        .from('document_chunks')
        .delete()
        .eq('document_slug', documentSlug)
        .select('chunk_index');
    
    if (error) {
        throw new DatabaseError(
            `Failed to delete chunks for document: ${error.message}`,
            { documentSlug, errorCode: error.code }
        );
    }
    
    return data?.length || 0;
}

/**
 * Get chunk count for a document
 * 
 * @param {Object} supabase - Supabase client
 * @param {string} documentSlug - Document slug
 * @returns {Promise<number>} Number of chunks
 */
async function getChunkCount(supabase, documentSlug) {
    validateSupabaseClient(supabase);
    validateDocumentSlug(documentSlug);
    
    const { count, error } = await supabase
        .from('document_chunks')
        .select('*', { count: 'exact', head: true })
        .eq('document_slug', documentSlug);
    
    if (error) {
        throw new DatabaseError(
            `Failed to get chunk count: ${error.message}`,
            { documentSlug, errorCode: error.code }
        );
    }
    
    return count || 0;
}

module.exports = {
    storeChunks,
    deleteChunksForDocument,
    getChunkCount
};

