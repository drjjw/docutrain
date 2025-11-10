/**
 * Quiz Generator
 * Generates multiple-choice quiz questions from document chunks using OpenAI
 */

const { config } = require('../config/document-processing');
const { createRetryStrategy } = require('../utils/retry-strategy');
const { createTimeoutManager } = require('../utils/timeout-manager');
const { ProcessingError } = require('../errors/processing-errors');
const { validateOpenAIClient, validateChunks, sanitizeString } = require('../utils/input-validator');
const { debugLog } = require('../utils/debug');

/**
 * Generate quiz questions from chunks using OpenAI
 * 
 * @param {Object} openaiClient - OpenAI client instance
 * @param {Array} chunks - Array of chunk objects with content
 * @param {string} documentTitle - Document title
 * @param {number} numQuestions - Number of questions to generate (default: 5)
 * @param {Object} options - Options (timeout manager, retry strategy, processingLogger, supabase, documentSlug)
 * @returns {Promise<Array|null>} Array of question objects or null if generation fails
 */
async function generateQuizQuestions(openaiClient, chunks, documentTitle, numQuestions = 5, options = {}) {
    const timeoutManager = options.timeoutManager || createTimeoutManager();
    const shouldCleanup = !options.timeoutManager;
    const retryStrategy = options.retryStrategy || createRetryStrategy(config.retry);
    const processingLogger = options.processingLogger;
    const supabase = options.supabase;
    const documentSlug = options.documentSlug;
    
    // Validate inputs
    validateOpenAIClient(openaiClient);
    validateChunks(chunks, 'chunks');
    
    if (!Number.isInteger(numQuestions) || numQuestions < 1 || numQuestions > 100) {
        throw new Error('numQuestions must be an integer between 1 and 100');
    }
    
    const sanitizedTitle = sanitizeString(documentTitle, 'documentTitle');
    const chunkCount = chunks.length;
    
    debugLog('📝 Generating quiz questions');
    debugLog(`   Document: ${sanitizedTitle}`);
    debugLog(`   Chunks available: ${chunkCount}`);
    debugLog(`   Questions requested: ${numQuestions}`);
    
    if (chunkCount === 0) {
        console.error('⚠️ No chunks available for quiz generation');
        return null;
    }
    
    // For large question sets (>20), use batching to avoid timeouts
    const BATCH_SIZE = 20; // Generate 20 questions per batch
    const useBatching = numQuestions > BATCH_SIZE;
    
    if (useBatching) {
        const numBatches = Math.ceil(numQuestions / BATCH_SIZE);
        console.log(`📝 Using batched generation: ${numBatches} batches of ~${BATCH_SIZE} questions each`);
        debugLog(`   Using batched generation: ${Math.ceil(numQuestions / BATCH_SIZE)} batches of ~${BATCH_SIZE} questions each`);
        return await generateQuizQuestionsBatched(
            openaiClient,
            chunks,
            sanitizedTitle,
            numQuestions,
            BATCH_SIZE,
            retryStrategy,
            timeoutManager,
            processingLogger,
            supabase,
            documentSlug
        );
    } else {
        // Single batch for smaller question sets
        console.log(`📝 Using single batch generation for ${numQuestions} questions`);
        return await generateQuizQuestionsSingle(
            openaiClient,
            chunks,
            sanitizedTitle,
            numQuestions,
            retryStrategy,
            timeoutManager
        );
    }
}

/**
 * Generate quiz questions in a single API call (for smaller question sets)
 */
async function generateQuizQuestionsSingle(openaiClient, chunks, documentTitle, numQuestions, retryStrategy, timeoutManager) {
    // Calculate timeout based on number of questions and chunks
    const baseTimeoutMs = 30 * 1000; // 30 seconds base
    const perQuestionTimeoutMs = 5 * 1000; // 5 seconds per question
    const perChunkTimeoutMs = 1 * 1000; // 1 second per chunk
    const calculatedTimeoutMs = baseTimeoutMs + (numQuestions * perQuestionTimeoutMs) + (chunks.length * perChunkTimeoutMs);
    const maxTimeoutMs = 5 * 60 * 1000; // Cap at 5 minutes
    const finalTimeoutMs = Math.min(Math.max(calculatedTimeoutMs, baseTimeoutMs), maxTimeoutMs);
    
    debugLog(`   Timeout: ${(finalTimeoutMs / 1000).toFixed(1)}s`);
    
    try {
        // Combine chunk content
        const combinedText = chunks
            .map(chunk => chunk.content || '')
            .filter(content => content && content.trim().length > 0)
            .join('\n\n');
        
        if (!combinedText || combinedText.trim().length === 0) {
            console.error('⚠️ No valid chunk content available');
            return null;
        }
        
        // Truncate if too long (leave room for prompt and response)
        const maxChars = config.ai.maxChars || 400000;
        const textForQuiz = combinedText.length > maxChars 
            ? combinedText.substring(0, maxChars) + '...'
            : combinedText;
        
        // Generate questions with retry and timeout protection
        const questions = await retryStrategy.execute(async () => {
            return await makeQuizAPIRequest(
                openaiClient,
                textForQuiz,
                documentTitle,
                numQuestions,
                finalTimeoutMs
            );
        }, {
            operationName: 'quiz generation',
            maxRetries: config.retry.maxRetries
        }).catch((error) => {
            const errorMessage = error.message || 'Unknown error';
            console.error(`⚠️ Failed to generate quiz questions after retries: ${errorMessage}`);
            throw new Error(`Quiz generation failed: ${errorMessage}`);
        });
        
        return questions;
        
    } catch (error) {
        const errorMessage = error.message || 'Unknown error';
        console.error(`⚠️ Failed to generate quiz questions: ${errorMessage}`);
        throw new Error(`Quiz generation failed: ${errorMessage}`);
    }
}

