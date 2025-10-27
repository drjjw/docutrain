// Debug logging system with configurable levels
// Supports URL parameter: ?debug=off|quiet|normal|verbose

const urlParams = new URLSearchParams(window.location.search);
const debugParam = urlParams.get('debug');

// Debug levels: off, quiet, normal (default), verbose
export const DEBUG_LEVELS = {
    OFF: 0,      // No performance logging
    QUIET: 1,    // Only summary
    NORMAL: 2,   // Summary + step times (default)
    VERBOSE: 3   // Everything including nested functions
};

// Determine debug level from URL parameter
let DEBUG_LEVEL = DEBUG_LEVELS.NORMAL; // Default

if (debugParam === 'off' || debugParam === 'false' || debugParam === '0') {
    DEBUG_LEVEL = DEBUG_LEVELS.OFF;
} else if (debugParam === 'quiet' || debugParam === 'summary') {
    DEBUG_LEVEL = DEBUG_LEVELS.QUIET;
} else if (debugParam === 'verbose' || debugParam === 'true' || debugParam === '1') {
    DEBUG_LEVEL = DEBUG_LEVELS.VERBOSE;
}

// Helper functions for conditional logging
export const debugLog = {
    always: (...args) => console.log(...args),
    verbose: (...args) => { if (DEBUG_LEVEL >= DEBUG_LEVELS.VERBOSE) console.log(...args); },
    normal: (...args) => { if (DEBUG_LEVEL >= DEBUG_LEVELS.NORMAL) console.log(...args); },
    quiet: (...args) => { if (DEBUG_LEVEL >= DEBUG_LEVELS.QUIET) console.log(...args); },
    warn: (...args) => console.warn(...args),
    error: (...args) => console.error(...args)
};

// Make available globally for backward compatibility
window.debugLog = debugLog;

// Export debug level for other modules to check
export { DEBUG_LEVEL };

