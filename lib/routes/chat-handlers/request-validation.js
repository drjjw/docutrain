/**
 * Request Validation Middleware
 * Validates chat requests before processing
 */

const { v4: uuidv4 } = require('uuid');
const rateLimiter = require('./rate-limiter');
const { checkContent } = require('../../utils/profanity-filter');
const { debugLog } = require('../../utils/debug');

/**
 * Validate and generate session ID
 * @param {string|undefined} sessionId - Session ID from request body
 * @returns {string} Valid UUID session ID
 */
function validateSessionId(sessionId) {
    if (!sessionId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
        return uuidv4();
    }
    return sessionId;
}

/**
 * Check rate limit for session
 * @param {string} sessionId - Session UUID
 * @returns {Object} { allowed: boolean, retryAfter?: number, reason?: string, limit?: number, window?: string }
 */
function checkRateLimit(sessionId) {
    return rateLimiter.checkLimit(sessionId);
}

/**
 * Check conversation length limit
 * @param {string} sessionId - Session UUID
 * @param {object} supabase - Supabase client
 * @returns {Promise<{allowed: boolean, count?: number, limit?: number, error?: string}>}
 */
async function checkConversationLimit(sessionId, supabase) {
    const MAX_CONVERSATION_LENGTH = parseInt(process.env.MAX_CONVERSATION_LENGTH || '3', 10);
    const { count: conversationCount, error: countError } = await supabase
        .from('chat_conversations')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', sessionId);
    
    if (countError) {
        debugLog(`⚠️  Error counting conversations for session ${sessionId.substring(0, 8)}...: ${countError.message}`);
        // Allow on error (fail open)
        return { allowed: true };
    }
    
    if (conversationCount !== null && conversationCount >= MAX_CONVERSATION_LENGTH) {
        debugLog(`🚫 Conversation limit reached for session ${sessionId.substring(0, 8)}... (${conversationCount}/${MAX_CONVERSATION_LENGTH})`);
        return {
            allowed: false,
            count: conversationCount,
            limit: MAX_CONVERSATION_LENGTH
        };
    }
    
    debugLog(`✅ Conversation count check passed for session ${sessionId.substring(0, 8)}... (${conversationCount || 0}/${MAX_CONVERSATION_LENGTH})`);
    return { allowed: true, count: conversationCount || 0, limit: MAX_CONVERSATION_LENGTH };
}

/**
 * Validate message
 * @param {string} message - Message to validate
 * @returns {{valid: boolean, error?: string}}
 */
function validateMessage(message) {
    if (!message) {
        return { valid: false, error: 'Message is required' };
    }
    
    // Validate message length (prevent abuse)
    const MAX_MESSAGE_LENGTH = 1500;
    if (typeof message === 'string' && message.length > MAX_MESSAGE_LENGTH) {
        return {
            valid: false,
            error: 'Message too long',
            message: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters. Please shorten your message.`
        };
    }
    
    return { valid: true };
}

/**
 * Check content for profanity/junk
 * @param {string} message - Message to check
 * @returns {{shouldBan: boolean, reason: string|null}}
 */
function checkContentForBan(message) {
    const contentCheck = checkContent(message);
    return {
        shouldBan: contentCheck.shouldBan,
        reason: contentCheck.reason
    };
}

/**
 * Parse document parameter
 * @param {string} doc - Document parameter (supports multiple with + separator)
 * @returns {Array<string>} Array of document slugs
 */
function parseDocumentParam(doc) {
    const docParam = doc || 'smh';
    return docParam.split(/[\s+]+/).map(s => s.trim()).filter(s => s);
}

/**
 * Validate document count
 * @param {Array<string>} documentSlugs - Array of document slugs
 * @returns {{valid: boolean, error?: string, count?: number}}
 */
function validateDocumentCount(documentSlugs) {
    const MAX_DOCUMENTS = 5;
    if (documentSlugs.length > MAX_DOCUMENTS) {
        return {
            valid: false,
            error: 'Too Many Documents',
            message: `Maximum ${MAX_DOCUMENTS} documents can be searched simultaneously. You specified ${documentSlugs.length}.`,
            count: documentSlugs.length,
            max: MAX_DOCUMENTS
        };
    }
    return { valid: true };
}

module.exports = {
    validateSessionId,
    checkRateLimit,
    checkConversationLimit,
    validateMessage,
    checkContentForBan,
    parseDocumentParam,
    validateDocumentCount
};

