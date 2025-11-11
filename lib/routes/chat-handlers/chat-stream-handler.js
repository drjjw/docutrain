/**
 * Chat Stream Handler
 * Handles streaming RAG chat endpoint (SSE)
 */

const {
    authenticateUser,
    checkDocumentAccess,
    validateDocuments,
    getChunkLimitAndOwnerInfo,
    applyModelOverride,
    embedQueryWithCache,
    retrieveChunks
} = require('../chat-helpers');
const { getIpAddress } = require('../../utils');
const { getCountryFromIP } = require('../../utils/ip-geolocation');
const { debugLog } = require('../../utils/debug');
const {
    validateSessionId,
    checkRateLimit,
    checkConversationLimit,
    validateMessage,
    checkContentForBan,
    parseDocumentParam,
    validateDocumentCount
} = require('./request-validation');
const {
    extractDocumentMetadata,
    buildConversationData,
    logConversationSync
} = require('./conversation-logger');

/**
 * Create POST /chat/stream handler
 * @param {object} dependencies - Dependencies object
 * @returns {Function} Express route handler
 */
function createChatStreamHandler(dependencies) {
    const {
        supabase,
        documentRegistry,
        rag,
        localEmbeddings,
        embeddingCache,
        clients
    } = dependencies;

    return async (req, res) => {
        const startTime = Date.now();
        
        // Set up SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

        // Validate session ID
        const sessionId = validateSessionId(req.body.sessionId);

        // Check rate limit
        const rateLimitCheck = checkRateLimit(sessionId);
        if (!rateLimitCheck.allowed) {
            console.log(`⚠️  Rate limit exceeded for session ${sessionId.substring(0, 8)}... (${rateLimitCheck.reason})`);
            res.write(`data: ${JSON.stringify({ 
                error: `Rate limit exceeded. Please wait ${rateLimitCheck.retryAfter} seconds before sending another message.`,
                rateLimitExceeded: true,
                retryAfter: rateLimitCheck.retryAfter,
                limit: rateLimitCheck.limit,
                window: rateLimitCheck.window,
                type: 'error'
            })}\n\n`);
            res.end();
            return;
        }

        // Check conversation length limit
        const conversationLimitCheck = await checkConversationLimit(sessionId, supabase);
        if (!conversationLimitCheck.allowed) {
            res.write(`data: ${JSON.stringify({ 
                error: `You've reached the conversation limit of ${conversationLimitCheck.limit} messages. Please start a new chat to continue.`,
                conversationLimitExceeded: true,
                limit: conversationLimitCheck.limit,
                currentCount: conversationLimitCheck.count,
                type: 'error'
            })}\n\n`);
            res.end();
            return;
        }

        try {
            const { message, history = [], model: requestedModel = 'gemini', doc = 'smh', passcode = null } = req.body;
            let model = requestedModel;
            let embeddingType = req.query.embedding || 'openai';
            
            // Get IP address from request
            const ipAddress = getIpAddress(req);
            
            // Lookup country from IP address (non-blocking, don't wait for it)
            // Wrap in try-catch to ensure it never throws and breaks the request
            let countryPromise = Promise.resolve(null);
            if (ipAddress) {
                try {
                    countryPromise = getCountryFromIP(ipAddress).catch(err => {
                        console.warn(`[Chat] Country lookup failed for IP ${ipAddress}:`, err.message);
                        return null;
                    });
                } catch (err) {
                    console.warn(`[Chat] Error initiating country lookup:`, err.message);
                    countryPromise = Promise.resolve(null);
                }
            }

            // Validate message
            const messageValidation = validateMessage(message);
            if (!messageValidation.valid) {
                res.write(`data: ${JSON.stringify({ error: messageValidation.error || 'Message is required' })}\n\n`);
                res.end();
                return;
            }

            // Check content for ban
            const { shouldBan: isBanned, reason: banReason } = checkContentForBan(message);

            // Parse document parameter
            const documentSlugs = parseDocumentParam(doc);

            const { userId } = await authenticateUser(req.headers.authorization, supabase);
            debugLog(`📝 Stream: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}" | ${model} | ${documentSlugs.join('+')}`);
            
            // Check document access (with optional passcode)
            const accessResult = await checkDocumentAccess(documentSlugs, userId, supabase, passcode);
            if (!accessResult.hasAccess) {
                res.write(`data: ${JSON.stringify({ error: accessResult.error.message, document: accessResult.error.document })}\n\n`);
                res.end();
                return;
            }

            // Validate documents
            const validationResult = await validateDocuments(documentSlugs, documentRegistry);
            if (!validationResult.valid) {
                res.write(`data: ${JSON.stringify({ error: validationResult.error.message })}\n\n`);
                res.end();
                return;
            }

            // Multi-doc validation - force OpenAI embeddings
            if (documentSlugs.length > 1) {
                embeddingType = 'openai';
            }

            const documentType = documentSlugs.length === 1 ? documentSlugs[0] : documentSlugs;

            // Get chunk limit and owner info
            const chunkLimitResult = await getChunkLimitAndOwnerInfo(documentSlugs, supabase);
            const chunkLimit = chunkLimitResult.chunkLimit;
            const ownerInfo = chunkLimitResult.ownerInfo;

            // Apply forced Grok model override
            const modelOverrideResult = applyModelOverride(model, documentSlugs, ownerInfo, chunkLimitResult.rawDocumentData);
            model = modelOverrideResult.effectiveModel;

            // Embed query
            const embeddingResult = await embedQueryWithCache(message, embeddingType, embeddingCache, localEmbeddings, rag, clients);
            const queryEmbedding = embeddingResult.queryEmbedding;

            // Retrieve chunks using HYBRID search (vector + full-text)
            const retrievalResult = await retrieveChunks(queryEmbedding, message, embeddingType, documentType, chunkLimit, supabase, rag, ownerInfo);
            const retrievedChunks = retrievalResult.retrievedChunks;

            // Stream the response
            let fullResponse = '';
            let actualModelName;

            if (model === 'grok' || model === 'grok-reasoning') {
                actualModelName = model === 'grok' ? 'grok-4-fast-non-reasoning' : 'grok-4-fast-reasoning';
                const stream = rag.chatWithRAGGrokStream(clients.xai, documentRegistry, message, history, documentType, retrievedChunks, actualModelName);
                
                for await (const chunk of stream) {
                    fullResponse += chunk;
                    res.write(`data: ${JSON.stringify({ chunk, type: 'content' })}\n\n`);
                }
            } else {
                actualModelName = 'gemini-2.5-flash';
                const stream = rag.chatWithRAGGeminiStream(clients.genAI, documentRegistry, message, history, documentType, retrievedChunks);
                
                for await (const chunk of stream) {
                    fullResponse += chunk;
                    res.write(`data: ${JSON.stringify({ chunk, type: 'content' })}\n\n`);
                }
            }

            // Log conversation to database BEFORE sending done event (so we can include conversation ID)
            const totalTime = Date.now() - startTime;
            let conversationId = null;
            let shareToken = null;
            
            try {
                // Extract document metadata
                const { combinedDocName, documentIds, docYear } = await extractDocumentMetadata(documentType, documentRegistry);

                // Get country from IP lookup (await the promise we started earlier)
                const country = await countryPromise;
                if (country) {
                    debugLog(`🌍 Country lookup successful: IP ${ipAddress} → ${country}`);
                } else if (ipAddress) {
                    debugLog(`⚠️  Country lookup failed or returned null for IP: ${ipAddress}`);
                }

                // Build conversation data
                const conversationData = buildConversationData({
                    sessionId,
                    message,
                    responseText: fullResponse,
                    model,
                    responseTime: totalTime,
                    documentType,
                    combinedDocName,
                    docYear,
                    documentIds,
                    userId,
                    ipAddress,
                    country,
                    isBanned,
                    banReason,
                    retrievedChunks,
                    retrievalTimeMs: retrievalResult.retrievalTimeMs || 0,
                    embeddingType,
                    ownerInfo,
                    chunkLimit,
                    originalModel: requestedModel,
                    history,
                    timings: null, // Not tracking timings for streaming
                    streaming: true
                });

                // Log conversation synchronously (need conversation ID for response)
                const logResult = await logConversationSync(conversationData, supabase);
                conversationId = logResult.conversationId;
                shareToken = logResult.shareToken;
            } catch (loggingError) {
                console.error(`⚠️  Stream logging error:`, loggingError.message);
            }

            // Send completion event with conversation ID and share token
            res.write(`data: ${JSON.stringify({ 
                type: 'done',
                metadata: {
                    responseTime: totalTime,
                    chunksUsed: retrievedChunks.length,
                    retrievalTime: retrievalResult.retrievalTimeMs || 0,
                    model: actualModelName,
                    sessionId: sessionId,
                    conversationId: conversationId,
                    shareToken: shareToken
                }
            })}\n\n`);
            
            res.end();

            console.log(`✅ Stream completed: ${totalTime}ms | ${retrievedChunks.length} chunks | Model: ${actualModelName}`);

        } catch (error) {
            console.error('❌ Streaming error:', error);
            res.write(`data: ${JSON.stringify({ error: error.message, type: 'error' })}\n\n`);
            res.end();
        }
    };
}

module.exports = {
    createChatStreamHandler
};

