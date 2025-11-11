/**
 * Conversation Logger
 * Handles building and logging conversation data to Supabase
 */

const { generateShareToken } = require('./share-token');
const { debugLog } = require('../../utils/debug');

/**
 * Extract document metadata from registry (handles single and multi-document)
 * @param {string|Array<string>} documentType - Document slug(s)
 * @param {object} documentRegistry - Document registry instance
 * @returns {Promise<{combinedDocName: string, documentIds: Array<string>|null, docYear: number|null}>}
 */
async function extractDocumentMetadata(documentType, documentRegistry) {
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
    
    return { combinedDocName, documentIds, docYear };
}

/**
 * Build conversation data object for logging
 * @param {object} params - Parameters for building conversation data
 * @returns {object} Conversation data object ready for database insertion
 */
function buildConversationData({
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
    country,
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
    streaming = false,
    error = null
}) {
    // Reduce metadata size - keep only top 10 chunks for logging
    const topChunks = retrievedChunks.slice(0, 10);
    const similarities = retrievedChunks.map(c => c.similarity);
    
    // Log if content was banned
    if (isBanned) {
        const reasonLabel = banReason === 'profanity' ? 'Profanity' : 'Junk';
        console.log(`🚫 ${reasonLabel} detected synchronously in conversation, no share token generated (reason: ${banReason})`);
    }
    
    const isMultiDoc = Array.isArray(documentType);
    
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
        error: error,
        retrieval_method: 'rag', // Always use 'rag' (database constraint only allows 'full' or 'rag')
        chunks_used: retrievedChunks.length,
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
            streaming: streaming
        }
    };
    
    // Add timing breakdown if provided
    if (timings) {
        conversationData.metadata.timing_breakdown = {
            auth_ms: timings.authEnd - timings.authStart,
            registry_ms: timings.registryEnd - timings.registryStart,
            embedding_ms: timings.embeddingEnd - timings.embeddingStart,
            retrieval_ms: timings.retrievalEnd - timings.retrievalStart,
            generation_ms: timings.generationEnd - timings.generationStart,
            total_ms: responseTime
        };
    }
    
    // Add country if provided (for streaming)
    if (country !== undefined) {
        conversationData.country = country;
    }
    
    return conversationData;
}

/**
 * Log conversation to database asynchronously (fire-and-forget)
 * @param {object} conversationData - Conversation data object
 * @param {object} supabase - Supabase client
 * @returns {Promise<void>}
 */
async function logConversation(conversationData, supabase) {
    return supabase
        .from('chat_conversations')
        .insert([conversationData])
        .select('id')
        .single()
        .then(({ data, error }) => {
            if (error) {
                console.error(`⚠️  Logging failed:`, error.message, `(${error.code || 'unknown'})`);
                if (error.code === '42501' || error.message?.includes('permission denied') || error.message?.includes('row-level security')) {
                    console.error(`   ⚠️  RLS policy issue detected`);
                }
            }
            return data;
        })
        .catch(error => {
            console.error(`⚠️  Logging error:`, error.message);
            return null;
        });
}

/**
 * Log conversation to database synchronously (for streaming, returns conversation ID)
 * @param {object} conversationData - Conversation data object
 * @param {object} supabase - Supabase client
 * @returns {Promise<{conversationId: string|null, shareToken: string|null}>}
 */
async function logConversationSync(conversationData, supabase) {
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
        return { conversationId: null, shareToken: null };
    }
    
    if (data) {
        const conversationId = data.id;
        // Only set shareToken if conversation is not banned
        const shareToken = !data.banned ? data.share_token : null;
        return { conversationId, shareToken };
    }
    
    return { conversationId: null, shareToken: null };
}

module.exports = {
    extractDocumentMetadata,
    buildConversationData,
    logConversation,
    logConversationSync
};

