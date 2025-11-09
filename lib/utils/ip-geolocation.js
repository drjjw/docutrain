/**
 * IP Geolocation Utility
 * Looks up country information from IP address using ip-api.com
 * Free tier: 45 requests/minute, no API key required
 */

const fetch = require('node-fetch');

// Cache for IP to country lookups (to avoid repeated API calls)
const countryCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Lookup country code from IP address
 * @param {string} ipAddress - IP address to lookup
 * @returns {Promise<string|null>} Country code (ISO 3166-1 alpha-2) or null if lookup fails
 */
async function getCountryFromIP(ipAddress) {
    if (!ipAddress || ipAddress === '127.0.0.1' || ipAddress === '::1' || ipAddress === 'localhost') {
        return null; // Skip localhost IPs
    }

    // Check cache first
    const cached = countryCache.get(ipAddress);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.country;
    }

    try {
        // Use ip-api.com free tier (no API key required)
        // Rate limit: 45 requests/minute
        // Use Promise.race for timeout (node-fetch v2 doesn't support AbortController signal)
        const fetchPromise = fetch(`http://ip-api.com/json/${ipAddress}?fields=status,message,countryCode`);
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 3000)
        );
        
        const response = await Promise.race([fetchPromise, timeoutPromise]);

        if (!response.ok) {
            console.warn(`[IP Geolocation] Failed to fetch country for IP ${ipAddress}: ${response.status}`);
            return null;
        }

        const data = await response.json();

        if (data.status === 'success' && data.countryCode) {
            const countryCode = data.countryCode.toUpperCase();
            
            // Cache the result
            countryCache.set(ipAddress, {
                country: countryCode,
                timestamp: Date.now()
            });

            return countryCode;
        } else {
            console.warn(`[IP Geolocation] Lookup failed for IP ${ipAddress}: ${data.message || 'Unknown error'}`);
            return null;
        }
    } catch (error) {
        // Handle timeout errors
        if (error.message === 'Timeout') {
            console.warn(`[IP Geolocation] Timeout looking up country for IP ${ipAddress}`);
            return null;
        }
        
        // Don't fail the request if geolocation lookup fails
        console.warn(`[IP Geolocation] Error looking up country for IP ${ipAddress}:`, error.message);
        return null;
    }
}

/**
 * Clear the country cache (useful for testing)
 */
function clearCache() {
    countryCache.clear();
}

module.exports = {
    getCountryFromIP,
    clearCache
};

