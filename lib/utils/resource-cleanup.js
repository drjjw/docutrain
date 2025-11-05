/**
 * Resource Cleanup Manager
 * Ensures all resources are cleaned up with guaranteed cleanup in finally blocks
 */

/**
 * Resource Cleanup Manager
 * Tracks resources and ensures they're cleaned up even on errors
 */
class ResourceCleanup {
    constructor() {
        this.cleanupFunctions = [];
        this.cleanedUp = false;
    }
    
    /**
     * Register a cleanup function
     * @param {Function} cleanupFn - Function to call during cleanup
     * @param {string} description - Optional description for debugging
     */
    register(cleanupFn, description = null) {
        if (typeof cleanupFn !== 'function') {
            throw new Error('Cleanup function must be a function');
        }
        
        this.cleanupFunctions.push({
            fn: cleanupFn,
            description: description || 'unnamed cleanup'
        });
    }
    
    /**
     * Register a timeout handle for cleanup
     */
    registerTimeout(timeoutHandle, description = null) {
        this.register(() => {
            if (timeoutHandle && typeof timeoutHandle.cancel === 'function') {
                timeoutHandle.cancel();
            }
        }, description || 'timeout cleanup');
    }
    
    /**
     * Register multiple timeout handles
     */
    registerTimeouts(timeoutHandles, description = null) {
        timeoutHandles.forEach((handle, index) => {
            this.registerTimeout(handle, description ? `${description}[${index}]` : `timeout[${index}]`);
        });
    }
    
    /**
     * Execute all registered cleanup functions
     * Safe to call multiple times (idempotent)
     */
    execute() {
        if (this.cleanedUp) {
            return;
        }
        
        this.cleanedUp = true;
        const errors = [];
        
        // Execute cleanup functions in reverse order (LIFO)
        // This ensures resources are cleaned up in the opposite order they were created
        for (let i = this.cleanupFunctions.length - 1; i >= 0; i--) {
            const { fn, description } = this.cleanupFunctions[i];
            
            try {
                fn();
            } catch (error) {
                errors.push({ description, error: error.message });
                console.error(`⚠️ Cleanup function failed (${description}):`, error.message);
            }
        }
        
        // Clear cleanup functions
        this.cleanupFunctions = [];
        
        if (errors.length > 0) {
            console.warn(`⚠️ ${errors.length} cleanup function(s) had errors`);
        }
        
        return {
            success: errors.length === 0,
            errors: errors
        };
    }
    
    /**
     * Check if cleanup has been executed
     */
    isCleanedUp() {
        return this.cleanedUp;
    }
    
    /**
     * Get count of registered cleanup functions
     */
    getCleanupCount() {
        return this.cleanupFunctions.length;
    }
    
    /**
     * Clear all registered cleanup functions without executing
     */
    clear() {
        this.cleanupFunctions = [];
    }
}

/**
 * Create a resource cleanup manager
 */
function createResourceCleanup() {
    return new ResourceCleanup();
}

/**
 * Execute cleanup in a try-finally pattern
 * Ensures cleanup is always called, even if function throws
 */
async function withCleanup(asyncFn, cleanupFn) {
    let resourceCleanup = null;
    
    // If asyncFn returns a ResourceCleanup, use it
    // Otherwise create a new one
    try {
        const result = await asyncFn();
        
        // Check if result has a cleanup property
        if (result && typeof result.cleanup === 'object' && result.cleanup instanceof ResourceCleanup) {
            resourceCleanup = result.cleanup;
        }
        
        return result;
    } finally {
        // Execute provided cleanup function
        if (cleanupFn) {
            try {
                await cleanupFn();
            } catch (error) {
                console.error('Error in cleanup function:', error);
            }
        }
        
        // Execute resource cleanup if available
        if (resourceCleanup && !resourceCleanup.isCleanedUp()) {
            resourceCleanup.execute();
        }
    }
}

/**
 * Wrap an async function with automatic cleanup
 */
function wrapWithCleanup(asyncFn) {
    return async function(...args) {
        const cleanup = createResourceCleanup();
        
        try {
            const result = await asyncFn(...args, cleanup);
            return result;
        } finally {
            cleanup.execute();
        }
    };
}

module.exports = {
    ResourceCleanup,
    createResourceCleanup,
    withCleanup,
    wrapWithCleanup
};

