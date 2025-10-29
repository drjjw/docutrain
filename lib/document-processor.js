/**
 * Document Processor
 * Handles PDF processing, chunking, and embedding for user-uploaded documents
 * Extracted from scripts/chunk-and-embed.js for reusable server-side processing
 */

const pdf = require('pdf-parse');
const logger = require('./processing-logger');

// Configuration
const CHUNK_SIZE = 500; // tokens (roughly 2000 characters)
const CHUNK_OVERLAP = 100; // tokens (roughly 400 characters)
const CHARS_PER_TOKEN = 4; // Rough estimate
const BATCH_SIZE = 50; // Process embeddings in batches
const BATCH_DELAY_MS = 100; // Small delay between batches

/**
 * Clean PDF text to reduce noise
 */
function cleanPDFText(text) {
    let cleaned = text;

    // Convert "Page X" headers to citation markers
    cleaned = cleaned.replace(/\s*Page (\d+)\s*/g, '\n[Page $1]\n');

    // Convert standalone page numbers to citation markers
    cleaned = cleaned.replace(/^\s*(\d+)\s*$/gm, '\n[Page $1]\n');

    // Remove excessive whitespace
    cleaned = cleaned.replace(/\n\n\n+/g, '\n\n');

    // Trim lines
    cleaned = cleaned.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join('\n');

    return cleaned;
}

/**
 * Enhanced PDF text extraction with automatic page markers
 */
async function extractPDFTextWithPageMarkers(buffer) {
    const data = await pdf(buffer);
    let fullText = data.text;
    const numPages = data.numpages;

    // Check if text already has page markers
    const pageMarkerRegex = /\[Page \d+\]/g;
    const existingMarkers = fullText.match(pageMarkerRegex);

    if (!existingMarkers || existingMarkers.length < numPages * 0.5) {
        // Clean the text first
        fullText = cleanPDFText(fullText);

        // Calculate approximate characters per page
        const totalChars = fullText.length;
        const avgCharsPerPage = Math.floor(totalChars / numPages);

        // Insert page markers at estimated boundaries
        let markedText = '';
        let currentPos = 0;
        let currentPage = 1;

        // Add first page marker
        markedText += `[Page ${currentPage}]\n`;

        while (currentPos < totalChars && currentPage <= numPages) {
            const pageEnd = Math.min(currentPos + avgCharsPerPage, totalChars);
            const pageText = fullText.substring(currentPos, pageEnd);

            markedText += pageText;

            currentPos = pageEnd;
            currentPage++;

            if (currentPage <= numPages && currentPos < totalChars) {
                markedText += `\n\n[Page ${currentPage}]\n`;
            }
        }

        fullText = markedText;
    }

    return { text: fullText, pages: numPages };
}

/**
 * Split text into overlapping chunks with accurate page detection
 */
function chunkText(text, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP, totalPages = 1) {
    const chunks = [];
    const chunkChars = chunkSize * CHARS_PER_TOKEN;
    const overlapChars = overlap * CHARS_PER_TOKEN;

    // Find all page markers and their positions
    const pageMarkers = [];
    const pageMarkerRegex = /\[Page (\d+)\]/g;
    let match;
    while ((match = pageMarkerRegex.exec(text)) !== null) {
        const pageNum = parseInt(match[1]);
        const position = match.index;
        pageMarkers.push({ pageNum, position });
    }

    // Sort by position
    pageMarkers.sort((a, b) => a.position - b.position);

    let start = 0;
    let chunkIndex = 0;

    while (start < text.length) {
        const end = Math.min(start + chunkChars, text.length);
        const chunk = text.substring(start, end);

        // Only include non-empty chunks
        if (chunk.trim().length > 0) {
            // Determine actual page number using page markers
            const chunkCenter = start + (end - start) / 2;
            let actualPage = 1; // Default to page 1

            // Find which page this chunk belongs to
            for (let i = 0; i < pageMarkers.length; i++) {
                if (chunkCenter < pageMarkers[i].position) {
                    if (i === 0) {
                        actualPage = 1;
                    } else {
                        actualPage = pageMarkers[i - 1].pageNum;
                    }
                    break;
                }
            }

            // If chunk center is after the last marker, it belongs to the last page
            if (pageMarkers.length > 0 && chunkCenter >= pageMarkers[pageMarkers.length - 1].position) {
                actualPage = pageMarkers[pageMarkers.length - 1].pageNum;
            }

            // Ensure page number is within valid range
            actualPage = Math.min(Math.max(1, actualPage), totalPages);

            chunks.push({
                index: chunkIndex,
                content: chunk.trim(),
                charStart: start,
                charEnd: end,
                pageNumber: actualPage,
                pageMarkersFound: pageMarkers.length
            });
            chunkIndex++;
        }

        // Move forward by (chunkSize - overlap) to create overlap
        start += chunkChars - overlapChars;
    }

    return chunks;
}

