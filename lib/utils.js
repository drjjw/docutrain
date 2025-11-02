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

module.exports = {
    sanitizeIntroHTML,
    escapeHtml,
    logConversation
};

