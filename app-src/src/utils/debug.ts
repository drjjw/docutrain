/**
 * Debug utility for conditional logging
 * 
 * Default behavior:
 * - Development mode (Vite dev server): Debug logs ON by default
 * - Production build: Debug logs OFF by default
 * 
 * Override behavior:
 * - Set VITE_DEBUG=true to enable debug logs in production builds
 * - Set VITE_DEBUG=false to disable debug logs in development
 */

const isDebugEnabled = (): boolean => {
  try {
    const viteDebug = (import.meta as any).env?.VITE_DEBUG;
    const isDev = (import.meta as any).env?.DEV === true;
    
    // Explicit override: VITE_DEBUG=false always disables
    if (viteDebug === 'false') {
      return false;
    }
    
    // Explicit override: VITE_DEBUG=true always enables
    if (viteDebug === 'true') {
      return true;
    }
    
    // Default behavior: ON in dev mode, OFF in production build
    // If VITE_DEBUG is unset, use dev mode detection
    return isDev;
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



