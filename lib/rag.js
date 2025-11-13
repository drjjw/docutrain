/**
 * RAG (Retrieval Augmented Generation) functions
 * Handles embeddings, chunk retrieval, and prompt generation
 */

/**
 * Generate embedding for a query using OpenAI text-embedding-3-small
 */
async function embedQuery(openaiClient, text) {
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
 * @param {Array<{id: string, slug: string}>|{id: string, slug: string}} documentIds - Document ID(s) with slug for logging
 */
async function findRelevantChunks(supabase, embedding, documentIds, limit = 5, threshold = null) {
    try {
        // OpenAI embeddings use higher threshold (0.3), local embeddings use lower (0.1)
        const defaultThreshold = threshold || parseFloat(process.env.RAG_SIMILARITY_THRESHOLD) || 0.3;

        // Handle both single object and array of document objects
        const isMultiDoc = Array.isArray(documentIds);
        const docArray = isMultiDoc ? documentIds : [documentIds];
        
        // Extract IDs and slugs
        const ids = docArray.map(doc => doc.id);
        const slugs = docArray.map(doc => doc.slug);

        // Use multi-document function if searching across multiple documents
        if (docArray.length > 1) {
            console.log(`RAG: Using multi-document search for: ${slugs.join(', ')}`);
            const { data, error } = await supabase.rpc('match_document_chunks_multi', {
                query_embedding: embedding,
                doc_ids: ids,
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
                doc_id: ids[0],
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
 * @param {Array<{id: string, slug: string}>|{id: string, slug: string}} documentIds - Document ID(s) with slug for logging
 */
async function findRelevantChunksLocal(supabase, embedding, documentIds, limit = 5, threshold = null) {
    try {
        // Local embeddings use lower threshold (0.05) since they have lower similarity scores
        const defaultThreshold = threshold || parseFloat(process.env.RAG_SIMILARITY_THRESHOLD_LOCAL) || 0.05;

        // Handle both single object and array of document objects
        const isMultiDoc = Array.isArray(documentIds);
        const docArray = isMultiDoc ? documentIds : [documentIds];
        
        // Extract IDs and slugs
        const ids = docArray.map(doc => doc.id);
        const slugs = docArray.map(doc => doc.slug);

        // Use multi-document function if searching across multiple documents
        if (docArray.length > 1) {
            console.log(`RAG: Using multi-document search (local) for: ${slugs.join(', ')}`);
            const { data, error } = await supabase.rpc('match_document_chunks_local_multi', {
                query_embedding: embedding,
                doc_ids: ids,
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
                doc_id: ids[0],
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
 * Find relevant chunks using HYBRID search (vector + full-text)
 * Supports both single and multiple documents
 * @param {object} supabase - Supabase client
 * @param {array} embedding - Query embedding vector
 * @param {string} queryText - Original query text for full-text search
 * @param {Array<{id: string, slug: string}>|{id: string, slug: string}} documentIds - Document ID(s) with slug for logging
 * @param {number} limit - Maximum chunks to retrieve
 * @param {number} threshold - Similarity threshold (default 0.2 for hybrid)
 */
async function findRelevantChunksHybrid(supabase, embedding, queryText, documentIds, limit = 5, threshold = null) {
    try {
        // Lower threshold for hybrid search since we have text search backup
        const defaultThreshold = threshold || parseFloat(process.env.RAG_SIMILARITY_THRESHOLD_HYBRID) || 0.2;

        // Handle both single object and array of document objects
        const isMultiDoc = Array.isArray(documentIds);
        const docArray = isMultiDoc ? documentIds : [documentIds];
        
        // Extract IDs and slugs
        const ids = docArray.map(doc => doc.id);
        const slugs = docArray.map(doc => doc.slug);

        // Use multi-document function if searching across multiple documents
        if (docArray.length > 1) {
            console.log(`RAG: Using multi-document HYBRID search for: ${slugs.join(', ')}`);
            const { data, error } = await supabase.rpc('match_document_chunks_hybrid_multi', {
                query_embedding: embedding,
                query_text: queryText,
                doc_ids: ids,
                match_threshold: defaultThreshold,
                match_count_per_doc: limit
            });

            if (error) {
                console.error('Error finding relevant chunks (hybrid, multi):', error);
                throw error;
            }

            return data || [];
        } else {
            // Single document - use hybrid function
            const { data, error } = await supabase.rpc('match_document_chunks_hybrid', {
                query_embedding: embedding,
                query_text: queryText,
                doc_id: ids[0],
                match_threshold: defaultThreshold,
                match_count: limit
            });

            if (error) {
                console.error('Error finding relevant chunks (hybrid):', error);
                throw error;
            }

            return data || [];
        }
    } catch (error) {
        console.error('Error in findRelevantChunksHybrid:', error);
        throw error;
    }
}

/**
 * Find relevant chunks using HYBRID search with local embeddings (vector + full-text)
 * Supports both single and multiple documents
 * @param {object} supabase - Supabase client
 * @param {array} embedding - Query embedding vector (384D local)
 * @param {string} queryText - Original query text for full-text search
 * @param {Array<{id: string, slug: string}>|{id: string, slug: string}} documentIds - Document ID(s) with slug for logging
 * @param {number} limit - Maximum chunks to retrieve
 * @param {number} threshold - Similarity threshold (default 0.05 for local hybrid)
 */
async function findRelevantChunksLocalHybrid(supabase, embedding, queryText, documentIds, limit = 5, threshold = null) {
    try {
        // Lower threshold for local embeddings
        const defaultThreshold = threshold || parseFloat(process.env.RAG_SIMILARITY_THRESHOLD_LOCAL_HYBRID) || 0.05;

        // Handle both single object and array of document objects
        const isMultiDoc = Array.isArray(documentIds);
        const docArray = isMultiDoc ? documentIds : [documentIds];
        
        // Extract IDs and slugs
        const ids = docArray.map(doc => doc.id);
        const slugs = docArray.map(doc => doc.slug);

        // Use multi-document function if searching across multiple documents
        if (docArray.length > 1) {
            console.log(`RAG: Using multi-document HYBRID search (local) for: ${slugs.join(', ')}`);
            const { data, error} = await supabase.rpc('match_document_chunks_local_hybrid_multi', {
                query_embedding: embedding,
                query_text: queryText,
                doc_ids: ids,
                match_threshold: defaultThreshold,
                match_count_per_doc: limit
            });

            if (error) {
                console.error('Error finding relevant chunks (local hybrid, multi):', error);
                throw error;
            }

            return data || [];
        } else {
            // Single document - use local hybrid function
            const { data, error } = await supabase.rpc('match_document_chunks_local_hybrid', {
                query_embedding: embedding,
                query_text: queryText,
                doc_id: ids[0],
                match_threshold: defaultThreshold,
                match_count: limit
            });

            if (error) {
                console.error('Error finding relevant chunks (local hybrid):', error);
                throw error;
            }

            return data || [];
        }
    } catch (error) {
        console.error('Error in findRelevantChunksLocalHybrid:', error);
        throw error;
    }
}

/**
 * Build RAG system prompt with retrieved chunks
 * Supports both single and multiple document types
 */
async function getRAGSystemPrompt(documentRegistry, documentTypes = 'smh', chunks = []) {
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

    // Check if any document is one of the specific ukidney docs that should get drug instructions
    const isUkidneySpecificDoc = docArray.some(slug => ['smh', 'smh-tx'].includes(slug));

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

    // Add ukidney-specific drug instruction only for specific ukidney docs (smh, smh-tx)
    const ukidneyDrugInstruction = isUkidneySpecificDoc ? `
6. For questions about drug dose conversions related to MMF (CellCept) PO, Myfortic PO, MMF IV, Cyclosporine PO, Cyclosporine IV, Envarsus, Advagraf/Astagraf, Prograf, Prednisone, Methylprednisolone IV, Hydrocortisone IV, or Dexamethasone, attempt to answer but include a message directing users to consult https://ukidney.com/drugs` : '';

    // Add instruction to NOT include ukidney drug instruction for non-SMH documents
    const noUkidneyInstruction = !isUkidneySpecificDoc ? `
6. CRITICAL: Under NO circumstances should you mention https://ukidney.com/drugs, ukidney.com, or any ukidney.com website in your response. Do not direct users to external websites for drug information. Only answer using the provided document excerpts.` : '';

    return `You are a helpful assistant that answers questions based on ${isMultiDoc ? 'multiple documents: ' + docName : 'the ' + docName}.

***CRITICAL FORMATTING REQUIREMENT: You MUST include footnotes [1], [2], etc. for EVERY claim/fact in your response, with references at the end. ${citationFormat}***

IMPORTANT RULES:
1. Answer questions ONLY using information from the provided relevant excerpts below
2. If the answer is not in the excerpts, say "I don't have that information in the provided sections of the ${docName}"
3. Be concise and professional
4. If you're unsure, admit it rather than guessing
5. Do NOT mention chunk numbers or reference which excerpt information came from${ukidneyDrugInstruction}${noUkidneyInstruction}${conflictInstructions}

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
}

/**
 * Get model-specific RAG prompt for Gemini
 */
async function getRAGGeminiPrompt(documentRegistry, documentType, chunks) {
    const basePrompt = await getRAGSystemPrompt(documentRegistry, documentType, chunks);
    return basePrompt + `

RESPONSE STYLE - STRICTLY FOLLOW:
- Use markdown tables when presenting structured data
- Present information in the most compact, scannable format
- Lead with the direct answer, then provide details
- Use minimal explanatory text - let the structure speak
- **MANDATORY**: Include footnotes [1], [2], etc. for EVERY claim with references at response end`;
}

/**
 * Get model-specific RAG prompt for Grok
 */
async function getRAGGrokPrompt(documentRegistry, documentType, chunks) {
    const basePrompt = await getRAGSystemPrompt(documentRegistry, documentType, chunks);
    return basePrompt + `

RESPONSE STYLE - STRICTLY FOLLOW:
- ALWAYS add a brief introductory sentence explaining the context
- When presenting factual data, include WHY it matters
- Add a short concluding note with clinical significance when relevant
- Use more descriptive language - explain, don't just list
- **MANDATORY**: Include footnotes [1], [2], etc. for EVERY claim with references at response end`;
}

/**
 * Chat with RAG using Gemini
 */
async function chatWithRAGGemini(genAI, documentRegistry, message, history, documentType, chunks) {
    console.log(`🤖 Using RAG Gemini model: gemini-2.5-flash`);
    const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash"
    });

    const systemMessage = await getRAGGeminiPrompt(documentRegistry, documentType, chunks);
    
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
 * Chat with RAG using Gemini - STREAMING VERSION
 */
async function* chatWithRAGGeminiStream(genAI, documentRegistry, message, history, documentType, chunks) {
    console.log(`🤖 Using RAG Gemini model: gemini-2.5-flash (STREAMING)`);
    const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash"
    });

    const systemMessage = await getRAGGeminiPrompt(documentRegistry, documentType, chunks);
    
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

    const result = await chat.sendMessageStream(message);
    
    for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        yield chunkText;
    }
}

/**
 * Chat with RAG using Grok
 */
async function chatWithRAGGrok(xai, documentRegistry, message, history, documentType, chunks, modelName = 'grok-4-fast-non-reasoning') {
    console.log(`🤖 Using RAG Grok model: ${modelName}`);
    const systemMessage = await getRAGGrokPrompt(documentRegistry, documentType, chunks);
    
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

/**
 * Chat with RAG using Grok - STREAMING VERSION
 */
async function* chatWithRAGGrokStream(xai, documentRegistry, message, history, documentType, chunks, modelName = 'grok-4-fast-non-reasoning') {
    console.log(`🤖 Using RAG Grok model: ${modelName} (STREAMING)`);
    const systemMessage = await getRAGGrokPrompt(documentRegistry, documentType, chunks);
    
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

    const stream = await xai.chat.completions.create({
        model: modelName,
        messages: messages,
        temperature: 0.7,
        stream: true
    });

    for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
            yield content;
        }
    }
}

module.exports = {
    embedQuery,
    findRelevantChunks,
    findRelevantChunksLocal,
    findRelevantChunksHybrid,
    findRelevantChunksLocalHybrid,
    getRAGSystemPrompt,
    getRAGGeminiPrompt,
    getRAGGrokPrompt,
    chatWithRAGGemini,
    chatWithRAGGrok,
    chatWithRAGGeminiStream,
    chatWithRAGGrokStream
};

