/**
 * Debug utility for conditional logging (Backend)
 * Only logs when DEBUG mode is enabled (development or DEBUG=true)
 */

/**
 * Check if debug mode is enabled
 * @returns {boolean} True if DEBUG=true or NODE_ENV=development
 */
const isDebugEnabled = () => {
  return process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development';
};

/**
 * Debug log - only outputs in development or when DEBUG=true
 * @param {...any} args - Arguments to log
 */
const debugLog = (...args) => {
  if (isDebugEnabled()) {
    console.log(...args);
  }
};

/**
 * Debug warn - only outputs in development or when DEBUG=true
 * @param {...any} args - Arguments to log
 */
const debugWarn = (...args) => {
  if (isDebugEnabled()) {
    console.warn(...args);
  }
};

/**
 * Debug error - only outputs in development or when DEBUG=true
 * Note: For actual errors, use console.error() directly as those should always show
 * @param {...any} args - Arguments to log
 */
const debugError = (...args) => {
  if (isDebugEnabled()) {
    console.error(...args);
  }
};

/**
 * Debug info - only outputs in development or when DEBUG=true
 * @param {...any} args - Arguments to log
 */
const debugInfo = (...args) => {
  if (isDebugEnabled()) {
    console.info(...args);
  }
};

module.exports = {
  debugLog,
  debugWarn,
  debugError,
  debugInfo,
  isDebugEnabled,
  isDebug: isDebugEnabled, // Alias for consistency with frontend
};











