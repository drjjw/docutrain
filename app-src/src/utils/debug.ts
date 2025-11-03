/**
 * Debug utility for conditional logging
 * Only logs when DEBUG mode is enabled (development or VITE_DEBUG=true)
 */

const isDebugEnabled = (): boolean => {
  try {
    return (import.meta as any).env?.VITE_DEBUG === 'true' || (import.meta as any).env?.DEV === true;
  } catch {
    return false;
  }
};

/**
 * Debug log - only outputs in development or when VITE_DEBUG=true
 */
export const debugLog = (...args: any[]): void => {
  if (isDebugEnabled()) {
    console.log(...args);
  }
};

/**
 * Debug warn - only outputs in development or when VITE_DEBUG=true
 */
export const debugWarn = (...args: any[]): void => {
  if (isDebugEnabled()) {
    console.warn(...args);
  }
};

/**
 * Debug error - only outputs in development or when VITE_DEBUG=true
 */
export const debugError = (...args: any[]): void => {
  if (isDebugEnabled()) {
    console.error(...args);
  }
};

/**
 * Check if debug mode is enabled
 */
export const isDebug = isDebugEnabled;


