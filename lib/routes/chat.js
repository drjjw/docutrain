/**
 * Chat routes
 * Handles RAG chat endpoint with multi-document support
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const {
    authenticateUser,
    checkDocumentAccess,
    validateDocuments,
    getChunkLimitAndOwnerInfo,
    applyModelOverride,
    embedQueryWithCache,
    retrieveChunks
} = require('./chat-helpers');
const { getIpAddress } = require('../utils');
const { checkContent } = require('../utils/profanity-filter');
const { getCountryFromIP } = require('../utils/ip-geolocation');
const { debugLog } = require('../utils/debug');

/**
 * In-memory rate limiter
 * Tracks message timestamps per session to prevent spam/automation
 */
class RateLimiter {
    constructor() {
        // Map of sessionId -> array of timestamps
        this.sessions = new Map();
        
        // Rate limit configuration
        this.limits = {
            perMinute: 10,      // Max 10 messages per minute
            perTenSeconds: 3    // Max 3 messages per 10 seconds (burst protection)
        };
        
        // Cleanup old entries every 5 minutes to prevent memory leaks
        setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }
    
    /**
     * Check if a session has exceeded rate limits
     * @param {string} sessionId - Session UUID
     * @returns {Object} { allowed: boolean, retryAfter: number }
     */
    checkLimit(sessionId) {
        const now = Date.now();
        // Enable debug logging if explicitly enabled via env var, or in development mode
        const debugEnabled = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development';
        
        // Get or create timestamp array for this session
        if (!this.sessions.has(sessionId)) {
            this.sessions.set(sessionId, []);
        }
        
        const timestamps = this.sessions.get(sessionId);
        
        // Remove timestamps older than 1 minute
        const oneMinuteAgo = now - 60 * 1000;
        const tenSecondsAgo = now - 10 * 1000;
        
        // Filter to keep only recent timestamps
        const recentTimestamps = timestamps.filter(ts => ts > oneMinuteAgo);
        this.sessions.set(sessionId, recentTimestamps);
        
        // Count messages in last minute and last 10 seconds
        const messagesInLastMinute = recentTimestamps.length;
        const messagesInLastTenSeconds = recentTimestamps.filter(ts => ts > tenSecondsAgo).length;
        
        // Debug logging (only if enabled)
        if (debugEnabled) {
            const sessionShort = sessionId.substring(0, 8);
            console.log(`🔍 Rate Limit Check [${sessionShort}]:`);
            console.log(`   📊 Last minute: ${messagesInLastMinute}/${this.limits.perMinute} messages`);
            console.log(`   ⚡ Last 10 sec: ${messagesInLastTenSeconds}/${this.limits.perTenSeconds} messages`);
            console.log(`   ✅ Status: ${messagesInLastMinute < this.limits.perMinute && messagesInLastTenSeconds < this.limits.perTenSeconds ? 'WITHIN LIMITS' : 'APPROACHING/EXCEEDED'}`);
        }
        
        // Check 10-second burst limit
        if (messagesInLastTenSeconds >= this.limits.perTenSeconds) {
            const oldestInBurst = recentTimestamps.filter(ts => ts > tenSecondsAgo)[0];
            const retryAfter = Math.ceil((oldestInBurst + 10 * 1000 - now) / 1000);
            
            if (debugEnabled) {
                console.log(`   ❌ BURST LIMIT EXCEEDED: ${messagesInLastTenSeconds}/${this.limits.perTenSeconds} in 10 seconds`);
                console.log(`   ⏱️  Retry after: ${retryAfter} seconds`);
            }
            
            return {
                allowed: false,
                retryAfter: Math.max(retryAfter, 1),
                reason: `burst_limit`,
                limit: this.limits.perTenSeconds,
                window: '10 seconds'
            };
        }
        
        // Check per-minute limit
        if (messagesInLastMinute >= this.limits.perMinute) {
            const oldestInMinute = recentTimestamps[0];
            const retryAfter = Math.ceil((oldestInMinute + 60 * 1000 - now) / 1000);
            
            if (debugEnabled) {
                console.log(`   ❌ RATE LIMIT EXCEEDED: ${messagesInLastMinute}/${this.limits.perMinute} in 1 minute`);
                console.log(`   ⏱️  Retry after: ${retryAfter} seconds`);
            }
            
            return {
                allowed: false,
                retryAfter: Math.max(retryAfter, 1),
                reason: `rate_limit`,
                limit: this.limits.perMinute,
                window: 'minute'
            };
        }
        
        // Rate limit passed - record this message
        recentTimestamps.push(now);
        this.sessions.set(sessionId, recentTimestamps);
        
        if (debugEnabled) {
            console.log(`   ✅ Request ALLOWED - Message recorded`);
            console.log(`   📈 New counts: ${messagesInLastMinute + 1}/${this.limits.perMinute} (minute), ${messagesInLastTenSeconds + 1}/${this.limits.perTenSeconds} (10sec)`);
        }
        
        return { allowed: true };
    }
    
