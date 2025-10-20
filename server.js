const express = require('express');
const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Graceful shutdown handling
let server;
const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  if (server) {
    server.close((err) => {
      if (err) {
        console.error('Error during server close:', err);
        process.exit(1);
      }

      console.log('✓ HTTP server closed gracefully');
      console.log('✓ All connections drained');

      // Close any database connections or cleanup here if needed
      console.log('✓ Cleanup complete. Exiting...');
      process.exit(0);
    });

    // Force shutdown after 30 seconds if graceful shutdown takes too long
    setTimeout(() => {
      console.error('⚠️  Forced shutdown after 30 seconds');
      process.exit(1);
    }, 30000);
  } else {
    process.exit(0);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Middleware
app.use(cors({
    origin: '*', // Allow embedding from any domain (or specify ukidney.com)
    credentials: true
}));

// Add headers for iframe embedding
app.use((req, res, next) => {
    res.removeHeader('X-Frame-Options'); // Remove X-Frame-Options to allow all embedding
    // Don't set Content-Security-Policy frame-ancestors to allow embedding from anywhere
    next();
});

app.use(express.json());
app.use(express.static('public'));

// Initialize AI clients
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const xai = new OpenAI({
    apiKey: process.env.XAI_API_KEY,
    baseURL: 'https://api.x.ai/v1'
});

// Initialize OpenAI client for embeddings (RAG)
let openaiClient = null;
if (process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
    });
    console.log('✓ OpenAI client initialized for RAG embeddings');
} else {
    console.warn('⚠️  OPENAI_API_KEY not found - OpenAI RAG mode will not work');
}

// Initialize local embeddings
const { generateLocalEmbedding, initializeModel: initLocalModel, getModelInfo } = require('./lib/local-embeddings');

// Initialize document registry
const documentRegistry = require('./lib/document-registry');

// Initialize embedding cache
const { getEmbeddingWithCache, getCacheStats, clearCache, initializeCacheCleanup } = require('./lib/embedding-cache');

let localEmbeddingsReady = false;

// Lazy-load local embedding model
async function ensureLocalEmbeddings() {
    if (!localEmbeddingsReady) {
        try {
            await initLocalModel();
            localEmbeddingsReady = true;
            const info = getModelInfo();
            console.log(`✓ Local embeddings ready: ${info.name} (${info.dimensions}D)`);
        } catch (error) {
            console.error('⚠️  Failed to initialize local embeddings:', error.message);
            throw error;
        }
    }
}

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// RAG-only architecture - no PDF loading in memory

// ==================== RAG ENHANCEMENT ====================

/**
 * Generate embedding for a query using OpenAI text-embedding-3-small
 */
async function embedQuery(text) {
    try {
        if (!openaiClient) {
            throw new Error('OpenAI client not initialized. OPENAI_API_KEY environment variable is required for RAG mode.');
        }
        
        const response = await openaiClient.embeddings.create({
            model: 'text-embedding-3-small',
            input: text,
            encoding_format: 'float'
        });
        
        return response.data[0].embedding;
    } catch (error) {
        console.error('Error generating query embedding:', error.message);
        throw error;
    }
}

/**
 * Find relevant chunks from Supabase using vector similarity
 * Supports both single and multiple documents
 */
async function findRelevantChunks(embedding, documentTypes, limit = 5, threshold = null) {
    try {
        // OpenAI embeddings use higher threshold (0.3), local embeddings use lower (0.1)
        const defaultThreshold = threshold || parseFloat(process.env.RAG_SIMILARITY_THRESHOLD) || 0.3;

        // Handle both single string and array of document types
        const isMultiDoc = Array.isArray(documentTypes);
        const docArray = isMultiDoc ? documentTypes : [documentTypes];

        // Use multi-document function if searching across multiple documents
        if (docArray.length > 1) {
            console.log(`RAG: Using multi-document search for: ${docArray.join(', ')}`);
            const { data, error } = await supabase.rpc('match_document_chunks_multi', {
                query_embedding: embedding,
                doc_slugs: docArray,
                match_threshold: defaultThreshold,
                match_count_per_doc: limit
            });

            if (error) {
                console.error('Error finding relevant chunks (multi):', error);
                throw error;
            }

            return data || [];
        } else {
            // Single document - use original function
            const { data, error } = await supabase.rpc('match_document_chunks', {
                query_embedding: embedding,
                doc_slug: docArray[0],
                match_threshold: defaultThreshold,
                match_count: limit
            });

            if (error) {
                console.error('Error finding relevant chunks:', error);
                throw error;
            }

            return data || [];
        }
    } catch (error) {
        console.error('Error in findRelevantChunks:', error);
        throw error;
    }
}

