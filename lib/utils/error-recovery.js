/**
 * Error Recovery Utilities
 * Functions to recover from partial failures, cleanup failed processing, and reset stuck documents
 */

const { ProcessingError, PartialFailureError } = require('../errors/processing-errors');

/**
 * Cleanup failed processing attempt
 * Removes partial data created during failed processing
 */
async function cleanupFailedProcessing(supabase, userDocId, documentSlug, stagesCompleted = []) {
    const cleanupErrors = [];
    
    try {
        // If document was created, delete it
        if (stagesCompleted.includes('createDocument') && documentSlug) {
            try {
                // Delete chunks first (foreign key constraint)
                const { error: chunkError } = await supabase
                    .from('document_chunks')
                    .delete()
                    .eq('document_slug', documentSlug);
                
                if (chunkError) {
                    cleanupErrors.push(`Failed to delete chunks: ${chunkError.message}`);
                } else {
                    console.log(`✓ Cleaned up chunks for document ${documentSlug}`);
                }
                
                // Then delete document
                const { error: docError } = await supabase
                    .from('documents')
                    .delete()
                    .eq('slug', documentSlug);
                
                if (docError) {
                    cleanupErrors.push(`Failed to delete document: ${docError.message}`);
                } else {
                    console.log(`✓ Cleaned up document ${documentSlug}`);
                }
            } catch (error) {
                cleanupErrors.push(`Error during document cleanup: ${error.message}`);
            }
        }
        
        // Update user_documents status to error if not already set
        if (stagesCompleted.length > 0) {
            try {
                await supabase
                    .from('user_documents')
                    .update({
                        status: 'error',
                        updated_at: new Date().toISOString(),
                        error_message: `Processing failed after completing stages: ${stagesCompleted.join(', ')}`
                    })
                    .eq('id', userDocId);
            } catch (error) {
                cleanupErrors.push(`Failed to update status: ${error.message}`);
            }
        }
        
        if (cleanupErrors.length > 0) {
            console.warn('⚠️ Some cleanup operations had errors:', cleanupErrors);
        }
        
        return {
            success: cleanupErrors.length === 0,
            errors: cleanupErrors
        };
        
    } catch (error) {
        console.error('❌ Error during cleanup:', error);
        return {
            success: false,
            errors: [error.message]
        };
    }
}

/**
 * Reset stuck document
 * Resets a document that's been stuck in processing status
 */
