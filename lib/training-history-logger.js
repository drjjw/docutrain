/**
 * Training History Logger
 * Logs training and retraining activities for user audit trail
 */

/**
 * Log a training/retraining activity
 * @param {Object} supabase - Supabase client (service role)
 * @param {Object} params - Log parameters
 * @param {string} params.documentId - Document UUID
 * @param {string} params.documentSlug - Document slug
 * @param {string} params.userId - User ID who performed the action
 * @param {string} params.userDocumentId - User document ID (optional)
 * @param {string} params.actionType - 'train', 'retrain_replace', or 'retrain_add'
 * @param {string} params.status - 'started', 'completed', or 'failed'
 * @param {Object} params.details - Additional details
 * @param {string} [params.details.uploadType] - 'pdf' or 'text'
 * @param {string} [params.details.retrainMode] - 'replace' or 'add'
 * @param {string} [params.details.fileName] - File name
 * @param {number} [params.details.fileSize] - File size in bytes
 * @param {number} [params.details.chunkCount] - Number of chunks created
 * @param {number} [params.details.existingChunkCount] - Existing chunks (for retrain_add)
 * @param {number} [params.details.processingTimeMs] - Processing time in milliseconds
 * @param {string} [params.details.errorMessage] - Error message if failed
 * @param {Object} [params.details.metadata] - Additional metadata
 */
async function logTrainingActivity(supabase, params) {
    const {
        documentId,
        documentSlug,
        userId,
        userDocumentId,
        actionType,
        status,
        details = {}
    } = params;

    try {
        if (!supabase) {
            console.error('[Training History Logger] No supabase client provided');
            return;
        }

        const logEntry = {
            document_id: documentId,
            document_slug: documentSlug,
            user_id: userId,
            user_document_id: userDocumentId || null,
            action_type: actionType,
            status: status,
            upload_type: details.uploadType || null,
            retrain_mode: details.retrainMode || null,
            file_name: details.fileName || null,
            file_size: details.fileSize || null,
            chunk_count: details.chunkCount || null,
            existing_chunk_count: details.existingChunkCount || null,
            processing_time_ms: details.processingTimeMs || null,
            error_message: details.errorMessage || null,
            metadata: details.metadata || {}
        };

        const { data, error } = await supabase
            .from('document_training_history')
            .insert(logEntry)
            .select()
            .single();

        if (error) {
            console.error(`[Training History Logger] Failed to log ${actionType}:${status}:`, error);
            console.error(`[Training History Logger] Error details:`, {
                code: error.code,
                message: error.message,
                details: error.details,
                hint: error.hint
            });
        } else {
            console.debug(`[Training History Logger] ✅ Logged ${actionType}:${status} for ${documentSlug}`);
        }

        return data;
    } catch (error) {
        console.error(`[Training History Logger] Exception logging ${actionType}:${status}:`, error);
        return null;
    }
}

/**
 * Convenience methods for common log patterns
 */
const trainingLogger = {
    /**
     * Log training start
     */
    async started(supabase, params) {
        return await logTrainingActivity(supabase, {
            ...params,
            status: 'started'
        });
    },

    /**
     * Log training completion
     */
    async completed(supabase, params) {
        return await logTrainingActivity(supabase, {
            ...params,
            status: 'completed'
        });
    },

    /**
     * Log training failure
     */
    async failed(supabase, params) {
        return await logTrainingActivity(supabase, {
            ...params,
            status: 'failed'
        });
    }
};

module.exports = trainingLogger;