/**
 * Find relevant chunks from Supabase using local embeddings
 * Supports both single and multiple documents
 */
async function findRelevantChunksLocal(embedding, documentTypes, limit = 5, threshold = null) {
    try {
        // Local embeddings use lower threshold (0.05) since they have lower similarity scores
        const defaultThreshold = threshold || parseFloat(process.env.RAG_SIMILARITY_THRESHOLD_LOCAL) || 0.05;

        // Handle both single string and array of document types
        const isMultiDoc = Array.isArray(documentTypes);
        const docArray = isMultiDoc ? documentTypes : [documentTypes];

        // Use multi-document function if searching across multiple documents
        if (docArray.length > 1) {
            console.log(`RAG: Using multi-document search (local) for: ${docArray.join(', ')}`);
            const { data, error } = await supabase.rpc('match_document_chunks_local_multi', {
                query_embedding: embedding,
                doc_slugs: docArray,
                match_threshold: defaultThreshold,
                match_count_per_doc: limit
            });

            if (error) {
                console.error('Error finding relevant chunks (local, multi):', error);
                throw error;
            }

            return data || [];
        } else {
            // Single document - use original function
            const { data, error } = await supabase.rpc('match_document_chunks_local', {
                query_embedding: embedding,
                doc_slug: docArray[0],
                match_threshold: defaultThreshold,
                match_count: limit
            });

            if (error) {
                console.error('Error finding relevant chunks (local):', error);
                throw error;
            }

            return data || [];
        }
    } catch (error) {
        console.error('Error in findRelevantChunksLocal:', error);
        throw error;
    }
}

/**
 * Build RAG system prompt with retrieved chunks
 * Supports both single and multiple document types
 */
