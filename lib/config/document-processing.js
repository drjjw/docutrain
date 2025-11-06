/**
 * Document Processing Configuration
 * Centralized configuration constants with environment variable support
 */

/**
 * Chunking configuration
 */
const chunking = {
    size: parseInt(process.env.CHUNK_SIZE) || 500, // tokens (roughly 2000 characters)
    overlap: parseInt(process.env.CHUNK_OVERLAP) || 100, // tokens (roughly 400 characters)
    charsPerToken: 4 // Rough estimate
};

/**
 * Embedding configuration
 * 
 * batchSize: OpenAI supports up to 2048 inputs per request
 * We use 200 as a conservative default to balance speed and reliability
 * With batch API, this means 1 API call per 200 chunks instead of 200 calls
 * 
 * baseDelayMs: Reduced since we're making far fewer API calls with batch API
 */
const embedding = {
    batchSize: parseInt(process.env.EMBEDDING_BATCH_SIZE) || 200, // Increased from 50 to 200 (4x larger batches)
    baseDelayMs: parseInt(process.env.BASE_BATCH_DELAY_MS) || 50, // Reduced from 100ms to 50ms (fewer API calls)
    model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
    timeout: parseInt(process.env.EMBEDDING_TIMEOUT) || 30000, // 30 seconds
    hardTimeout: parseInt(process.env.EMBEDDING_HARD_TIMEOUT) || 45000 // 45 seconds
};

/**
 * AI content generation configuration
 */
const ai = {
    abstractModel: process.env.AI_ABSTRACT_MODEL || 'gpt-4o-mini',
    abstractTimeout: parseInt(process.env.AI_ABSTRACT_TIMEOUT) || 30000, // 30 seconds
    abstractHardTimeout: parseInt(process.env.AI_ABSTRACT_HARD_TIMEOUT) || 45000, // 45 seconds
    keywordTimeout: parseInt(process.env.AI_KEYWORD_TIMEOUT) || 30000, // 30 seconds
    keywordHardTimeout: parseInt(process.env.AI_KEYWORD_HARD_TIMEOUT) || 45000, // 45 seconds
    maxChars: parseInt(process.env.AI_MAX_CHARS) || 400000 // ~100k tokens
};

/**
 * Retry configuration
 */
const retry = {
    maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
    initialDelay: parseInt(process.env.RETRY_INITIAL_DELAY) || 1000, // 1 second
    maxDelay: parseInt(process.env.RETRY_MAX_DELAY) || 10000, // 10 seconds
    multiplier: parseFloat(process.env.RETRY_MULTIPLIER) || 2,
    jitter: process.env.RETRY_JITTER !== 'false',
    circuitBreakerThreshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD) || 5,
    circuitBreakerTimeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT) || 60000 // 1 minute
};

/**
 * Storage configuration
 * 
 * insertBatchSize: Increased to match embedding batch size for efficiency
 * Supabase/PostgreSQL can handle larger batches, but we stay conservative
 */
const storage = {
    insertBatchSize: parseInt(process.env.STORAGE_INSERT_BATCH_SIZE) || 200, // Increased from 50 to 200
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024 // 100MB
};

/**
 * Processing configuration
 */
const processing = {
    maxConcurrentJobs: parseInt(process.env.MAX_CONCURRENT_PROCESSING_JOBS) || 5,
    stuckDocumentThreshold: parseInt(process.env.STUCK_DOCUMENT_THRESHOLD) || 5 * 60 * 1000 // 5 minutes
};

/**
 * Complete configuration object
 */
const config = {
    chunking,
    embedding,
    ai,
    retry,
    storage,
    processing
};

/**
 * Get configuration value by path
 * Example: getConfig('embedding.timeout') returns embedding.timeout
 */
function getConfig(path) {
    const parts = path.split('.');
    let value = config;
    
    for (const part of parts) {
        if (value && typeof value === 'object' && part in value) {
            value = value[part];
        } else {
            return undefined;
        }
    }
    
    return value;
}

/**
 * Override configuration (useful for testing)
 */
function overrideConfig(overrides) {
    Object.assign(config, overrides);
}

/**
 * Reset configuration to defaults
 */
function resetConfig() {
    // This would require storing original values, so for now just log
    console.warn('resetConfig() not fully implemented - restart process to reset');
}

/**
 * Validate configuration
 */
function validateConfig() {
    const errors = [];
    
    // Validate chunking
    if (chunking.size < 100 || chunking.size > 5000) {
        errors.push('chunking.size must be between 100 and 5000');
    }
    if (chunking.overlap < 0 || chunking.overlap > 500) {
        errors.push('chunking.overlap must be between 0 and 500');
    }
    
    // Validate embedding
    // OpenAI supports up to 2048 inputs per request, but we cap at 1000 for safety
    if (embedding.batchSize < 1 || embedding.batchSize > 1000) {
        errors.push('embedding.batchSize must be between 1 and 1000');
    }
    if (embedding.timeout < 1000 || embedding.timeout > 300000) {
        errors.push('embedding.timeout must be between 1000 and 300000 ms');
    }
    
    // Validate retry
    if (retry.maxRetries < 0 || retry.maxRetries > 10) {
        errors.push('retry.maxRetries must be between 0 and 10');
    }
    
    if (errors.length > 0) {
        throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }
    
    return true;
}

// Validate on load
try {
    validateConfig();
} catch (error) {
    console.error('⚠️ Configuration validation failed:', error.message);
    console.error('Using default values - please check environment variables');
}

module.exports = {
    config,
    chunking,
    embedding,
    ai,
    retry,
    storage,
    processing,
    getConfig,
    overrideConfig,
    resetConfig,
    validateConfig
};

