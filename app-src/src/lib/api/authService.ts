/**
 * Centralized authentication utilities
 * Single source of truth for JWT token extraction and auth headers
 */

const SESSION_KEY = 'sb-mlxctdgnojvkgfqldaob-auth-token';

/**
 * Get authentication headers for API requests
 * Extracts JWT token from localStorage and adds Authorization header
 * @returns Headers object with Content-Type and Authorization (if token exists)
 */
export function getAuthHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  try {
    const sessionData = localStorage.getItem(SESSION_KEY);
    if (sessionData) {
      const session = JSON.parse(sessionData);
      const token = session?.access_token;
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
  } catch (error) {
    // Silently ignore token extraction errors
    // Component will work as unauthenticated user
  }

  return headers;
}

/**
 * Get just the auth token (without headers)
 * Useful for direct token access
 * @returns JWT token string or null if not found
 */
export function getAuthToken(): string | null {
  try {
    const sessionData = localStorage.getItem(SESSION_KEY);
    if (sessionData) {
      const session = JSON.parse(sessionData);
      return session?.access_token || null;
    }
  } catch (error) {
    // Silently ignore errors
  }
  return null;
}

/**
 * Check if user is currently authenticated
 * @returns true if valid session exists
 */
export function isAuthenticated(): boolean {
  return getAuthToken() !== null;
}




