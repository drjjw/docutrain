/**
 * Document Processor
 * Handles PDF processing, chunking, and embedding for user-uploaded documents
 * Extracted from scripts/chunk-and-embed.js for reusable server-side processing
 */

const { PDFExtract } = require('pdf.js-extract');
const pdfExtract = new PDFExtract();
const logger = require('./processing-logger');

// Configuration
const CHUNK_SIZE = 500; // tokens (roughly 2000 characters)
const CHUNK_OVERLAP = 100; // tokens (roughly 400 characters)
const CHARS_PER_TOKEN = 4; // Rough estimate
const BATCH_SIZE = 50; // Process embeddings in batches
const BASE_BATCH_DELAY_MS = 100; // Base delay between batches (scales with load)

/**
 * Track active processing for adaptive batch delays
 * This is a simple counter that gets incremented/decremented by the processing routes
 */
let activeProcessingCount = 0;

/**
 * Set the active processing count (called from processing routes)
 */
function setActiveProcessingCount(count) {
    activeProcessingCount = Math.max(0, count);
}

/**
 * Get adaptive batch delay based on current processing load
 * More concurrent jobs = longer delays to reduce OpenAI API pressure
 */
function getAdaptiveBatchDelay() {
    // Scale delay based on concurrent processing
    // 1 job = 100ms, 2 jobs = 150ms, 3 jobs = 200ms, 5+ jobs = 300ms
    const loadMultiplier = Math.min(3, 1 + (activeProcessingCount * 0.5));
    return Math.round(BASE_BATCH_DELAY_MS * loadMultiplier);
}

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
 * Enhanced PDF text extraction with automatic page markers using pdf.js-extract
 * This provides better text extraction and maintains proper reading order
 */