const getRAGSystemPrompt = async (documentTypes = 'smh', chunks = []) => {
    // Handle both single string and array of document types
    const docArray = Array.isArray(documentTypes) ? documentTypes : [documentTypes];
    
    // Get document info from registry
    let docName = 'SMH Housestaff Manual';
    try {
        if (docArray.length === 1) {
            const docConfig = await documentRegistry.getDocumentBySlug(docArray[0]);
            if (docConfig) {
                docName = docConfig.title || docConfig.welcome_message || docName;
            }
        } else {
            // Multiple documents - combine titles
            const docConfigs = await Promise.all(
                docArray.map(slug => documentRegistry.getDocumentBySlug(slug))
            );
            const titles = docConfigs
                .filter(cfg => cfg)
                .map(cfg => cfg.title || cfg.welcome_message)
                .filter(t => t);
            docName = titles.length > 0 ? titles.join(' and ') : 'the provided documents';
        }
    } catch (error) {
        console.warn(`Could not get document config, using default name`);
    }
    
    // Combine chunk content with page and source document information
    const context = chunks.map(chunk => {
        const pageInfo = chunk.metadata?.page_number ? ` [Page ${chunk.metadata.page_number}]` : '';
        const sourceInfo = docArray.length > 1 ? ` [Source: ${chunk.document_name || chunk.document_slug}]` : '';
        return chunk.content + pageInfo + sourceInfo;
    }).join('\n\n---\n\n');

    // Determine if this is a multi-document query
    const isMultiDoc = docArray.length > 1;
    
    // Build citation format instructions based on single vs multi-doc
    const citationFormat = isMultiDoc 
        ? `Look for [Page X] and [Source: Document Name] markers in the text. For multi-document searches, your references MUST include both the source document name AND page number. Example: "Drug X is indicated[1]. Dosage is 100mg[2].\n\n---\n\n**References**\n[1] SMH Manual, Page 15\n[2] UHN Manual, Page 42"`
        : `Look for [Page X] markers in the text. For single-document searches, your references should include the page number. Example: "Drug X is indicated[1]. Dosage is 100mg[2].\n\n---\n\n**References**\n[1] Page 15\n[2] Page 45"`;
    
    // Add conflict detection instructions for multi-document queries
    const conflictInstructions = isMultiDoc ? `
7. **CRITICAL FOR MULTI-DOCUMENT SEARCHES**: If you notice CONFLICTING or CONTRADICTORY information between the sources:
   - Explicitly state that "Different recommendations exist between sources" or similar
   - Present BOTH perspectives clearly with their respective source citations
   - If publication years are mentioned or implied, note which guideline is more recent
   - Example: "Source A recommends X[1], while Source B suggests Y[2]"
   - Do NOT try to reconcile or choose between conflicts - present them transparently
   - If differences are due to context (e.g., different patient populations), explain the distinction` : '';

    return `You are a helpful assistant that answers questions based on ${isMultiDoc ? 'multiple documents: ' + docName : 'the ' + docName}.

***CRITICAL FORMATTING REQUIREMENT: You MUST include footnotes [1], [2], etc. for EVERY claim/fact in your response, with references at the end. ${citationFormat}***

IMPORTANT RULES:
1. Answer questions ONLY using information from the provided relevant excerpts below
2. If the answer is not in the excerpts, say "I don't have that information in the provided sections of the ${docName}"
3. Be concise and professional
4. If you're unsure, admit it rather than guessing
5. Do NOT mention chunk numbers or reference which excerpt information came from
6. For questions about drug dose conversions related to MMF (CellCept) PO, Myfortic PO, MMF IV, Cyclosporine PO, Cyclosporine IV, Envarsus, Advagraf/Astagraf, Prograf, Prednisone, Methylprednisolone IV, Hydrocortisone IV, or Dexamethasone, attempt to answer but include a message directing users to consult https://ukidney.com/drugs${conflictInstructions}

FORMATTING RULES:
- Use **bold** for important terms and section titles
- Use bullet points (- or *) for lists
- Use numbered lists (1., 2., 3.) for sequential steps
- Use line breaks between different topics
- Keep paragraphs short and scannable
- **MANDATORY**: Use footnotes [1], [2], etc. for EVERY claim or fact: place superscript [number] immediately after each claim
- **MANDATORY**: Provide numbered references at the end of EVERY response (do not skip this step)
- Number footnotes sequentially starting from [1] for each response
- ${isMultiDoc ? '**FOR MULTI-DOCUMENT**: References MUST include source document name AND page (e.g., [1] SMH Manual, Page 15)' : 'Extract page numbers from [Page X] markers for citations (e.g., [1] Page 15)'}

RELEVANT EXCERPTS FROM ${docName.toUpperCase()}:
---
${context}
---`;
};

/**
 * Get model-specific RAG prompt
 */
const getRAGGeminiPrompt = async (documentType, chunks) => {
    const basePrompt = await getRAGSystemPrompt(documentType, chunks);
    return basePrompt + `

RESPONSE STYLE - STRICTLY FOLLOW:
- Use markdown tables when presenting structured data
- Present information in the most compact, scannable format
- Lead with the direct answer, then provide details
- Use minimal explanatory text - let the structure speak
- **MANDATORY**: Include footnotes [1], [2], etc. for EVERY claim with references at response end`;
};

const getRAGGrokPrompt = async (documentType, chunks) => {
    const basePrompt = await getRAGSystemPrompt(documentType, chunks);
    return basePrompt + `

RESPONSE STYLE - STRICTLY FOLLOW:
- ALWAYS add a brief introductory sentence explaining the context
- When presenting factual data, include WHY it matters
- Add a short concluding note with clinical significance when relevant
- Use more descriptive language - explain, don't just list
- **MANDATORY**: Include footnotes [1], [2], etc. for EVERY claim with references at response end`;
};

