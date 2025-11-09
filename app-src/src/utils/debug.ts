/**
 * Debug utility for conditional logging
 * 
 * Default behavior:
 * - Development mode (Vite dev server): Debug logs ON by default
 * - Production build: Debug logs OFF by default
 * 
 * Override behavior (in order of priority):
 * 1. URL parameter: ?debug=true|1|verbose (runtime, no rebuild needed) - Only if ALLOW_DEBUG_OVERRIDE=true
 * 2. localStorage: localStorage.setItem('debug', 'true'|'1'|'verbose') (runtime, no rebuild needed) - Only if ALLOW_DEBUG_OVERRIDE=true
 * 3. Build-time: Set VITE_DEBUG=true to enable debug logs in production builds
 * 4. Build-time: Set VITE_DEBUG=false to disable debug logs in development
 * 
 * Server control: Set ALLOW_DEBUG_OVERRIDE=false in server .env to disable runtime overrides
 */

// Cache for server's debug override setting
let allowDebugOverride: boolean | null = null;
let overrideCheckPromise: Promise<boolean> | null = null;

/**
 * Check if server allows debug override (URL/localStorage)
 * Fetches from /api/debug-config and caches result
 * Also checks window.__ALLOW_DEBUG_OVERRIDE__ set by main.tsx
 */
async function checkAllowDebugOverride(): Promise<boolean> {
  // Check window property first (set by main.tsx on app init)
  if (typeof window !== 'undefined' && (window as any).__ALLOW_DEBUG_OVERRIDE__ !== undefined) {
    allowDebugOverride = (window as any).__ALLOW_DEBUG_OVERRIDE__;
    return allowDebugOverride;
  }

  // Return cached value if available
  if (allowDebugOverride !== null) {
    return allowDebugOverride;
  }

  // If check is already in progress, return that promise
  if (overrideCheckPromise) {
    return overrideCheckPromise;
  }

  // Start async check
  overrideCheckPromise = (async () => {
    try {
      const response = await fetch('/api/debug-config');
      if (response.ok) {
        const data = await response.json();
        allowDebugOverride = data.allowDebugOverride !== false;
        // Also store in window for synchronous access
        if (typeof window !== 'undefined') {
          (window as any).__ALLOW_DEBUG_OVERRIDE__ = allowDebugOverride;
        }
        return allowDebugOverride;
      }
    } catch (e) {
      // If fetch fails, default to allowing override (backward compatible)
      console.warn('[debug] Failed to check ALLOW_DEBUG_OVERRIDE, defaulting to allowed');
    }
    // Default to true (allow override) if check fails
    allowDebugOverride = true;
    if (typeof window !== 'undefined') {
      (window as any).__ALLOW_DEBUG_OVERRIDE__ = true;
    }
    return true;
  })();

  return overrideCheckPromise;
}

const isDebugEnabled = (): boolean => {
  try {
    // Check build-time environment variable first (always works)
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
    
    // In dev mode, always enable
    if (isDev) {
      return true;
    }

    // Runtime overrides (URL/localStorage) - only if server allows
    if (typeof window !== 'undefined') {
      // Check if override is allowed (check window property set by main.tsx first)
      let overrideAllowed = true; // Default to true (backward compatible)
      
      if ((window as any).__ALLOW_DEBUG_OVERRIDE__ !== undefined) {
        overrideAllowed = (window as any).__ALLOW_DEBUG_OVERRIDE__;
        allowDebugOverride = overrideAllowed; // Update cache
      } else if (allowDebugOverride !== null) {
        overrideAllowed = allowDebugOverride;
      } else {
        // Not checked yet - trigger async check but allow override for now
        checkAllowDebugOverride().catch(() => {});
      }
      
      if (overrideAllowed) {
        // 1. Check URL parameter (highest priority, runtime)
        const urlParams = new URLSearchParams(window.location.search);
        const urlDebug = urlParams.get('debug');
        // Accept: true, 1, verbose (all enable debug mode)
        if (urlDebug === 'true' || urlDebug === '1' || urlDebug === 'verbose') {
          // Trigger async check in background (for next time)
          checkAllowDebugOverride().catch(() => {});
          return true;
        }
        // Accept: false, 0, off (all disable debug mode)
        if (urlDebug === 'false' || urlDebug === '0' || urlDebug === 'off') {
          return false;
        }
        
        // 2. Check localStorage (runtime, no rebuild needed)
        try {
          const localStorageDebug = localStorage.getItem('debug');
          // Accept: true, 1, verbose (all enable debug mode)
          if (localStorageDebug === 'true' || localStorageDebug === '1' || localStorageDebug === 'verbose') {
            // Trigger async check in background (for next time)
            checkAllowDebugOverride().catch(() => {});
            return true;
          }
          // Accept: false, 0, off (all disable debug mode)
          if (localStorageDebug === 'false' || localStorageDebug === '0' || localStorageDebug === 'off') {
            return false;
          }
        } catch (e) {
          // localStorage might not be available
        }
      } else {
        // Override not allowed - ignore URL/localStorage
      }
      
      // Trigger async check in background to update cache
      checkAllowDebugOverride().catch(() => {});
    }
    
    // Default behavior: OFF in production build
    return false;
  } catch {
    return false;
  }
};

/**
 * Debug log - only outputs in development or when debug is enabled via:
 * - URL parameter: ?debug=true|1|verbose
 * - localStorage: localStorage.setItem('debug', 'true'|'1'|'verbose')
 * - Build-time: VITE_DEBUG=true
 */
export const debugLog = (...args: any[]): void => {
  if (isDebugEnabled()) {
    console.log(...args);
  }
};

/**
 * Debug warn - only outputs in development or when debug is enabled via:
 * - URL parameter: ?debug=true|1|verbose
 * - localStorage: localStorage.setItem('debug', 'true'|'1'|'verbose')
 * - Build-time: VITE_DEBUG=true
 */
export const debugWarn = (...args: any[]): void => {
  if (isDebugEnabled()) {
    console.warn(...args);
  }
};

/**
 * Debug error - only outputs in development or when debug is enabled via:
 * - URL parameter: ?debug=true|1|verbose
 * - localStorage: localStorage.setItem('debug', 'true'|'1'|'verbose')
 * - Build-time: VITE_DEBUG=true
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



