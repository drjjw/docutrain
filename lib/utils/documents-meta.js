/**
 * Document routes meta tag utilities
 * HTML meta tag manipulation and serving
 */

const fs = require('fs');

/**
 * Build meta tags from document configs
 * @param {Array} docConfigs - Array of document config objects
 * @returns {{title: string, description: string}}
 */
function buildMetaTags(docConfigs) {
    const isMultiDoc = docConfigs.length > 1;
    const combinedTitle = docConfigs.map(c => c.title).join(' + ');
    const metaDescription = isMultiDoc 
        ? `Multi-document search across ${docConfigs.length} documents: ${combinedTitle}`
        : (docConfigs[0].subtitle || docConfigs[0].welcome_message || 'AI-powered document assistant');
    
    return {
        title: combinedTitle,
        description: metaDescription
    };
}

/**
 * Serve index.html with dynamic meta tags based on doc parameter
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {string} indexPath - Path to index.html file
 * @param {object} documentRegistry - Document registry instance
 * @param {function} escapeHtml - HTML escaping function
 */
async function serveIndexWithMetaTags(req, res, indexPath, documentRegistry, escapeHtml) {
    try {
        // Read the index.html file
        let html = fs.readFileSync(indexPath, 'utf8');
        
        // Check if doc parameter is provided
        const docParam = req.query.doc;
        
        if (docParam) {
            // Parse multiple documents (support for + separator)
            // Note: + in URLs gets decoded as space, so handle both
            const docSlugs = docParam.split(/[\s+]+/).map(s => s.trim()).filter(s => s);
            
            if (docSlugs.length > 0) {
                // Fetch document configs
                const docConfigs = await Promise.all(
                    docSlugs.map(slug => documentRegistry.getDocumentBySlug(slug))
                );
                
                // Filter out null results
                const validConfigs = docConfigs.filter(c => c !== null);
                
                if (validConfigs.length > 0) {
                    // Build title and description
                    const { title, description } = buildMetaTags(validConfigs);
                    
                    // Escape HTML to prevent XSS
                    const escapedTitle = escapeHtml(title);
                    const escapedDescription = escapeHtml(description);
                    
                    // Replace meta tags in HTML
                    html = html.replace(
                        /<title>.*?<\/title>/,
                        `<title>${escapedTitle}</title>`
                    );
                    
                    html = html.replace(
                        /<meta name="description" content=".*?">/,
                        `<meta name="description" content="${escapedDescription}">`
                    );
                    
                    html = html.replace(
                        /<meta property="og:title" content=".*?">/,
                        `<meta property="og:title" content="${escapedTitle}">`
                    );
                    
                    html = html.replace(
                        /<meta property="og:description" content=".*?">/,
                        `<meta property="og:description" content="${escapedDescription}">`
                    );
                    
                    html = html.replace(
                        /<meta name="twitter:title" content=".*?">/,
                        `<meta name="twitter:title" content="${escapedTitle}">`
                    );
                    
                    html = html.replace(
                        /<meta name="twitter:description" content=".*?">/,
                        `<meta name="twitter:description" content="${escapedDescription}">`
                    );
                    
                    console.log(`📄 Serving index.html with dynamic meta tags for: ${title}`);
                }
            }
        }
        
        // Send the modified HTML
        res.send(html);
    } catch (error) {
        console.error('Error serving index.html with dynamic meta tags:', error);
        // Fallback to static file on error
        res.sendFile(indexPath);
    }
}

module.exports = {
    buildMetaTags,
    serveIndexWithMetaTags
};