/**
 * Chat with RAG using Gemini
 */
async function chatWithRAGGemini(message, history, documentType, chunks) {
    console.log(`🤖 Using RAG Gemini model: gemini-2.5-flash`);
    const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash"
    });

    const systemMessage = await getRAGGeminiPrompt(documentType, chunks);
    
    // Get document name from registry (use title first for cleaner reference)
    const docConfig = await documentRegistry.getDocumentBySlug(documentType);
    const docName = docConfig?.title || docConfig?.welcome_message || 'SMH Housestaff Manual';

    const fullHistory = [
        {
            role: 'user',
            parts: [{ text: systemMessage + `\n\nI understand. I will only answer questions based on the ${docName} excerpts you provided.` }]
        },
        {
            role: 'model',
            parts: [{ text: `I understand. I will only answer questions based on the ${docName} excerpts you provided. What would you like to know?` }]
        },
        ...history.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
        }))
    ];

    const chat = model.startChat({
        history: fullHistory
    });

    const result = await chat.sendMessage(message);
    const response = await result.response;
    return response.text();
}

/**
 * Chat with RAG using Grok
 */
async function chatWithRAGGrok(message, history, documentType, chunks, modelName = 'grok-4-fast-non-reasoning') {
    console.log(`🤖 Using RAG Grok model: ${modelName}`);
    const systemMessage = await getRAGGrokPrompt(documentType, chunks);
    
    const messages = [
        {
            role: 'system',
            content: systemMessage
        },
        ...history.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content
        })),
        {
            role: 'user',
            content: message
        }
    ];

    const completion = await xai.chat.completions.create({
        model: modelName,
        messages: messages,
        temperature: 0.7
    });

    return completion.choices[0].message.content;
}

// ==================== END RAG ENHANCEMENT ====================

// Helper function to log conversation to Supabase
async function logConversation(data) {
    try {
        const { error } = await supabase
            .from('chat_conversations')
            .insert([data]);

        if (error) {
            console.error('Failed to log conversation:', error);
        }
    } catch (err) {
        console.error('Error logging to Supabase:', err);
    }
}

// Helper function to update conversation rating
async function updateConversationRating(conversationId, rating) {
    try {
        const { error } = await supabase
            .from('chat_conversations')
            .update({ user_rating: rating })
            .eq('id', conversationId);

        if (error) {
            console.error('Failed to update conversation rating:', error);
            throw error;
        }

        return { success: true };
    } catch (err) {
        console.error('Error updating conversation rating:', err);
        throw err;
    }
}

