/**
 * Edge Function client for document processing
 * Handles calls to Supabase Edge Functions with timeout and error handling
 */

/**
 * Configuration: Enable/disable Edge Functions for processing
 * Set USE_EDGE_FUNCTIONS=true in .env to enable, false or unset to use VPS processing
 */
const USE_EDGE_FUNCTIONS = process.env.USE_EDGE_FUNCTIONS === 'true';
const EDGE_FUNCTION_URL = process.env.SUPABASE_EDGE_FUNCTIONS_URL || 
    `${process.env.SUPABASE_URL}/functions/v1/process-document`;
const EDGE_FUNCTION_TIMEOUT_MS = 380000; // 380s (20s buffer before 400s Edge Function limit)

/**
 * Edge Functions have CPU/resource limits - use VPS for large documents
 * Threshold: 5MB (5 * 1024 * 1024 bytes) - documents larger than this use VPS
 */
const EDGE_FUNCTION_MAX_FILE_SIZE = parseInt(process.env.EDGE_FUNCTION_MAX_FILE_SIZE) || (5 * 1024 * 1024);

/**
 * Call Edge Function for document processing
 * Handles timeout, network errors, and HTTP errors
 * 
 * @param {string} user_document_id - ID of the user document to process
 * @param {string} authToken - JWT token for authentication
 * @returns {Promise<Object>} Edge Function response
 * @throws {Error} On timeout, network error, or HTTP error
 */
async function callEdgeFunction(user_document_id, authToken) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), EDGE_FUNCTION_TIMEOUT_MS);

    try {
        const response = await fetch(EDGE_FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
                'apikey': process.env.SUPABASE_ANON_KEY
            },
            body: JSON.stringify({ user_document_id }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Edge Function returned ${response.status}: ${errorText}`);
        }

        return await response.json();
    } catch (error) {
        clearTimeout(timeoutId);
        
        // Handle timeout/abort errors
        if (error.name === 'AbortError') {
            throw new Error('Edge Function timeout - exceeded 380s limit');
        }
        
        // Handle network errors
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            throw new Error(`Edge Function unavailable: ${error.message}`);
        }
        
        // Re-throw other errors
        throw error;
    }
}

/**
 * Check if Edge Functions should be used for a document
 * Based on configuration and file size
 * 
 * @param {number} fileSize - Size of the document in bytes
 * @returns {boolean} True if Edge Functions should be used
 */
function shouldUseEdgeFunction(fileSize) {
    return USE_EDGE_FUNCTIONS && fileSize <= EDGE_FUNCTION_MAX_FILE_SIZE;
}

/**
 * Get Edge Function configuration
 * 
 * @returns {Object} Configuration object
 */
function getEdgeFunctionConfig() {
    return {
        enabled: USE_EDGE_FUNCTIONS,
        url: EDGE_FUNCTION_URL,
        timeoutMs: EDGE_FUNCTION_TIMEOUT_MS,
        maxFileSize: EDGE_FUNCTION_MAX_FILE_SIZE
    };
}

module.exports = {
    callEdgeFunction,
    shouldUseEdgeFunction,
    getEdgeFunctionConfig,
    USE_EDGE_FUNCTIONS,
    EDGE_FUNCTION_MAX_FILE_SIZE
};

