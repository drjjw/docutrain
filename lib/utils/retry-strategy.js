/**
 * Retry Strategy
 * Enhanced retry logic with exponential backoff, circuit breaker, and error classification
 */

const { classifyError, isRetryableError, RateLimitError } = require('../errors/processing-errors');

/**
 * Default retry configuration
 */
const DEFAULT_CONFIG = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    multiplier: 2,
    jitter: true,
    circuitBreakerThreshold: 5, // Failures before opening circuit
    circuitBreakerTimeout: 60000 // 1 minute before retry
};

/**
 * Circuit breaker state
 */
const CIRCUIT_STATES = {
    CLOSED: 'closed', // Normal operation
    OPEN: 'open', // Failures detected, reject requests
    HALF_OPEN: 'half_open' // Testing if service recovered
};

/**
 * Simple circuit breaker implementation
 */
class CircuitBreaker {
    constructor(options = {}) {
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = null;
        this.state = CIRCUIT_STATES.CLOSED;
        this.threshold = options.threshold || DEFAULT_CONFIG.circuitBreakerThreshold;
        this.timeout = options.timeout || DEFAULT_CONFIG.circuitBreakerTimeout;
    }
    
    /**
     * Record a success
     */
    recordSuccess() {
        this.successCount++;
        if (this.state === CIRCUIT_STATES.HALF_OPEN) {
            // If we got successes in half-open, close the circuit
            this.state = CIRCUIT_STATES.CLOSED;
            this.failureCount = 0;
        }
    }
    
    /**
     * Record a failure
     */
    recordFailure() {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        
        if (this.failureCount >= this.threshold) {
            this.state = CIRCUIT_STATES.OPEN;
        }
    }
    
    /**
     * Check if request should be allowed
     */
    canAttempt() {
        if (this.state === CIRCUIT_STATES.CLOSED) {
            return true;
        }
        
        if (this.state === CIRCUIT_STATES.OPEN) {
            // Check if timeout has passed
            if (this.lastFailureTime && (Date.now() - this.lastFailureTime) >= this.timeout) {
                this.state = CIRCUIT_STATES.HALF_OPEN;
                return true;
            }
            return false;
        }
        
        // HALF_OPEN - allow one attempt
        return true;
    }
    
    /**
     * Reset circuit breaker
     */
    reset() {
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = null;
        this.state = CIRCUIT_STATES.CLOSED;
    }
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt, config) {
    const exponentialDelay = config.initialDelay * Math.pow(config.multiplier, attempt - 1);
    const delay = Math.min(exponentialDelay, config.maxDelay);
    
    if (config.jitter) {
        // Add jitter: random value between 0 and 20% of delay
        const jitterAmount = Math.random() * delay * 0.2;
        return Math.floor(delay + jitterAmount);
    }
    
    return delay;
}

/**
 * Retry strategy executor
 */
class RetryStrategy {
    constructor(options = {}) {
        this.config = { ...DEFAULT_CONFIG, ...options };
        this.circuitBreakers = new Map(); // Per-operation circuit breakers
    }
    
    /**
     * Get or create circuit breaker for operation
     */
    _getCircuitBreaker(operationName) {
        if (!this.circuitBreakers.has(operationName)) {
            this.circuitBreakers.set(operationName, new CircuitBreaker(this.config));
        }
        return this.circuitBreakers.get(operationName);
    }
    
    /**
     * Execute function with retry logic
     */
    async execute(fn, options = {}) {
        const operationName = options.operationName || 'operation';
        const maxRetries = options.maxRetries || this.config.maxRetries;
        const circuitBreaker = this._getCircuitBreaker(operationName);
        
        // Check circuit breaker
        if (!circuitBreaker.canAttempt()) {
            const error = new Error(`Circuit breaker is OPEN for ${operationName}. Too many failures.`);
            error.circuitOpen = true;
            throw error;
        }
        
        let lastError = null;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const result = await fn();
                
                // Record success
                circuitBreaker.recordSuccess();
                
                return result;
                
            } catch (error) {
                lastError = error;
                
                // Classify error
                const classifiedError = classifyError(error, {
                    operation: operationName,
                    attempt
                });
                
                // Check if error is retryable
                if (!classifiedError.isRetryable) {
                    circuitBreaker.recordFailure();
                    throw classifiedError;
                }
                
                // If this is the last attempt, throw
                if (attempt === maxRetries) {
                    circuitBreaker.recordFailure();
                    throw classifiedError;
                }
                
                // Calculate delay
                let delay;
                if (classifiedError instanceof RateLimitError && classifiedError.retryAfter) {
                    // Use retry-after header if available
                    delay = parseInt(classifiedError.retryAfter) * 1000;
                } else {
                    delay = calculateDelay(attempt, this.config);
                }
                
                // Log retry attempt
                console.warn(
                    `⏳ Retrying ${operationName} (attempt ${attempt}/${maxRetries}) after ${delay}ms...`,
                    `Error: ${classifiedError.message}`
                );
                
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        // Should not reach here, but just in case
        circuitBreaker.recordFailure();
        throw lastError || new Error('Retry failed after all attempts');
    }
    
    /**
     * Reset circuit breaker for operation
     */
    resetCircuitBreaker(operationName) {
        const circuitBreaker = this.circuitBreakers.get(operationName);
        if (circuitBreaker) {
            circuitBreaker.reset();
        }
    }
    
    /**
     * Reset all circuit breakers
     */
    resetAllCircuitBreakers() {
        this.circuitBreakers.forEach(cb => cb.reset());
    }
}

/**
 * Create retry strategy instance
 */
function createRetryStrategy(options = {}) {
    return new RetryStrategy(options);
}

/**
 * Simple retry helper (backward compatibility)
 */
async function retryWithBackoff(fn, maxRetries = 3, operationName = 'operation') {
    const strategy = createRetryStrategy({ maxRetries });
    return strategy.execute(fn, { operationName });
}

module.exports = {
    RetryStrategy,
    CircuitBreaker,
    createRetryStrategy,
    retryWithBackoff,
    calculateDelay,
    CIRCUIT_STATES
};

