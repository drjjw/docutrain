/**
 * Chat Route Helper Functions
 * Shared logic extracted from chat.js to reduce duplication
 */

/**
 * Authenticate user from authorization header
 * @param {string} authHeader - Authorization header value
 * @param {object} supabase - Supabase client
 * @returns {Promise<{userId: string|null}>}
 */
async function authenticateUser(authHeader, supabase) {
    let userId = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const { data: { user } } = await supabase.auth.getUser(token);
            userId = user?.id || null;
        } catch (error) {
            // Ignore - treat as unauthenticated
        }
    }
    return { userId };
}

/**
 * Check document access permissions for user
 * @param {Array<string>} documentSlugs - Array of document slugs to check
 * @param {string|null} userId - User ID (null for anonymous)
 * @param {object} supabase - Supabase client
 * @param {string|null} passcode - Optional passcode for passcode-protected documents
 * @returns {Promise<{hasAccess: boolean, error: object|null}>}
 */
async function checkDocumentAccess(documentSlugs, userId, supabase, passcode = null) {
    // Log passcode for debugging
    console.log(`🔍 checkDocumentAccess called with:`);
    console.log(`   - userId: ${userId || 'null'}`);
    console.log(`   - documentSlugs: ${documentSlugs.join(', ')}`);
    console.log(`   - passcode: ${passcode || 'null'}`);
    
    // First, try to check document access levels to determine error type
    // This query might fail due to RLS, so we handle errors gracefully
    let docAccessMap = {};
    try {
        const { data: docData, error: docError } = await supabase
            .from('documents')
            .select('slug, access_level, passcode')
            .in('slug', documentSlugs)
            .eq('active', true);
        
        if (docData && !docError) {
            docData.forEach(doc => {
                docAccessMap[doc.slug] = {
                    access_level: doc.access_level,
                    has_passcode: !!(doc.passcode && doc.passcode.trim())
                };
            });
            console.log(`📋 Document access levels retrieved for ${docData.length} document(s)`);
        } else if (docError) {
            console.log(`⚠️  Could not query document access levels (RLS may be blocking): ${docError.message}`);
            // Continue with access checks - we'll use fallback logic
        }
    } catch (queryError) {
        console.log(`⚠️  Error querying document access levels: ${queryError.message}`);
        // Continue with access checks - we'll use fallback logic
    }
    
    // 🎯 OPTIMIZATION: Parallel access checks (Priority 1)
    // Instead of sequential for-loop, execute all access checks in parallel
    const accessChecks = await Promise.all(
        documentSlugs.map(slug => 
            supabase.rpc('user_has_document_access_by_slug', {
                p_user_id: userId,
                p_document_slug: slug,
                p_passcode: passcode || null,
            })
        )
    );
    
    // Check results after all parallel calls complete
    for (let i = 0; i < documentSlugs.length; i++) {
        const slug = documentSlugs[i];
        const { data: hasAccess, error } = accessChecks[i];
        
        if (error) {
            console.error(`Access check error for ${slug}:`, error);
            return { 
                hasAccess: false, 
                error: { 
                    status: 500, 
                    message: 'Failed to verify document access' 
                } 
            };
        }
        
        if (!hasAccess) {
            console.log(`❌ Access denied to document: ${slug} for user: ${userId || 'anonymous'}`);
            
            // Determine if this is a passcode-protected document
            const docInfo = docAccessMap[slug];
            const isPasscodeProtected = docInfo && docInfo.access_level === 'passcode' && docInfo.has_passcode;
            
            // If we couldn't determine access level, use fallback logic:
            // - If passcode was provided but access denied, it might be incorrect
            // - If no passcode and no user, assume it might need passcode or auth
            let requiresPasscode = false;
            let requiresAuth = false;
            
            if (docInfo) {
                // We have document info - use it
                requiresPasscode = isPasscodeProtected && !passcode;
                requiresAuth = !isPasscodeProtected && !userId;
            } else {
                // Fallback: if passcode was provided, assume it was incorrect
                // Otherwise, if user is not authenticated, require auth
                requiresPasscode = passcode ? false : false; // Can't determine without doc info
                requiresAuth = !userId; // Default to requiring auth if not authenticated
            }
            
            return { 
                hasAccess: false, 
                error: {
                    status: 403,
                    message: requiresPasscode
                        ? `The document "${slug}" requires a passcode. Please provide the passcode.`
                        : userId 
                            ? `You do not have permission to access the document "${slug}"`
                            : `The document "${slug}" requires authentication. Please log in.`,
                    requires_auth: requiresAuth,
                    requires_passcode: requiresPasscode,
                    document: slug,
                }
            };
        }
    }
    
    console.log(`✓ Access granted to documents: ${documentSlugs.join(', ')}`);
    return { hasAccess: true, error: null };
}

