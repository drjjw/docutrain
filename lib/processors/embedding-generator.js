/**
 * Embedding Generator
 * Handles embedding generation with batch processing, partial failure handling, and retry logic
 */

const { config } = require('../config/document-processing');
const { createRetryStrategy } = require('../utils/retry-strategy');
const { createTimeoutManager } = require('../utils/timeout-manager');
const { EmbeddingError, PartialFailureError } = require('../errors/processing-errors');
const { validateOpenAIClient, validateChunks, validateText } = require('../utils/input-validator');

/**
 * Generate embedding for text using OpenAI with retry logic and timeout protection
 * 
 * @param {Object} openaiClient - OpenAI client instance
 * @param {string} text - Text to generate embedding for
 * @param {Object} options - Options (timeout manager, retry strategy)
 * @returns {Promise<number[]>} Embedding vector
 * @throws {EmbeddingError} If generation fails
 */
async function generateEmbedding(openaiClient, text, options = {}) {
    const timeoutManager = options.timeoutManager || createTimeoutManager();
    const retryStrategy = options.retryStrategy || createRetryStrategy(config.retry);
    
    // Validate inputs
    validateOpenAIClient(openaiClient);
    validateText(text, 'text');
    
    try {
        return await retryStrategy.execute(async () => {
            // Use timeout manager for race with timeout
            const embeddingPromise = openaiClient.embeddings.create({
                model: config.embedding.model,
                input: text,
                encoding_format: 'float'
            }, {
                timeout: config.embedding.timeout
            });
            
            // Race against timeout
            const response = await timeoutManager.raceWithTimeout(
                embeddingPromise,
                config.embedding.hardTimeout,
                'OpenAI embedding API call exceeded timeout',
                'embedding generation'
            );
            
            if (!response || !response.data || !response.data[0] || !response.data[0].embedding) {
                throw new EmbeddingError('Invalid response from OpenAI embedding API', null, {
                    response: response ? 'received but invalid structure' : 'null response'
                });
            }
            
            return response.data[0].embedding;
            
        }, {
            operationName: 'embedding generation',
            maxRetries: config.retry.maxRetries
        });
        
    } catch (error) {
        // Classify and wrap error
        if (error instanceof EmbeddingError) {
            throw error;
        }
        
        throw new EmbeddingError(
            `Failed to generate embedding: ${error.message}`,
            null,
            { originalError: error.message }
        );
    }
}

/**
 * Process embeddings in batches with partial failure handling
 * Uses OpenAI's batch API to process multiple texts in a single request
 * 
 * @param {Object} openaiClient - OpenAI client instance
 * @param {Array} chunks - Array of chunk objects
 * @param {number} startIdx - Starting index
 * @param {number} batchSize - Batch size
 * @param {Object} options - Options (timeout manager, retry strategy)
 * @returns {Promise<Object>} Object with successes and failures
 */