/**
 * Generate quiz questions in batches (for larger question sets)
 * Uses parallel processing with concurrency limit for efficiency
 */
async function generateQuizQuestionsBatched(openaiClient, chunks, documentTitle, numQuestions, batchSize, retryStrategy, timeoutManager, processingLogger, supabase, documentSlug) {
    const numBatches = Math.ceil(numQuestions / batchSize);
    console.log(`📝 Generating ${numQuestions} questions in ${numBatches} batches`);
    debugLog(`   Generating ${numQuestions} questions in ${numBatches} batches`);
    
    // Log to document-processing.log if processingLogger is available
    if (processingLogger && supabase && documentSlug) {
        await processingLogger.progress(supabase, null, documentSlug, processingLogger.STAGES.QUIZ, processingLogger.STATUSES.PROGRESS,
            `Starting batched generation: ${numQuestions} questions in ${numBatches} batches`, { numQuestions, numBatches });
    }
    
    // Distribute chunks across batches (round-robin to ensure diversity)
    const chunkBatches = [];
    for (let i = 0; i < numBatches; i++) {
        chunkBatches.push([]);
    }
    
    chunks.forEach((chunk, index) => {
        chunkBatches[index % numBatches].push(chunk);
    });
    
    // Process batches in parallel with concurrency limit (2-3 at a time)
    // This is faster than sequential but safer than all-at-once
    const CONCURRENCY_LIMIT = 3; // Process up to 3 batches concurrently
    const allQuestions = [];
    const errors = [];
    
    // Create batch tasks
    const batchTasks = [];
    for (let batchIndex = 0; batchIndex < numBatches; batchIndex++) {
        const batchChunks = chunkBatches[batchIndex];
        const questionsInBatch = batchIndex === numBatches - 1 
            ? numQuestions - (batchIndex * batchSize) // Last batch gets remainder
            : batchSize;
        
        batchTasks.push({
            batchIndex,
            batchChunks,
            questionsInBatch
        });
    }
    
    // Process batches with concurrency limit
    const startTime = Date.now();
    for (let i = 0; i < batchTasks.length; i += CONCURRENCY_LIMIT) {
        const batchGroup = batchTasks.slice(i, i + CONCURRENCY_LIMIT);
        const batchGroupStart = i + 1;
        const batchGroupEnd = Math.min(i + CONCURRENCY_LIMIT, batchTasks.length);
        
        console.log(`📝 Processing batches ${batchGroupStart}-${batchGroupEnd}/${numBatches} (${batchGroup.length} concurrent)`);
        
        // Log batch group start to document-processing.log
        if (processingLogger && supabase && documentSlug) {
            await processingLogger.progress(supabase, null, documentSlug, processingLogger.STAGES.QUIZ, processingLogger.STATUSES.PROGRESS,
                `Processing batches ${batchGroupStart}-${batchGroupEnd}/${numBatches} (${batchGroup.length} concurrent)`, 
                { batchGroupStart, batchGroupEnd, numBatches, concurrent: batchGroup.length });
        }
        
        const batchPromises = batchGroup.map(async ({ batchIndex, batchChunks, questionsInBatch }) => {
            console.log(`📝 Batch ${batchIndex + 1}/${numBatches}: Generating ${questionsInBatch} questions from ${batchChunks.length} chunks`);
            debugLog(`   Batch ${batchIndex + 1}/${numBatches}: Generating ${questionsInBatch} questions from ${batchChunks.length} chunks`);
            
            // Log individual batch start to document-processing.log
            if (processingLogger && supabase && documentSlug) {
                await processingLogger.progress(supabase, null, documentSlug, processingLogger.STAGES.QUIZ, processingLogger.STATUSES.PROGRESS,
                    `Batch ${batchIndex + 1}/${numBatches}: Generating ${questionsInBatch} questions`, 
                    { batchIndex: batchIndex + 1, numBatches, questionsInBatch, chunks: batchChunks.length });
            }
            
            try {
                const batchQuestions = await generateQuizQuestionsSingle(
                    openaiClient,
                    batchChunks,
                    documentTitle,
                    questionsInBatch,
                    retryStrategy,
                    timeoutManager
                );
                
                if (batchQuestions && batchQuestions.length > 0) {
                    console.log(`✓ Batch ${batchIndex + 1} completed: ${batchQuestions.length} questions`);
                    debugLog(`   ✓ Batch ${batchIndex + 1} completed: ${batchQuestions.length} questions`);
                    
                    // Log batch completion to document-processing.log
                    if (processingLogger && supabase && documentSlug) {
                        await processingLogger.progress(supabase, null, documentSlug, processingLogger.STAGES.QUIZ, processingLogger.STATUSES.PROGRESS,
                            `Batch ${batchIndex + 1}/${numBatches} completed: ${batchQuestions.length} questions`, 
                            { batchIndex: batchIndex + 1, numBatches, questionsGenerated: batchQuestions.length });
                    }
                    
                    return { success: true, batchIndex, questions: batchQuestions };
                } else {
                    const errorMsg = `Batch ${batchIndex + 1} returned no questions`;
                    console.error(`❌ ${errorMsg}`);
                    
                    // Log batch failure to document-processing.log
                    if (processingLogger && supabase && documentSlug) {
                        await processingLogger.progress(supabase, null, documentSlug, processingLogger.STAGES.QUIZ, processingLogger.STATUSES.PROGRESS,
                            `Batch ${batchIndex + 1}/${numBatches} failed: returned no questions`, 
                            { batchIndex: batchIndex + 1, numBatches });
                    }
                    
                    return { success: false, batchIndex, error: errorMsg };
                }
            } catch (batchError) {
                const errorMsg = `Batch ${batchIndex + 1} failed: ${batchError.message}`;
                console.error(`   ❌ ${errorMsg}`);
                
                // Log batch error to document-processing.log
                if (processingLogger && supabase && documentSlug) {
                    await processingLogger.progress(supabase, null, documentSlug, processingLogger.STAGES.QUIZ, processingLogger.STATUSES.PROGRESS,
                        `Batch ${batchIndex + 1}/${numBatches} failed: ${batchError.message}`, 
                        { batchIndex: batchIndex + 1, numBatches, error: batchError.message });
                }
                
                return { success: false, batchIndex, error: errorMsg };
            }
        });
        
        // Wait for this group of batches to complete
        const batchResults = await Promise.all(batchPromises);
        
        // Collect results
        batchResults.forEach(result => {
            if (result.success) {
                allQuestions.push(...result.questions);
            } else {
                errors.push(result.error);
            }
        });
        
        // Small delay between batch groups to avoid rate limiting
        if (i + CONCURRENCY_LIMIT < batchTasks.length) {
            await new Promise(resolve => setTimeout(resolve, 500)); // 0.5 second delay between groups
        }
    }
    
    const elapsed = Date.now() - startTime;
    
    if (allQuestions.length === 0) {
        const errorMessage = errors.length > 0 
            ? `All batches failed: ${errors.join('; ')}`
            : 'No questions generated from any batch';
        throw new Error(errorMessage);
    }
    
    // Shuffle questions to mix batches, then limit to requested number
    const shuffled = allQuestions.sort(() => Math.random() - 0.5);
    const finalQuestions = shuffled.slice(0, numQuestions);
    
    console.log(`✓ Generated ${finalQuestions.length} questions total from ${numBatches} batches in ${(elapsed / 1000).toFixed(1)}s`);
    debugLog(`   ✓ Generated ${finalQuestions.length} questions total from ${numBatches} batches`);
    
    // Log final completion to document-processing.log
    if (processingLogger && supabase && documentSlug) {
        await processingLogger.progress(supabase, null, documentSlug, processingLogger.STAGES.QUIZ, processingLogger.STATUSES.PROGRESS,
            `Batched generation completed: ${finalQuestions.length} questions from ${numBatches} batches in ${(elapsed / 1000).toFixed(1)}s`, 
            { totalQuestions: finalQuestions.length, numBatches, elapsedSeconds: (elapsed / 1000).toFixed(1) });
    }
    
    if (errors.length > 0 && finalQuestions.length < numQuestions) {
        console.warn(`   ⚠️ Some batches failed. Generated ${finalQuestions.length}/${numQuestions} questions. Errors: ${errors.join('; ')}`);
        
        // Log warning to document-processing.log
        if (processingLogger && supabase && documentSlug) {
            await processingLogger.progress(supabase, null, documentSlug, processingLogger.STAGES.QUIZ, processingLogger.STATUSES.PROGRESS,
                `Warning: Some batches failed. Generated ${finalQuestions.length}/${numQuestions} questions`, 
                { generated: finalQuestions.length, requested: numQuestions, errors: errors.length });
        }
    }
    
    return finalQuestions;
}