async function extractPDFTextWithPageMarkers(buffer) {
    try {
        // Extract PDF data with structure information
        const data = await pdfExtract.extractBuffer(buffer);
        const numPages = data.pages.length;
        
        let fullText = '';
        
        // Extract text page by page with markers
        data.pages.forEach((page, index) => {
            const pageNum = index + 1;
            
            // Add page marker
            if (pageNum === 1) {
                fullText += `[Page ${pageNum}]\n`;
            } else {
                fullText += `\n\n[Page ${pageNum}]\n`;
            }
            
            // Sort content by Y position (top to bottom) then X position (left to right)
            // This maintains proper reading order even in complex layouts
            const sortedContent = page.content.sort((a, b) => {
                // If items are on roughly the same line (within 5 units), sort by X
                if (Math.abs(a.y - b.y) < 5) {
                    return a.x - b.x;
                }
                // Otherwise sort by Y (top to bottom)
                return a.y - b.y;
            });
            
            // Extract text with proper spacing
            let lastY = -1;
            let lineText = '';
            
            sortedContent.forEach((item, idx) => {
                const text = item.str.trim();
                if (!text) return;
                
                // Check if we're on a new line
                if (lastY !== -1 && Math.abs(item.y - lastY) > 5) {
                    // New line detected
                    if (lineText) {
                        fullText += lineText + '\n';
                        lineText = '';
                    }
                }
                
                // Add space between words on same line
                if (lineText && !lineText.endsWith(' ') && !text.startsWith(' ')) {
                    lineText += ' ';
                }
                
                lineText += text;
                lastY = item.y;
            });
            
            // Add any remaining line text
            if (lineText) {
                fullText += lineText;
            }
        });
        
        // Clean the extracted text
        fullText = cleanPDFText(fullText);
        
        return { text: fullText, pages: numPages };
        
    } catch (error) {
        throw new Error(`PDF extraction failed: ${error.message}`);
    }
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
            // Determine actual page number by finding the LAST page marker within this chunk
            // This is more accurate than using chunk center, especially for chunks spanning multiple pages
            let actualPage = 1; // Default to page 1
            
            // Find all page markers that fall within this chunk's range
            const markersInChunk = pageMarkers.filter(marker => 
                marker.position >= start && marker.position < end
            );
            
            if (markersInChunk.length > 0) {
                // Use the LAST page marker found in this chunk
                actualPage = markersInChunk[markersInChunk.length - 1].pageNum;
            } else {
                // No markers in this chunk - find the last marker BEFORE this chunk
                for (let i = pageMarkers.length - 1; i >= 0; i--) {
                    if (pageMarkers[i].position < start) {
                        actualPage = pageMarkers[i].pageNum;
                        break;
                    }
                }
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
 * Retry helper with exponential backoff
 * Handles rate limits and transient errors gracefully
 */
async function retryWithBackoff(fn, maxRetries = 3, operationName = 'OpenAI API call') {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            const isRateLimit = error.status === 429;
            const isTimeout = error.code === 'ETIMEDOUT' || error.message?.includes('timeout');
            const isServerError = error.status >= 500 && error.status < 600;
            const isRetriable = isRateLimit || isTimeout || isServerError;
            
            // If this is the last attempt or error is not retriable, throw
            if (attempt === maxRetries || !isRetriable) {
                console.error(`❌ ${operationName} failed after ${attempt} attempt(s):`, error.message);
                throw error;
            }
            
            // Calculate exponential backoff delay
            // Rate limits: use retry-after header if available, otherwise exponential
            let delay;
            if (isRateLimit && error.headers?.['retry-after']) {
                delay = parseInt(error.headers['retry-after']) * 1000;
            } else {
                // Exponential backoff: 2s, 4s, 8s (capped at 10s)
                delay = Math.min(1000 * Math.pow(2, attempt), 10000);
            }
            
            console.warn(`⏳ ${operationName} failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`);
            console.warn(`   Error: ${error.message}`);
            
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

/**
 * Generate embedding for text using OpenAI with retry logic and hard timeout
 */
async function generateEmbedding(openaiClient, text) {
    return retryWithBackoff(async () => {
        try {
            // Wrap the API call with a hard timeout using Promise.race
            // This ensures we don't hang even if the SDK timeout fails
            const embeddingPromise = openaiClient.embeddings.create({
                model: 'text-embedding-3-small',
                input: text,
                encoding_format: 'float'
            }, {
                timeout: 30000 // 30 second timeout (SDK timeout)
            });
            
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error('Hard timeout: OpenAI embedding API call exceeded 45 seconds'));
                }, 45000); // 45 second hard timeout (15s buffer beyond SDK timeout)
            });
            
            const response = await Promise.race([embeddingPromise, timeoutPromise]);
            return response.data[0].embedding;
        } catch (error) {
            // Enhance error messages for better debugging
            if (error.status === 429) {
                const retryAfter = error.headers?.['retry-after'] || 'unknown';
                error.message = `Rate limit exceeded. Retry after: ${retryAfter} seconds`;
            } else if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
                error.message = `OpenAI API timeout: ${error.message}`;
            } else if (!error.message) {
                error.message = `Embedding generation failed: ${error.toString()}`;
            }
            throw error;
        }
    }, 3, 'Embedding generation');
}

/**
 * Generate a 100-word abstract from chunks using OpenAI with retry logic
 */