async function processEmbeddingsBatch(openaiClient, chunks, startIdx, batchSize, options = {}) {
    const timeoutManager = options.timeoutManager || createTimeoutManager();
    const retryStrategy = options.retryStrategy || createRetryStrategy(config.retry);
    
    // Validate inputs
    validateOpenAIClient(openaiClient);
    validateChunks(chunks, 'chunks');
    
    if (typeof startIdx !== 'number' || startIdx < 0 || startIdx >= chunks.length) {
        throw new Error(`Invalid startIdx: ${startIdx} (chunks.length=${chunks.length})`);
    }
    
    if (typeof batchSize !== 'number' || batchSize < 1) {
        throw new Error(`Invalid batchSize: ${batchSize}`);
    }
    
    const batch = chunks.slice(startIdx, startIdx + batchSize);
    const successes = [];
    const failures = [];
    
    // Use OpenAI's batch API - pass array of texts in a single request
    // This is MUCH faster than individual API calls (50x fewer requests)
    try {
        const texts = batch.map(chunk => chunk.content);
        
        const batchEmbeddingPromise = retryStrategy.execute(async () => {
            const embeddingPromise = openaiClient.embeddings.create({
                model: config.embedding.model,
                input: texts, // Array of texts for batch processing
                encoding_format: 'float'
            }, {
                timeout: config.embedding.timeout
            });
            
            // Race against timeout
            const response = await timeoutManager.raceWithTimeout(
                embeddingPromise,
                config.embedding.hardTimeout,
                'OpenAI embedding batch API call exceeded timeout',
                'batch embedding generation'
            );
            
            if (!response || !response.data || !Array.isArray(response.data)) {
                throw new EmbeddingError('Invalid response from OpenAI batch embedding API', null, {
                    response: response ? 'received but invalid structure' : 'null response'
                });
            }
            
            // Match embeddings to chunks by index
            if (response.data.length !== batch.length) {
                throw new EmbeddingError(
                    `Mismatch: received ${response.data.length} embeddings for ${batch.length} chunks`,
                    null,
                    { expected: batch.length, received: response.data.length }
                );
            }
            
            return response.data.map((item, idx) => ({
                chunk: batch[idx],
                embedding: item.embedding,
                chunkIndex: batch[idx].index
            }));
        }, {
            operationName: 'batch embedding generation',
            maxRetries: config.retry.maxRetries
        });
        
        const batchResults = await batchEmbeddingPromise;
        
        // All succeeded
        successes.push(...batchResults);
        
    } catch (error) {
        // If batch fails, fall back to individual processing for this batch
        // This provides resilience if batch API has issues
        console.warn(`⚠️ Batch embedding failed, falling back to individual processing:`, error.message);
        
        for (const chunk of batch) {
            try {
                const embedding = await generateEmbedding(
                    openaiClient,
                    chunk.content,
                    { timeoutManager, retryStrategy }
                );
                
                successes.push({
                    chunk,
                    embedding,
                    chunkIndex: chunk.index
                });
                
            } catch (individualError) {
                failures.push({
                    chunk,
                    error: individualError instanceof EmbeddingError ? individualError : new EmbeddingError(individualError.message, chunk.index),
                    chunkIndex: chunk.index
                });
                
                console.warn(`⚠️ Failed to embed chunk ${chunk.index}:`, individualError.message);
            }
        }
    }
    
    return {
        successes,
        failures,
        total: batch.length,
        successCount: successes.length,
        failureCount: failures.length
    };
}

/**
 * Process all embeddings with batch processing and adaptive delays
 * 
 * @param {Object} openaiClient - OpenAI client instance
 * @param {Array} chunks - Array of chunk objects
 * @param {Function} getAdaptiveDelay - Function to get adaptive delay between batches
 * @param {Function} progressCallback - Optional progress callback
 * @param {Object} options - Options (timeout manager, retry strategy)
 * @returns {Promise<Object>} Object with all successes and failures
 */
async function processAllEmbeddings(
    openaiClient,
    chunks,
    getAdaptiveDelay,
    progressCallback = null,
    options = {}
) {
    const timeoutManager = options.timeoutManager || createTimeoutManager();
    const retryStrategy = options.retryStrategy || createRetryStrategy(config.retry);
    
    validateChunks(chunks, 'chunks');
    
    const allSuccesses = [];
    const allFailures = [];
    const totalBatches = Math.ceil(chunks.length / config.embedding.batchSize);
    
    try {
        for (let i = 0; i < chunks.length; i += config.embedding.batchSize) {
            const batchNum = Math.floor(i / config.embedding.batchSize) + 1;
            
            // Progress callback
            if (progressCallback) {
                await progressCallback({
                    batch: batchNum,
                    totalBatches,
                    progress: (i / chunks.length) * 100
                });
            }
            
            // Process batch
            const batchResult = await processEmbeddingsBatch(
                openaiClient,
                chunks,
                i,
                config.embedding.batchSize,
                { timeoutManager, retryStrategy }
            );
            
            allSuccesses.push(...batchResult.successes);
            allFailures.push(...batchResult.failures);
            
            // Adaptive delay between batches (except for last batch)
            if (i + config.embedding.batchSize < chunks.length) {
                const delay = getAdaptiveDelay ? getAdaptiveDelay() : config.embedding.baseDelayMs;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        // Check if we should continue despite failures
        const successRate = allSuccesses.length / chunks.length;
        
        if (allFailures.length > 0 && successRate < 0.5) {
            // Too many failures - throw partial failure error
            throw new PartialFailureError(
                `Too many embedding failures: ${allFailures.length}/${chunks.length} failed`,
                allSuccesses,
                allFailures
            );
        }
        
        return {
            successes: allSuccesses,
            failures: allFailures,
            total: chunks.length,
            successCount: allSuccesses.length,
            failureCount: allFailures.length,
            successRate
        };
        
    } finally {
        // Cleanup timeout manager
        timeoutManager.cleanup();
    }
}

module.exports = {
    generateEmbedding,
    processEmbeddingsBatch,
    processAllEmbeddings
};