/**
 * Validate documents exist and have same owner
 * @param {Array<string>} documentSlugs - Array of document slugs
 * @param {object} documentRegistry - Document registry instance
 * @returns {Promise<{valid: boolean, error: object|null}>}
 */
async function validateDocuments(documentSlugs, documentRegistry) {
    // Validate all document slugs exist
    const validationResults = await Promise.all(
        documentSlugs.map(slug => documentRegistry.isValidSlug(slug))
    );
    const invalidSlugs = documentSlugs.filter((slug, idx) => !validationResults[idx]);
    
    if (invalidSlugs.length > 0) {
        return {
            valid: false,
            error: {
                status: 400,
                message: `The following document(s) are not available: ${invalidSlugs.join(', ')}`
            }
        };
    }

    // Validate all documents have same owner (if multiple documents)
    if (documentSlugs.length > 1) {
        const ownerValidation = await documentRegistry.validateSameOwner(documentSlugs);
        if (!ownerValidation.valid) {
            return {
                valid: false,
                error: {
                    status: 400,
                    message: ownerValidation.error
                }
            };
        }

        // Note: Embedding type validation removed - multi-doc always uses OpenAI
        // Individual documents may have different settings in DB, but we override to OpenAI
        // This ensures compatibility and allows all documents to be searched together
    }

    return { valid: true, error: null };
}

/**
 * Get chunk limit and owner info for documents
 * @param {Array<string>} documentSlugs - Array of document slugs
 * @param {object} supabase - Supabase client
 * @returns {Promise<{chunkLimit: number, ownerInfo: object|null, rawDocumentData: array, timings: object}>}
 */
async function getChunkLimitAndOwnerInfo(documentSlugs, supabase) {
    const timings = {
        registryStart: Date.now(),
        registryEnd: 0
    };

    // 🎯 OPTIMIZATION: Parallel metadata queries (Priority 2)
    // Get owner-specific chunk limit and owner info in parallel
    let chunkLimit = 50; // Default fallback
    let ownerInfo = null;
    let rawDocumentData = [];
    
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
                rawDocumentData = ownerInfoResult.data; // Store raw data for multi-doc overrides
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

    return { chunkLimit, ownerInfo, rawDocumentData, timings };
}

/**
 * Apply forced Grok model override with document-level precedence
 * @param {string} model - Requested model
 * @param {Array<string>} documentSlugs - Array of document slugs
 * @param {object|null} ownerInfo - Owner information
 * @param {Array} rawDocumentData - Raw document data for multi-doc
 * @returns {object} {effectiveModel, originalModel, overrideReason, overrideSource}
 */
function applyModelOverride(model, documentSlugs, ownerInfo, rawDocumentData) {
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
            const allDocOverrides = rawDocumentData
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
                const uniqueOwners = [...new Set(rawDocumentData.map(d => d.owner_slug))];
                if (uniqueOwners.length === 1 && ownerInfo?.owner_forced_grok_model) {
                    effectiveModel = ownerInfo.owner_forced_grok_model;
                    overrideReason = `Owner-level override: ${ownerInfo.owner_name}`;
                    overrideSource = 'owner';
                }
            }
        }

        // Apply the override if different from requested
        if (effectiveModel !== model) {
            console.log(`🔒 FORCED MODEL OVERRIDE:`);
            console.log(`   - User requested: ${originalModel}`);
            console.log(`   - Forced to use: ${effectiveModel}`);
            console.log(`   - Reason: ${overrideReason}`);
        }
    }

    return { effectiveModel, originalModel, overrideReason, overrideSource };
}

/**
 * Embed query with caching
 * @param {string} message - Query message
 * @param {string} embeddingType - 'openai' or 'local'
 * @param {object} embeddingCache - Embedding cache instance
 * @param {object} localEmbeddings - Local embeddings instance
 * @param {object} rag - RAG module
 * @param {object} clients - API clients (openai, xai, genAI)
 * @returns {Promise<{queryEmbedding: array, timings: object}>}
 */
async function embedQueryWithCache(message, embeddingType, embeddingCache, localEmbeddings, rag, clients) {
    const timings = {
        embeddingStart: Date.now(),
        embeddingEnd: 0
    };

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

    return { queryEmbedding, timings };
}

