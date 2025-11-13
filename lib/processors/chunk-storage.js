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
 * @param {Object} options - Options (retry strategy, documentId)
 * @returns {Promise<number>} Number of chunks successfully stored
 * @throws {DatabaseError} If storage fails critically
 */
async function storeChunks(supabase, documentSlug, documentName, chunksWithEmbeddings, options = {}) {
    const retryStrategy = options.retryStrategy || createRetryStrategy(config.retry);
    const documentId = options.documentId; // UUID for referential integrity
    
    // Validate inputs
    validateSupabaseClient(supabase);
    validateDocumentSlug(documentSlug);
    
    // Require document ID for new storage operations
    if (!documentId) {
        throw new Error('document ID is required for chunk storage');
    }
    
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
    const records = validChunks.map(({ chunk, embedding }) => {
        const baseMetadata = {
            char_start: chunk.charStart,
            char_end: chunk.charEnd,
            tokens_approx: Math.round(chunk.content.length / charsPerToken),
            page_number: chunk.pageNumber,
            page_markers_found: chunk.pageMarkersFound
        };
        
        // Add audio-specific metadata if present
        if (chunk.startTime !== null && chunk.startTime !== undefined) {
            baseMetadata.start_time = chunk.startTime;
        }
        if (chunk.endTime !== null && chunk.endTime !== undefined) {
            baseMetadata.end_time = chunk.endTime;
        }
        
        return {
            document_id: documentId, // Immutable reference to parent document
            document_type: documentSlug, // Kept for legacy compatibility
            document_slug: documentSlug, // Kept for display purposes
            document_name: sanitizedName,
            chunk_index: chunk.index,
            content: chunk.content,
            embedding: embedding,
            metadata: baseMetadata
        };
    });
    
    // Insert in batches to avoid payload size limits
    const insertBatchSize = config.storage.insertBatchSize;
    let inserted = 0;
    const failures = [];
    
    // Check if index conflict handling is enabled (for "add" retrain mode)
    const handleIndexConflict = options.handleIndexConflict === true;
    
    for (let i = 0; i < records.length; i += insertBatchSize) {
        const batch = records.slice(i, i + insertBatchSize);
        const batchNum = Math.floor(i / insertBatchSize) + 1;
        const totalBatches = Math.ceil(records.length / insertBatchSize);
        let conflictRetries = 0;
        const maxConflictRetries = 3;
        
        while (conflictRetries <= maxConflictRetries) {
            try {
                // Retry batch insertion on failure
                await retryStrategy.execute(async () => {
                    const { error } = await supabase
                        .from('document_chunks')
                        .insert(batch);
                    
                    if (error) {
                        // Check for UNIQUE constraint violation (23505) - race condition in "add" mode
                        if (error.code === '23505' && handleIndexConflict && conflictRetries < maxConflictRetries) {
                            console.log(`🔄 UNIQUE constraint violation detected in batch ${batchNum}, recalculating indices...`);
                            
                            // Re-fetch max chunk_index from database
                            const { getMaxChunkIndex } = require('../db/chunk-operations');
                            const currentMaxIndex = await getMaxChunkIndex(supabase, documentSlug);
                            
                            // Calculate the minimum index in this batch
                            const minBatchIndex = Math.min(...batch.map(r => r.chunk_index));
                            
                            // Calculate offset needed to place batch after current max
                            const offset = currentMaxIndex + 1 - minBatchIndex;
                            
                            if (offset <= 0) {
                                // This shouldn't happen, but if it does, use a larger offset
                                console.warn(`⚠️ Calculated offset is ${offset}, using minimum offset of 1`);
                                const adjustedOffset = 1;
                                batch.forEach(record => {
                                    record.chunk_index += adjustedOffset;
                                });
                                // Update remaining records too
                                for (let j = i + insertBatchSize; j < records.length; j++) {
                                    records[j].chunk_index += adjustedOffset;
                                }
                            } else {
                                // Update batch indices
                                batch.forEach(record => {
                                    record.chunk_index += offset;
                                });
                                
                                // Update remaining records too
                                for (let j = i + insertBatchSize; j < records.length; j++) {
                                    records[j].chunk_index += offset;
                                }
                            }
                            
                            conflictRetries++;
                            console.log(`🔄 Retrying batch ${batchNum} with recalculated indices (attempt ${conflictRetries}/${maxConflictRetries})`);
                            throw new Error('INDEX_CONFLICT_RETRY'); // Signal to retry
                        }
                        
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
                break; // Success, exit conflict retry loop
                
            } catch (error) {
                // Handle index conflict retry
                if (error.message === 'INDEX_CONFLICT_RETRY' && conflictRetries < maxConflictRetries) {
                    continue; // Retry with recalculated indices
                }
                
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
                
                break; // Exit conflict retry loop and move to next batch
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

/**
 * Get the maximum chunk_index for a document (re-export from chunk-operations)
 * 
 * @param {Object} supabase - Supabase client
 * @param {string} documentSlug - Document slug
 * @returns {Promise<number>} Maximum chunk_index, or -1 if no chunks exist
 */
async function getMaxChunkIndex(supabase, documentSlug) {
    const { getMaxChunkIndex: getMax } = require('../db/chunk-operations');
    return getMax(supabase, documentSlug);
}

module.exports = {
    storeChunks,
    deleteChunksForDocument,
    getChunkCount,
    getMaxChunkIndex
};

