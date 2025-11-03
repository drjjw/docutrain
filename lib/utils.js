/**
 * Utility functions for server operations
 */

/**
 * Sanitize HTML intro messages to prevent XSS attacks
 * Allows only safe tags and strips dangerous attributes
 */
function sanitizeIntroHTML(html) {
    if (!html || typeof html !== 'string') {
        return null;
    }
    
    // Allowed tags (safe for display)
    const allowedTags = ['strong', 'em', 'b', 'i', 'br', 'ul', 'ol', 'li', 'a', 'p', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
    
    // Remove script tags and their content
    let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    
    // Remove event handlers (onclick, onerror, etc.)
    sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
    sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '');
    
    // Remove javascript: protocol from hrefs
    sanitized = sanitized.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');
    
    // Remove style attributes (to prevent CSS injection)
    sanitized = sanitized.replace(/\s*style\s*=\s*["'][^"']*["']/gi, '');
    
    // Remove any tags not in allowed list
    const tagRegex = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
    sanitized = sanitized.replace(tagRegex, (match, tagName) => {
        if (allowedTags.includes(tagName.toLowerCase())) {
            // For anchor tags, ensure only href attribute is kept
            if (tagName.toLowerCase() === 'a') {
                const hrefMatch = match.match(/href\s*=\s*["']([^"']*)["']/i);
                if (hrefMatch) {
                    return `<a href="${hrefMatch[1]}">`;
                }
                return match.includes('</') ? '</a>' : '<a>';
            }
            return match;
        }
        return ''; // Remove disallowed tags
    });
    
    return sanitized.trim() || null;
}

/**
 * Escape HTML to prevent XSS
 * Note: We use double quotes for HTML attributes, so apostrophes don't need escaping
 */
function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')  // Must be first to avoid double-escaping
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');  // Escape double quotes since we use them for attributes
        // Note: Apostrophes (') don't need escaping when using double quotes for attributes
}

/**
 * Log conversation to Supabase
 */
async function logConversation(supabase, data) {
    try {
        const { error } = await supabase
            .from('chat_conversations')
            .insert([data]);

        if (error) {
            console.error('Failed to log conversation:', error);
        }
    } catch (err) {
        console.error('Error logging to Supabase:', err);
    }
}

/**
 * Get IP address from Express request object
 * Handles localhost, proxies, and various connection scenarios
 * @param {Object} req - Express request object
 * @returns {string|null} IP address or null if unavailable
 */
function getIpAddress(req) {
    if (!req) return null;
    
    let ipAddress = null;
    
    // Try multiple sources in order of preference
    if (req.ip) {
        ipAddress = req.ip;
    } else if (req.headers['x-forwarded-for']) {
        // X-Forwarded-For can contain multiple IPs, take the first (original client)
        ipAddress = req.headers['x-forwarded-for'].split(',')[0].trim();
    } else if (req.connection?.remoteAddress) {
        ipAddress = req.connection.remoteAddress;
    } else if (req.socket?.remoteAddress) {
        ipAddress = req.socket.remoteAddress;
    }
    
    // Normalize IPv6 localhost to IPv4 for consistency
    if (ipAddress === '::1' || ipAddress === '::ffff:127.0.0.1') {
        ipAddress = '127.0.0.1';
    }
    
    // Only use localhost fallback if we truly can't determine anything
    // This handles cases where middleware hasn't set req.ip yet
    if (!ipAddress) {
        // Check if we're actually on localhost by examining the connection
        const isLocalhost = !req.connection || 
                           req.connection.remoteAddress === '::1' || 
                           req.connection.remoteAddress === '127.0.0.1' ||
                           !req.connection.remoteAddress;
        if (isLocalhost) {
            ipAddress = '127.0.0.1';
        }
    }
    
    return ipAddress;
}

module.exports = {
    sanitizeIntroHTML,
    escapeHtml,
    logConversation,
    getIpAddress
};