/**
 * Generate embedding for text using OpenAI
 */
async function generateEmbedding(openaiClient, text) {
    try {
        const response = await openaiClient.embeddings.create({
            model: 'text-embedding-3-small',
            input: text,
            encoding_format: 'float'
        });
        
        return response.data[0].embedding;
    } catch (error) {
        throw new Error(`Embedding generation failed: ${error.message}`);
    }
}

/**
 * Process embeddings in batches
 */
async function processEmbeddingsBatch(openaiClient, chunks, startIdx, batchSize) {
    const batch = chunks.slice(startIdx, startIdx + batchSize);
    const embeddings = [];
    
    for (const chunk of batch) {
        try {
            const embedding = await generateEmbedding(openaiClient, chunk.content);
            embeddings.push({ chunk, embedding });
        } catch (error) {
            console.error(`Failed to embed chunk ${chunk.index}:`, error.message);
            embeddings.push({ chunk, embedding: null });
        }
    }
    
    return embeddings;
}

/**
 * Store chunks with embeddings in Supabase
 */
async function storeChunks(supabase, documentSlug, documentName, chunksWithEmbeddings) {
    const records = chunksWithEmbeddings
        .filter(item => item.embedding !== null)
        .map(({ chunk, embedding }) => ({
            document_type: documentSlug,
            document_slug: documentSlug,
            document_name: documentName,
            chunk_index: chunk.index,
            content: chunk.content,
            embedding: embedding,
            metadata: {
                char_start: chunk.charStart,
                char_end: chunk.charEnd,
                tokens_approx: Math.round(chunk.content.length / CHARS_PER_TOKEN),
                page_number: chunk.pageNumber,
                page_markers_found: chunk.pageMarkersFound
            }
        }));
    
    // Insert in batches to avoid payload size limits
    const insertBatchSize = 50;
    let inserted = 0;
    
    for (let i = 0; i < records.length; i += insertBatchSize) {
        const batch = records.slice(i, i + insertBatchSize);
        const { error } = await supabase
            .from('document_chunks')
            .insert(batch);
        
        if (error) {
            throw new Error(`Failed to insert batch: ${error.message}`);
        }
        
        inserted += batch.length;
    }
    
    return inserted;
}

/**
 * Download PDF from Supabase Storage
 */
async function downloadPDFFromStorage(supabase, filePath) {
    const { data, error } = await supabase.storage
        .from('user-documents')
        .download(filePath);
    
    if (error) {
        throw new Error(`Failed to download PDF: ${error.message}`);
    }
    
    // Convert blob to buffer
    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

/**
 * Generate unique slug from title
 */
function generateSlug(title) {
    const timestamp = Date.now();
    const baseSlug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 50);
    
    return `user-${baseSlug}-${timestamp}`;
}

/**
 * Main processing function for user-uploaded documents
 * 
 * @param {string} userDocId - ID of the user_documents record
 * @param {Object} supabase - Supabase client
 * @param {Object} openaiClient - OpenAI client
 * @returns {Object} Processing result with document slug and stats
 */
