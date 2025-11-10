/**
 * Shared API URL utility
 * Centralized function to get the correct API URL for both dev and production
 */

/**
 * Get API URL from environment or use default
 * In development (localhost), uses relative URLs so Vite proxy handles them
 * In production, returns the current origin (API routes are at root)
 */
export function getAPIUrl(): string {
  // In development (Vite dev server), use relative URLs so Vite proxy handles them
  // This way the backend doesn't need to be running separately
  const hostname = window.location.hostname;
  const isDev = import.meta.env.DEV || hostname === 'localhost' || hostname === '127.0.0.1';
  
  // If we're running on localhost (dev mode), use relative URLs (Vite proxy will handle)
  if (isDev) {
    // Return empty string for relative URLs - Vite proxy will forward to backend
    // Note: Backend server must be running on http://localhost:3458 for proxy to work
    return ''; 
  }
  
  // In production, API routes are at the root, not under /app
  // If we're at /app/chat, we need to go to root for /api routes
  const pathname = window.location.pathname;
  
  // If we're in /app/*, remove /app to get the root
  if (pathname.startsWith('/app/')) {
    return window.location.origin;
  }
  
  // Otherwise, use current directory
  const baseDir = pathname.substring(0, pathname.lastIndexOf('/') + 1);
  return (window.location.origin + baseDir).replace(/\/$/, '');
}

/**
 * Check if backend server is accessible (for debugging)
 * Only works in development mode
 */
export async function checkBackendHealth(): Promise<boolean> {
  const hostname = window.location.hostname;
  const isDev = import.meta.env.DEV || hostname === 'localhost' || hostname === '127.0.0.1';
  
  if (!isDev) {
    return true; // Assume backend is available in production
  }
  
  try {
    const response = await fetch('/api/health', { 
      method: 'GET',
      signal: AbortSignal.timeout(2000) // 2 second timeout
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