/**
 * Retrieve relevant chunks from database using HYBRID search (vector + full-text)
 * @param {array} queryEmbedding - Query embedding vector
 * @param {string} queryText - Original query text for full-text search
 * @param {string} embeddingType - 'openai' or 'local'
 * @param {string|Array<string>} documentType - Document slug(s)
 * @param {number} chunkLimit - Maximum chunks to retrieve
 * @param {object} supabase - Supabase client
 * @param {object} rag - RAG module
 * @param {object|null} ownerInfo - Owner information
 * @returns {Promise<{retrievedChunks: array, retrievalTimeMs: number, timings: object}>}
 */
async function retrieveChunks(queryEmbedding, queryText, embeddingType, documentType, chunkLimit, supabase, rag, ownerInfo) {
    const timings = {
        retrievalStart: Date.now(),
        retrievalEnd: 0
    };
    const retrievalStart = Date.now(); // Keep for backward compatibility
    
    let retrievedChunks = [];
    
    // Step 2: Find relevant chunks using HYBRID search (vector + full-text)
    try {
        console.log(`\n🔍 HYBRID CHUNK RETRIEVAL (Vector + Full-Text):`);
        console.log(`   - Owner: ${ownerInfo?.owner_name || 'Unknown'}`);
        console.log(`   - Requesting: ${chunkLimit} chunks (owner-configured)`);
        console.log(`   - Embedding type: ${embeddingType}`);
        console.log(`   - Vector threshold: ${embeddingType === 'local' ? '0.05' : '0.2'}`);
        console.log(`   - Query text: "${queryText.substring(0, 50)}..."`);
        
        // Use hybrid search functions (vector + full-text)
        if (embeddingType === 'local') {
            retrievedChunks = await rag.findRelevantChunksLocalHybrid(supabase, queryEmbedding, queryText, documentType, chunkLimit);
        } else {
            retrievedChunks = await rag.findRelevantChunksHybrid(supabase, queryEmbedding, queryText, documentType, chunkLimit);
        }
        const retrievalTimeMs = Date.now() - retrievalStart;
        timings.retrievalEnd = Date.now();
        const chunksUsed = retrievedChunks.length;
        
        // Calculate similarity statistics (including hybrid scores)
        const similarities = retrievedChunks.map(c => c.similarity);
        const textRanks = retrievedChunks.map(c => c.text_rank || 0);
        const combinedScores = retrievedChunks.map(c => c.combined_score);
        
        const avgSimilarity = similarities.length > 0 
            ? (similarities.reduce((a, b) => a + b, 0) / similarities.length).toFixed(3)
            : 0;
        const maxSimilarity = similarities.length > 0 ? Math.max(...similarities).toFixed(3) : 0;
        const minSimilarity = similarities.length > 0 ? Math.min(...similarities).toFixed(3) : 0;
        
        const avgTextRank = textRanks.length > 0 
            ? (textRanks.reduce((a, b) => a + b, 0) / textRanks.length).toFixed(3)
            : 0;
        
        console.log(`   ✓ Retrieved: ${chunksUsed} chunks in ${retrievalTimeMs}ms`);
        console.log(`   - Vector similarity range: ${minSimilarity} - ${maxSimilarity} (avg: ${avgSimilarity})`);
        console.log(`   - Text rank average: ${avgTextRank}`);
        console.log(`   - Top 5 combined scores: ${combinedScores.slice(0, 5).map(s => s.toFixed(3)).join(', ')}`);
        console.log(`⏱️  Retrieval: ${timings.retrievalEnd - timings.retrievalStart}ms`);
        
        // Log chunk sources for multi-document
        if (Array.isArray(documentType)) {
            const sourceCounts = {};
            retrievedChunks.forEach(c => {
                sourceCounts[c.document_slug] = (sourceCounts[c.document_slug] || 0) + 1;
            });
            console.log(`   - Chunks per document:`, sourceCounts);
        }

        return { retrievedChunks, retrievalTimeMs, timings };
    } catch (chunkError) {
        timings.retrievalEnd = Date.now();
        console.error('❌ Error finding chunks:', chunkError.message);
        console.log(`⏱️  Retrieval: ${timings.retrievalEnd - timings.retrievalStart}ms (with error)`);
        throw new Error(`Failed to find relevant chunks with ${embeddingType}: ${chunkError.message}`);
    }
}

module.exports = {
    authenticateUser,
    checkDocumentAccess,
    validateDocuments,
    getChunkLimitAndOwnerInfo,
    applyModelOverride,
    embedQueryWithCache,
    retrieveChunks
};