async function processUserDocument(userDocId, supabase, openaiClient) {
    const startTime = Date.now();
    let documentSlug = null;
    
    try {
        // 1. Get user document record
        await logger.started(supabase, userDocId, logger.STAGES.DOWNLOAD, 'Starting document processing');
        
        const { data: userDoc, error: fetchError } = await supabase
            .from('user_documents')
            .select('*')
            .eq('id', userDocId)
            .single();
        
        if (fetchError || !userDoc) {
            throw new Error(`User document not found: ${userDocId}`);
        }
        
        // Update status to processing
        await supabase
            .from('user_documents')
            .update({ status: 'processing', updated_at: new Date().toISOString() })
            .eq('id', userDocId);
        
        // 2. Download PDF from storage
        await logger.progress(supabase, userDocId, null, logger.STAGES.DOWNLOAD, 'Downloading PDF from storage', {
            file_path: userDoc.file_path,
            file_size: userDoc.file_size
        });
        
        const pdfBuffer = await downloadPDFFromStorage(supabase, userDoc.file_path);
        
        await logger.completed(supabase, userDocId, null, logger.STAGES.DOWNLOAD, 'PDF downloaded successfully', {
            buffer_size: pdfBuffer.length
        });
        
        // 3. Extract text from PDF
        await logger.started(supabase, userDocId, logger.STAGES.EXTRACT, 'Extracting text from PDF');
        
        const { text, pages } = await extractPDFTextWithPageMarkers(pdfBuffer);
        
        await logger.completed(supabase, userDocId, null, logger.STAGES.EXTRACT, 'Text extracted successfully', {
            pages,
            characters: text.length
        });
        
        // 4. Generate document slug and create documents record
        documentSlug = generateSlug(userDoc.title);
        
        const { error: docInsertError } = await supabase
            .from('documents')
            .insert({
                slug: documentSlug,
                title: userDoc.title,
                subtitle: `Uploaded by user`,
                welcome_message: `Ask questions about ${userDoc.title}`,
                pdf_filename: userDoc.file_path.split('/').pop(),
                pdf_subdirectory: 'user-uploads',
                embedding_type: 'openai',
                active: true,
                access_level: 'owner_restricted',
                metadata: {
                    user_document_id: userDocId,
                    user_id: userDoc.user_id,
                    uploaded_at: userDoc.created_at,
                    file_size: userDoc.file_size
                }
            });
        
        if (docInsertError) {
            throw new Error(`Failed to create document record: ${docInsertError.message}`);
        }
        
        await logger.progress(supabase, userDocId, documentSlug, logger.STAGES.EXTRACT, 'Document record created', {
            slug: documentSlug
        });
        
        // 5. Chunk text
        await logger.started(supabase, userDocId, logger.STAGES.CHUNK, 'Chunking text');
        
        const chunks = chunkText(text, CHUNK_SIZE, CHUNK_OVERLAP, pages);
        
        await logger.completed(supabase, userDocId, documentSlug, logger.STAGES.CHUNK, 'Text chunked successfully', {
            chunk_count: chunks.length,
            chunk_size: CHUNK_SIZE,
            overlap: CHUNK_OVERLAP
        });
        
        // 6. Generate embeddings
        await logger.started(supabase, userDocId, logger.STAGES.EMBED, 'Generating embeddings');
        
        const allEmbeddings = [];
        const totalBatches = Math.ceil(chunks.length / BATCH_SIZE);
        
        for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
            const batchNum = Math.floor(i / BATCH_SIZE) + 1;
            
            await logger.progress(supabase, userDocId, documentSlug, logger.STAGES.EMBED, 
                `Processing batch ${batchNum}/${totalBatches}`, {
                batch: batchNum,
                total_batches: totalBatches
            });
            
            const batchResults = await processEmbeddingsBatch(openaiClient, chunks, i, BATCH_SIZE);
            allEmbeddings.push(...batchResults);
            
            // Small delay between batches
            if (i + BATCH_SIZE < chunks.length) {
                await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
            }
        }
        
        const successfulEmbeddings = allEmbeddings.filter(e => e.embedding !== null).length;
        
        await logger.completed(supabase, userDocId, documentSlug, logger.STAGES.EMBED, 'Embeddings generated', {
            total: chunks.length,
            successful: successfulEmbeddings,
            failed: chunks.length - successfulEmbeddings
        });
        
        // 7. Store chunks in database
        await logger.started(supabase, userDocId, logger.STAGES.STORE, 'Storing chunks in database');
        
        const inserted = await storeChunks(supabase, documentSlug, userDoc.title, allEmbeddings);
        
        await logger.completed(supabase, userDocId, documentSlug, logger.STAGES.STORE, 'Chunks stored successfully', {
            chunks_stored: inserted
        });
        
        // 8. Update user_documents status to ready
        await supabase
            .from('user_documents')
            .update({ 
                status: 'ready',
                updated_at: new Date().toISOString()
            })
            .eq('id', userDocId);
        
        const processingTime = Date.now() - startTime;
        
        await logger.completed(supabase, userDocId, documentSlug, logger.STAGES.COMPLETE, 'Processing complete', {
            processing_time_ms: processingTime,
            document_slug: documentSlug,
            pages,
            chunks: inserted
        });
        
        return {
            success: true,
            documentSlug,
            stats: {
                pages,
                chunks: inserted,
                processingTimeMs: processingTime
            }
        };
        
    } catch (error) {
        // Log error
        await logger.error(supabase, userDocId, documentSlug, 'Processing failed', error);
        
        // Update user_documents status to error
        await supabase
            .from('user_documents')
            .update({ 
                status: 'error',
                error_message: error.message,
                updated_at: new Date().toISOString()
            })
            .eq('id', userDocId);
        
        throw error;
    }
}

module.exports = {
    processUserDocument,
    generateSlug,
    CHUNK_SIZE,
    CHUNK_OVERLAP
};