/**
 * Make a single OpenAI API request for quiz questions
 */
async function makeQuizAPIRequest(openaiClient, textForQuiz, documentTitle, numQuestions, timeoutMs) {
    const requestStartTime = Date.now();
    const requestSize = textForQuiz.length;
    const estimatedTokens = Math.ceil(requestSize / 4);
    debugLog(`   📊 Request size: ${requestSize.toLocaleString()} chars (~${estimatedTokens.toLocaleString()} tokens)`);
    debugLog(`   ⏱️  Timeout: ${(timeoutMs / 1000).toFixed(1)}s`);
    
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
            const elapsed = Date.now() - requestStartTime;
            console.error(`   ❌ Quiz generation TIMEOUT after ${(elapsed / 1000).toFixed(1)}s`);
            reject(new Error(`OpenAI quiz API call exceeded maximum timeout (${(timeoutMs / 1000).toFixed(1)}s)`));
        }, timeoutMs);
    });
    
    debugLog(`   🚀 Sending OpenAI API request for quiz questions...`);
    
    const apiPromise = openaiClient.chat.completions.create({
        model: config.ai.abstractModel || 'gpt-4o-mini',
        messages: [
            {
                role: 'system',
                content: 'You are an expert at creating educational quiz questions from document content. Generate clear, accurate multiple-choice questions that test understanding of the material. Each question must have exactly 4 options (A, B, C, D) with one clearly correct answer. Make questions challenging but fair, based directly on the provided content.'
            },
            {
                role: 'user',
                content: `Generate ${numQuestions} multiple-choice questions based on the following document content from "${documentTitle}".

Each question must have:
- A clear, specific question
- Exactly 4 options (A, B, C, D)
- One correct answer (indicated by correctAnswer index 0-3)
- Three plausible distractors

Return your response as a JSON object with this exact structure:
{
  "questions": [
    {
      "question": "What is...?",
      "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
      "correctAnswer": 1
    }
  ]
}

Document content:
${textForQuiz}

Provide ONLY the JSON object, no additional commentary.`
            }
        ],
        temperature: 0.7,
        max_tokens: 2000 + (numQuestions * 300), // Scale with number of questions
        response_format: { type: "json_object" }
    }, {
        timeout: Math.min(config.ai.abstractTimeout || 60000, timeoutMs - 5000)
    });
    
    let response;
    try {
        response = await Promise.race([
            apiPromise.then(result => {
                const elapsed = Date.now() - requestStartTime;
                debugLog(`   ✅ OpenAI API responded in ${(elapsed / 1000).toFixed(1)}s`);
                return result;
            }),
            timeoutPromise
        ]);
    } catch (error) {
        const elapsed = Date.now() - requestStartTime;
        console.error(`   ❌ OpenAI API error after ${(elapsed / 1000).toFixed(1)}s:`, error.message);
        throw error;
    }
    
    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
        throw new ProcessingError('Empty response from OpenAI quiz API');
    }
    
    // Parse JSON response
    let parsed;
    try {
        parsed = JSON.parse(content);
    } catch (parseError) {
        // Try to extract JSON from markdown code blocks if present
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
        } else {
            throw new Error(`Failed to parse JSON response: ${parseError.message}`);
        }
    }
    
    const questionsArray = parsed.questions || parsed.question || [];
    if (!Array.isArray(questionsArray) || questionsArray.length === 0) {
        throw new ProcessingError('No questions found in API response');
    }
    
    // Validate and normalize questions
    const validatedQuestions = questionsArray
        .slice(0, numQuestions) // Limit to requested number
        .map((q, index) => {
            // Validate structure
            if (!q.question || typeof q.question !== 'string') {
                throw new Error(`Question ${index + 1} missing or invalid question text`);
            }
            if (!Array.isArray(q.options) || q.options.length !== 4) {
                throw new Error(`Question ${index + 1} must have exactly 4 options`);
            }
            if (typeof q.correctAnswer !== 'number' || q.correctAnswer < 0 || q.correctAnswer > 3) {
                throw new Error(`Question ${index + 1} correctAnswer must be 0-3`);
            }
            
            return {
                question: q.question.trim(),
                options: q.options.map(opt => String(opt).trim()),
                correctAnswer: q.correctAnswer
            };
        });
    
    if (validatedQuestions.length === 0) {
        throw new ProcessingError('No valid questions generated');
    }
    
    debugLog(`   ✓ Generated ${validatedQuestions.length} quiz questions`);
    return validatedQuestions;
}

module.exports = {
    generateQuizQuestions
};

