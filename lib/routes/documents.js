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
        // If there's a doc parameter, redirect to /chat with the parameter
        if (req.query.doc) {
            const queryString = new URLSearchParams(req.query).toString();
            return res.redirect(`/chat?${queryString}`);
        }
        
        // Otherwise, serve the landing page
        const indexPath = path.join(__dirname, '../../public', 'index.html');
        res.sendFile(indexPath);
    });

    // GET /goodbye - Goodbye page for declined disclaimer (excluded from document modal)
    router.get('/goodbye', async (req, res) => {
        const indexPath = path.join(__dirname, '../../public', 'index.html');
        let html = fs.readFileSync(indexPath, 'utf8');

        // Replace page title and content to show goodbye message
        html = html.replace(
            /<title>.*?<\/title>/,
            `<title>Thank You - AI Document Assistant</title>`
        );

        html = html.replace(
            /<meta name="description" content=".*?">/,
            `<meta name="description" content="Thank you for your interest in our AI document assistant. We understand you prefer not to proceed at this time. You are welcome to return whenever you wish."></meta>`
        );

        // Add a script to hide the document modal and show a goodbye message
        const goodbyeScript = `
        <script>
            // Hide document modal and show goodbye message on load
            document.addEventListener('DOMContentLoaded', function() {
                // Hide document selector overlay if present
                const overlay = document.getElementById('documentSelectorOverlay');
                if (overlay) overlay.style.display = 'none';

                // Hide input container and chat interface
                const inputContainer = document.querySelector('.input-container');
                const chatContainer = document.getElementById('chatContainer');

                if (inputContainer) inputContainer.style.display = 'none';
                if (chatContainer) chatContainer.style.display = 'none';

                // Hide the about icon since there's no document context
                const aboutIcon = document.getElementById('aboutIcon');
                if (aboutIcon) aboutIcon.style.display = 'none';

                // Update header to show goodbye message
                const headerTitle = document.getElementById('headerTitle');
                const headerSubtitle = document.getElementById('headerSubtitle');

                if (headerTitle) headerTitle.textContent = 'Thank You';
                if (headerSubtitle) headerSubtitle.textContent = 'You are welcome to return anytime';

                // Create and show goodbye message
                const goodbyeContainer = document.createElement('div');
                goodbyeContainer.style.cssText = \`
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    text-align: center;
                    padding: 2rem;
                    max-width: 500px;
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                    z-index: 1000;
                \`;

                goodbyeContainer.innerHTML = \`
                    <h2 style="color: #333; margin-bottom: 1rem; font-size: 1.5rem;">Thank You for Your Interest</h2>
                    <p style="color: #666; line-height: 1.6; margin-bottom: 1.5rem;">
                        We understand you prefer not to proceed with the disclaimer at this time.
                        You are always welcome to return and explore our AI document assistant whenever you're ready.
                    </p>
                    <p style="color: #888; font-size: 0.9rem;">
                        Have a great day!
                    </p>
                \`;

                document.body.appendChild(goodbyeContainer);
            });
        </script>
        `;

        // Insert the goodbye script before the closing body tag
        html = html.replace('</body>', goodbyeScript + '</body>');

        res.send(html);
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

    // GET /api/documents - Document registry API with optional filtering
    router.get('/api/documents', async (req, res) => {
        try {
            const { doc, owner, passcode } = req.query;
            
            // Try to get authenticated user (optional)
            let userId = null;
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.split(' ')[1];
                console.log(`🔐 Auth header present, extracting user from token...`);
                try {
                    const { data: { user }, error } = await supabase.auth.getUser(token);
                    if (error) {
                        console.log(`❌ Auth error:`, error);
                    } else if (user) {
                        userId = user.id;
                        console.log(`✅ Authenticated user: ${userId} (${user.email})`);
                    } else {
                        console.log(`⚠️ No user returned from token`);
                    }
                } catch (error) {
                    console.log(`❌ Exception getting user:`, error);
                    // Ignore - treat as unauthenticated
                }
            } else {
                console.log(`🔓 No auth header - treating as unauthenticated`);
            }
            
            // If doc parameter is provided, return only that document
            if (doc) {
                const docSlugs = doc.split(/[\s+]+/).map(s => s.trim()).filter(s => s);
                console.log(`🔍 Fetching documents: ${docSlugs.join(', ')}`);
                if (passcode) {
                    console.log(`🔐 Passcode provided in query parameter`);
                }

                const docConfigs = await Promise.all(
                    docSlugs.map(slug => documentRegistry.getDocumentBySlug(slug))
                );

                console.log(`📊 Document configs retrieved:`, docConfigs.map((c, i) => ({
                    slug: docSlugs[i],
                    found: c !== null,
                    title: c?.title
                })));

                let validConfigs = docConfigs.filter(c => c !== null);
                
                // Filter by access permissions (with optional passcode)
                console.log(`🔒 Checking access for ${validConfigs.length} documents with userId: ${userId || 'null'}`);
                const accessChecks = await Promise.all(
                    validConfigs.map(async (doc) => {
                        console.log(`🔍 Checking access for document: ${doc.slug}`);
                        const { data: hasAccess, error } = await supabase
                            .rpc('user_has_document_access_by_slug', {
                                p_user_id: userId,
                                p_document_slug: doc.slug,
                                p_passcode: passcode || null,
                            });
                        if (error) {
                            console.log(`❌ Access check error for ${doc.slug}:`, error);
                        }
                        const accessResult = hasAccess || false;
                        console.log(`🔍 Access result for ${doc.slug}: ${accessResult}`);
                        return accessResult;
                    })
                );

                console.log(`📊 Access check results:`, accessChecks);
                validConfigs = validConfigs.filter((doc, index) => accessChecks[index]);
                console.log(`✅ After access filtering: ${validConfigs.length} documents remaining`);
                
                if (validConfigs.length === 0) {
                    // Check if any of the requested documents exist at all
                    const docExistsChecks = await Promise.all(
                        docSlugs.map(async (slug) => {
                            const { data, error } = await supabase
                                .from('documents')
                                .select('slug, title')
                                .eq('slug', slug)
                                .eq('active', true)
                                .single();
                            return { slug, exists: !error && data };
                        })
                    );
                    
                    const nonExistentDocs = docExistsChecks.filter(check => !check.exists);
                    const existentDocs = docExistsChecks.filter(check => check.exists);
                    
                    if (nonExistentDocs.length > 0) {
                        const errorMessage = nonExistentDocs.length === 1 
                            ? `Document "${nonExistentDocs[0].slug}" not found`
                            : `Documents not found: ${nonExistentDocs.map(d => d.slug).join(', ')}`;
                        
                        return res.status(404).json({ 
                            error: errorMessage,
                            error_type: 'document_not_found',
                            requested_slugs: docSlugs,
                            non_existent_slugs: nonExistentDocs.map(d => d.slug),
                            existent_slugs: existentDocs.map(d => d.slug)
                        });
                    } else {
                        // All documents exist but user doesn't have access
                        return res.status(403).json({ 
                            error: 'Access denied to requested document(s)',
                            error_type: 'access_denied',
                            requested_slugs: docSlugs
                        });
                    }
                }
                
                // Transform to API format
                const apiDocs = validConfigs.map(doc => ({
                    slug: doc.slug,
                    title: doc.title,
                    subtitle: doc.subtitle,
                    cover: doc.cover,
                    backLink: doc.back_link,
                    welcomeMessage: doc.welcome_message,
                    introMessage: doc.intro_message || doc.owner_intro_message || null,
                    embeddingType: doc.embedding_type,
                    year: doc.year,
                    category: doc.category,
                    active: doc.active,
                    owner: doc.owner,
                    metadata: doc.metadata || {},
                    downloads: doc.downloads || [],
                    showDocumentSelector: doc.show_document_selector || false,
                    ownerInfo: doc.owner_slug ? {
                        slug: doc.owner_slug,
                        name: doc.owner_name
                    } : null
                }));
                
                console.log(`📄 Returned ${apiDocs.length} document(s) for doc=${doc}`);
                return res.json({ documents: apiDocs });
            }
            
            // If owner parameter is provided, return only that owner's documents
            if (owner) {
                const allDocs = await documentRegistry.getDocumentsForAPI();
                const ownerDocs = allDocs.filter(d => d.ownerInfo && d.ownerInfo.slug === owner);
                
                if (ownerDocs.length === 0) {
                    return res.status(404).json({ error: 'No documents found for this owner' });
                }
                
                console.log(`📂 Returned ${ownerDocs.length} documents for owner=${owner}`);
                return res.json({ documents: ownerDocs });
            }
            
            // No filters - return all documents (backward compatibility)
            const docs = await documentRegistry.getDocumentsForAPI();
            console.log(`📚 Returned all ${docs.length} documents (no filters)`);
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