    /**
     * Clean up old session data to prevent memory leaks
     */
    cleanup() {
        const now = Date.now();
        const fiveMinutesAgo = now - 5 * 60 * 1000;
        
        let cleaned = 0;
        for (const [sessionId, timestamps] of this.sessions.entries()) {
            // Remove sessions with no recent activity
            const recentTimestamps = timestamps.filter(ts => ts > fiveMinutesAgo);
            
            if (recentTimestamps.length === 0) {
                this.sessions.delete(sessionId);
                cleaned++;
            } else {
                this.sessions.set(sessionId, recentTimestamps);
            }
        }
        
        if (cleaned > 0) {
            console.log(`🧹 Rate limiter cleanup: removed ${cleaned} inactive sessions`);
        }
    }
    
    /**
     * Get current statistics (for monitoring)
     */
    getStats() {
        return {
            activeSessions: this.sessions.size,
            totalTimestamps: Array.from(this.sessions.values()).reduce((sum, arr) => sum + arr.length, 0)
        };
    }
}

// Create singleton rate limiter instance
const rateLimiter = new RateLimiter();

/**
 * Generate a secure, URL-safe share token for conversations
 * Uses crypto.randomBytes for cryptographically secure randomness
 * @returns {string} URL-safe base64 token (32 bytes = 43 chars)
 */
