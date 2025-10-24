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
        
        // 🎯 OPTIMIZATION: Detailed timing instrumentation
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
            
            // 🎯 OPTIMIZATION: Start auth timing
            timings.authStart = Date.now();
            
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
            
            // 🎯 OPTIMIZATION: Parallel access checks (Priority 1)
            // Instead of sequential for-loop, execute all access checks in parallel
            const accessChecks = await Promise.all(
                documentSlugs.map(slug => 
                    supabase.rpc('user_has_document_access_by_slug', {
                        p_user_id: userId,
                        p_document_slug: slug,
                    })
                )
            );
            
            // Check results after all parallel calls complete
            for (let i = 0; i < documentSlugs.length; i++) {
                const slug = documentSlugs[i];
                const { data: hasAccess, error } = accessChecks[i];
                
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
            
            timings.authEnd = Date.now();
            console.log(`✓ Access granted to documents: ${documentSlugs.join(', ')}`);
            console.log(`⏱️  Auth: ${timings.authEnd - timings.authStart}ms`);

            
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

            // 🎯 OPTIMIZATION: Start registry timing
            timings.registryStart = Date.now();

            // 🎯 OPTIMIZATION: Parallel metadata queries (Priority 2)
            // Get owner-specific chunk limit and owner info in parallel
            let chunkLimit = 50; // Default fallback
            let ownerInfo = null;
            try {
                if (documentSlugs.length === 1) {
                    // Single document - fetch chunk limit and owner info in parallel
                    const [chunkLimitResult, ownerInfoResult] = await Promise.all([
                        supabase.rpc('get_document_chunk_limit', {
                            doc_slug: documentSlugs[0]
                        }),
                        supabase
                            .rpc('get_documents_with_owner')
                            .select('owner_slug, owner_name, default_chunk_limit, owner_forced_grok_model, document_forced_grok_model')
                            .eq('slug', documentSlugs[0])
                            .single()
                    ]);
                    
                    if (!chunkLimitResult.error && chunkLimitResult.data) {
                        chunkLimit = chunkLimitResult.data;
                    }
                    ownerInfo = ownerInfoResult.data;
                } else {
                    // Multi-document - fetch chunk limit and owner info in parallel
                    const [chunkLimitResult, ownerInfoResult] = await Promise.all([
                        supabase.rpc('get_multi_document_chunk_limit', {
                            doc_slugs: documentSlugs
                        }),
                        supabase
                            .rpc('get_documents_with_owner')
                            .select('owner_slug, owner_name, default_chunk_limit, owner_forced_grok_model, document_forced_grok_model')
                            .in('slug', documentSlugs)
                    ]);
                    
                    if (!chunkLimitResult.error && chunkLimitResult.data) {
                        chunkLimit = chunkLimitResult.data;
                    }
                    
                    if (ownerInfoResult.data && ownerInfoResult.data.length > 0) {
                        const uniqueOwners = [...new Set(ownerInfoResult.data.map(d => d.owner_slug))];
                        if (uniqueOwners.length === 1) {
                            ownerInfo = ownerInfoResult.data[0];
                        } else {
                            ownerInfo = { owner_slug: 'mixed', owner_name: 'Multiple Owners', default_chunk_limit: 50, forced_grok_model: null };
                        }
                    }
                }
                
                timings.registryEnd = Date.now();
                console.log(`   - Owner: ${ownerInfo?.owner_name || 'Unknown'} (${ownerInfo?.owner_slug || 'unknown'})`);
                console.log(`   - Configured chunk limit: ${chunkLimit}`);
                console.log(`⏱️  Registry: ${timings.registryEnd - timings.registryStart}ms`);
            } catch (limitError) {
                timings.registryEnd = Date.now();
                console.warn(`⚠️  Could not fetch chunk limit, using default (50):`, limitError.message);
                console.log(`⏱️  Registry: ${timings.registryEnd - timings.registryStart}ms (with error)`);
                chunkLimit = 50;
            }

            // Apply forced Grok model override with document-level precedence
            let originalModel = model;
            let effectiveModel = model;
            let overrideReason = '';
            let overrideSource = '';

            if (model === 'grok' || model === 'grok-reasoning') {
                if (documentSlugs.length === 1) {
                    // Single document: Document override takes precedence over owner override
                    if (ownerInfo?.document_forced_grok_model) {
                        effectiveModel = ownerInfo.document_forced_grok_model;
                        overrideReason = `Document-level override: ${ownerInfo.slug}`;
                        overrideSource = 'document';
                    } else if (ownerInfo?.owner_forced_grok_model) {
                        effectiveModel = ownerInfo.owner_forced_grok_model;
                        overrideReason = `Owner-level override: ${ownerInfo.owner_name}`;
                        overrideSource = 'owner';
                    }
                } else {
                    // Multi-document: Check all document overrides, use grok-reasoning if any conflicts or reasoning required
                    const allDocOverrides = ownerInfoResult.data
                        .map(doc => doc.document_forced_grok_model)
                        .filter(override => override !== null);

                    if (allDocOverrides.length > 0) {
                        // If any document requires reasoning, or if there are conflicts, use reasoning
                        const hasReasoning = allDocOverrides.includes('grok-reasoning');
                        const hasConflicts = new Set(allDocOverrides).size > 1;

                        if (hasReasoning || hasConflicts) {
                            effectiveModel = 'grok-reasoning';
                            overrideReason = `Multi-document override: ${hasReasoning ? 'reasoning required' : 'conflicting overrides'} (${allDocOverrides.join(', ')})`;
                            overrideSource = 'multi-document-reasoning';
                        } else {
                            // All documents agree on same override
                            effectiveModel = allDocOverrides[0];
                            overrideReason = `Multi-document override: all documents agree (${effectiveModel})`;
                            overrideSource = 'multi-document-consensus';
                        }
                    } else {
                        // No document overrides, check owner-level (only if all docs have same owner)
                        const uniqueOwners = [...new Set(ownerInfoResult.data.map(d => d.owner_slug))];
                        if (uniqueOwners.length === 1 && ownerInfo?.owner_forced_grok_model) {
                            effectiveModel = ownerInfo.owner_forced_grok_model;
                            overrideReason = `Owner-level override: ${ownerInfo.owner_name}`;
                            overrideSource = 'owner';
                        }
                    }
                }

                // Apply the override if different from requested
                if (effectiveModel !== model) {
                    model = effectiveModel;
                    console.log(`🔒 FORCED MODEL OVERRIDE:`);
                    console.log(`   - User requested: ${originalModel}`);
                    console.log(`   - Forced to use: ${model}`);
                    console.log(`   - Reason: ${overrideReason}`);
                }
            }

            let responseText;
            let retrievalTimeMs = 0;
            let chunksUsed = 0;
            let errorOccurred = null;
            let retrievedChunks = [];

            try {
                // 🎯 OPTIMIZATION: Start embedding timing
                timings.embeddingStart = Date.now();
                
                // Step 1: Embed the query (using selected embedding type)
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
                    
                    timings.embeddingEnd = Date.now();
                    console.log(`⏱️  Embedding: ${timings.embeddingEnd - timings.embeddingStart}ms`);
                } catch (embedError) {
                    timings.embeddingEnd = Date.now();
                    console.error('RAG: Error embedding query:', embedError.message);
                    console.log(`⏱️  Embedding: ${timings.embeddingEnd - timings.embeddingStart}ms (with error)`);
                    throw new Error(`Failed to embed query with ${embeddingType}: ${embedError.message}`);
                }
                
                // 🎯 OPTIMIZATION: Start retrieval timing
                timings.retrievalStart = Date.now();
                const retrievalStart = Date.now(); // Keep for backward compatibility with existing code
                
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
                    timings.retrievalEnd = Date.now();
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
                    console.log(`⏱️  Retrieval: ${timings.retrievalEnd - timings.retrievalStart}ms`);
                    
                    // Log chunk sources for multi-document
                    if (Array.isArray(documentType)) {
                        const sourceCounts = {};
                        retrievedChunks.forEach(c => {
                            sourceCounts[c.document_slug] = (sourceCounts[c.document_slug] || 0) + 1;
                        });
                        console.log(`   - Chunks per document:`, sourceCounts);
                    }
                } catch (chunkError) {
                    timings.retrievalEnd = Date.now();
                    console.error('❌ Error finding chunks:', chunkError.message);
                    console.log(`⏱️  Retrieval: ${timings.retrievalEnd - timings.retrievalStart}ms (with error)`);
                    throw new Error(`Failed to find relevant chunks with ${embeddingType}: ${chunkError.message}`);
                }

                // 🎯 OPTIMIZATION: Start generation timing
                timings.generationStart = Date.now();
                
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
                    timings.generationEnd = Date.now();
                    console.log(`   ✓ Generated: ${responseText.length} characters in ${genTime}ms`);
                    console.log(`   - Words: ~${responseText.split(/\s+/).length}`);
                    console.log(`   - Tokens (est): ~${Math.ceil(responseText.length / 4)}`);
                    console.log(`⏱️  Generation: ${timings.generationEnd - timings.generationStart}ms`);
                } catch (genError) {
                    timings.generationEnd = Date.now();
                    console.error('❌ Error generating response:', genError.message);
                    console.log(`⏱️  Generation: ${timings.generationEnd - timings.generationStart}ms (with error)`);
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

                // 🎯 OPTIMIZATION: Async logging (Priority 3)
                // Fire-and-forget logging to avoid blocking response
                const loggingPromise = supabase
                    .from('chat_conversations')
                    .insert([conversationData])
                    .select('id')
                    .single()
                    .then(({ data }) => {
                        timings.loggingEnd = Date.now();
                        if (data) {
                            console.log(`✓ Conversation logged: ${data.id} (${timings.loggingEnd - timings.loggingStart}ms)`);
                        }
                        return data;
                    })
                    .catch(error => {
                        timings.loggingEnd = Date.now();
                        console.error(`⚠️  Failed to log conversation (${timings.loggingEnd - timings.loggingStart}ms):`, error.message);
                        // Don't fail the request if logging fails
                        return null;
                    });

                // Don't wait for logging - send response immediately
                res.locals.conversationId = null; // Will be logged asynchronously
            }

            const finalResponseTime = Date.now() - startTime;
            
            // 🎯 OPTIMIZATION: Detailed timing breakdown in final summary
            console.log(`\n${'='.repeat(80)}`);
            console.log(`✅ RAG REQUEST COMPLETED`);
            console.log(`${'='.repeat(80)}`);
            console.log(`⏱️  DETAILED TIMING BREAKDOWN:`);
            console.log(`   - Auth: ${timings.authEnd - timings.authStart}ms (${((timings.authEnd - timings.authStart)/finalResponseTime*100).toFixed(1)}%)`);
            console.log(`   - Registry: ${timings.registryEnd - timings.registryStart}ms (${((timings.registryEnd - timings.registryStart)/finalResponseTime*100).toFixed(1)}%)`);
            console.log(`   - Embedding: ${timings.embeddingEnd - timings.embeddingStart}ms (${((timings.embeddingEnd - timings.embeddingStart)/finalResponseTime*100).toFixed(1)}%)`);
            console.log(`   - Retrieval: ${timings.retrievalEnd - timings.retrievalStart}ms (${((timings.retrievalEnd - timings.retrievalStart)/finalResponseTime*100).toFixed(1)}%)`);
            console.log(`   - Generation: ${timings.generationEnd - timings.generationStart}ms (${((timings.generationEnd - timings.generationStart)/finalResponseTime*100).toFixed(1)}%)`);
            console.log(`   - Logging: Background (async)`);
            console.log(`   - TOTAL: ${finalResponseTime}ms`);
            console.log(`📦 Data Summary:`);
            console.log(`   - Chunks used: ${chunksUsed}`);
            console.log(`   - Response length: ${responseText.length} chars (~${responseText.split(/\s+/).length} words)`);
            console.log(`   - Conversation ID: Logging in background...`);
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

    // POST /api/chat/stream - Streaming RAG chat endpoint
    router.post('/chat/stream', async (req, res) => {
        const startTime = Date.now();
        console.log(`\n${'='.repeat(80)}`);
        console.log(`🔵 STREAMING RAG REQUEST RECEIVED`);
        console.log(`${'='.repeat(80)}`);
        
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
            const { message, history = [], model: requestedModel = 'gemini', doc = 'smh' } = req.body;
            let model = requestedModel;
            let embeddingType = req.query.embedding || 'openai';

            if (!message) {
                res.write(`data: ${JSON.stringify({ error: 'Message is required' })}\n\n`);
                res.end();
                return;
            }

            // Parse document parameter
            const docParam = doc || 'smh';
            const documentSlugs = docParam.split('+').map(s => s.trim()).filter(s => s);
            
            // Auth and access checks (same as non-streaming)
            let userId = null;
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.split(' ')[1];
                try {
                    const { data: { user } } = await supabase.auth.getUser(token);
                    userId = user?.id || null;
                } catch (error) {
                    // Ignore
                }
            }
            
            // Parallel access checks
            const accessChecks = await Promise.all(
                documentSlugs.map(slug => 
                    supabase.rpc('user_has_document_access_by_slug', {
                        p_user_id: userId,
                        p_document_slug: slug,
                    })
                )
            );
            
            for (let i = 0; i < documentSlugs.length; i++) {
                const { data: hasAccess, error } = accessChecks[i];
                if (error || !hasAccess) {
                    res.write(`data: ${JSON.stringify({ error: 'Access denied', document: documentSlugs[i] })}\n\n`);
                    res.end();
                    return;
                }
            }

            // Validate documents
            const validationResults = await Promise.all(
                documentSlugs.map(slug => documentRegistry.isValidSlug(slug))
            );
            if (validationResults.some(v => !v)) {
                res.write(`data: ${JSON.stringify({ error: 'Invalid document(s)' })}\n\n`);
                res.end();
                return;
            }

            // Multi-doc validation
            if (documentSlugs.length > 1) {
                const ownerValidation = await documentRegistry.validateSameOwner(documentSlugs);
                if (!ownerValidation.valid) {
                    res.write(`data: ${JSON.stringify({ error: ownerValidation.error })}\n\n`);
                    res.end();
                    return;
                }
                embeddingType = 'openai';
            }

            const documentType = documentSlugs.length === 1 ? documentSlugs[0] : documentSlugs;

            // Get chunk limit and owner info
            let chunkLimit = 50;
            let ownerInfo = null;
            try {
                if (documentSlugs.length === 1) {
                    const [chunkLimitResult, ownerInfoResult] = await Promise.all([
                        supabase.rpc('get_document_chunk_limit', { doc_slug: documentSlugs[0] }),
                        supabase.rpc('get_documents_with_owner')
                            .select('owner_slug, owner_name, default_chunk_limit, owner_forced_grok_model, document_forced_grok_model')
                            .eq('slug', documentSlugs[0])
                            .single()
                    ]);
                    if (!chunkLimitResult.error && chunkLimitResult.data) {
                        chunkLimit = chunkLimitResult.data;
                    }
                    ownerInfo = ownerInfoResult.data;
                } else {
                    const [chunkLimitResult, ownerInfoResult] = await Promise.all([
                        supabase.rpc('get_multi_document_chunk_limit', { doc_slugs: documentSlugs }),
                        supabase.rpc('get_documents_with_owner')
                            .select('owner_slug, owner_name, default_chunk_limit, owner_forced_grok_model, document_forced_grok_model')
                            .in('slug', documentSlugs)
                    ]);
                    if (!chunkLimitResult.error && chunkLimitResult.data) {
                        chunkLimit = chunkLimitResult.data;
                    }
                    if (ownerInfoResult.data && ownerInfoResult.data.length > 0) {
                        const uniqueOwners = [...new Set(ownerInfoResult.data.map(d => d.owner_slug))];
                        ownerInfo = uniqueOwners.length === 1 ? ownerInfoResult.data[0] : 
                            { owner_slug: 'mixed', owner_name: 'Multiple Owners', default_chunk_limit: 50, forced_grok_model: null };
                    }
                }
            } catch (limitError) {
                chunkLimit = 50;
            }

            // Apply forced Grok model override with document-level precedence
            let originalModel = model;
            let effectiveModel = model;

            if (model === 'grok' || model === 'grok-reasoning') {
                if (documentSlugs.length === 1) {
                    // Single document: Document override takes precedence over owner override
                    if (ownerInfo?.document_forced_grok_model) {
                        effectiveModel = ownerInfo.document_forced_grok_model;
                    } else if (ownerInfo?.owner_forced_grok_model) {
                        effectiveModel = ownerInfo.owner_forced_grok_model;
                    }
                } else {
                    // Multi-document: Check all document overrides, use grok-reasoning if any conflicts or reasoning required
                    const allDocOverrides = ownerInfoResult.data
                        .map(doc => doc.document_forced_grok_model)
                        .filter(override => override !== null);

                    if (allDocOverrides.length > 0) {
                        // If any document requires reasoning, or if there are conflicts, use reasoning
                        const hasReasoning = allDocOverrides.includes('grok-reasoning');
                        const hasConflicts = new Set(allDocOverrides).size > 1;

                        if (hasReasoning || hasConflicts) {
                            effectiveModel = 'grok-reasoning';
                        } else {
                            // All documents agree on same override
                            effectiveModel = allDocOverrides[0];
                        }
                    } else {
                        // No document overrides, check owner-level (only if all docs have same owner)
                        const uniqueOwners = [...new Set(ownerInfoResult.data.map(d => d.owner_slug))];
                        if (uniqueOwners.length === 1 && ownerInfo?.owner_forced_grok_model) {
                            effectiveModel = ownerInfo.owner_forced_grok_model;
                        }
                    }
                }

                // Apply the override if different from requested
                if (effectiveModel !== model) {
                    model = effectiveModel;
                }
            }

            // Embed query
            let queryEmbedding;
            if (embeddingType === 'local') {
                queryEmbedding = await embeddingCache.getEmbeddingWithCache(
                    message,
                    async (text) => {
                        await localEmbeddings.ensureLocalEmbeddings();
                        return await localEmbeddings.generateLocalEmbedding(text);
                    },
                    'local'
                );
            } else {
                queryEmbedding = await embeddingCache.getEmbeddingWithCache(
                    message,
                    (text) => rag.embedQuery(clients.openai, text),
                    'openai'
                );
            }

            // Retrieve chunks
            const retrievedChunks = embeddingType === 'local'
                ? await rag.findRelevantChunksLocal(supabase, queryEmbedding, documentType, chunkLimit)
                : await rag.findRelevantChunks(supabase, queryEmbedding, documentType, chunkLimit);

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
                    model: actualModelName,
                    sessionId: sessionId
                }
            })}\n\n`);
            
            res.end();

            console.log(`✅ Streaming completed in ${totalTime}ms`);

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

