/**
 * Chat POST Handler
 * Handles non-streaming RAG chat endpoint
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
    logConversation
} = require('./conversation-logger');

/**
 * Create POST /chat handler
 * @param {object} dependencies - Dependencies object
 * @returns {Function} Express route handler
 */
function createChatPostHandler(dependencies) {
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
        
        // Timing instrumentation
        const timings = {
            start: startTime,
            authStart: 0,
            authEnd: 0,
            registryStart: 0,
            registryEnd: 0,
            embeddingStart: 0,
            embeddingEnd: 0,
            retrievalStart: 0,
            retrievalEnd: 0,
            generationStart: 0,
            generationEnd: 0,
            loggingStart: 0,
            loggingEnd: 0
        };

        // Store raw document data for multi-doc overrides
        let rawDocumentData = [];
        
        // Validate session ID
        const sessionId = validateSessionId(req.body.sessionId);

        // Check rate limit
        const rateLimitCheck = checkRateLimit(sessionId);
        if (!rateLimitCheck.allowed) {
            console.log(`⚠️  Rate limit exceeded for session ${sessionId.substring(0, 8)}... (${rateLimitCheck.reason})`);
            return res.status(429).json({
                error: `Rate limit exceeded. Please wait ${rateLimitCheck.retryAfter} seconds before sending another message.`,
                rateLimitExceeded: true,
                retryAfter: rateLimitCheck.retryAfter,
                limit: rateLimitCheck.limit,
                window: rateLimitCheck.window
            });
        }

        // Check conversation length limit
        const conversationLimitCheck = await checkConversationLimit(sessionId, supabase);
        if (!conversationLimitCheck.allowed) {
            return res.status(403).json({
                error: `You've reached the conversation limit of ${conversationLimitCheck.limit} messages. Please start a new chat to continue.`,
                conversationLimitExceeded: true,
                limit: conversationLimitCheck.limit,
                currentCount: conversationLimitCheck.count
            });
        }

        try {
            const { message, history = [], model: requestedModel = 'gemini', doc = 'smh', passcode = null } = req.body;
            let model = requestedModel;
            
            // Get IP address from request
            const ipAddress = getIpAddress(req);
            
            // Get embedding type from query parameter (openai or local)
            let embeddingType = req.query.embedding || 'openai';

            // Validate message
            const messageValidation = validateMessage(message);
            if (!messageValidation.valid) {
                return res.status(400).json({ 
                    error: messageValidation.error,
                    message: messageValidation.message
                });
            }

            // Check content for ban
            const { shouldBan: isBanned, reason: banReason } = checkContentForBan(message);

            // Parse document parameter
            const documentSlugs = parseDocumentParam(doc);
            
            timings.authStart = Date.now();
            const { userId } = await authenticateUser(req.headers.authorization, supabase);
            timings.authEnd = Date.now();
            
            const accessResult = await checkDocumentAccess(documentSlugs, userId, supabase, passcode);
            if (!accessResult.hasAccess) {
                return res.status(accessResult.error.status).json({
                    error: accessResult.error.status === 403 ? 'Access denied' : 'Error',
                    message: accessResult.error.message,
                    requires_auth: accessResult.error.requires_auth,
                    document: accessResult.error.document
                });
            }
            
            debugLog(`📝 Chat: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}" | ${model} | ${documentSlugs.join('+')}`);

            // Validate document count
            const docCountValidation = validateDocumentCount(documentSlugs);
            if (!docCountValidation.valid) {
                return res.status(400).json({
                    error: docCountValidation.error,
                    message: docCountValidation.message
                });
            }

            // For multi-document searches, ALWAYS use OpenAI embeddings for consistency
            if (documentSlugs.length > 1) {
                embeddingType = 'openai';
            }

            // Validate documents
            const validationResult = await validateDocuments(documentSlugs, documentRegistry);
            if (!validationResult.valid) {
                return res.status(validationResult.error.status).json({
                    error: validationResult.error.status === 400 ? 'Invalid Document(s)' : 'Error',
                    message: validationResult.error.message
                });
            }

            // Use array for multi-document, single string for backward compatibility
            const documentType = documentSlugs.length === 1 ? documentSlugs[0] : documentSlugs;

            // Get chunk limit and owner info
            const chunkLimitResult = await getChunkLimitAndOwnerInfo(documentSlugs, supabase);
            const chunkLimit = chunkLimitResult.chunkLimit;
            const ownerInfo = chunkLimitResult.ownerInfo;
            rawDocumentData = chunkLimitResult.rawDocumentData;
            timings.registryStart = chunkLimitResult.timings.registryStart;
            timings.registryEnd = chunkLimitResult.timings.registryEnd;

            // Apply forced Grok model override
            const modelOverrideResult = applyModelOverride(model, documentSlugs, ownerInfo, rawDocumentData);
            model = modelOverrideResult.effectiveModel;
            const originalModel = modelOverrideResult.originalModel;

            let responseText;
            let retrievalTimeMs = 0;
            let chunksUsed = 0;
            let errorOccurred = null;
            let retrievedChunks = [];

            try {
                // Embed the query
                const embeddingResult = await embedQueryWithCache(message, embeddingType, embeddingCache, localEmbeddings, rag, clients);
                const queryEmbedding = embeddingResult.queryEmbedding;
                timings.embeddingStart = embeddingResult.timings.embeddingStart;
                timings.embeddingEnd = embeddingResult.timings.embeddingEnd;
                
                // Retrieve relevant chunks using HYBRID search (vector + full-text)
                const retrievalResult = await retrieveChunks(queryEmbedding, message, embeddingType, documentType, chunkLimit, supabase, rag, ownerInfo);
                retrievedChunks = retrievalResult.retrievedChunks;
                retrievalTimeMs = retrievalResult.retrievalTimeMs;
                chunksUsed = retrievedChunks.length;
                timings.retrievalStart = retrievalResult.timings.retrievalStart;
                timings.retrievalEnd = retrievalResult.timings.retrievalEnd;

                timings.generationStart = Date.now();
                
                try {
                    let actualModelName;
                    
                    if (model === 'grok') {
                        actualModelName = 'grok-4-fast-non-reasoning';
                        responseText = await rag.chatWithRAGGrok(clients.xai, documentRegistry, message, history, documentType, retrievedChunks, actualModelName);
                    } else if (model === 'grok-reasoning') {
                        actualModelName = 'grok-4-fast-reasoning';
                        responseText = await rag.chatWithRAGGrok(clients.xai, documentRegistry, message, history, documentType, retrievedChunks, actualModelName);
                    } else {
                        actualModelName = 'gemini-2.5-flash';
                        responseText = await rag.chatWithRAGGemini(clients.genAI, documentRegistry, message, history, documentType, retrievedChunks);
                    }
                    
                    timings.generationEnd = Date.now();
                } catch (genError) {
                    timings.generationEnd = Date.now();
                    console.error('❌ Generation error:', genError.message);
                    throw new Error(`Failed to generate response: ${genError.message}`);
                }
            } catch (chatError) {
                errorOccurred = chatError.message;
                console.error('RAG Chat Error:', chatError);
                throw chatError;
            } finally {
                const responseTime = Date.now() - startTime;

                // Extract document metadata
                const { combinedDocName, documentIds, docYear } = await extractDocumentMetadata(documentType, documentRegistry);
                
                timings.loggingStart = Date.now();

                // Build conversation data
                const conversationData = buildConversationData({
                    sessionId,
                    message,
                    responseText,
                    model,
                    responseTime,
                    documentType,
                    combinedDocName,
                    docYear,
                    documentIds,
                    userId,
                    ipAddress,
                    country: undefined, // Not used in non-streaming
                    isBanned,
                    banReason,
                    retrievedChunks,
                    retrievalTimeMs,
                    embeddingType,
                    ownerInfo,
                    chunkLimit,
                    originalModel,
                    history,
                    timings,
                    streaming: false,
                    error: errorOccurred
                });

                // Async logging - fire-and-forget
                logConversation(conversationData, supabase);

                // Don't wait for logging - send response immediately
                res.locals.conversationId = null; // Will be logged asynchronously
            }

            const finalResponseTime = Date.now() - startTime;
            
            // Determine actual API model name for logging and response
            const actualModelName = model === 'grok' ? 'grok-4-fast-non-reasoning' :
                                    model === 'grok-reasoning' ? 'grok-4-fast-reasoning' :
                                    'gemini-2.5-flash';
            
            console.log(`✅ Chat completed: ${finalResponseTime}ms | ${chunksUsed} chunks | Model: ${actualModelName}`);

            // Get document info from registry for response metadata (handle multi-document)
            const isMultiDocResponse = Array.isArray(documentType);
            const slugsArray = isMultiDocResponse ? documentType : [documentType];
            
            const docConfigs = await Promise.all(
                slugsArray.map(slug => documentRegistry.getDocumentBySlug(slug))
            );
            
            const docTitles = docConfigs.filter(cfg => cfg).map(cfg => cfg.title).join(' + ');
            const docFileNames = docConfigs.filter(cfg => cfg).map(cfg => cfg.pdf_filename).join(' + ');
            
            res.json({
                response: responseText,
                model: model,
                actualModel: actualModelName,
                sessionId: sessionId,
                conversationId: res.locals.conversationId,
                metadata: {
                    document: docFileNames,
                    documentType: documentType,
                    documentSlugs: slugsArray,
                    documentTitle: docTitles || 'Unknown',
                    isMultiDocument: isMultiDocResponse,
                    responseTime: finalResponseTime,
                    retrievalMethod: isMultiDocResponse ? 'rag-multi' : 'rag',
                    chunksUsed: chunksUsed,
                    retrievalTime: retrievalTimeMs,
                    embedding_type: embeddingType,
                    embedding_dimensions: embeddingType === 'local' ? 384 : 1536,
                    chunkSimilarities: retrievedChunks.map(c => ({
                        index: c.chunk_index,
                        similarity: c.similarity,
                        source: c.document_slug
                    }))
                }
            });

        } catch (error) {
            const errorTime = Date.now() - startTime;
            console.error(`❌ Error after ${errorTime}ms:`, error.message);
            res.status(500).json({ 
                error: 'Failed to process RAG chat message',
                details: error.message 
            });
        }
    };
}

module.exports = {
    createChatPostHandler
};

