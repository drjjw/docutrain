/**
 * Document routes
 * Handles document registry, meta tags, and owner configurations
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

/**
 * Create documents router
 */
function createDocumentsRouter(supabase, documentRegistry, registryState, escapeHtml) {
    // Helper function to serve index.html with dynamic meta tags
    async function serveIndexWithMetaTags(req, res, indexPath) {
        try {
            // Read the index.html file
            let html = fs.readFileSync(indexPath, 'utf8');
            
            // Check if doc parameter is provided
            const docParam = req.query.doc;
            
            if (docParam) {
                // Parse multiple documents (support for + separator)
                const docSlugs = docParam.split('+').map(s => s.trim()).filter(s => s);
                
                if (docSlugs.length > 0) {
                    // Fetch document configs
                    const docConfigs = await Promise.all(
                        docSlugs.map(slug => documentRegistry.getDocumentBySlug(slug))
                    );
                    
                    // Filter out null results
                    const validConfigs = docConfigs.filter(c => c !== null);
                    
                    if (validConfigs.length > 0) {
                        // Build title and description
                        const isMultiDoc = validConfigs.length > 1;
                        const combinedTitle = validConfigs.map(c => c.title).join(' + ');
                        const metaDescription = isMultiDoc 
                            ? `Multi-document search across ${validConfigs.length} documents: ${combinedTitle}`
                            : (validConfigs[0].subtitle || validConfigs[0].welcome_message || 'AI-powered document assistant');
                        
                        // Escape HTML to prevent XSS
                        const escapedTitle = escapeHtml(combinedTitle);
                        const escapedDescription = escapeHtml(metaDescription);
                        
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
                        
                        console.log(`📄 Serving index.html with dynamic meta tags for: ${combinedTitle}`);
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

    // GET / - Root route with dynamic meta tags
    router.get('/', async (req, res) => {
        const indexPath = path.join(__dirname, '../../public', 'index.html');
        await serveIndexWithMetaTags(req, res, indexPath);
    });

    // GET /index.php - Joomla/Apache compatibility
    router.get('/index.php', async (req, res) => {
        const indexPath = path.join(__dirname, '../../public', 'index.html');
        await serveIndexWithMetaTags(req, res, indexPath);
    });

    // GET *.php - Catch-all for PHP requests
    router.get('*.php', (req, res) => {
        res.sendFile(path.join(__dirname, '../../public', 'index.html'));
    });

    // GET /api/documents - Document registry API
    router.get('/api/documents', async (req, res) => {
        try {
            const docs = await documentRegistry.getDocumentsForAPI();
            res.json({ documents: docs });
        } catch (error) {
            console.error('Error fetching documents:', error);
            res.status(500).json({ error: 'Failed to fetch documents' });
        }
    });

    // GET /api/owners - Owner logo configurations
    router.get('/api/owners', async (req, res) => {
        try {
            const { data: owners, error } = await supabase
                .from('owners')
                .select('slug, name, logo_url, metadata')
                .not('logo_url', 'is', null);

            if (error) {
                console.error('Error fetching owners:', error);
                return res.status(500).json({ error: 'Failed to fetch owners' });
            }

            // Transform the data to match the expected format
            const ownerConfigs = {};
            owners.forEach(owner => {
                if (owner.logo_url) {
                    ownerConfigs[owner.slug] = {
                        logo: owner.logo_url,
                        alt: owner.metadata?.logo_alt || owner.name,
                        link: owner.metadata?.logo_link || '#',
                        accentColor: owner.metadata?.accent_color || '#cc0000'
                    };
                }
            });

            res.json({ owners: ownerConfigs });
        } catch (error) {
            console.error('Error in owners API:', error);
            res.status(500).json({ error: 'Failed to fetch owners' });
        }
    });

    // POST /api/refresh-registry - Force registry refresh (admin)
    router.post('/api/refresh-registry', async (req, res) => {
        try {
            console.log('🔄 Forcing document registry refresh...');

            // Force refresh the document registry
            await documentRegistry.refreshRegistry();

            // Reload active slugs
            registryState.activeDocumentSlugs = await documentRegistry.getActiveSlugs();

            console.log('✅ Document registry refreshed successfully');

            res.json({
                success: true,
                message: 'Document registry cache cleared and refreshed',
                documentCount: registryState.activeDocumentSlugs.length
            });

        } catch (error) {
            console.error('Registry refresh error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to refresh document registry',
                error: error.message
            });
        }
    });

    return router;
}

module.exports = {
    createDocumentsRouter
};