function generateShareToken() {
    // Generate 32 random bytes (256 bits) for strong security
    const randomBytes = crypto.randomBytes(32);
    // Convert to URL-safe base64 (replaces + with -, / with _, removes padding)
    return randomBytes.toString('base64url');
}

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

        // Check rate limit
        const rateLimitCheck = rateLimiter.checkLimit(sessionId);
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
        // Count conversations for this session_id BEFORE adding the new one
        // Allow if count is less than MAX (e.g., if MAX=3, allow when count is 0, 1, or 2)
        const MAX_CONVERSATION_LENGTH = parseInt(process.env.MAX_CONVERSATION_LENGTH || '3', 10);
        const { count: conversationCount, error: countError } = await supabase
            .from('chat_conversations')
            .select('*', { count: 'exact', head: true })
            .eq('session_id', sessionId);
        
        if (countError) {
            debugLog(`⚠️  Error counting conversations for session ${sessionId.substring(0, 8)}...: ${countError.message}`);
        } else if (conversationCount !== null && conversationCount >= MAX_CONVERSATION_LENGTH) {
            debugLog(`🚫 Conversation limit reached for session ${sessionId.substring(0, 8)}... (${conversationCount}/${MAX_CONVERSATION_LENGTH})`);
            return res.status(403).json({
                error: `You've reached the conversation limit of ${MAX_CONVERSATION_LENGTH} messages. Please start a new chat to continue.`,
                conversationLimitExceeded: true,
                limit: MAX_CONVERSATION_LENGTH,
                currentCount: conversationCount
            });
        } else {
            debugLog(`✅ Conversation count check passed for session ${sessionId.substring(0, 8)}... (${conversationCount || 0}/${MAX_CONVERSATION_LENGTH})`);
        }

        try {
            const { message, history = [], model: requestedModel = 'gemini', doc = 'smh', passcode = null } = req.body;
            let model = requestedModel;
            
            // Get IP address from request (same logic as downloads tracking)
            const ipAddress = getIpAddress(req);
            
            // Get embedding type from query parameter (openai or local)
            let embeddingType = req.query.embedding || 'openai';

            if (!message) {
                return res.status(400).json({ error: 'Message is required' });
            }

            // Validate message length (prevent abuse)
            const MAX_MESSAGE_LENGTH = 1500;
            if (typeof message === 'string' && message.length > MAX_MESSAGE_LENGTH) {
                return res.status(400).json({ 
                    error: 'Message too long',
                    message: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters. Please shorten your message.`
                });
            }

            // Check content synchronously at the START (before any processing)
            // This prevents banned conversations from getting share tokens
            // The check is fast (milliseconds) and doesn't block significantly
            const contentCheck = checkContent(message);
            const isBanned = contentCheck.shouldBan;
            const banReason = contentCheck.reason;

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
            
            debugLog(`📝 Chat: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}" | ${model} | ${documentSlugs.join('+')}`);

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
                
                // Use the banned status checked at the start of the request
                // (isBanned and banReason were set earlier, before processing started)
                
                // Log if content was banned
                if (isBanned) {
                    const reasonLabel = banReason === 'profanity' ? 'Profanity' : 'Junk';
                    console.log(`🚫 ${reasonLabel} detected synchronously in conversation, no share token generated (reason: ${banReason})`);
                }
                
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
                    ip_address: ipAddress, // IP address for conversation tracking
                    share_token: isBanned ? null : generateShareToken(), // Only generate share token if not banned
                    banned: isBanned, // Set banned flag immediately
                    ban_reason: banReason, // Set ban reason immediately
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

        // Check rate limit
        const rateLimitCheck = rateLimiter.checkLimit(sessionId);
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
        // Count conversations for this session_id BEFORE adding the new one
        // Allow if count is less than MAX (e.g., if MAX=3, allow when count is 0, 1, or 2)
        const MAX_CONVERSATION_LENGTH = parseInt(process.env.MAX_CONVERSATION_LENGTH || '3', 10);
        const { count: conversationCount, error: countError } = await supabase
            .from('chat_conversations')
            .select('*', { count: 'exact', head: true })
            .eq('session_id', sessionId);
        
        if (countError) {
            debugLog(`⚠️  Error counting conversations for session ${sessionId.substring(0, 8)}...: ${countError.message}`);
        } else if (conversationCount !== null && conversationCount >= MAX_CONVERSATION_LENGTH) {
            debugLog(`🚫 Conversation limit reached for session ${sessionId.substring(0, 8)}... (${conversationCount}/${MAX_CONVERSATION_LENGTH})`);
            res.write(`data: ${JSON.stringify({ 
                error: `You've reached the conversation limit of ${MAX_CONVERSATION_LENGTH} messages. Please start a new chat to continue.`,
                conversationLimitExceeded: true,
                limit: MAX_CONVERSATION_LENGTH,
                currentCount: conversationCount,
                type: 'error'
            })}\n\n`);
            res.end();
            return;
        } else {
            debugLog(`✅ Conversation count check passed for session ${sessionId.substring(0, 8)}... (${conversationCount || 0}/${MAX_CONVERSATION_LENGTH})`);
        }

        try {
            const { message, history = [], model: requestedModel = 'gemini', doc = 'smh', passcode = null } = req.body;
            let model = requestedModel;
            let embeddingType = req.query.embedding || 'openai';
            
            // Get IP address from request (same logic as downloads tracking)
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

            if (!message) {
                res.write(`data: ${JSON.stringify({ error: 'Message is required' })}\n\n`);
                res.end();
                return;
            }

            // Check content synchronously at the START (before any processing)
            // This prevents banned conversations from getting share tokens without blocking the stream
            const contentCheck = checkContent(message);
            const isBanned = contentCheck.shouldBan;
            const banReason = contentCheck.reason;

            // Parse document parameter
            const docParam = doc || 'smh';
            const documentSlugs = docParam.split(/[\s+]+/).map(s => s.trim()).filter(s => s);

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

            // Log conversation to database BEFORE sending done event (so we can include conversation ID)
            const totalTime = Date.now() - startTime;
            let conversationId = null;
            let shareToken = null;
            
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

                // Use the banned status checked at the start of the request
                // (isBanned and banReason were set earlier, before streaming started)
                
                // Log if content was banned
                if (isBanned) {
                    const reasonLabel = banReason === 'profanity' ? 'Profanity' : 'Junk';
                    console.log(`🚫 ${reasonLabel} detected synchronously in conversation, no share token generated (reason: ${banReason})`);
                }

                // Get country from IP lookup (await the promise we started earlier)
                const country = await countryPromise;
                if (country) {
                    debugLog(`🌍 Country lookup successful: IP ${ipAddress} → ${country}`);
                } else if (ipAddress) {
                    debugLog(`⚠️  Country lookup failed or returned null for IP: ${ipAddress}`);
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
                    ip_address: ipAddress, // IP address for conversation tracking
                    country: country, // Country code from IP geolocation
                    share_token: isBanned ? null : generateShareToken(), // Only generate share token if not banned
                    banned: isBanned, // Set banned flag immediately
                    ban_reason: banReason, // Set ban reason immediately
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
                    .select('id, share_token, banned')
                    .single();

                if (error) {
                    console.error(`⚠️  Stream logging failed:`, error.message, `(${error.code || 'unknown'})`);
                    if (error.code === '42501' || error.message?.includes('permission denied') || error.message?.includes('row-level security')) {
                        console.error(`   ⚠️  RLS policy issue detected`);
                    }
                } else if (data) {
                    conversationId = data.id;
                    // Only set shareToken if conversation is not banned
                    if (!data.banned) {
                        shareToken = data.share_token;
                    } else {
                        shareToken = null; // Explicitly set to null for banned conversations
                    }
                }
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
    });

    // GET /api/shared/:shareToken - Fetch shared conversation by token
    router.get('/shared/:shareToken', async (req, res) => {
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
    });

    // POST /api/chat/share - Generate share token for existing conversation
    router.post('/chat/share', async (req, res) => {
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
    });

    // GET /api/chat/conversation/:conversationId/banned-status - Check if conversation is banned
    router.get('/chat/conversation/:conversationId/banned-status', async (req, res) => {
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
    });

    return router;
}

module.exports = {
    createChatRouter
};

