/**
 * Document Processor
 * Handles PDF processing, chunking, and embedding for user-uploaded documents
 * Refactored for maintainability and resilience with modular architecture
 */

const logger = require('./processing-logger');
const trainingLogger = require('./training-history-logger');

// Import new modules
const { config } = require('./config/document-processing');
const { ProcessingError, classifyError } = require('./errors/processing-errors');
const { validateProcessUserDocumentInputs, validateReprocessDocumentInputs } = require('./utils/input-validator');
const { createResourceCleanup } = require('./utils/resource-cleanup');
const { createTimeoutManager } = require('./utils/timeout-manager');
const { createRetryStrategy } = require('./utils/retry-strategy');
const { cleanupFailedProcessing, createCheckpoint } = require('./utils/error-recovery');

// Import processors
const { extractPDFTextWithPageMarkers, downloadPDFFromStorage } = require('./processors/pdf-extractor');
const { chunkText } = require('./processors/text-chunker');
const { processAllEmbeddings } = require('./processors/embedding-generator');
const { generateAbstractAndKeywords } = require('./processors/ai-content-generator');
const { storeChunks } = require('./processors/chunk-storage');

// Import database operations
const { resolveOwnerId, createServiceSupabaseClient, createDocumentRecord, updateDocumentRecord, getDocumentRecord } = require('./db/document-operations');
const { setProcessingStatus, setReadyStatus, setErrorStatus } = require('./db/status-operations');

/**
 * Track active processing for adaptive batch delays
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
 */
function getAdaptiveBatchDelay() {
    const loadMultiplier = Math.min(3, 1 + (activeProcessingCount * 0.5));
    return Math.round(config.embedding.baseDelayMs * loadMultiplier);
}

/**
 * Generate unique slug from title (kept for backward compatibility)
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
 * Refactored with comprehensive error handling, resource cleanup, and checkpoint recovery
 * 
 * @param {string} userDocId - ID of the user_documents record
 * @param {Object} supabase - Supabase client
 * @param {Object} openaiClient - OpenAI client
 * @returns {Object} Processing result with document slug and stats
 */