// RAG Chat endpoint (primary and only chat endpoint)
app.post('/api/chat', async (req, res) => {
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
        const { message, history = [], model = 'gemini', doc = 'smh' } = req.body;
        
        // Get embedding type from query parameter (openai or local)
        let embeddingType = req.query.embedding || 'openai';

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Parse document parameter - supports multiple documents with + separator
        const docParam = doc || 'smh';
        const documentSlugs = docParam.split('+').map(s => s.trim()).filter(s => s);
        
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
                
                // Get owner info for logging
                const { data: docData } = await supabase
                    .from('documents_with_owner')
                    .select('owner_slug, owner_name, default_chunk_limit')
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
                
                // Get owner info for logging
                const { data: docData } = await supabase
                    .from('documents_with_owner')
                    .select('owner_slug, owner_name, default_chunk_limit')
                    .in('slug', documentSlugs);
                if (docData && docData.length > 0) {
                    const uniqueOwners = [...new Set(docData.map(d => d.owner_slug))];
                    if (uniqueOwners.length === 1) {
                        ownerInfo = docData[0];
                    } else {
                        ownerInfo = { owner_slug: 'mixed', owner_name: 'Multiple Owners', default_chunk_limit: 50 };
                    }
                }
            }
            console.log(`   - Owner: ${ownerInfo?.owner_name || 'Unknown'} (${ownerInfo?.owner_slug || 'unknown'})`);
            console.log(`   - Configured chunk limit: ${chunkLimit}`);
        } catch (limitError) {
            console.warn(`⚠️  Could not fetch chunk limit, using default (50):`, limitError.message);
            chunkLimit = 50;
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
                    queryEmbedding = await getEmbeddingWithCache(
                        message,
                        async (text) => {
                            console.log(`RAG: Generating local embedding for: "${text.substring(0, 30)}..."`);
                            await ensureLocalEmbeddings();
                            return await generateLocalEmbedding(text);
                        },
                        'local'
                    );
                    console.log(`RAG: Query embedded successfully (cached local, ${queryEmbedding.length}D)`);
                } else {
                    // Use cached OpenAI embeddings
                    console.log(`RAG: Using cached OpenAI embeddings`);
                    queryEmbedding = await getEmbeddingWithCache(
                        message,
                        embedQuery,
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
                    retrievedChunks = await findRelevantChunksLocal(queryEmbedding, documentType, chunkLimit);
                } else {
                    retrievedChunks = await findRelevantChunks(queryEmbedding, documentType, chunkLimit);
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
                    responseText = await chatWithRAGGrok(message, history, documentType, retrievedChunks, actualModelName);
                } else if (model === 'grok-reasoning') {
                    actualModelName = 'grok-4-fast-reasoning';
                    temperature = 0.7;
                    console.log(`   - Model: ${actualModelName}`);
                    console.log(`   - Temperature: ${temperature}`);
                    console.log(`   - Context: ${chunksUsed} chunks + ${history.length} history messages`);
                    responseText = await chatWithRAGGrok(message, history, documentType, retrievedChunks, actualModelName);
                } else {
                    actualModelName = 'gemini-2.5-flash';
                    temperature = 'default (Gemini auto)';
                    console.log(`   - Model: ${actualModelName}`);
                    console.log(`   - Temperature: ${temperature}`);
                    console.log(`   - Context: ${chunksUsed} chunks + ${history.length} history messages`);
                    responseText = await chatWithRAGGemini(message, history, documentType, retrievedChunks);
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
                    chunk_limit_source: ownerInfo ? 'owner' : 'default'
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

// Root route - serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Catch index.php requests (Joomla/Apache adds this)
app.get('/index.php', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Catch any other .php requests
app.get('*.php', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Readiness check endpoint (for load balancers and PM2 health checks)
app.get('/api/ready', async (req, res) => {
    try {
        // Ensure registry is loaded
        if (!documentRegistryLoaded) {
            return res.status(503).json({
                status: 'not_ready',
                message: 'Document registry not loaded yet'
            });
        }

        // Server is ready to serve requests (RAG-only, no PDF loading required)
        res.json({
            status: 'ready',
            message: 'Server is fully ready to serve requests',
            availableDocuments: activeDocumentSlugs.length,
            mode: 'rag-only'
        });
    } catch (error) {
        console.error('Readiness check error:', error);
        res.status(503).json({
            status: 'error',
            message: 'Readiness check failed',
            error: error.message
        });
    }
});

// Health check endpoint (RAG-only mode)
app.get('/api/health', async (req, res) => {
    try {
        const requestedDoc = req.query.doc || 'smh';

        // Ensure registry is loaded for health check
        if (!documentRegistryLoaded) {
            await documentRegistry.loadDocuments();
            activeDocumentSlugs = await documentRegistry.getActiveSlugs();
            documentRegistryLoaded = true;
        }

        // Validate using registry
        const isValid = await documentRegistry.isValidSlug(requestedDoc);
        const docType = isValid ? requestedDoc : 'smh';

        // Get document info from registry (metadata only)
        let currentDocInfo;
        if (isValid) {
            const docConfig = await documentRegistry.getDocumentBySlug(docType);
            currentDocInfo = {
                title: docConfig.title,
                embeddingType: docConfig.embedding_type,
                year: docConfig.year
            };
        }

        res.json({
            status: 'ok',
            mode: 'rag-only',
            currentDocument: currentDocInfo?.title || 'Unknown',
            currentDocumentType: docType,
            availableDocuments: activeDocumentSlugs,
            totalAvailableDocuments: activeDocumentSlugs.length,
            requestedDoc: requestedDoc
        });
    } catch (error) {
        console.error('Health check error:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Document registry refresh endpoint (for admin use)
app.post('/api/refresh-registry', async (req, res) => {
    try {
        console.log('🔄 Forcing document registry refresh...');

        // Force refresh the document registry
        await documentRegistry.refreshRegistry();

        // Reload active slugs
        activeDocumentSlugs = await documentRegistry.getActiveSlugs();

        console.log('✅ Document registry refreshed successfully');

        res.json({
            success: true,
            message: 'Document registry cache cleared and refreshed',
            documentCount: activeDocumentSlugs.length
        });

    } catch (error) {
        console.error('Registry refresh error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to refresh document registry',
            error: error.message
        });
    }
});

// Rating endpoint
app.post('/api/rate', async (req, res) => {
    try {
        const { conversationId, rating } = req.body;

        if (!conversationId) {
            return res.status(400).json({ error: 'conversationId is required' });
        }

        if (!['thumbs_up', 'thumbs_down'].includes(rating)) {
            return res.status(400).json({ error: 'rating must be either "thumbs_up" or "thumbs_down"' });
        }

        await updateConversationRating(conversationId, rating);

        res.json({ success: true, message: 'Rating submitted successfully' });
    } catch (error) {
        console.error('Rating error:', error);
        res.status(500).json({
            error: 'Failed to submit rating',
            details: error.message
        });
    }
});

// Analytics endpoint
app.get('/api/analytics', async (req, res) => {
    try {
        const { timeframe = '24h' } = req.query;
        
        // Calculate time filter
        const hoursBack = timeframe === '24h' ? 24 : timeframe === '7d' ? 168 : timeframe === '30d' ? 720 : 24;
        const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
        
        // Get conversation stats
        const { data: conversations, error } = await supabase
            .from('chat_conversations')
            .select('*')
            .gte('created_at', since)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        // Get unique documents
        const documentStats = {};
        conversations.forEach(c => {
            const docName = c.document_name || c.pdf_name || 'unknown';
            if (!documentStats[docName]) {
                documentStats[docName] = {
                    count: 0,
                    version: c.document_version,
                    avgResponseTime: 0,
                    totalTime: 0
                };
            }
            documentStats[docName].count++;
            documentStats[docName].totalTime += c.response_time_ms || 0;
        });
        
        // Calculate averages for documents
        Object.keys(documentStats).forEach(doc => {
            documentStats[doc].avgResponseTime = Math.round(
                documentStats[doc].totalTime / documentStats[doc].count
            );
            delete documentStats[doc].totalTime;
        });
        
        // Calculate analytics
        const stats = {
            totalConversations: conversations.length,
            byModel: {
                gemini: conversations.filter(c => c.model === 'gemini').length,
                grok: conversations.filter(c => c.model === 'grok').length
            },
            byDocument: documentStats,
            avgResponseTime: {
                gemini: Math.round(
                    conversations.filter(c => c.model === 'gemini')
                        .reduce((sum, c) => sum + (c.response_time_ms || 0), 0) / 
                    conversations.filter(c => c.model === 'gemini').length || 1
                ),
                grok: Math.round(
                    conversations.filter(c => c.model === 'grok')
                        .reduce((sum, c) => sum + (c.response_time_ms || 0), 0) / 
                    conversations.filter(c => c.model === 'grok').length || 1
                )
            },
            errors: conversations.filter(c => c.error).length,
            uniqueSessions: new Set(conversations.map(c => c.session_id)).size,
            uniqueDocuments: Object.keys(documentStats).length,
            timeframe: timeframe,
            recentQuestions: conversations.slice(0, 10).map(c => ({
                question: c.question,
                model: c.model,
                document: c.document_name || c.pdf_name,
                timestamp: c.created_at,
                responseTime: c.response_time_ms
            }))
        };
        
        res.json(stats);
    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

// Embedding cache statistics endpoint
app.get('/api/cache/stats', async (req, res) => {
    try {
        const stats = getCacheStats();
        res.json({
            success: true,
            cache: stats
        });
    } catch (error) {
        console.error('Error getting cache stats:', error);
        res.status(500).json({ error: 'Failed to get cache statistics' });
    }
});

// Clear embedding cache endpoint (for testing/debugging)
app.post('/api/cache/clear', async (req, res) => {
    try {
        clearCache();
        res.json({
            success: true,
            message: 'Embedding cache cleared'
        });
    } catch (error) {
        console.error('Error clearing cache:', error);
        res.status(500).json({ error: 'Failed to clear cache' });
    }
});

// Documents registry API endpoint
app.get('/api/documents', async (req, res) => {
    try {
        const docs = await documentRegistry.getDocumentsForAPI();
        res.json({ documents: docs });
    } catch (error) {
        console.error('Error fetching documents:', error);
        res.status(500).json({ error: 'Failed to fetch documents' });
    }
});

// Track registry loading status
let documentRegistryLoaded = false;
let activeDocumentSlugs = [];

// Auto-refresh document registry every 2 minutes
function initializeRegistryAutoRefresh() {
    const REFRESH_INTERVAL = 2 * 60 * 1000; // 2 minutes
    
    setInterval(async () => {
        try {
            console.log('🔄 Auto-refreshing document registry...');
            await documentRegistry.refreshRegistry();
            activeDocumentSlugs = await documentRegistry.getActiveSlugs();
            console.log(`✓ Registry auto-refreshed: ${activeDocumentSlugs.length} active documents`);
        } catch (error) {
            console.error('❌ Auto-refresh failed:', error.message);
        }
    }, REFRESH_INTERVAL);
    
    console.log(`✓ Registry auto-refresh enabled (every ${REFRESH_INTERVAL / 1000}s)`);
}

// Start server
async function start() {
    const startupStart = Date.now();
    console.log('🔄 Starting RAG-only server...');

    try {
        // Phase 1: Load document registry
        const phase1Start = Date.now();
        console.log('📋 Phase 1: Loading document registry...');

        await documentRegistry.loadDocuments();
        activeDocumentSlugs = await documentRegistry.getActiveSlugs();
        documentRegistryLoaded = true;

        const phase1Time = Date.now() - phase1Start;
        console.log(`✓ Document registry loaded (${phase1Time}ms): ${activeDocumentSlugs.length} active documents available`);

        // Phase 2: Initialize services
        const phase2Start = Date.now();
        console.log('🔧 Phase 2: Initializing services...');

        initializeCacheCleanup();
        initializeRegistryAutoRefresh();

        const phase2Time = Date.now() - phase2Start;
        console.log(`✓ Services initialized (${phase2Time}ms)`);

        // Phase 3: Start HTTP server
        const phase3Start = Date.now();
        console.log('🌐 Phase 3: Starting HTTP server...');

        const serverStart = Date.now();
        server = app.listen(PORT, () => {
            const serverTime = Date.now() - serverStart;
            const totalStartupTime = Date.now() - startupStart;

            console.log(`\n🚀 Server running at http://localhost:${PORT} (${serverTime}ms)`);
            console.log(`📚 RAG-only chatbot ready!`);
            console.log(`   - Total startup time: ${totalStartupTime}ms`);
            console.log(`   - Available documents: ${activeDocumentSlugs.length} total`);
            console.log(`   - Mode: RAG-only (database retrieval)`);
            console.log(`   - Use ?doc=<slug> URL parameter to select document\n`);

            // Signal to PM2 that the app is ready
            if (process.send) {
                process.send('ready');
                console.log('✓ Sent ready signal to PM2');
            }
        });
    } catch (error) {
        const totalStartupTime = Date.now() - startupStart;
        console.error(`❌ Failed to start server after ${totalStartupTime}ms:`, error);
        process.exit(1);
    }
}

start();

