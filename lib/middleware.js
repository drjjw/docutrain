/**
 * Express middleware configuration
 */

const cors = require('cors');
const express = require('express');

// Cache for custom domain to owner mapping
let domainOwnerCache = {};
let cacheTimestamp = 0;
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

/**
 * Create hostname detection middleware for custom domains
 * This middleware detects if a request is coming from a custom domain
 * and automatically injects the owner parameter
 */
function createHostnameDetectionMiddleware(supabase) {
    // Load domain mappings into cache
    async function refreshCache() {
        try {
            const { data, error } = await supabase
                .from('owners')
                .select('slug, custom_domain')
                .not('custom_domain', 'is', null);

            if (error) {
                console.error('Error loading custom domains:', error);
                return;
            }

            // Build cache map: domain -> owner slug
            domainOwnerCache = {};
            data.forEach(owner => {
                if (owner.custom_domain) {
                    domainOwnerCache[owner.custom_domain.toLowerCase()] = owner.slug;
                }
            });

            cacheTimestamp = Date.now();
            console.log(`✓ Loaded ${Object.keys(domainOwnerCache).length} custom domain mappings`);
        } catch (error) {
            console.error('Failed to refresh domain cache:', error);
        }
    }

    // Initial load
    refreshCache();

    // Auto-refresh cache every 2 minutes
    setInterval(refreshCache, CACHE_TTL);

    // Middleware function
    return async (req, res, next) => {
        try {
            const hostname = req.hostname?.toLowerCase();

            // Check if cache needs refresh
            if (Date.now() - cacheTimestamp > CACHE_TTL) {
                await refreshCache();
            }

            // Check if hostname matches a custom domain
            if (hostname && domainOwnerCache[hostname]) {
                const ownerSlug = domainOwnerCache[hostname];
                
                // Only inject if owner parameter is not already present
                if (!req.query.owner) {
                    req.query.owner = ownerSlug;
                    console.log(`🌐 Custom domain detected: ${hostname} → owner=${ownerSlug}`);
                }
            }
        } catch (error) {
            console.error('Hostname detection middleware error:', error);
            // Continue even if detection fails
        }

        next();
    };
}

/**
 * Configure and return middleware array
 */
function setupMiddleware() {
    return [
        // CORS - Allow embedding from any domain
        cors({
            origin: '*',
            credentials: true
        }),
        
        // Remove X-Frame-Options to allow iframe embedding
        (req, res, next) => {
            res.removeHeader('X-Frame-Options');
            next();
        },
        
        // JSON body parser
        express.json()
    ];
}

module.exports = {
    setupMiddleware,
    createHostnameDetectionMiddleware
};