async function resetStuckDocument(supabase, userDocId, reason = 'Document stuck in processing') {
    try {
        const { error } = await supabase
            .from('user_documents')
            .update({
                status: 'pending',
                error_message: reason,
                updated_at: new Date().toISOString()
            })
            .eq('id', userDocId);
        
        if (error) {
            throw new Error(`Failed to reset stuck document: ${error.message}`);
        }
        
        console.log(`✓ Reset stuck document ${userDocId} to pending`);
        return { success: true };
        
    } catch (error) {
        console.error(`❌ Failed to reset stuck document ${userDocId}:`, error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Handle partial failure - continue processing if possible
 * @param {Object} result - Result object with successes and failures
 * @param {string} stage - Current processing stage
 * @returns {Object} Decision on whether to continue
 */
function handlePartialFailure(result, stage) {
    const { successes = [], failures = [], total = 0 } = result;
    const successCount = successes.length;
    const failureCount = failures.length;
    const successRate = total > 0 ? successCount / total : 0;
    
    // Critical stages - fail if any failures
    const criticalStages = ['createDocument', 'download', 'extract'];
    if (criticalStages.includes(stage)) {
        if (failureCount > 0) {
            return {
                shouldContinue: false,
                reason: `Critical stage ${stage} had failures`,
                error: new PartialFailureError(
                    `Failed ${stage} stage`,
                    successes,
                    failures
                )
            };
        }
    }
    
    // Non-critical stages - continue if we have some successes
    // Embedding stage: continue if >50% succeeded
    if (stage === 'embed') {
        if (successRate >= 0.5) {
            return {
                shouldContinue: true,
                reason: `Embedding stage: ${successCount}/${total} succeeded (${(successRate * 100).toFixed(1)}%)`,
                warnings: failures.map(f => f.error?.message || 'Unknown error')
            };
        } else {
            return {
                shouldContinue: false,
                reason: `Embedding stage: Only ${successCount}/${total} succeeded (${(successRate * 100).toFixed(1)}%)`,
                error: new PartialFailureError(
                    `Too many embedding failures`,
                    successes,
                    failures
                )
            };
        }
    }
    
    // Store stage: continue if we have any successes
    if (stage === 'store') {
        if (successCount > 0) {
            return {
                shouldContinue: true,
                reason: `Store stage: ${successCount}/${total} succeeded`,
                warnings: failures.map(f => f.error?.message || 'Unknown error')
            };
        } else {
            return {
                shouldContinue: false,
                reason: 'Store stage: No chunks stored successfully',
                error: new PartialFailureError(
                    'Failed to store any chunks',
                    successes,
                    failures
                )
            };
        }
    }
    
    // Default: continue if we have successes
    return {
        shouldContinue: successCount > 0,
        reason: successCount > 0 
            ? `Stage ${stage}: ${successCount} succeeded, ${failureCount} failed`
            : `Stage ${stage}: All operations failed`,
        warnings: failures.map(f => f.error?.message || 'Unknown error')
    };
}

/**
 * Recover from checkpoint
 * Resume processing from a saved checkpoint
 */
async function recoverFromCheckpoint(supabase, userDocId, checkpoint) {
    try {
        console.log(`🔄 Recovering from checkpoint: ${checkpoint.stage}`);
        console.log(`   Completed stages: ${checkpoint.completed?.join(', ') || 'none'}`);
        
        // Update status to indicate recovery
        await supabase
            .from('user_documents')
            .update({
                status: 'processing',
                updated_at: new Date().toISOString(),
                error_message: null // Clear previous error
            })
            .eq('id', userDocId);
        
        return {
            success: true,
            checkpoint: checkpoint,
            resumeFromStage: checkpoint.stage
        };
        
    } catch (error) {
        console.error(`❌ Failed to recover from checkpoint:`, error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Create checkpoint for recovery
 */
function createCheckpoint(stage, completed = [], data = {}) {
    return {
        stage,
        completed,
        data,
        timestamp: new Date().toISOString(),
        errors: []
    };
}

/**
 * Save checkpoint to database (optional - for persistent recovery)
 */
async function saveCheckpoint(supabase, userDocId, checkpoint) {
    try {
        // Store checkpoint in user_documents metadata or separate table
        await supabase
            .from('user_documents')
            .update({
                metadata: {
                    checkpoint: checkpoint
                },
                updated_at: new Date().toISOString()
            })
            .eq('id', userDocId);
        
        return { success: true };
    } catch (error) {
        console.warn(`⚠️ Failed to save checkpoint: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * Load checkpoint from database
 */
async function loadCheckpoint(supabase, userDocId) {
    try {
        const { data, error } = await supabase
            .from('user_documents')
            .select('metadata')
            .eq('id', userDocId)
            .single();
        
        if (error || !data?.metadata?.checkpoint) {
            return null;
        }
        
        return data.metadata.checkpoint;
    } catch (error) {
        console.warn(`⚠️ Failed to load checkpoint: ${error.message}`);
        return null;
    }
}

/**
 * Clear checkpoint
 */
async function clearCheckpoint(supabase, userDocId) {
    try {
        // Clear checkpoint from metadata
        const { data: currentDoc } = await supabase
            .from('user_documents')
            .select('metadata')
            .eq('id', userDocId)
            .single();
        
        if (currentDoc?.metadata?.checkpoint) {
            const { metadata } = currentDoc;
            delete metadata.checkpoint;
            
            await supabase
                .from('user_documents')
                .update({
                    metadata,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userDocId);
        }
        
        return { success: true };
    } catch (error) {
        console.warn(`⚠️ Failed to clear checkpoint: ${error.message}`);
        return { success: false, error: error.message };
    }
}

module.exports = {
    cleanupFailedProcessing,
    resetStuckDocument,
    handlePartialFailure,
    recoverFromCheckpoint,
    createCheckpoint,
    saveCheckpoint,
    loadCheckpoint,
    clearCheckpoint
};

