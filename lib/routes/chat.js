/**
 * Chat routes
 * Handles RAG chat endpoint with multi-document support
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const {
    authenticateUser,
    checkDocumentAccess,
    validateDocuments,
    getChunkLimitAndOwnerInfo,
    applyModelOverride,
    embedQueryWithCache,
    retrieveChunks
} = require('./chat-helpers');

/**
 * Create chat router
 */
function createChatRouter(dependencies) {
    const {
        supabase,
        documentRegistry,
        rag,
        localEmbeddings,
        embeddingCache,
        clients
    } = dependencies;

    // POST /api/chat - Main RAG chat endpoint
    router.post('/chat', async (req, res) => {
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
        
        // Ensure sessionId is a valid UUID
        let sessionId = req.body.sessionId;
        if (!sessionId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
            sessionId = uuidv4();
        }

        try {
            const { message, history = [], model: requestedModel = 'gemini', doc = 'smh', passcode = null } = req.body;
            let model = requestedModel;
            
            // Get embedding type from query parameter (openai or local)
            let embeddingType = req.query.embedding || 'openai';

            if (!message) {
                return res.status(400).json({ error: 'Message is required' });
            }

            // Parse document parameter - supports multiple documents with + separator
            const docParam = doc || 'smh';
            const documentSlugs = docParam.split(/[\s+]+/).map(s => s.trim()).filter(s => s);
            
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
            
            console.log(`📝 Chat: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}" | ${model} | ${documentSlugs.join('+')}`);

            // Validate max document limit (5 documents)
            const MAX_DOCUMENTS = 5;
            if (documentSlugs.length > MAX_DOCUMENTS) {
                return res.status(400).json({
                    error: 'Too Many Documents',
                    message: `Maximum ${MAX_DOCUMENTS} documents can be searched simultaneously. You specified ${documentSlugs.length}.`
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
            const overrideReason = modelOverrideResult.overrideReason;
            const overrideSource = modelOverrideResult.overrideSource;

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

                // Log to Supabase with RAG metadata
                // Get document info from registry for logging (handle multi-document)
                const isMultiDoc = Array.isArray(documentType);
                const firstDocSlug = isMultiDoc ? documentType[0] : documentType;
                const docConfig = await documentRegistry.getDocumentBySlug(firstDocSlug);
                const docFileName = docConfig ? docConfig.pdf_filename : 'unknown.pdf';
                const docYear = docConfig ? docConfig.year : null;
                
                // For multi-document, create combined document name
                let combinedDocName = docFileName;
                let documentIds = null;
                if (isMultiDoc && documentType.length > 1) {
                    const allConfigs = await Promise.all(
                        documentType.map(slug => documentRegistry.getDocumentBySlug(slug))
                    );
                    const fileNames = allConfigs.filter(cfg => cfg).map(cfg => cfg.pdf_filename);
                    combinedDocName = fileNames.join(' + ');
                    // Extract document IDs for multi-document conversations
                    documentIds = allConfigs.filter(cfg => cfg && cfg.id).map(cfg => cfg.id);
                } else {
                    // Single document conversation - extract document ID
                    documentIds = docConfig && docConfig.id ? [docConfig.id] : null;
                }
                
                // 🎯 OPTIMIZATION: Start logging timing
                timings.loggingStart = Date.now();
                
                // 🎯 OPTIMIZATION: Reduce metadata size (Priority 4)
                // Keep only top 10 chunks for logging instead of all chunks
                const topChunks = retrievedChunks.slice(0, 10);
                const similarities = retrievedChunks.map(c => c.similarity);
                
                const conversationData = {
                    session_id: sessionId,
                    question: message,
                    response: responseText || '',
                    model: model === 'grok-reasoning' ? 'grok' : model, // Normalize 'grok-reasoning' to 'grok' for database constraint
                    response_time_ms: responseTime,
                    document_name: combinedDocName,
                    document_path: '', // Not used in RAG-only mode
                    document_version: docYear,
                    pdf_name: combinedDocName, // Legacy field for compatibility
                    pdf_pages: 0, // Not applicable for RAG
                    error: errorOccurred,
                    retrieval_method: 'rag', // Always use 'rag' (database constraint only allows 'full' or 'rag')
                    chunks_used: chunksUsed,
                    retrieval_time_ms: retrievalTimeMs,
                    document_ids: documentIds, // Array of document UUIDs (1-5 documents)
                    user_id: userId || null, // User ID if authenticated, null for anonymous
                    metadata: {
                        history_length: history.length,
                        timestamp: new Date().toISOString(),
                        document_type: documentType,
                        document_slugs: isMultiDoc ? documentType : [documentType],
                        is_multi_document: isMultiDoc,
                        
                        // Only log top 10 chunk similarities (not all 50+)
                        chunk_similarities_top10: topChunks.map(c => c.similarity),
                        chunk_similarities_stats: {
                            count: retrievedChunks.length,
                            avg: similarities.length > 0 ? similarities.reduce((sum, c) => sum + c, 0) / similarities.length : 0,
                            max: similarities.length > 0 ? Math.max(...similarities) : 0,
                            min: similarities.length > 0 ? Math.min(...similarities) : 0
                        },
                        
                        // Only log top 10 chunk sources (not all 50+)
                        chunk_sources_top10: topChunks.map(c => ({
                            slug: c.document_slug,
                            name: c.document_name,
                            similarity: c.similarity
                        })),
                        
                        embedding_type: embeddingType,
                        embedding_dimensions: embeddingType === 'local' ? 384 : 1536,
                        owner_slug: ownerInfo?.owner_slug || null,
                        owner_name: ownerInfo?.owner_name || null,
                        chunk_limit_configured: chunkLimit,
                        chunk_limit_source: ownerInfo ? 'owner' : 'default',
                        forced_grok_model: ownerInfo?.forced_grok_model || null,
                        model_override_applied: originalModel !== model,
                        original_model_requested: originalModel !== model ? originalModel : null,
                        
                        // Add detailed timing breakdown to metadata
                        timing_breakdown: {
                            auth_ms: timings.authEnd - timings.authStart,
                            registry_ms: timings.registryEnd - timings.registryStart,
                            embedding_ms: timings.embeddingEnd - timings.embeddingStart,
                            retrieval_ms: timings.retrievalEnd - timings.retrievalStart,
                            generation_ms: timings.generationEnd - timings.generationStart,
                            total_ms: responseTime
                        }
                    }
                };

                // Async logging - fire-and-forget
                timings.loggingStart = Date.now();
                
                supabase
                    .from('chat_conversations')
                    .insert([conversationData])
                    .select('id')
                    .single()
                    .then(({ data, error }) => {
                        timings.loggingEnd = Date.now();
                        if (error) {
                            console.error(`⚠️  Logging failed:`, error.message, `(${error.code || 'unknown'})`);
                            if (error.code === '42501' || error.message?.includes('permission denied') || error.message?.includes('row-level security')) {
                                console.error(`   ⚠️  RLS policy issue detected`);
                            }
                        } else if (data) {
                            // Only log on success (async logging)
                        }
                        return data;
                    })
                    .catch(error => {
                        console.error(`⚠️  Logging error:`, error.message);
                        return null;
                    });

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
    });

    // POST /api/chat/stream - Streaming RAG chat endpoint
    router.post('/chat/stream', async (req, res) => {
        const startTime = Date.now();
        
        // Set up SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
        
        // Ensure sessionId is a valid UUID
        let sessionId = req.body.sessionId;
        if (!sessionId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
            sessionId = uuidv4();
        }

        try {
            const { message, history = [], model: requestedModel = 'gemini', doc = 'smh', passcode = null } = req.body;
            let model = requestedModel;
            let embeddingType = req.query.embedding || 'openai';

            if (!message) {
                res.write(`data: ${JSON.stringify({ error: 'Message is required' })}\n\n`);
                res.end();
                return;
            }

            // Parse document parameter
            const docParam = doc || 'smh';
            const documentSlugs = docParam.split(/[\s+]+/).map(s => s.trim()).filter(s => s);

            const { userId } = await authenticateUser(req.headers.authorization, supabase);
            console.log(`📝 Stream: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}" | ${model} | ${documentSlugs.join('+')}`);
            
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
            const rawDocumentData = chunkLimitResult.rawDocumentData;

            // Apply forced Grok model override
            const modelOverrideResult = applyModelOverride(model, documentSlugs, ownerInfo, rawDocumentData);
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

            // Send completion event
            const totalTime = Date.now() - startTime;
            res.write(`data: ${JSON.stringify({ 
                type: 'done',
                metadata: {
                    responseTime: totalTime,
                    chunksUsed: retrievedChunks.length,
                    retrievalTime: retrievalResult.retrievalTimeMs || 0,
                    model: actualModelName,
                    sessionId: sessionId
                }
            })}\n\n`);
            
            res.end();

            console.log(`✅ Stream completed: ${totalTime}ms | ${retrievedChunks.length} chunks | Model: ${actualModelName}`);

            // Log conversation to database (async, fire-and-forget)
            (async () => {
                try {
                    // Get document info from registry for logging (handle multi-document)
                    const isMultiDoc = Array.isArray(documentType);
                    const firstDocSlug = isMultiDoc ? documentType[0] : documentType;
                    const docConfig = await documentRegistry.getDocumentBySlug(firstDocSlug);
                    const docFileName = docConfig ? docConfig.pdf_filename : 'unknown.pdf';
                    const docYear = docConfig ? docConfig.year : null;
                    
                    // For multi-document, create combined document name
                    let combinedDocName = docFileName;
                    let documentIds = null;
                    if (isMultiDoc && documentType.length > 1) {
                        const allConfigs = await Promise.all(
                            documentType.map(slug => documentRegistry.getDocumentBySlug(slug))
                        );
                        const fileNames = allConfigs.filter(cfg => cfg).map(cfg => cfg.pdf_filename);
                        combinedDocName = fileNames.join(' + ');
                        // Extract document IDs for multi-document conversations
                        documentIds = allConfigs.filter(cfg => cfg && cfg.id).map(cfg => cfg.id);
                    } else {
                        // Single document conversation - extract document ID
                        documentIds = docConfig && docConfig.id ? [docConfig.id] : null;
                    }

                    const conversationData = {
                        session_id: sessionId,
                        question: message,
                        response: fullResponse || '',
                        model: model === 'grok-reasoning' ? 'grok' : model, // Normalize 'grok-reasoning' to 'grok' for database constraint
                        response_time_ms: totalTime,
                        document_name: combinedDocName,
                        document_path: '', // Not used in RAG-only mode
                        document_version: docYear,
                        pdf_name: combinedDocName, // Legacy field for compatibility
                        pdf_pages: 0, // Not applicable for RAG
                        error: null,
                        retrieval_method: 'rag', // Always use 'rag' (database constraint only allows 'full' or 'rag')
                        chunks_used: retrievedChunks.length,
                        retrieval_time_ms: retrievalResult.retrievalTimeMs || 0,
                        document_ids: documentIds, // Array of document UUIDs (1-5 documents)
                        user_id: userId || null, // User ID if authenticated, null for anonymous
                        metadata: {
                            history_length: history.length,
                            timestamp: new Date().toISOString(),
                            document_type: documentType,
                            document_slugs: isMultiDoc ? documentType : [documentType],
                            is_multi_document: isMultiDoc,
                            embedding_type: embeddingType,
                            embedding_dimensions: embeddingType === 'local' ? 384 : 1536,
                            owner_slug: ownerInfo?.owner_slug || null,
                            owner_name: ownerInfo?.owner_name || null,
                            chunk_limit_configured: chunkLimit,
                            chunk_limit_source: ownerInfo ? 'owner' : 'default',
                            forced_grok_model: ownerInfo?.forced_grok_model || null,
                            streaming: true
                        }
                    };

                    const { data, error } = await supabase
                        .from('chat_conversations')
                        .insert([conversationData])
                        .select('id')
                        .single();

                    if (error) {
                        console.error(`⚠️  Stream logging failed:`, error.message, `(${error.code || 'unknown'})`);
                        if (error.code === '42501' || error.message?.includes('permission denied') || error.message?.includes('row-level security')) {
                            console.error(`   ⚠️  RLS policy issue detected`);
                        }
                    } else if (data) {
                        // Only log on success (async logging)
                    }
                } catch (loggingError) {
                    console.error(`⚠️  Stream logging error:`, loggingError.message);
                }
            })().catch((err) => {
                console.error(`❌ Logging promise rejected:`, err.message);
            });

        } catch (error) {
            console.error('❌ Streaming error:', error);
            res.write(`data: ${JSON.stringify({ error: error.message, type: 'error' })}\n\n`);
            res.end();
        }
    });

    return router;
}

module.exports = {
    createChatRouter
};

