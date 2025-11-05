/**
 * Status Operations
 * Handles status updates for user_documents with atomic operations and consistency
 */

const { DatabaseError } = require('../errors/processing-errors');
const { validateSupabaseClient, validateUserDocId } = require('../utils/input-validator');

/**
 * Update user document status
 * Ensures atomic status updates with proper error handling
 * 
 * @param {Object} supabase - Supabase client
 * @param {string} userDocId - User document ID
 * @param {string} status - New status (pending, processing, ready, error)
 * @param {Object} additionalFields - Additional fields to update
 * @returns {Promise<void>}
 * @throws {DatabaseError} If update fails
 */
async function updateUserDocumentStatus(supabase, userDocId, status, additionalFields = {}) {
    validateSupabaseClient(supabase);
    validateUserDocId(userDocId);
    
    const validStatuses = ['pending', 'processing', 'ready', 'error'];
    if (!validStatuses.includes(status)) {
        throw new Error(`Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
    }
    
    const updateData = {
        status,
        updated_at: new Date().toISOString(),
        ...additionalFields
    };
    
    const { error } = await supabase
        .from('user_documents')
        .update(updateData)
        .eq('id', userDocId);
    
    if (error) {
        throw new DatabaseError(
            `Failed to update user document status: ${error.message}`,
            {
                userDocId,
                status,
                errorCode: error.code,
                errorDetails: error.details
            }
        );
    }
}

/**
 * Set user document to processing status
 * 
 * @param {Object} supabase - Supabase client
 * @param {string} userDocId - User document ID
 * @param {string} processingMethod - Processing method (vps, edge_function)
 * @returns {Promise<void>}
 */
async function setProcessingStatus(supabase, userDocId, processingMethod = null) {
    const additionalFields = processingMethod ? { processing_method: processingMethod } : {};
    return updateUserDocumentStatus(supabase, userDocId, 'processing', additionalFields);
}

/**
 * Set user document to ready status
 * 
 * @param {Object} supabase - Supabase client
 * @param {string} userDocId - User document ID
 * @returns {Promise<void>}
 */
async function setReadyStatus(supabase, userDocId) {
    return updateUserDocumentStatus(supabase, userDocId, 'ready');
}

/**
 * Set user document to error status
 * 
 * @param {Object} supabase - Supabase client
 * @param {string} userDocId - User document ID
 * @param {string} errorMessage - Error message
 * @returns {Promise<void>}
 */
async function setErrorStatus(supabase, userDocId, errorMessage) {
    return updateUserDocumentStatus(supabase, userDocId, 'error', {
        error_message: errorMessage
    });
}

/**
 * Set user document to pending status
 * 
 * @param {Object} supabase - Supabase client
 * @param {string} userDocId - User document ID
 * @returns {Promise<void>}
 */
async function setPendingStatus(supabase, userDocId) {
    return updateUserDocumentStatus(supabase, userDocId, 'pending');
}

/**
 * Get user document status
 * 
 * @param {Object} supabase - Supabase client
 * @param {string} userDocId - User document ID
 * @returns {Promise<string|null>} Status or null if not found
 */
async function getUserDocumentStatus(supabase, userDocId) {
    validateSupabaseClient(supabase);
    validateUserDocId(userDocId);
    
    const { data, error } = await supabase
        .from('user_documents')
        .select('status')
        .eq('id', userDocId)
        .single();
    
    if (error) {
        if (error.code === 'PGRST116') {
            // Not found
            return null;
        }
        
        throw new DatabaseError(
            `Failed to get user document status: ${error.message}`,
            { userDocId, errorCode: error.code }
        );
    }
    
    return data?.status || null;
}

/**
 * Check if document is stuck in processing
 * 
 * @param {Object} supabase - Supabase client
 * @param {string} userDocId - User document ID
 * @param {number} thresholdMinutes - Threshold in minutes (default 5)
 * @returns {Promise<boolean>} True if stuck
 */
async function isStuckInProcessing(supabase, userDocId, thresholdMinutes = 5) {
    validateSupabaseClient(supabase);
    validateUserDocId(userDocId);
    
    const { data, error } = await supabase
        .from('user_documents')
        .select('status, updated_at')
        .eq('id', userDocId)
        .eq('status', 'processing')
        .single();
    
    if (error) {
        if (error.code === 'PGRST116') {
            return false; // Not found or not processing
        }
        
        throw new DatabaseError(
            `Failed to check if stuck: ${error.message}`,
            { userDocId, errorCode: error.code }
        );
    }
    
    if (!data) {
        return false;
    }
    
    const updatedAt = new Date(data.updated_at);
    const now = new Date();
    const minutesSinceUpdate = (now - updatedAt) / 1000 / 60;
    
    return minutesSinceUpdate > thresholdMinutes;
}

module.exports = {
    updateUserDocumentStatus,
    setProcessingStatus,
    setReadyStatus,
    setErrorStatus,
    setPendingStatus,
    getUserDocumentStatus,
    isStuckInProcessing
};

