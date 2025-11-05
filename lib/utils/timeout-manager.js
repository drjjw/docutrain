/**
 * Timeout Manager
 * Centralized timeout management with automatic cleanup and leak prevention
 */

const { TimeoutError } = require('../errors/processing-errors');

/**
 * Timeout handle returned by createTimeout
 */
class TimeoutHandle {
    constructor(id, manager) {
        this.id = id;
        this.manager = manager;
        this.cancelled = false;
        this.fired = false;
    }
    
    /**
     * Cancel the timeout
     */
    cancel() {
        if (!this.cancelled && !this.fired) {
            clearTimeout(this.id);
            this.cancelled = true;
            this.manager._removeTimeout(this);
        }
    }
    
    /**
     * Check if timeout is still active
     */
    isActive() {
        return !this.cancelled && !this.fired;
    }
}

/**
 * Timeout Manager
 * Manages timeouts with automatic cleanup and leak prevention
 */
class TimeoutManager {
    constructor() {
        this.activeTimeouts = new Map(); // Map of timeout ID to handle
        this.timeoutCounter = 0;
    }
    
    /**
     * Create a timeout that will be tracked and can be cleaned up
     * @param {number} ms - Milliseconds until timeout
     * @param {Function} onTimeout - Callback when timeout fires
     * @param {string} description - Optional description for debugging
     * @returns {TimeoutHandle} Handle to cancel the timeout
     */
    createTimeout(ms, onTimeout, description = null) {
        if (typeof ms !== 'number' || ms < 0) {
            throw new Error(`Invalid timeout duration: ${ms}`);
        }
        
        if (typeof onTimeout !== 'function') {
            throw new Error('Timeout callback must be a function');
        }
        
        const timeoutId = ++this.timeoutCounter;
        const handle = new TimeoutHandle(timeoutId, this);
        
        const wrappedCallback = () => {
            handle.fired = true;
            this._removeTimeout(handle);
            try {
                onTimeout();
            } catch (error) {
                console.error(`Error in timeout callback: ${error.message}`);
            }
        };
        
        const nativeTimeoutId = setTimeout(wrappedCallback, ms);
        
        // Store mapping
        handle.id = nativeTimeoutId;
        this.activeTimeouts.set(timeoutId, handle);
        
        // Debug logging
        if (description) {
            console.debug(`⏱️ Created timeout: ${description} (${ms}ms)`);
        }
        
        return handle;
    }
    
    /**
     * Create a timeout that rejects a promise
     * @param {number} ms - Milliseconds until timeout
     * @param {string} message - Error message
     * @param {string} description - Optional description for debugging
     * @returns {Promise} Promise that rejects on timeout
     */
    createTimeoutPromise(ms, message = 'Operation timed out', description = null) {
        return new Promise((resolve, reject) => {
            const handle = this.createTimeout(ms, () => {
                reject(new TimeoutError(message, ms, description));
            }, description);
            
            // Return handle for cancellation
            return handle;
        });
    }
    
    /**
     * Race a promise against a timeout
     * @param {Promise} promise - Promise to race
     * @param {number} ms - Timeout in milliseconds
     * @param {string} message - Error message if timeout
     * @param {string} description - Optional description
     * @returns {Promise} Promise that resolves/rejects based on race
     */
    async raceWithTimeout(promise, ms, message = 'Operation timed out', description = null) {
        const timeoutHandle = this.createTimeout(ms, () => {
            // Timeout will reject via Promise.race
        }, description);
        
        try {
            const result = await Promise.race([
                promise,
                this.createTimeoutPromise(ms, message, description)
            ]);
            
            // Success - cancel timeout
            timeoutHandle.cancel();
            return result;
            
        } catch (error) {
            // Cancel timeout if promise resolved/rejected before timeout
            timeoutHandle.cancel();
            throw error;
        }
    }
    
    /**
     * Internal method to remove timeout from tracking
     */
    _removeTimeout(handle) {
        if (handle.id && this.activeTimeouts.has(handle.id)) {
            this.activeTimeouts.delete(handle.id);
        }
    }
    
    /**
     * Cancel a specific timeout
     */
    cancel(handle) {
        if (handle instanceof TimeoutHandle) {
            handle.cancel();
        } else {
            console.warn('Invalid timeout handle provided to cancel()');
        }
    }
    
    /**
     * Cancel all active timeouts
     */
    cancelAll() {
        const count = this.activeTimeouts.size;
        this.activeTimeouts.forEach(handle => {
            if (handle.id) {
                clearTimeout(handle.id);
            }
        });
        this.activeTimeouts.clear();
        
        if (count > 0) {
            console.debug(`🧹 Cancelled ${count} active timeout(s)`);
        }
    }
    
    /**
     * Get count of active timeouts
     */
    getActiveCount() {
        return this.activeTimeouts.size;
    }
    
    /**
     * Check if there are any active timeouts (useful for leak detection)
     */
    hasActiveTimeouts() {
        return this.activeTimeouts.size > 0;
    }
    
    /**
     * Cleanup all timeouts (alias for cancelAll)
     */
    cleanup() {
        this.cancelAll();
    }
}

/**
 * Create a new timeout manager instance
 */
function createTimeoutManager() {
    return new TimeoutManager();
}

module.exports = {
    TimeoutManager,
    TimeoutHandle,
    createTimeoutManager
};

