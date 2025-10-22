/**
 * Chat routes
 * Handles RAG chat endpoint with multi-document support
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

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
        console.log(`\n${'='.repeat(80)}`);
        console.log(`🔵 RAG REQUEST RECEIVED`);
        console.log(`${'='.repeat(80)}`);
        
        // Ensure sessionId is a valid UUID
        let sessionId = req.body.sessionId;
        if (!sessionId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
            sessionId = uuidv4();
        }

        try {
            const { message, history = [], model: requestedModel = 'gemini', doc = 'smh' } = req.body;
            let model = requestedModel; // Use let so we can override if needed
            
            // Get embedding type from query parameter (openai or local)
            let embeddingType = req.query.embedding || 'openai';

            if (!message) {
                return res.status(400).json({ error: 'Message is required' });
            }

            // Parse document parameter - supports multiple documents with + separator
            const docParam = doc || 'smh';
            const documentSlugs = docParam.split('+').map(s => s.trim()).filter(s => s);
            
            // Check document access permissions
            let userId = null;
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.split(' ')[1];
                try {
                    const { data: { user } } = await supabase.auth.getUser(token);
                    userId = user?.id || null;
                } catch (error) {
                    // Ignore - treat as unauthenticated
                }
            }
            
            // Verify access to each document
            for (const slug of documentSlugs) {
                const { data: hasAccess, error } = await supabase
                    .rpc('user_has_document_access_by_slug', {
                        p_user_id: userId,
                        p_document_slug: slug,
                    });
                
                if (error) {
                    console.error(`Access check error for ${slug}:`, error);
                    return res.status(500).json({ error: 'Failed to verify document access' });
                }
                
                if (!hasAccess) {
                    console.log(`❌ Access denied to document: ${slug} for user: ${userId || 'anonymous'}`);
                    return res.status(403).json({
                        error: 'Access denied',
                        message: userId 
                            ? `You do not have permission to access the document "${slug}"`
                            : `The document "${slug}" requires authentication. Please log in.`,
                        requires_auth: !userId,
                        document: slug,
                    });
                }
            }
            
            console.log(`✓ Access granted to documents: ${documentSlugs.join(', ')}`);

            
            // Log request details
            console.log(`📝 Query: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`);
            console.log(`📊 Request Details:`);
            console.log(`   - Message length: ${message.length} characters`);
            console.log(`   - History length: ${history.length} messages`);
            console.log(`   - Model: ${model}`);
            console.log(`   - Document(s): ${documentSlugs.join(' + ')}`);
            console.log(`   - Embedding type: ${embeddingType}`);
            console.log(`   - Session ID: ${sessionId}`);

            // Validate max document limit (5 documents)
            const MAX_DOCUMENTS = 5;
            if (documentSlugs.length > MAX_DOCUMENTS) {
                return res.status(400).json({
                    error: 'Too Many Documents',
                    message: `Maximum ${MAX_DOCUMENTS} documents can be searched simultaneously. You specified ${documentSlugs.length}.`
                });
            }

            // For multi-document searches, ALWAYS use OpenAI embeddings for consistency
            // This ensures all documents can be searched together regardless of individual settings
            if (documentSlugs.length > 1) {
                if (embeddingType !== 'openai') {
                    console.log(`🔄 Multi-doc search: Forcing OpenAI embeddings (was: ${embeddingType})`);
                }
                embeddingType = 'openai';
            }

            console.log(`RAG: Message length: ${message.length} chars, Model: ${model}, Docs: ${documentSlugs.join('+')}, Embedding: ${embeddingType}`);

            // Validate all document slugs exist
            const validationResults = await Promise.all(
                documentSlugs.map(slug => documentRegistry.isValidSlug(slug))
            );
            const invalidSlugs = documentSlugs.filter((slug, idx) => !validationResults[idx]);
            
            if (invalidSlugs.length > 0) {
                return res.status(400).json({
                    error: 'Invalid Document(s)',
                    message: `The following document(s) are not available: ${invalidSlugs.join(', ')}`
                });
            }

            // Validate all documents have same owner (if multiple documents)
            if (documentSlugs.length > 1) {
                const ownerValidation = await documentRegistry.validateSameOwner(documentSlugs);
                if (!ownerValidation.valid) {
                    return res.status(400).json({
                        error: 'Owner Mismatch',
                        message: ownerValidation.error
                    });
                }

                // Note: Embedding type validation removed - multi-doc always uses OpenAI
                // Individual documents may have different settings in DB, but we override to OpenAI
                // This ensures compatibility and allows all documents to be searched together
            }

            // Use array for multi-document, single string for backward compatibility
            const documentType = documentSlugs.length === 1 ? documentSlugs[0] : documentSlugs;

            // Get owner-specific chunk limit from database
            let chunkLimit = 50; // Default fallback
            let ownerInfo = null;
            try {
                if (documentSlugs.length === 1) {
                    // Single document - get its owner's chunk limit
                    const { data, error } = await supabase.rpc('get_document_chunk_limit', {
                        doc_slug: documentSlugs[0]
                    });
                    if (!error && data) {
                        chunkLimit = data;
                    }
                    
                    // Get owner info for logging and model enforcement
                    const { data: docData } = await supabase
                        .rpc('get_documents_with_owner')
                        .select('owner_slug, owner_name, default_chunk_limit, forced_grok_model')
                        .eq('slug', documentSlugs[0])
                        .single();
                    ownerInfo = docData;
                } else {
                    // Multi-document - get chunk limit (uses owner limit if same owner, else default)
                    const { data, error } = await supabase.rpc('get_multi_document_chunk_limit', {
                        doc_slugs: documentSlugs
                    });
                    if (!error && data) {
                        chunkLimit = data;
                    }
                    
                    // Get owner info for logging and model enforcement
                    const { data: docData } = await supabase
                        .rpc('get_documents_with_owner')
                        .select('owner_slug, owner_name, default_chunk_limit, forced_grok_model')
                        .in('slug', documentSlugs);
                    if (docData && docData.length > 0) {
                        const uniqueOwners = [...new Set(docData.map(d => d.owner_slug))];
                        if (uniqueOwners.length === 1) {
                            ownerInfo = docData[0];
                        } else {
                            ownerInfo = { owner_slug: 'mixed', owner_name: 'Multiple Owners', default_chunk_limit: 50, forced_grok_model: null };
                        }
                    }
                }
                console.log(`   - Owner: ${ownerInfo?.owner_name || 'Unknown'} (${ownerInfo?.owner_slug || 'unknown'})`);
                console.log(`   - Configured chunk limit: ${chunkLimit}`);
            } catch (limitError) {
                console.warn(`⚠️  Could not fetch chunk limit, using default (50):`, limitError.message);
                chunkLimit = 50;
            }

            // Apply forced Grok model override if configured for this owner
            let originalModel = model;
            if (ownerInfo?.forced_grok_model && (model === 'grok' || model === 'grok-reasoning')) {
                originalModel = model;
                model = ownerInfo.forced_grok_model;
                console.log(`🔒 FORCED MODEL OVERRIDE:`);
                console.log(`   - Owner: ${ownerInfo.owner_name}`);
                console.log(`   - User requested: ${originalModel}`);
                console.log(`   - Forced to use: ${model}`);
                console.log(`   - Reason: Owner-configured safety mechanism`);
            }

            let responseText;
            let retrievalTimeMs = 0;
            let chunksUsed = 0;
            let errorOccurred = null;
            let retrievedChunks = [];

            try {
                // Step 1: Embed the query (using selected embedding type)
                const retrievalStart = Date.now();
                console.log(`RAG: Embedding query: "${message.substring(0, 50)}..."`);
                
                let queryEmbedding;
                try {
                    console.log(`RAG: Starting embedding process for type: ${embeddingType}`);
                    if (embeddingType === 'local') {
                        // Use cached local embeddings
                        console.log(`RAG: Using cached local embeddings`);
                        queryEmbedding = await embeddingCache.getEmbeddingWithCache(
                            message,
                            async (text) => {
                                console.log(`RAG: Generating local embedding for: "${text.substring(0, 30)}..."`);
                                await localEmbeddings.ensureLocalEmbeddings();
                                return await localEmbeddings.generateLocalEmbedding(text);
                            },
                            'local'
                        );
                        console.log(`RAG: Query embedded successfully (cached local, ${queryEmbedding.length}D)`);
                    } else {
                        // Use cached OpenAI embeddings
                        console.log(`RAG: Using cached OpenAI embeddings`);
                        queryEmbedding = await embeddingCache.getEmbeddingWithCache(
                            message,
                            (text) => rag.embedQuery(clients.openai, text),
                            'openai'
                        );
                        console.log(`RAG: Query embedded successfully (cached OpenAI, 1536D)`);
                    }
                } catch (embedError) {
                    console.error('RAG: Error embedding query:', embedError.message);
                    throw new Error(`Failed to embed query with ${embeddingType}: ${embedError.message}`);
                }
                
                // Step 2: Find relevant chunks (from appropriate table)
                try {
                    console.log(`\n🔍 CHUNK RETRIEVAL:`);
                    console.log(`   - Owner: ${ownerInfo?.owner_name || 'Unknown'}`);
                    console.log(`   - Requesting: ${chunkLimit} chunks (owner-configured)`);
                    console.log(`   - Embedding type: ${embeddingType}`);
                    console.log(`   - Similarity threshold: ${embeddingType === 'local' ? '0.05' : '0.3'}`);
                    
                    if (embeddingType === 'local') {
                        retrievedChunks = await rag.findRelevantChunksLocal(supabase, queryEmbedding, documentType, chunkLimit);
                    } else {
                        retrievedChunks = await rag.findRelevantChunks(supabase, queryEmbedding, documentType, chunkLimit);
                    }
                    retrievalTimeMs = Date.now() - retrievalStart;
                    chunksUsed = retrievedChunks.length;
                    
                    // Calculate similarity statistics
                    const similarities = retrievedChunks.map(c => c.similarity);
                    const avgSimilarity = similarities.length > 0 
                        ? (similarities.reduce((a, b) => a + b, 0) / similarities.length).toFixed(3)
                        : 0;
                    const maxSimilarity = similarities.length > 0 ? Math.max(...similarities).toFixed(3) : 0;
                    const minSimilarity = similarities.length > 0 ? Math.min(...similarities).toFixed(3) : 0;
                    
                    console.log(`   ✓ Retrieved: ${chunksUsed} chunks in ${retrievalTimeMs}ms`);
                    console.log(`   - Similarity range: ${minSimilarity} - ${maxSimilarity} (avg: ${avgSimilarity})`);
                    console.log(`   - Top 5 similarities: ${similarities.slice(0, 5).map(s => s.toFixed(3)).join(', ')}`);
                    
                    // Log chunk sources for multi-document
                    if (Array.isArray(documentType)) {
                        const sourceCounts = {};
                        retrievedChunks.forEach(c => {
                            sourceCounts[c.document_slug] = (sourceCounts[c.document_slug] || 0) + 1;
                        });
                        console.log(`   - Chunks per document:`, sourceCounts);
                    }
                } catch (chunkError) {
                    console.error('❌ Error finding chunks:', chunkError.message);
                    throw new Error(`Failed to find relevant chunks with ${embeddingType}: ${chunkError.message}`);
                }

                // Step 3: Generate response using RAG
                try {
                    const genStart = Date.now();
                    console.log(`\n🤖 AI GENERATION:`);
                    
                    let actualModelName;
                    let temperature;
                    
                    if (model === 'grok') {
                        actualModelName = 'grok-4-fast-non-reasoning';
                        temperature = 0.7;
                        console.log(`   - Model: ${actualModelName}`);
                        console.log(`   - Temperature: ${temperature}`);
                        console.log(`   - Context: ${chunksUsed} chunks + ${history.length} history messages`);
                        responseText = await rag.chatWithRAGGrok(clients.xai, documentRegistry, message, history, documentType, retrievedChunks, actualModelName);
                    } else if (model === 'grok-reasoning') {
                        actualModelName = 'grok-4-fast-reasoning';
                        temperature = 0.7;
                        console.log(`   - Model: ${actualModelName}`);
                        console.log(`   - Temperature: ${temperature}`);
                        console.log(`   - Context: ${chunksUsed} chunks + ${history.length} history messages`);
                        responseText = await rag.chatWithRAGGrok(clients.xai, documentRegistry, message, history, documentType, retrievedChunks, actualModelName);
                    } else {
                        actualModelName = 'gemini-2.5-flash';
                        temperature = 'default (Gemini auto)';
                        console.log(`   - Model: ${actualModelName}`);
                        console.log(`   - Temperature: ${temperature}`);
                        console.log(`   - Context: ${chunksUsed} chunks + ${history.length} history messages`);
                        responseText = await rag.chatWithRAGGemini(clients.genAI, documentRegistry, message, history, documentType, retrievedChunks);
                    }
                    
                    const genTime = Date.now() - genStart;
                    console.log(`   ✓ Generated: ${responseText.length} characters in ${genTime}ms`);
                    console.log(`   - Words: ~${responseText.split(/\s+/).length}`);
                    console.log(`   - Tokens (est): ~${Math.ceil(responseText.length / 4)}`);
                } catch (genError) {
                    console.error('❌ Error generating response:', genError.message);
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
                if (isMultiDoc && documentType.length > 1) {
                    const allConfigs = await Promise.all(
                        documentType.map(slug => documentRegistry.getDocumentBySlug(slug))
                    );
                    const fileNames = allConfigs.filter(cfg => cfg).map(cfg => cfg.pdf_filename);
                    combinedDocName = fileNames.join(' + ');
                }
                
                const conversationData = {
                    session_id: sessionId,
                    question: message,
                    response: responseText || '',
                    model: model,
                    response_time_ms: responseTime,
                    document_name: combinedDocName,
                    document_path: '', // Not used in RAG-only mode
                    document_version: docYear,
                    pdf_name: combinedDocName, // Legacy field for compatibility
                    pdf_pages: 0, // Not applicable for RAG
                    error: errorOccurred,
                    retrieval_method: isMultiDoc ? 'rag-multi' : 'rag',
                    chunks_used: chunksUsed,
                    retrieval_time_ms: retrievalTimeMs,
                    metadata: {
                        history_length: history.length,
                        timestamp: new Date().toISOString(),
                        document_type: documentType,
                        document_slugs: isMultiDoc ? documentType : [documentType],
                        is_multi_document: isMultiDoc,
                        chunk_similarities: retrievedChunks.map(c => c.similarity),
                        chunk_sources: retrievedChunks.map(c => ({
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
                        original_model_requested: originalModel !== model ? originalModel : null
                    }
                };

                const { data: loggedConversation } = await supabase
                    .from('chat_conversations')
                    .insert([conversationData])
                    .select('id')
                    .single();

                res.locals.conversationId = loggedConversation?.id;
            }

            const finalResponseTime = Date.now() - startTime;
            
            // Final summary
            console.log(`\n${'='.repeat(80)}`);
            console.log(`✅ RAG REQUEST COMPLETED`);
            console.log(`${'='.repeat(80)}`);
            console.log(`⏱️  Performance Summary:`);
            console.log(`   - Total time: ${finalResponseTime}ms`);
            console.log(`   - Retrieval time: ${retrievalTimeMs}ms (${((retrievalTimeMs/finalResponseTime)*100).toFixed(1)}%)`);
            console.log(`   - Generation time: ${finalResponseTime - retrievalTimeMs}ms (${(((finalResponseTime-retrievalTimeMs)/finalResponseTime)*100).toFixed(1)}%)`);
            console.log(`📦 Data Summary:`);
            console.log(`   - Chunks used: ${chunksUsed}`);
            console.log(`   - Response length: ${responseText.length} chars (~${responseText.split(/\s+/).length} words)`);
            console.log(`   - Conversation ID: ${res.locals.conversationId || 'N/A'}`);
            console.log(`${'='.repeat(80)}\n`);

            // Determine actual API model name for response
            const actualModelName = model === 'grok' ? 'grok-4-fast-non-reasoning' :
                                    model === 'grok-reasoning' ? 'grok-4-fast-reasoning' :
                                    'gemini-2.5-flash';

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
            console.log(`\n${'='.repeat(80)}`);
            console.log(`❌ RAG REQUEST FAILED`);
            console.log(`${'='.repeat(80)}`);
            console.error(`⚠️  Error after ${errorTime}ms:`, error.message);
            console.error(`   Stack:`, error.stack);
            console.log(`${'='.repeat(80)}\n`);
            res.status(500).json({ 
                error: 'Failed to process RAG chat message',
                details: error.message 
            });
        }
    });

    return router;
}

module.exports = {
    createChatRouter
};