async function generateAbstract(openaiClient, chunks, documentTitle) {
    console.log('🤖 NEW CODE: generateAbstract() called - AI abstract generation feature is active!');
    console.log(`   Document: ${documentTitle}`);
    console.log(`   Total chunks available: ${chunks.length}`);
    
    try {
        // Take the first 30 chunks (or all if less than 30) to get a good overview
        const chunksForAbstract = chunks.slice(0, Math.min(30, chunks.length));
        
        // Combine chunk content
        const combinedText = chunksForAbstract
            .map(chunk => chunk.content)
            .join('\n\n');
        
        // Truncate if too long (to stay within token limits)
        const maxChars = 20000; // ~5000 tokens
        const textForAbstract = combinedText.length > maxChars 
            ? combinedText.substring(0, maxChars) + '...'
            : combinedText;
        
        const abstract = await retryWithBackoff(async () => {
            const response = await openaiClient.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert at creating concise, informative abstracts from document content. Create a 100-word abstract that captures the key themes, purpose, and scope of the document.'
                    },
                    {
                        role: 'user',
                        content: `Please create a 100-word abstract for a document titled "${documentTitle}". Base your abstract on the following content from the document:\n\n${textForAbstract}\n\nProvide ONLY the abstract text, no additional commentary. The abstract should be exactly 100 words.`
                    }
                ],
                temperature: 0.7,
                max_tokens: 200
            }, {
                timeout: 30000 // 30 second timeout (as options parameter)
            });
            
            return response.choices[0]?.message?.content?.trim();
        }, 3, 'Abstract generation');
        
        return abstract || null;
        
    } catch (error) {
        console.error('Failed to generate abstract:', error.message);
        // Return null on error - don't fail the whole process
        return null;
    }
}

/**
 * Generate keywords for word cloud from chunks using OpenAI
 * Returns an array of keyword objects with term and weight
 */
