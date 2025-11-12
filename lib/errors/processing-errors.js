/**
 * Processing Error Classes
 * Custom error classes for document processing with context preservation
 */

/**
 * Base processing error class
 */
class ProcessingError extends Error {
    constructor(message, context = {}) {
        super(message);
        this.name = this.constructor.name;
        this.context = context;
        this.timestamp = new Date().toISOString();
        this.isRetryable = false;
        
        // Preserve stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
    
    /**
     * Convert error to JSON for logging
     */
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            context: this.context,
            timestamp: this.timestamp,
            isRetryable: this.isRetryable,
            stack: this.stack
        };
    }
}

/**
 * Validation error - input validation failed
 */
class ValidationError extends ProcessingError {
    constructor(message, field = null, value = null) {
        super(message, { field, value });
        this.isRetryable = false;
    }
}

/**
 * Timeout error - operation exceeded timeout
 * Hard timeouts (exceeded maximum allowed time) are NOT retryable
 * Network timeouts (ETIMEDOUT) may be retryable
 */
class TimeoutError extends ProcessingError {
    constructor(message, timeoutMs = null, operation = null, isHardTimeout = false) {
        super(message, { timeoutMs, operation });
        // Hard timeouts (exceeded max time) should NOT be retried
        // Network timeouts (connection issues) may be retryable
        this.isRetryable = !isHardTimeout;
        this.isHardTimeout = isHardTimeout;
    }
}

/**
 * Retryable error - operation failed but can be retried
 */
class RetryableError extends ProcessingError {
    constructor(message, context = {}) {
        super(message, context);
        this.isRetryable = true;
        this.retryAfter = context.retryAfter || null;
    }
}

/**
 * Rate limit error - API rate limit exceeded
 */
class RateLimitError extends RetryableError {
    constructor(message, retryAfter = null) {
        super(message, { retryAfter });
        this.name = 'RateLimitError';
    }
}

/**
 * Network error - network/connection issues
 */
class NetworkError extends RetryableError {
    constructor(message, context = {}) {
        super(message, context);
        this.name = 'NetworkError';
    }
}

/**
 * Server error - external server error (5xx)
 */
class ServerError extends RetryableError {
    constructor(message, statusCode = null, context = {}) {
        super(message, { ...context, statusCode });
        this.name = 'ServerError';
        this.statusCode = statusCode;
    }
}

/**
 * Database error - database operation failed
 */
class DatabaseError extends ProcessingError {
    constructor(message, context = {}) {
        super(message, context);
        this.isRetryable = context.isRetryable !== undefined ? context.isRetryable : true;
        this.name = 'DatabaseError';
    }
}

/**
 * PDF extraction error - PDF processing failed
 */
class PDFExtractionError extends ProcessingError {
    constructor(message, context = {}) {
        super(message, context);
        this.isRetryable = false;
        this.name = 'PDFExtractionError';
    }
}

/**
 * Audio extraction error - Audio transcription failed
 */
class AudioExtractionError extends ProcessingError {
    constructor(message, context = {}) {
        super(message, context);
        this.isRetryable = false;
        this.name = 'AudioExtractionError';
    }
}

/**
 * Embedding error - embedding generation failed
 */
class EmbeddingError extends RetryableError {
    constructor(message, chunkIndex = null, context = {}) {
        super(message, { ...context, chunkIndex });
        this.name = 'EmbeddingError';
        this.chunkIndex = chunkIndex;
    }
}

/**
 * Partial failure error - some operations succeeded, some failed
 */
class PartialFailureError extends ProcessingError {
    constructor(message, successes = [], failures = [], context = {}) {
        super(message, { ...context, successes, failures });
        this.isRetryable = failures.length > 0; // Retryable if we have failures
        this.name = 'PartialFailureError';
        this.successes = successes;
        this.failures = failures;
    }
}

/**
 * Classify an error and return appropriate error class
 */
function classifyError(error, context = {}) {
    // If already a ProcessingError, return as-is
    if (error instanceof ProcessingError) {
        return error;
    }
    
    // Classify based on error properties
    const message = error.message || String(error);
    const status = error.status || error.statusCode;
    const code = error.code;
    
    // Rate limit
    if (status === 429 || code === 'rate_limit_exceeded') {
        const retryAfter = error.headers?.['retry-after'] || error.retryAfter;
        return new RateLimitError(message, retryAfter);
    }
    
    // Timeout
    if (code === 'ETIMEDOUT' || message.includes('timeout') || message.includes('TIMEOUT')) {
        // Check if this is a hard timeout (exceeded maximum time) vs network timeout
        const isHardTimeout = message.includes('exceeded timeout') || 
                            message.includes('exceeded maximum') ||
                            message.includes('Hard timeout');
        return new TimeoutError(message, context.timeoutMs, context.operation, isHardTimeout);
    }
    
    // Network errors
    if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ECONNRESET') {
        return new NetworkError(message, { code });
    }
    
    // Server errors (5xx)
    if (status >= 500 && status < 600) {
        return new ServerError(message, status, { code });
    }
    
    // Database errors
    if (error.code && error.code.startsWith('23')) { // PostgreSQL constraint violations
        return new DatabaseError(message, { code: error.code, isRetryable: false });
    }
    if (error.code && error.code.startsWith('40')) { // PostgreSQL transaction errors
        return new DatabaseError(message, { code: error.code, isRetryable: true });
    }
    if (error.code && error.code.startsWith('53')) { // PostgreSQL insufficient resources
        return new DatabaseError(message, { code: error.code, isRetryable: true });
    }
    
    // Default to generic retryable error for unknown errors
    return new RetryableError(message, { originalError: error.message, code, status });
}

/**
 * Check if error is retryable
 */
function isRetryableError(error) {
    if (error instanceof ProcessingError) {
        return error.isRetryable;
    }
    
    // Check common retryable patterns
    const status = error.status || error.statusCode;
    const code = error.code;
    
    // Rate limits are retryable
    if (status === 429) return true;
    
    // Timeouts are retryable
    if (code === 'ETIMEDOUT' || error.message?.includes('timeout')) return true;
    
    // Network errors are retryable
    if (['ECONNREFUSED', 'ENOTFOUND', 'ECONNRESET'].includes(code)) return true;
    
    // Server errors (5xx) are retryable
    if (status >= 500 && status < 600) return true;
    
    return false;
}

module.exports = {
    ProcessingError,
    ValidationError,
    TimeoutError,
    RetryableError,
    RateLimitError,
    NetworkError,
    ServerError,
    DatabaseError,
    PDFExtractionError,
    AudioExtractionError,
    EmbeddingError,
    PartialFailureError,
    classifyError,
    isRetryableError
};