async function processUserDocument(userDocId, supabase, openaiClient) {
    const startTime = Date.now();
    let documentSlug = null;
    const stagesCompleted = [];
    const cleanup = createResourceCleanup();
    const timeoutManager = createTimeoutManager();
    const retryStrategy = createRetryStrategy(config.retry);
    
    // Register cleanup handlers
    cleanup.register(() => timeoutManager.cleanup(), 'timeout manager cleanup');
    
    try {
        // Validate inputs
        const validated = validateProcessUserDocumentInputs(userDocId, supabase, openaiClient);
        userDocId = validated.userDocId;
        supabase = validated.supabase;
        openaiClient = validated.openaiClient;
        
        // Stage 1: Get user document record
        // Log capacity status when processing starts (helps verify queue system is active)
        const { getProcessingLoad } = require('./utils/concurrency-manager');
        const loadInfo = getProcessingLoad();
        await logger.started(supabase, userDocId, logger.STAGES.DOWNLOAD, `Starting document processing (queue system active: ${loadInfo.active}/${loadInfo.max} jobs, ${loadInfo.available} available)`, {
            queue_system_active: true,
            current_load: loadInfo.active,
            max_capacity: loadInfo.max,
            available_slots: loadInfo.available,
            utilization_percent: loadInfo.utilizationPercent
        }, 'vps');
        
        const { data: userDoc, error: fetchError } = await supabase
            .from('user_documents')
            .select('*')
            .eq('id', userDocId)
            .single();
        
        if (fetchError || !userDoc) {
            throw new ProcessingError(`User document not found: ${userDocId}`, { userDocId, error: fetchError?.message });
        }
        
        // Update status to processing
        await setProcessingStatus(supabase, userDocId);
        stagesCompleted.push('statusUpdate');
        
        // Log training start
        const isTextUploadStart = (userDoc.file_path === 'text-upload' || userDoc.file_path === 'text-retrain') &&
                            userDoc.metadata?.text_content &&
                            (userDoc.metadata?.upload_type === 'text' || userDoc.metadata?.upload_type === 'text_retrain');
        const serviceSupabaseStart = createServiceSupabaseClient();
        await trainingLogger.started(serviceSupabaseStart, {
            documentId: null, // Will be set after document creation
            documentSlug: null, // Will be set after slug generation
            userId: userDoc.user_id,
            userDocumentId: userDocId,
            actionType: 'train',
            details: {
                uploadType: isTextUploadStart ? 'text' : 'pdf',
                fileName: userDoc.file_path !== 'text-upload' && userDoc.file_path !== 'text-retrain' ? userDoc.file_path : null,
                fileSize: userDoc.file_size || null
            }
        });
        
        // Stage 2: Get text content (either from uploaded PDF or direct text input)
        let text, pages;

        // Check if this is a text upload (placeholder file_path, has text_content in metadata)
        const isTextUpload = (userDoc.file_path === 'text-upload' || userDoc.file_path === 'text-retrain') &&
                            userDoc.metadata?.text_content &&
                            (userDoc.metadata?.upload_type === 'text' || userDoc.metadata?.upload_type === 'text_retrain');

        if (isTextUpload) {
            // Direct text input - no download or extraction needed
            await logger.progress(supabase, userDocId, null, logger.STAGES.DOWNLOAD, 'Processing direct text input', {
                character_count: userDoc.metadata.character_count,
                upload_type: 'text'
            }, 'vps');

            text = userDoc.metadata.text_content;
            pages = 1; // Treat as single page for text uploads

            await logger.completed(supabase, userDocId, null, logger.STAGES.DOWNLOAD, 'Text content loaded successfully', {
                characters: text.length,
                pages: pages,
                upload_type: 'text'
            }, 'vps');
            stagesCompleted.push('download');
        } else {
            // PDF upload - download and extract
            await logger.progress(supabase, userDocId, null, logger.STAGES.DOWNLOAD, 'Downloading PDF from storage', {
                file_path: userDoc.file_path,
                file_size: userDoc.file_size
            }, 'vps');

            const pdfBuffer = await downloadPDFFromStorage(supabase, userDoc.file_path);

            await logger.completed(supabase, userDocId, null, logger.STAGES.DOWNLOAD, 'PDF downloaded successfully', {
                buffer_size: pdfBuffer.length
            }, 'vps');
            stagesCompleted.push('download');

            // Stage 3: Extract text from PDF
            await logger.started(supabase, userDocId, logger.STAGES.EXTRACT, 'Extracting text from PDF using pdf.js-extract', {
                file_size: pdfBuffer.length,
                file_size_mb: (pdfBuffer.length / 1024 / 1024).toFixed(2)
            }, 'vps');

            let extractionResult;
            try {
                extractionResult = await extractPDFTextWithPageMarkers(pdfBuffer);
                text = extractionResult.text;
                pages = extractionResult.pages;
            } catch (extractError) {
                const errorMessage = extractError.message || 'Unknown extraction error';
                console.error(`❌ PDF extraction failed for ${userDocId}:`, errorMessage);
                await logger.failed(supabase, userDocId, null, logger.STAGES.EXTRACT, `PDF extraction failed: ${errorMessage}`, {
                    error: errorMessage,
                    file_size: pdfBuffer.length,
                    file_size_mb: (pdfBuffer.length / 1024 / 1024).toFixed(2)
                }, 'vps');
                throw extractError;
            }

            await logger.completed(supabase, userDocId, null, logger.STAGES.EXTRACT, 'Text extracted successfully', {
                pages,
                characters: text.length,
                pdf_processor: 'pdf.js-extract'
            }, 'vps');
            stagesCompleted.push('extract');
        }
        
        // Stage 4: Chunk text
        await logger.started(supabase, userDocId, logger.STAGES.CHUNK, 'Chunking text', {}, 'vps');
        
        const chunks = chunkText(text, config.chunking.size, config.chunking.overlap, pages);
        
        await logger.completed(supabase, userDocId, null, logger.STAGES.CHUNK, 'Text chunked successfully', {
            chunk_count: chunks.length,
            chunk_size: config.chunking.size,
            overlap: config.chunking.overlap
        }, 'vps');
        stagesCompleted.push('chunk');
        
        // Stage 5: Generate AI abstract and keywords (optional - graceful degradation)
        await logger.progress(supabase, userDocId, null, logger.STAGES.CHUNK, 'Generating AI abstract and keywords', {
            chunk_count: chunks.length
        }, 'vps');
        
        let abstract = null;
        let keywords = null;
        
        const aiGenerationStartTime = Date.now();
        try {
            console.log(`🤖 Starting AI generation for ${userDocId} (${chunks.length} chunks)`);
            const aiResult = await generateAbstractAndKeywords(
                openaiClient,
                chunks,
                userDoc.title,
                { timeoutManager, retryStrategy }
            );
            abstract = aiResult.abstract;
            keywords = aiResult.keywords;
            const aiGenerationTime = Date.now() - aiGenerationStartTime;
            console.log(`✅ AI generation completed in ${(aiGenerationTime / 1000).toFixed(1)}s`);
        } catch (error) {
            const aiGenerationTime = Date.now() - aiGenerationStartTime;
            // Graceful degradation - log but continue
            console.warn(`⚠️ AI generation failed after ${(aiGenerationTime / 1000).toFixed(1)}s, continuing without abstract/keywords:`, error.message);
            await logger.progress(supabase, userDocId, null, logger.STAGES.CHUNK, 'AI generation failed - continuing without abstract/keywords', {
                error: error.message,
                elapsed_ms: aiGenerationTime
            }, 'vps');
        }
        
        if (abstract) {
            await logger.progress(supabase, userDocId, null, logger.STAGES.CHUNK, 'Abstract generated successfully', {
                abstract_length: abstract.length,
                abstract_words: abstract.split(/\s+/).length
            }, 'vps');
        } else {
            await logger.progress(supabase, userDocId, null, logger.STAGES.CHUNK, 'Abstract generation skipped or failed', {}, 'vps');
        }
        
        if (keywords && keywords.length > 0) {
            // Check which method was used (if metadata exists)
            const method = keywords._method || 'unknown';
            if (keywords._method) {
                delete keywords._method; // Remove metadata before storing
            }
            await logger.progress(supabase, userDocId, null, logger.STAGES.CHUNK, 'Keywords generated successfully', {
                keyword_count: keywords.length,
                method: method
            }, 'vps');
        } else {
            await logger.progress(supabase, userDocId, null, logger.STAGES.CHUNK, 'Keyword generation skipped or failed', {}, 'vps');
        }
        
        // Stage 6: Generate document slug (use UUID as slug)
        documentSlug = userDocId;
        
        await logger.progress(supabase, userDocId, documentSlug, logger.STAGES.CHUNK, 'Document slug generated', {
            slug: documentSlug
        }, 'vps');
        
        // Stage 7: Generate embeddings
        await logger.started(supabase, userDocId, logger.STAGES.EMBED, 'Generating embeddings', {}, 'vps');
        
        const embeddingResult = await processAllEmbeddings(
            openaiClient,
            chunks,
            getAdaptiveBatchDelay,
            async (progress) => {
                await logger.progress(
                    supabase,
                    userDocId,
                    documentSlug,
                    logger.STAGES.EMBED,
                    `Processing batch ${progress.batch}/${progress.totalBatches}`,
                    {
                        batch: progress.batch,
                        total_batches: progress.totalBatches
                    },
                    'vps'
                );
            },
            { timeoutManager, retryStrategy }
        );
        
        const allEmbeddings = embeddingResult.successes.map(s => ({
            chunk: s.chunk,
            embedding: s.embedding
        }));
        
        await logger.completed(supabase, userDocId, documentSlug, logger.STAGES.EMBED, 'Embeddings generated', {
            total: chunks.length,
            successful: embeddingResult.successCount,
            failed: embeddingResult.failureCount
        }, 'vps');
        stagesCompleted.push('embed');
        
        // Stage 8: Create document record FIRST (before storing chunks that reference it)
        await logger.started(supabase, userDocId, logger.STAGES.COMPLETE, 'Creating document record', {}, 'vps');
        
        // Create service role client for database operations
        const serviceSupabaseCreate = createServiceSupabaseClient();
        
        // Resolve owner ID
        const ownerId = await resolveOwnerId(serviceSupabaseCreate, userDoc.user_id);
        
        // Create document record
        await createDocumentRecord(
            serviceSupabaseCreate,
            documentSlug,
            userDoc.title,
            userDoc.file_path,
            userDoc.user_id,
            ownerId,
            abstract,
            keywords,
            userDoc
        );
        
        // Get document_id for training history
        const { data: createdDoc } = await serviceSupabaseCreate
            .from('documents')
            .select('id')
            .eq('slug', documentSlug)
            .single();
        
        await logger.progress(supabase, userDocId, documentSlug, logger.STAGES.COMPLETE, 'Document record created in documents table', {
            slug: documentSlug,
            has_abstract: abstract ? true : false
        }, 'vps');
        stagesCompleted.push('createDocument');
        
        // Stage 9: Store chunks in database (AFTER document record exists)
        await logger.started(supabase, userDocId, logger.STAGES.STORE, 'Storing chunks in database', {}, 'vps');
        
        const inserted = await storeChunks(
            serviceSupabase,
            documentSlug,
            userDoc.title,
            allEmbeddings,
            { retryStrategy }
        );
        
        await logger.completed(supabase, userDocId, documentSlug, logger.STAGES.STORE, 'Chunks stored successfully', {
            chunks_stored: inserted
        }, 'vps');
        stagesCompleted.push('store');
        
        // Stage 10: Update user_documents status to ready
        await setReadyStatus(serviceSupabase, userDocId);
        
        const processingTime = Date.now() - startTime;
        
        await logger.completed(supabase, userDocId, documentSlug, logger.STAGES.COMPLETE, 'Processing complete', {
            processing_time_ms: processingTime,
            document_slug: documentSlug,
            pages,
            chunks: inserted
        }, 'vps');
        
        // Log training completion
        const isTextUploadComplete = (userDoc.file_path === 'text-upload' || userDoc.file_path === 'text-retrain') &&
                            userDoc.metadata?.text_content &&
                            (userDoc.metadata?.upload_type === 'text' || userDoc.metadata?.upload_type === 'text_retrain');
        await trainingLogger.completed(serviceSupabaseCreate, {
            documentId: createdDoc?.id || null,
            documentSlug: documentSlug,
            userId: userDoc.user_id,
            userDocumentId: userDocId,
            actionType: 'train',
            details: {
                uploadType: isTextUploadComplete ? 'text' : 'pdf',
                fileName: userDoc.file_path !== 'text-upload' && userDoc.file_path !== 'text-retrain' ? userDoc.file_path : null,
                fileSize: userDoc.file_size || null,
                chunkCount: inserted,
                processingTimeMs: processingTime
            }
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
        // Classify error
        const classifiedError = classifyError(error, {
            userDocId,
            documentSlug,
            stagesCompleted
        });
        
        // Log error
        await logger.error(supabase, userDocId, documentSlug, 'Processing failed', classifiedError, {}, 'vps');
        
        // Log training failure
        try {
            const { data: userDoc } = await supabase
                .from('user_documents')
                .select('user_id, file_path, file_size, metadata')
                .eq('id', userDocId)
                .single();
            
            if (userDoc) {
                const isTextUploadFail = (userDoc.file_path === 'text-upload' || userDoc.file_path === 'text-retrain') &&
                                    userDoc.metadata?.text_content &&
                                    (userDoc.metadata?.upload_type === 'text' || userDoc.metadata?.upload_type === 'text_retrain');
                const serviceSupabaseFail = createServiceSupabaseClient();
                const { data: docRecord } = await serviceSupabaseFail
                    .from('documents')
                    .select('id')
                    .eq('slug', documentSlug)
                    .single();
                
                await trainingLogger.failed(serviceSupabaseFail, {
                    documentId: docRecord?.id || null,
                    documentSlug: documentSlug || null,
                    userId: userDoc.user_id,
                    userDocumentId: userDocId,
                    actionType: 'train',
                    details: {
                        uploadType: isTextUploadFail ? 'text' : 'pdf',
                        fileName: userDoc.file_path !== 'text-upload' && userDoc.file_path !== 'text-retrain' ? userDoc.file_path : null,
                        fileSize: userDoc.file_size || null,
                        errorMessage: classifiedError.message
                    }
                });
            }
        } catch (logError) {
            console.error('⚠️ Failed to log training failure:', logError.message);
        }
        
        // Cleanup failed processing
        if (documentSlug && stagesCompleted.includes('createDocument')) {
            try {
                await cleanupFailedProcessing(supabase, userDocId, documentSlug, stagesCompleted);
            } catch (cleanupError) {
                console.error('⚠️ Cleanup failed:', cleanupError.message);
            }
        }
        
        // Update user_documents status to error
        try {
            await setErrorStatus(supabase, userDocId, classifiedError.message);
        } catch (statusError) {
            console.error('⚠️ Failed to update error status:', statusError.message);
        }
        
        throw classifiedError;
        
    } finally {
        // GUARANTEED cleanup
        cleanup.execute();
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
async function reprocessDocument(userDocId, documentSlug, supabase, openaiClient, retrainMode = 'replace') {
    const startTime = Date.now();
    const cleanup = createResourceCleanup();
    const timeoutManager = createTimeoutManager();
    const retryStrategy = createRetryStrategy(config.retry);
    
    // Register cleanup handlers
    cleanup.register(() => timeoutManager.cleanup(), 'timeout manager cleanup');
    
    try {
        // Validate inputs
        const validated = validateReprocessDocumentInputs(userDocId, documentSlug, supabase, openaiClient);
        userDocId = validated.userDocId;
        documentSlug = validated.documentSlug;
        supabase = validated.supabase;
        openaiClient = validated.openaiClient;
        
        // Validate retrainMode
        if (retrainMode !== 'replace' && retrainMode !== 'add') {
            throw new ProcessingError(`Invalid retrainMode: ${retrainMode}. Must be 'replace' or 'add'`, { retrainMode });
        }
        
        // Stage 1: Get user document record
        // Log capacity status when reprocessing starts (helps verify queue system is active)
        const { getProcessingLoad } = require('./utils/concurrency-manager');
        const loadInfo = getProcessingLoad();
        await logger.started(supabase, userDocId, logger.STAGES.DOWNLOAD, `Starting document reprocessing (queue system active: ${loadInfo.active}/${loadInfo.max} jobs, ${loadInfo.available} available)`, {
            queue_system_active: true,
            current_load: loadInfo.active,
            max_capacity: loadInfo.max,
            available_slots: loadInfo.available,
            utilization_percent: loadInfo.utilizationPercent
        }, 'vps');
        
        const { data: userDoc, error: fetchError } = await supabase
            .from('user_documents')
            .select('*')
            .eq('id', userDocId)
            .single();
        
        if (fetchError || !userDoc) {
            throw new ProcessingError(`User document not found: ${userDocId}`, { userDocId, error: fetchError?.message });
        }
        
        // Get document_id for training history
        const serviceSupabaseRetrain = createServiceSupabaseClient();
        const { data: docRecord } = await serviceSupabaseRetrain
            .from('documents')
            .select('id')
            .eq('slug', documentSlug)
            .single();
        
        // Log retraining start
        const isTextUploadRetrain = (userDoc.file_path === 'text-upload' || userDoc.file_path === 'text-retrain') &&
                            userDoc.metadata?.text_content &&
                            (userDoc.metadata?.upload_type === 'text' || userDoc.metadata?.upload_type === 'text_retrain');
        const actionTypeRetrain = retrainMode === 'add' ? 'retrain_add' : 'retrain_replace';
        
        // Get existing chunk count for "add" mode
        let existingChunkCount = null;
        if (retrainMode === 'add') {
            const { getMaxChunkIndex } = require('./processors/chunk-storage');
            const maxIndex = await getMaxChunkIndex(serviceSupabaseRetrain, documentSlug);
            existingChunkCount = maxIndex + 1; // +1 because indices are 0-based
        }
        
        await trainingLogger.started(serviceSupabaseRetrain, {
            documentId: docRecord?.id || null,
            documentSlug: documentSlug,
            userId: userDoc.user_id,
            userDocumentId: userDocId,
            actionType: actionTypeRetrain,
            details: {
                uploadType: isTextUploadRetrain ? 'text' : 'pdf',
                retrainMode: retrainMode,
                fileName: userDoc.file_path !== 'text-upload' && userDoc.file_path !== 'text-retrain' ? userDoc.file_path : null,
                fileSize: userDoc.file_size || null,
                existingChunkCount: existingChunkCount
            }
        });
        
        // Update status to processing
        await setProcessingStatus(supabase, userDocId);
        
        // Stage 2: Get text content (either from uploaded PDF or direct text input)
        let text, pages;

        // Check if this is a text upload (placeholder file_path, has text_content in metadata)
        const isTextUpload = (userDoc.file_path === 'text-upload' || userDoc.file_path === 'text-retrain') &&
                            userDoc.metadata?.text_content &&
                            (userDoc.metadata?.upload_type === 'text' || userDoc.metadata?.upload_type === 'text_retrain');

        if (isTextUpload) {
            // Direct text input - no download or extraction needed
            await logger.progress(supabase, userDocId, documentSlug, logger.STAGES.DOWNLOAD, 'Processing direct text input', {
                character_count: userDoc.metadata.character_count,
                upload_type: 'text'
            }, 'vps');

            text = userDoc.metadata.text_content;
            pages = 1; // Treat as single page for text uploads

            await logger.completed(supabase, userDocId, documentSlug, logger.STAGES.DOWNLOAD, 'Text content loaded successfully', {
                characters: text.length,
                pages: pages,
                upload_type: 'text'
            }, 'vps');
        } else {
            // PDF upload - download and extract
            await logger.progress(supabase, userDocId, documentSlug, logger.STAGES.DOWNLOAD, 'Downloading PDF from storage', {
                file_path: userDoc.file_path,
                file_size: userDoc.file_size
            }, 'vps');

            const pdfBuffer = await downloadPDFFromStorage(supabase, userDoc.file_path);

            await logger.completed(supabase, userDocId, documentSlug, logger.STAGES.DOWNLOAD, 'PDF downloaded successfully', {
                buffer_size: pdfBuffer.length
            }, 'vps');

            // Stage 3: Extract text from PDF
            await logger.started(supabase, userDocId, logger.STAGES.EXTRACT, 'Extracting text from PDF using pdf.js-extract', {
                file_size: pdfBuffer.length,
                file_size_mb: (pdfBuffer.length / 1024 / 1024).toFixed(2)
            }, 'vps');

            let extractionResult;
            try {
                extractionResult = await extractPDFTextWithPageMarkers(pdfBuffer);
                text = extractionResult.text;
                pages = extractionResult.pages;
            } catch (extractError) {
                const errorMessage = extractError.message || 'Unknown extraction error';
                console.error(`❌ PDF extraction failed for ${userDocId}:`, errorMessage);
                await logger.failed(supabase, userDocId, documentSlug, logger.STAGES.EXTRACT, `PDF extraction failed: ${errorMessage}`, {
                    error: errorMessage,
                    file_size: pdfBuffer.length,
                    file_size_mb: (pdfBuffer.length / 1024 / 1024).toFixed(2)
                }, 'vps');
                throw extractError;
            }

            await logger.completed(supabase, userDocId, documentSlug, logger.STAGES.EXTRACT, 'Text extracted successfully', {
                pages,
                characters: text.length,
                pdf_processor: 'pdf.js-extract'
            }, 'vps');
        }

        // Stage 4: Chunk text
        await logger.started(supabase, userDocId, logger.STAGES.CHUNK, 'Chunking text', {}, 'vps');
        
        const chunks = chunkText(text, config.chunking.size, config.chunking.overlap, pages);
        
        await logger.completed(supabase, userDocId, documentSlug, logger.STAGES.CHUNK, 'Text chunked successfully', {
            chunk_count: chunks.length,
            chunk_size: config.chunking.size,
            overlap: config.chunking.overlap
        }, 'vps');
        
        // Stage 4.5: Handle "add" mode - fetch existing chunks and offset indices
        const serviceSupabase = createServiceSupabaseClient();
        let existingChunks = [];
        let maxChunkIndex = -1;
        let offsetChunks = chunks;
        
        if (retrainMode === 'add') {
            await logger.progress(supabase, userDocId, documentSlug, logger.STAGES.CHUNK, 'Fetching existing chunks for incremental retraining', {}, 'vps');
            
            const { getChunksForDocument, getMaxChunkIndex, convertDbChunksToAIFormat } = require('./db/chunk-operations');
            existingChunks = await getChunksForDocument(serviceSupabase, documentSlug);
            maxChunkIndex = await getMaxChunkIndex(serviceSupabase, documentSlug);
            
            await logger.progress(supabase, userDocId, documentSlug, logger.STAGES.CHUNK, `Found ${existingChunks.length} existing chunks (max index: ${maxChunkIndex})`, {
                existing_chunk_count: existingChunks.length,
                max_chunk_index: maxChunkIndex
            }, 'vps');
            
            // Offset new chunk indices to start after highest existing index
            offsetChunks = chunks.map(chunk => ({
                ...chunk,
                index: maxChunkIndex + 1 + chunk.index
            }));
            
            await logger.progress(supabase, userDocId, documentSlug, logger.STAGES.CHUNK, `Offset new chunks to start at index ${maxChunkIndex + 1}`, {
                new_chunk_start_index: maxChunkIndex + 1,
                new_chunk_count: offsetChunks.length
            }, 'vps');
        }
        
        // Stage 5: Generate AI abstract and keywords
        await logger.progress(supabase, userDocId, documentSlug, logger.STAGES.CHUNK, 'Generating AI abstract and keywords', {}, 'vps');
        
        let abstract = null;
        let keywords = null;
        
        try {
            // For "add" mode, combine existing and new chunks for abstract/keyword generation
            let chunksForAI = offsetChunks;
            if (retrainMode === 'add' && existingChunks.length > 0) {
                const { convertDbChunksToAIFormat } = require('./db/chunk-operations');
                const existingChunksForAI = convertDbChunksToAIFormat(existingChunks);
                chunksForAI = [...existingChunksForAI, ...offsetChunks];
                
                await logger.progress(supabase, userDocId, documentSlug, logger.STAGES.CHUNK, `Generating abstract/keywords from combined chunks (${existingChunksForAI.length} existing + ${offsetChunks.length} new)`, {
                    total_chunks_for_ai: chunksForAI.length,
                    existing_chunks: existingChunksForAI.length,
                    new_chunks: offsetChunks.length
                }, 'vps');
            }
            
            const aiResult = await generateAbstractAndKeywords(
                openaiClient,
                chunksForAI,
                userDoc.title,
                { timeoutManager, retryStrategy }
            );
            abstract = aiResult.abstract;
            keywords = aiResult.keywords;
        } catch (error) {
            console.warn('⚠️ AI generation failed, continuing without abstract/keywords:', error.message);
        }
        
        if (abstract) {
            await logger.progress(supabase, userDocId, documentSlug, logger.STAGES.CHUNK, 'Abstract generated successfully', {
                abstract_length: abstract.length
            }, 'vps');
        }
        
        if (keywords && keywords.length > 0) {
            // Check which method was used (if metadata exists)
            const method = keywords._method || 'unknown';
            if (keywords._method) {
                delete keywords._method; // Remove metadata before storing
            }
            await logger.progress(supabase, userDocId, documentSlug, logger.STAGES.CHUNK, 'Keywords generated successfully', {
                keyword_count: keywords.length,
                method: method
            }, 'vps');
        } else {
            await logger.progress(supabase, userDocId, documentSlug, logger.STAGES.CHUNK, 'Keyword generation skipped or failed', {
                keywords_value: keywords ? 'empty_array' : 'null'
            }, 'vps');
        }
        
        // Stage 6: Update existing document record
        const existingDoc = await getDocumentRecord(serviceSupabase, documentSlug);
        
        if (existingDoc) {
            // Resolve owner ID if needed
            let ownerIdUpdate = existingDoc.owner_id;
            if (!existingDoc.owner_id) {
                ownerIdUpdate = await resolveOwnerId(serviceSupabase, userDoc.user_id);
            }
            
            // Create intro message
            let introMessage = `Ask questions about ${userDoc.title}`;
            if (abstract) {
                introMessage = `<div class="document-abstract"><p><strong>Document Summary:</strong></p><p>${abstract}</p></div><p>Ask questions about this document below.</p>`;
            }
            
            // Preserve upload_type from user_documents metadata and disable references for text uploads
            const uploadType = userDoc.metadata?.upload_type || null;
            const shouldDisableReferences = isTextUpload;
            
            const updateData = {
                intro_message: introMessage,
                show_references: shouldDisableReferences ? false : existingDoc.show_references, // Disable for text, preserve for PDF
                metadata: {
                    ...existingDoc.metadata,
                    has_ai_abstract: abstract ? true : false,
                    keywords: keywords || null,
                    reprocessed_at: new Date().toISOString(),
                    upload_type: uploadType // Preserve upload_type from user_documents
                }
            };
            
            if (!existingDoc.owner_id && ownerIdUpdate) {
                updateData.owner_id = ownerIdUpdate;
            }
            
            if (!existingDoc.uploaded_by_user_id) {
                updateData.uploaded_by_user_id = userDoc.user_id;
            }
            
            await updateDocumentRecord(serviceSupabase, documentSlug, updateData);
            
            await logger.progress(supabase, userDocId, documentSlug, logger.STAGES.CHUNK, 'Document record updated', {
                slug: documentSlug,
                has_abstract: abstract ? true : false
            }, 'vps');
        }
        
        // Stage 7: Generate embeddings
        await logger.started(supabase, userDocId, logger.STAGES.EMBED, 'Generating embeddings', {}, 'vps');
        
        // Generate embeddings from original chunks (content-based)
        const embeddingResult = await processAllEmbeddings(
            openaiClient,
            chunks,
            getAdaptiveBatchDelay,
            async (progress) => {
                await logger.progress(
                    supabase,
                    userDocId,
                    documentSlug,
                    logger.STAGES.EMBED,
                    `Processing batch ${progress.batch}/${progress.totalBatches}`,
                    {
                        batch: progress.batch,
                        total_batches: progress.totalBatches
                    },
                    'vps'
                );
            },
            { timeoutManager, retryStrategy }
        );
        
        // Map embeddings to offset chunks (for "add" mode, use offset indices)
        const allEmbeddings = embeddingResult.successes.map((s, idx) => {
            // Use the corresponding offset chunk (same position in array)
            const offsetChunk = offsetChunks[idx] || s.chunk;
            return {
                chunk: offsetChunk,
                embedding: s.embedding
            };
        });
        
        await logger.completed(supabase, userDocId, documentSlug, logger.STAGES.EMBED, 'Embeddings generated', {
            total: chunks.length,
            successful: embeddingResult.successCount,
            failed: embeddingResult.failureCount
        }, 'vps');
        
        // Stage 8: Store chunks in database
        await logger.started(supabase, userDocId, logger.STAGES.STORE, retrainMode === 'add' ? 'Adding chunks to existing chunks' : 'Storing chunks in database', {}, 'vps');
        
        // Only delete old chunks if in "replace" mode
        if (retrainMode === 'replace') {
            const { deleteChunksForDocument } = require('./processors/chunk-storage');
            await deleteChunksForDocument(serviceSupabase, documentSlug);
        }
        
        // Enable index conflict handling for "add" mode
        const inserted = await storeChunks(
            serviceSupabase,
            documentSlug,
            userDoc.title,
            allEmbeddings,
            { 
                retryStrategy,
                handleIndexConflict: retrainMode === 'add' // Enable race condition handling
            }
        );
        
        await logger.completed(supabase, userDocId, documentSlug, logger.STAGES.STORE, 'Chunks stored successfully', {
            chunks_stored: inserted
        }, 'vps');
        
        // Stage 9: Update user_documents status to ready
        await setReadyStatus(serviceSupabase, userDocId);
        
        const processingTime = Date.now() - startTime;
        
        await logger.completed(supabase, userDocId, documentSlug, logger.STAGES.COMPLETE, 'Reprocessing complete', {
            processing_time_ms: processingTime,
            document_slug: documentSlug,
            pages,
            chunks: inserted
        }, 'vps');
        
        // Log retraining completion
        const isTextUploadRetrainComplete = (userDoc.file_path === 'text-upload' || userDoc.file_path === 'text-retrain') &&
                            userDoc.metadata?.text_content &&
                            (userDoc.metadata?.upload_type === 'text' || userDoc.metadata?.upload_type === 'text_retrain');
        const actionTypeRetrainComplete = retrainMode === 'add' ? 'retrain_add' : 'retrain_replace';
        await trainingLogger.completed(serviceSupabaseRetrain, {
            documentId: docRecord?.id || null,
            documentSlug: documentSlug,
            userId: userDoc.user_id,
            userDocumentId: userDocId,
            actionType: actionTypeRetrainComplete,
            details: {
                uploadType: isTextUploadRetrainComplete ? 'text' : 'pdf',
                retrainMode: retrainMode,
                fileName: userDoc.file_path !== 'text-upload' && userDoc.file_path !== 'text-retrain' ? userDoc.file_path : null,
                fileSize: userDoc.file_size || null,
                chunkCount: inserted,
                existingChunkCount: existingChunkCount,
                processingTimeMs: processingTime
            }
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
        // Classify error
        const classifiedError = classifyError(error, {
            userDocId,
            documentSlug
        });
        
        // Log error
        await logger.error(supabase, userDocId, documentSlug, 'Reprocessing failed', classifiedError, {}, 'vps');
        
        // Log retraining failure
        try {
            const { data: userDoc } = await supabase
                .from('user_documents')
                .select('user_id, file_path, file_size, metadata')
                .eq('id', userDocId)
                .single();
            
            if (userDoc) {
                const isTextUploadRetrainFail = (userDoc.file_path === 'text-upload' || userDoc.file_path === 'text-retrain') &&
                                    userDoc.metadata?.text_content &&
                                    (userDoc.metadata?.upload_type === 'text' || userDoc.metadata?.upload_type === 'text_retrain');
                const serviceSupabaseRetrainFail = createServiceSupabaseClient();
                const { data: docRecordFail } = await serviceSupabaseRetrainFail
                    .from('documents')
                    .select('id')
                    .eq('slug', documentSlug)
                    .single();
                
                const actionTypeRetrainFail = retrainMode === 'add' ? 'retrain_add' : 'retrain_replace';
                await trainingLogger.failed(serviceSupabaseRetrainFail, {
                    documentId: docRecordFail?.id || null,
                    documentSlug: documentSlug || null,
                    userId: userDoc.user_id,
                    userDocumentId: userDocId,
                    actionType: actionTypeRetrainFail,
                    details: {
                        uploadType: isTextUploadRetrainFail ? 'text' : 'pdf',
                        retrainMode: retrainMode,
                        fileName: userDoc.file_path !== 'text-upload' && userDoc.file_path !== 'text-retrain' ? userDoc.file_path : null,
                        fileSize: userDoc.file_size || null,
                        errorMessage: classifiedError.message
                    }
                });
            }
        } catch (logError) {
            console.error('⚠️ Failed to log retraining failure:', logError.message);
        }
        
        // Update user_documents status to error
        try {
            await setErrorStatus(supabase, userDocId, classifiedError.message);
        } catch (statusError) {
            console.error('⚠️ Failed to update error status:', statusError.message);
        }
        
        throw classifiedError;
        
    } finally {
        // GUARANTEED cleanup
        cleanup.execute();
    }
}

// Export for backward compatibility
module.exports = {
    processUserDocument,
    reprocessDocument,
    generateSlug,
    setActiveProcessingCount,
    CHUNK_SIZE: config.chunking.size,
    CHUNK_OVERLAP: config.chunking.overlap
};

// Re-export AI functions for backward compatibility
const { generateAbstract, generateKeywords } = require('./processors/ai-content-generator');
module.exports.generateAbstract = generateAbstract;
module.exports.generateKeywords = generateKeywords;