async function generateKeywords(openaiClient, chunks, documentTitle) {
    console.log('🔑 NEW CODE: generateKeywords() called - AI keyword extraction feature is active!');
    console.log(`   Document: ${documentTitle}`);
    console.log(`   Total chunks available: ${chunks.length}`);
    
    try {
        // Sample chunks from across the entire document for better keyword density analysis
        // Strategy: sample evenly across the document for comprehensive coverage
        let chunksForKeywords = [];
        const totalChunks = chunks.length;
        
        if (totalChunks <= 50) {
            // If document is small, use all chunks
            chunksForKeywords = chunks;
        } else {
            // For larger documents, sample more chunks for better keyword density analysis
            // Target: Use ~10% of chunks, up to 300 chunks (to stay within token limits)
            const targetSampleSize = Math.min(300, Math.max(100, Math.floor(totalChunks * 0.1)));
            
            // Sample evenly across the document for comprehensive coverage
            const step = Math.floor(totalChunks / targetSampleSize);
            const usedIndices = new Set();
            
            for (let i = 0; i < totalChunks && chunksForKeywords.length < targetSampleSize; i += step) {
                const chunkIndex = chunks[i].index !== undefined ? chunks[i].index : i;
                if (!usedIndices.has(chunkIndex)) {
                    chunksForKeywords.push(chunks[i]);
                    usedIndices.add(chunkIndex);
                }
            }
            
            // Ensure we have samples from beginning, middle, and end
            if (chunksForKeywords.length < targetSampleSize) {
                // Add beginning chunks if not already included
                for (let i = 0; i < Math.min(30, totalChunks) && chunksForKeywords.length < targetSampleSize; i++) {
                    const chunkIndex = chunks[i].index !== undefined ? chunks[i].index : i;
                    if (!usedIndices.has(chunkIndex)) {
                        chunksForKeywords.push(chunks[i]);
                        usedIndices.add(chunkIndex);
                    }
                }
                
                // Add middle chunks
                const middleStart = Math.floor(totalChunks / 2) - 15;
                for (let i = middleStart; i < middleStart + 30 && chunksForKeywords.length < targetSampleSize && i < totalChunks; i++) {
                    const chunkIndex = chunks[i].index !== undefined ? chunks[i].index : i;
                    if (!usedIndices.has(chunkIndex)) {
                        chunksForKeywords.push(chunks[i]);
                        usedIndices.add(chunkIndex);
                    }
                }
                
                // Add end chunks
                for (let i = Math.max(0, totalChunks - 30); i < totalChunks && chunksForKeywords.length < targetSampleSize; i++) {
                    const chunkIndex = chunks[i].index !== undefined ? chunks[i].index : i;
                    if (!usedIndices.has(chunkIndex)) {
                        chunksForKeywords.push(chunks[i]);
                        usedIndices.add(chunkIndex);
                    }
                }
            }
            
            // Sort by original index to maintain some order
            chunksForKeywords.sort((a, b) => {
                const aIndex = a.index !== undefined ? a.index : chunks.indexOf(a);
                const bIndex = b.index !== undefined ? b.index : chunks.indexOf(b);
                return aIndex - bIndex;
            });
        }
        
        console.log(`   📋 Sampling ${chunksForKeywords.length} chunks from across document`);
        
        // Combine chunk content
        const combinedText = chunksForKeywords
            .map(chunk => chunk.content)
            .join('\n\n');
        
        // Truncate if too long (to stay within token limits)
        // gpt-4o-mini has 128k context window, so we can use more
        // Reserve ~25k tokens for system prompt, user prompt template, and response
        // That leaves ~100k tokens (~400k chars) for document content
        const maxChars = 400000; // ~100k tokens (leaving room for prompts and response)
        const textForKeywords = combinedText.length > maxChars 
            ? combinedText.substring(0, maxChars) + '...'
            : combinedText;
        
        const content = await retryWithBackoff(async () => {
            const response = await openaiClient.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert at analyzing document content and extracting key terms and concepts. Identify the most important keywords, phrases, and concepts that would be useful for a word cloud visualization. Focus on domain-specific terms, key concepts, and important topics. Always respond with valid JSON.'
                    },
                    {
                        role: 'user',
                        content: `Analyze the following document content and extract 20-30 key terms, phrases, and concepts that best represent this document. For each term, assign a weight from 0.1 to 1.0 based on its importance (1.0 = most important, 0.1 = less important but still relevant).\n\nDocument title: "${documentTitle}"\n\nContent:\n${textForKeywords}\n\nReturn your response as a JSON object with a "keywords" property containing an array of objects, each with "term" (string) and "weight" (number) properties. Example format:\n{"keywords": [{"term": "kidney disease", "weight": 0.95}, {"term": "chronic kidney disease", "weight": 0.90}, {"term": "treatment", "weight": 0.75}]}\n\nProvide ONLY the JSON object, no additional commentary.`
                    }
                ],
                temperature: 0.7,
                max_tokens: 800, // Increased to avoid truncation
                response_format: { type: "json_object" }
            }, {
                timeout: 30000 // 30 second timeout (as options parameter)
            });
            
            return response.choices[0]?.message?.content?.trim();
        }, 3, 'Keyword generation');
        
        if (!content) {
            console.error('No content in OpenAI response for keywords');
            return null;
        }
        
        // Parse JSON response - GPT may wrap it in an object
        let parsed;
        try {
            parsed = JSON.parse(content);
        } catch (parseError) {
            console.error('Failed to parse keywords JSON:', parseError.message);
            return null;
        }
        
        // Handle both direct array and wrapped object responses
        let keywords = null;
        if (Array.isArray(parsed)) {
            keywords = parsed;
        } else if (parsed.keywords && Array.isArray(parsed.keywords)) {
            keywords = parsed.keywords;
        } else if (parsed.terms && Array.isArray(parsed.terms)) {
            keywords = parsed.terms;
        } else {
            // Try to find any array in the response
            const keys = Object.keys(parsed);
            for (const key of keys) {
                if (Array.isArray(parsed[key])) {
                    keywords = parsed[key];
                    break;
                }
            }
        }
        
        if (!keywords || !Array.isArray(keywords)) {
            console.error('Keywords not found in expected format. Parsed response:', JSON.stringify(parsed, null, 2));
            return null;
        }
        
        // Validate and clean keywords
        const validKeywords = keywords
            .filter(k => k && typeof k === 'object' && k.term && typeof k.term === 'string')
            .map(k => ({
                term: k.term.trim(),
                weight: typeof k.weight === 'number' ? Math.max(0.1, Math.min(1.0, k.weight)) : 0.5
            }))
            .filter(k => k.term.length > 0)
            .slice(0, 30); // Limit to 30 keywords
        
        if (validKeywords.length === 0) {
            console.error('No valid keywords after filtering. Original keywords array length:', keywords.length);
            return null;
        }
        
        console.log(`   ✓ Generated ${validKeywords.length} keywords`);
        return validKeywords;
        
    } catch (error) {
        console.error('Failed to generate keywords:', error.message);
        console.error('Error details:', {
            message: error?.message,
            status: error?.status,
            code: error?.code,
            type: error?.type,
            stack: error?.stack
        });
        // Return null on error - don't fail the whole process
        return null;
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
        await logger.started(supabase, userDocId, logger.STAGES.EXTRACT, 'Extracting text from PDF using pdf.js-extract');
        
        const { text, pages } = await extractPDFTextWithPageMarkers(pdfBuffer);
        
        await logger.completed(supabase, userDocId, null, logger.STAGES.EXTRACT, 'Text extracted successfully', {
            pages,
            characters: text.length,
            pdf_processor: 'pdf.js-extract'
        });
        
        // 4. Chunk text (do this before creating document so we can generate abstract)
        await logger.started(supabase, userDocId, logger.STAGES.CHUNK, 'Chunking text');
        
        const chunks = chunkText(text, CHUNK_SIZE, CHUNK_OVERLAP, pages);
        
        await logger.completed(supabase, userDocId, null, logger.STAGES.CHUNK, 'Text chunked successfully', {
            chunk_count: chunks.length,
            chunk_size: CHUNK_SIZE,
            overlap: CHUNK_OVERLAP
        });
        
        // 5. Generate AI abstract and keywords from chunks
        console.log('🎯 NEW CODE: About to generate AI abstract and keywords (Step 5 of processing)');
        await logger.progress(supabase, userDocId, null, logger.STAGES.CHUNK, 'Generating AI abstract and keywords');
        
        // Generate abstract and keywords in parallel (both use same model and chunks)
        const [abstract, keywords] = await Promise.all([
            generateAbstract(openaiClient, chunks, userDoc.title),
            generateKeywords(openaiClient, chunks, userDoc.title)
        ]);
        
        if (abstract) {
            await logger.progress(supabase, userDocId, null, logger.STAGES.CHUNK, 'Abstract generated successfully', {
                abstract_length: abstract.length,
                abstract_words: abstract.split(/\s+/).length
            });
        } else {
            await logger.progress(supabase, userDocId, null, logger.STAGES.CHUNK, 'Abstract generation skipped or failed');
        }
        
        if (keywords && keywords.length > 0) {
            await logger.progress(supabase, userDocId, null, logger.STAGES.CHUNK, 'Keywords generated successfully', {
                keyword_count: keywords.length
            });
        } else {
            await logger.progress(supabase, userDocId, null, logger.STAGES.CHUNK, 'Keyword generation skipped or failed');
        }
        
        // 6. Generate document slug (but don't create record yet - wait until processing is complete)
        documentSlug = generateSlug(userDoc.title);
        
        await logger.progress(supabase, userDocId, documentSlug, logger.STAGES.CHUNK, 'Document slug generated', {
            slug: documentSlug
        });
        
        // 7. Generate embeddings
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
            
            // Adaptive delay between batches (scales with concurrent processing load)
            if (i + BATCH_SIZE < chunks.length) {
                const delay = getAdaptiveBatchDelay();
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        const successfulEmbeddings = allEmbeddings.filter(e => e.embedding !== null).length;
        
        await logger.completed(supabase, userDocId, documentSlug, logger.STAGES.EMBED, 'Embeddings generated', {
            total: chunks.length,
            successful: successfulEmbeddings,
            failed: chunks.length - successfulEmbeddings
        });
        
        // 8. Create document record FIRST (before storing chunks that reference it)
        await logger.started(supabase, userDocId, logger.STAGES.COMPLETE, 'Creating document record');
        
        // Create intro message with abstract (if available)
        let introMessage = `Ask questions about ${userDoc.title}`;
        if (abstract) {
            introMessage = `<div class="document-abstract"><p><strong>Document Summary:</strong></p><p>${abstract}</p></div><p>Ask questions about this document below.</p>`;
        }
        
        // Check if user is super admin (global super admin has owner_id IS NULL)
        // Use service role client to bypass RLS for owner lookup
        const { createClient } = require('@supabase/supabase-js');
        const serviceSupabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        
        let ownerIdToSet = null;
        const { data: userRoles } = await serviceSupabase
            .from('user_roles')
            .select('role, owner_id')
            .eq('user_id', userDoc.user_id)
            .eq('role', 'super_admin');
        
        // Check if user is a global super admin (owner_id IS NULL)
        const isSuperAdmin = userRoles && userRoles.some(r => r.owner_id === null);
        
        if (!isSuperAdmin) {
            // Get user's owner group from user_owner_access (regular members)
            const { data: ownerAccess, error: ownerAccessError } = await serviceSupabase
                .from('user_owner_access')
                .select('owner_id')
                .eq('user_id', userDoc.user_id)
                .limit(1)
                .maybeSingle();
            
            if (!ownerAccessError && ownerAccess?.owner_id) {
                ownerIdToSet = ownerAccess.owner_id;
            } else {
                // Check user_roles for owner_admin or registered roles with owner_id
                const { data: userRolesWithOwner, error: rolesError } = await serviceSupabase
                    .from('user_roles')
                    .select('owner_id')
                    .eq('user_id', userDoc.user_id)
                    .not('owner_id', 'is', null)
                    .limit(1)
                    .maybeSingle();
                
                if (!rolesError && userRolesWithOwner?.owner_id) {
                    ownerIdToSet = userRolesWithOwner.owner_id;
                }
            }
        }
        // If super admin, ownerIdToSet remains null (can be set later in edit modal)
        
        const { error: docInsertError } = await supabase
            .from('documents')
            .insert({
                slug: documentSlug,
                title: userDoc.title,
                subtitle: null,
                welcome_message: `Ask questions about ${userDoc.title}`,
                intro_message: introMessage,
                pdf_filename: userDoc.file_path.split('/').pop(),
                pdf_subdirectory: 'user-uploads',
                embedding_type: 'openai',
                active: true,
                access_level: 'owner_restricted',
                owner_id: ownerIdToSet,
                uploaded_by_user_id: userDoc.user_id,
                metadata: {
                    user_document_id: userDocId,
                    user_id: userDoc.user_id,
                    uploaded_at: userDoc.created_at,
                    file_size: userDoc.file_size,
                    has_ai_abstract: abstract ? true : false,
                    keywords: keywords || null
                }
            });
        
        if (docInsertError) {
            throw new Error(`Failed to create document record: ${docInsertError.message}`);
        }
        
        await logger.progress(supabase, userDocId, documentSlug, logger.STAGES.COMPLETE, 'Document record created in documents table', {
            slug: documentSlug,
            has_abstract: abstract ? true : false
        });
        
        // 9. Store chunks in database (AFTER document record exists)
        await logger.started(supabase, userDocId, logger.STAGES.STORE, 'Storing chunks in database');
        
        const inserted = await storeChunks(supabase, documentSlug, userDoc.title, allEmbeddings);
        
        await logger.completed(supabase, userDocId, documentSlug, logger.STAGES.STORE, 'Chunks stored successfully', {
            chunks_stored: inserted
        });
        
        // 10. Update user_documents status to ready
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

/**
 * Reprocess an existing document with new PDF content
 * Similar to processUserDocument but updates existing document record instead of creating new one
 * 
 * @param {string} userDocId - ID of the user_documents record
 * @param {string} documentSlug - Existing document slug to preserve
 * @param {Object} supabase - Supabase client
 * @param {Object} openaiClient - OpenAI client
 * @returns {Object} Processing result
 */
async function reprocessDocument(userDocId, documentSlug, supabase, openaiClient) {
    const startTime = Date.now();
    
    try {
        // 1. Get user document record
        await logger.started(supabase, userDocId, logger.STAGES.DOWNLOAD, 'Starting document reprocessing');
        
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
        await logger.progress(supabase, userDocId, documentSlug, logger.STAGES.DOWNLOAD, 'Downloading PDF from storage', {
            file_path: userDoc.file_path,
            file_size: userDoc.file_size
        });
        
        const pdfBuffer = await downloadPDFFromStorage(supabase, userDoc.file_path);
        
        await logger.completed(supabase, userDocId, documentSlug, logger.STAGES.DOWNLOAD, 'PDF downloaded successfully', {
            buffer_size: pdfBuffer.length
        });
        
        // 3. Extract text from PDF
        await logger.started(supabase, userDocId, logger.STAGES.EXTRACT, 'Extracting text from PDF using pdf.js-extract');
        
        const { text, pages } = await extractPDFTextWithPageMarkers(pdfBuffer);
        
        await logger.completed(supabase, userDocId, documentSlug, logger.STAGES.EXTRACT, 'Text extracted successfully', {
            pages,
            characters: text.length,
            pdf_processor: 'pdf.js-extract'
        });
        
        // 4. Chunk text
        await logger.started(supabase, userDocId, logger.STAGES.CHUNK, 'Chunking text');
        
        const chunks = chunkText(text, CHUNK_SIZE, CHUNK_OVERLAP, pages);
        
        await logger.completed(supabase, userDocId, documentSlug, logger.STAGES.CHUNK, 'Text chunked successfully', {
            chunk_count: chunks.length,
            chunk_size: CHUNK_SIZE,
            overlap: CHUNK_OVERLAP
        });
        
        // 5. Generate AI abstract and keywords from chunks
        await logger.progress(supabase, userDocId, documentSlug, logger.STAGES.CHUNK, 'Generating AI abstract and keywords');
        
        const [abstract, keywords] = await Promise.all([
            generateAbstract(openaiClient, chunks, userDoc.title),
            generateKeywords(openaiClient, chunks, userDoc.title)
        ]);
        
        if (abstract) {
            await logger.progress(supabase, userDocId, documentSlug, logger.STAGES.CHUNK, 'Abstract generated successfully', {
                abstract_length: abstract.length
            });
        }
        
        if (keywords && keywords.length > 0) {
            await logger.progress(supabase, userDocId, documentSlug, logger.STAGES.CHUNK, 'Keywords generated successfully', {
                keyword_count: keywords.length
            });
        }
        
        // 6. Update existing document record with new abstract and keywords
        let introMessage = `Ask questions about ${userDoc.title}`;
        if (abstract) {
            introMessage = `<div class="document-abstract"><p><strong>Document Summary:</strong></p><p>${abstract}</p></div><p>Ask questions about this document below.</p>`;
        }
        
        // Get existing document to preserve other fields
        const { data: existingDoc } = await supabase
            .from('documents')
            .select('*')
            .eq('slug', documentSlug)
            .single();
        
        if (existingDoc) {
            // If document doesn't have owner_id, set it based on uploader (unless super admin)
            // Use service role client to bypass RLS for owner lookup
            const { createClient } = require('@supabase/supabase-js');
            const serviceSupabase = createClient(
                process.env.SUPABASE_URL,
                process.env.SUPABASE_SERVICE_ROLE_KEY
            );
            
            let ownerIdUpdate = existingDoc.owner_id;
            if (!existingDoc.owner_id) {
                // Check if user is super admin (global super admin has owner_id IS NULL)
                const { data: userRoles } = await serviceSupabase
                    .from('user_roles')
                    .select('role, owner_id')
                    .eq('user_id', userDoc.user_id)
                    .eq('role', 'super_admin');
                
                const isSuperAdmin = userRoles && userRoles.some(r => r.owner_id === null);
                
                if (!isSuperAdmin) {
                    // Get user's owner group from user_owner_access (regular members)
                    const { data: ownerAccess, error: ownerAccessError } = await serviceSupabase
                        .from('user_owner_access')
                        .select('owner_id')
                        .eq('user_id', userDoc.user_id)
                        .limit(1)
                        .maybeSingle();
                    
                    if (!ownerAccessError && ownerAccess?.owner_id) {
                        ownerIdUpdate = ownerAccess.owner_id;
                    } else {
                        // Check user_roles for owner_admin or registered roles with owner_id
                        const { data: userRolesWithOwner, error: rolesError } = await serviceSupabase
                            .from('user_roles')
                            .select('owner_id')
                            .eq('user_id', userDoc.user_id)
                            .not('owner_id', 'is', null)
                            .limit(1)
                            .maybeSingle();
                        
                        if (!rolesError && userRolesWithOwner?.owner_id) {
                            ownerIdUpdate = userRolesWithOwner.owner_id;
                        }
                    }
                }
                // If super admin, ownerIdUpdate remains null (can be set later in edit modal)
            }
            
            const updateData = {
                intro_message: introMessage,
                updated_at: new Date().toISOString(),
                metadata: {
                    ...existingDoc.metadata,
                    has_ai_abstract: abstract ? true : false,
                    keywords: keywords || null,
                    reprocessed_at: new Date().toISOString()
                }
            };
            
            // Only update owner_id if it was null and we found one to set
            if (!existingDoc.owner_id && ownerIdUpdate) {
                updateData.owner_id = ownerIdUpdate;
            }
            
            // Ensure uploaded_by_user_id is set (preserve if exists, set if missing)
            if (!existingDoc.uploaded_by_user_id) {
                updateData.uploaded_by_user_id = userDoc.user_id;
            }
            
            await supabase
                .from('documents')
                .update(updateData)
                .eq('slug', documentSlug);
            
            await logger.progress(supabase, userDocId, documentSlug, logger.STAGES.CHUNK, 'Document record updated', {
                slug: documentSlug,
                has_abstract: abstract ? true : false
            });
        }
        
        // 7. Generate embeddings
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
            
            // Adaptive delay between batches (scales with concurrent processing load)
            if (i + BATCH_SIZE < chunks.length) {
                const delay = getAdaptiveBatchDelay();
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        const successfulEmbeddings = allEmbeddings.filter(e => e.embedding !== null).length;
        
        await logger.completed(supabase, userDocId, documentSlug, logger.STAGES.EMBED, 'Embeddings generated', {
            total: chunks.length,
            successful: successfulEmbeddings,
            failed: chunks.length - successfulEmbeddings
        });
        
        // 8. Store chunks in database
        await logger.started(supabase, userDocId, logger.STAGES.STORE, 'Storing chunks in database');
        
        const inserted = await storeChunks(supabase, documentSlug, userDoc.title, allEmbeddings);
        
        await logger.completed(supabase, userDocId, documentSlug, logger.STAGES.STORE, 'Chunks stored successfully', {
            chunks_stored: inserted
        });
        
        // 9. Update user_documents status to ready
        await supabase
            .from('user_documents')
            .update({ 
                status: 'ready',
                updated_at: new Date().toISOString()
            })
            .eq('id', userDocId);
        
        const processingTime = Date.now() - startTime;
        
        await logger.completed(supabase, userDocId, documentSlug, logger.STAGES.COMPLETE, 'Reprocessing complete', {
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
        await logger.error(supabase, userDocId, documentSlug, 'Reprocessing failed', error);
        
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
    reprocessDocument,
    generateSlug,
    generateAbstract,
    generateKeywords,
    setActiveProcessingCount,
    CHUNK_SIZE,
    CHUNK_OVERLAP
};

