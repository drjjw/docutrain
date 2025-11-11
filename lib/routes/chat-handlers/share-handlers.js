/**
 * Share Handlers
 * Handles conversation sharing endpoints
 */

const { authenticateUser, checkDocumentAccess } = require('../chat-helpers');
const { debugLog } = require('../../utils/debug');
const { generateShareToken } = require('./share-token');

/**
 * Extract document slugs from conversation metadata
 * @param {object} metadata - Conversation metadata
 * @returns {Array<string>} Array of document slugs
 */
function extractDocumentSlugsFromMetadata(metadata) {
    let documentSlugs = [];
    
    if (metadata.document_slugs) {
        // Handle both array and single string
        documentSlugs = Array.isArray(metadata.document_slugs) 
            ? metadata.document_slugs 
            : [metadata.document_slugs];
    } else if (metadata.document_type) {
        // Fallback to document_type
        documentSlugs = Array.isArray(metadata.document_type)
            ? metadata.document_type
            : [metadata.document_type];
    }
    
    return documentSlugs;
}

/**
 * Create GET /shared/:shareToken handler
 * @param {object} dependencies - Dependencies object
 * @returns {Function} Express route handler
 */
function createGetSharedHandler(dependencies) {
    const { supabase } = dependencies;

    return async (req, res) => {
        try {
            const { shareToken } = req.params;
            const passcode = req.query.passcode || null; // Get passcode from query params

            if (!shareToken) {
                return res.status(400).json({ error: 'Share token is required' });
            }

            // Fetch conversation by share_token
            const { data: conversation, error } = await supabase
                .from('chat_conversations')
                .select(`
                    id,
                    session_id,
                    question,
                    response,
                    model,
                    created_at,
                    document_name,
                    document_version,
                    document_ids,
                    metadata,
                    user_id,
                    banned,
                    ban_reason
                `)
                .eq('share_token', shareToken)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    // No rows returned
                    return res.status(404).json({ error: 'Conversation not found' });
                }
                console.error('Error fetching shared conversation:', error);
                return res.status(500).json({ error: 'Failed to fetch conversation' });
            }

            if (!conversation) {
                return res.status(404).json({ error: 'Conversation not found' });
            }

            // If conversation is banned, don't allow access
            if (conversation.banned) {
                return res.status(403).json({ 
                    error: 'This conversation cannot be shared because it contains inappropriate content',
                    banned: true,
                    ban_reason: conversation.ban_reason
                });
            }

            // Extract document slugs from metadata
            const metadata = conversation.metadata || {};
            const documentSlugs = extractDocumentSlugsFromMetadata(metadata);

            debugLog(`📋 Shared conversation access check:`);
            debugLog(`   - Share token: ${shareToken ? shareToken.substring(0, Math.min(10, shareToken.length)) : 'null'}...`);
            debugLog(`   - Document slugs: ${documentSlugs.join(', ') || 'none'}`);
            debugLog(`   - Passcode provided: ${passcode ? 'yes' : 'no'}`);

            // If no document slugs found, allow access (legacy conversations)
            if (documentSlugs.length === 0) {
                debugLog('⚠️  Shared conversation has no document slugs in metadata, allowing access');
                return res.json({
                    conversation: {
                        id: conversation.id,
                        sessionId: conversation.session_id,
                        question: conversation.question,
                        response: conversation.response,
                        model: conversation.model,
                        createdAt: conversation.created_at,
                        documentName: conversation.document_name,
                        documentVersion: conversation.document_version,
                        documentIds: conversation.document_ids,
                        metadata: conversation.metadata
                    }
                });
            }

            // Authenticate user (may be null for anonymous)
            const { userId } = await authenticateUser(req.headers.authorization, supabase);
            debugLog(`   - User ID: ${userId || 'anonymous'}`);

            // Check document access (with optional passcode)
            let accessResult;
            try {
                accessResult = await checkDocumentAccess(documentSlugs, userId, supabase, passcode);
            } catch (accessError) {
                console.error('❌ Error checking document access:', accessError);
                return res.status(500).json({ 
                    error: 'Failed to verify document access',
                    details: accessError.message 
                });
            }
            
            if (!accessResult.hasAccess) {
                debugLog(`❌ Access denied to shared conversation:`);
                debugLog(`   - Error: ${accessResult.error?.message || 'Unknown error'}`);
                debugLog(`   - Requires auth: ${accessResult.error?.requires_auth || false}`);
                debugLog(`   - Requires passcode: ${accessResult.error?.requires_passcode || false}`);
                // Return appropriate error based on access denial reason
                const errorResponse = {
                    error: accessResult.error?.message || 'Access denied',
                    error_type: accessResult.error?.requires_passcode ? 'passcode_required' :
                                accessResult.error?.requires_auth ? 'auth_required' :
                                (passcode ? 'passcode_incorrect' : 'access_denied'),
                    document: accessResult.error?.document || documentSlugs[0],
                    requires_auth: accessResult.error?.requires_auth || false,
                    requires_passcode: accessResult.error?.requires_passcode || false
                };
                
                return res.status(403).json(errorResponse);
            }

            debugLog(`✅ Access granted to shared conversation`);

            // Return conversation data
            res.json({
                conversation: {
                    id: conversation.id,
                    sessionId: conversation.session_id,
                    question: conversation.question,
                    response: conversation.response,
                    model: conversation.model,
                    createdAt: conversation.created_at,
                    documentName: conversation.document_name,
                    documentVersion: conversation.document_version,
                    documentIds: conversation.document_ids,
                    metadata: conversation.metadata
                }
            });

        } catch (error) {
            console.error('❌ Error in GET /api/shared/:shareToken:', error);
            console.error('   - Error stack:', error.stack);
            console.error('   - Error message:', error.message);
            res.status(500).json({ 
                error: 'Internal server error',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    };
}

/**
 * Create POST /chat/share handler
 * @param {object} dependencies - Dependencies object
 * @returns {Function} Express route handler
 */
function createPostShareHandler(dependencies) {
    const { supabase } = dependencies;

    return async (req, res) => {
        try {
            const { conversationId } = req.body;

            if (!conversationId) {
                return res.status(400).json({ error: 'Conversation ID is required' });
            }

            // Check if conversation exists and get current share_token and banned status
            const { data: conversation, error: fetchError } = await supabase
                .from('chat_conversations')
                .select('id, share_token, banned, ban_reason')
                .eq('id', conversationId)
                .single();

            if (fetchError || !conversation) {
                return res.status(404).json({ error: 'Conversation not found' });
            }

            // If conversation is banned, don't allow sharing
            if (conversation.banned) {
                return res.status(403).json({ 
                    error: 'This conversation cannot be shared because it contains inappropriate content',
                    banned: true,
                    ban_reason: conversation.ban_reason
                });
            }

            // If share_token already exists, return it
            if (conversation.share_token) {
                const shareUrl = `/app/shared/${conversation.share_token}`;
                return res.json({
                    shareToken: conversation.share_token,
                    shareUrl: shareUrl,
                    alreadyExists: true
                });
            }

            // Generate new share_token
            let shareToken = generateShareToken();
            let attempts = 0;
            const maxAttempts = 5;

            // Retry if token collision (unlikely but possible)
            while (attempts < maxAttempts) {
                const { error: updateError } = await supabase
                    .from('chat_conversations')
                    .update({ share_token: shareToken })
                    .eq('id', conversationId);

                if (!updateError) {
                    // Success - token updated
                    const shareUrl = `/app/shared/${shareToken}`;
                    return res.json({
                        shareToken: shareToken,
                        shareUrl: shareUrl,
                        alreadyExists: false
                    });
                }

                // If unique constraint violation, try again with new token
                if (updateError.code === '23505') {
                    attempts++;
                    shareToken = generateShareToken();
                } else {
                    // Other error
                    console.error('Error updating share token:', updateError);
                    return res.status(500).json({ error: 'Failed to generate share token' });
                }
            }

            return res.status(500).json({ error: 'Failed to generate unique share token' });

        } catch (error) {
            console.error('Error in POST /api/chat/share:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    };
}

/**
 * Create GET /chat/conversation/:conversationId/banned-status handler
 * @param {object} dependencies - Dependencies object
 * @returns {Function} Express route handler
 */
function createGetBannedStatusHandler(dependencies) {
    const { supabase } = dependencies;

    return async (req, res) => {
        try {
            const { conversationId } = req.params;

            if (!conversationId) {
                return res.status(400).json({ error: 'Conversation ID is required' });
            }

            const { data: conversation, error } = await supabase
                .from('chat_conversations')
                .select('id, banned, ban_reason')
                .eq('id', conversationId)
                .single();

            if (error || !conversation) {
                return res.status(404).json({ error: 'Conversation not found' });
            }

            return res.json({
                banned: conversation.banned === true,
                ban_reason: conversation.ban_reason || null
            });

        } catch (error) {
            console.error('Error checking banned status:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    };
}

module.exports = {
    createGetSharedHandler,
    createPostShareHandler,
    createGetBannedStatusHandler
};

