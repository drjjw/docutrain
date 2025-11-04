/**
 * Document routes
 * Handles document registry, meta tags, and owner configurations
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { getIpAddress } = require('../utils');

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
            const { doc, owner, passcode, forceRefresh } = req.query;
            const shouldForceRefresh = forceRefresh === 'true' || forceRefresh === true;
            
            // Create service role client for bypassing RLS when checking access levels
            const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
            let serviceSupabase = supabase; // Default to regular client
            if (serviceRoleKey && process.env.SUPABASE_URL) {
                try {
                    serviceSupabase = createClient(
                        process.env.SUPABASE_URL,
                        serviceRoleKey
                    );
                } catch (error) {
                    console.error('Error creating service role client:', error);
                    // Fallback to regular client
                    serviceSupabase = supabase;
                }
            }
            
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
                    docSlugs.map(slug => documentRegistry.getDocumentBySlug(slug, shouldForceRefresh))
                );

                console.log(`📊 Document configs retrieved:`, docConfigs.map((c, i) => ({
                    slug: docSlugs[i],
                    found: c !== null,
                    title: c?.title
                })));

                let validConfigs = docConfigs.filter(c => c !== null);
                
                // Filter by access permissions (with optional passcode)
                console.log(`🔒 Checking access for ${validConfigs.length} documents with userId: ${userId || 'null'}`);

                let accessChecks = [];
                // IMPORTANT: Skip batch access check if passcode is provided OR if any documents might be passcode-protected
                // The batch function treats all passcode-protected docs as public, which is incorrect
                // We need to check document access_levels first to determine if we can use batch
                
                // Check if any documents are passcode-protected (to decide whether to use batch or individual checks)
                let hasPasscodeProtectedDocs = false;
                if (!passcode && validConfigs.length > 0) {
                    // Query documents to check access_level using service role to bypass RLS
                    try {
                        const { data: docAccessLevels, error: accessLevelError } = await serviceSupabase
                            .from('documents')
                            .select('slug, access_level')
                            .in('slug', validConfigs.map(doc => doc.slug))
                            .eq('active', true);
                        
                        if (!accessLevelError && docAccessLevels) {
                            hasPasscodeProtectedDocs = docAccessLevels.some(doc => doc.access_level === 'passcode');
                            if (hasPasscodeProtectedDocs) {
                                console.log(`🔐 Found passcode-protected document(s) - using individual access checks`);
                            }
                        } else if (accessLevelError) {
                            console.log(`⚠️  Error checking access levels, using individual checks for safety:`, accessLevelError.message);
                            // If we can't check access levels, use individual checks to be safe
                            hasPasscodeProtectedDocs = true;
                        }
                    } catch (queryError) {
                        console.log(`⚠️  Exception checking access levels, using individual checks for safety:`, queryError.message);
                        // If we can't check access levels, use individual checks to be safe
                        hasPasscodeProtectedDocs = true;
                    }
                }
                
                if (passcode || hasPasscodeProtectedDocs) {
                    console.log(`🔐 Using individual access checks ${passcode ? '(passcode provided)' : '(passcode-protected docs detected)'}`);
                    accessChecks = await Promise.all(
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
                } else {
                    // No passcode-protected docs and no passcode provided - can use batch check for efficiency
                    try {
                        console.log(`🔄 Attempting batch access check for ${validConfigs.length} documents`);
                        const { data: batchResults, error: batchError } = await supabase
                            .rpc('user_has_multiple_document_access', {
                                p_user_id: userId,
                                p_document_slugs: validConfigs.map(doc => doc.slug)
                            });

                        if (batchError) {
                            console.log(`⚠️  Batch access check failed, falling back to individual checks:`, batchError.message);
                            throw batchError;
                        }

                        // Convert batch results to access array
                        const accessMap = {};
                        batchResults.forEach(result => {
                            accessMap[result.document_slug] = result.has_access;
                        });

                        accessChecks = validConfigs.map(doc => {
                            const hasAccess = accessMap[doc.slug] || false;
                            console.log(`🔍 Access result for ${doc.slug}: ${hasAccess}`);
                            return hasAccess;
                        });

                        console.log(`✅ Batch access check completed in single query`);

                    } catch (batchError) {
                        // Fallback to individual access checks
                        console.log(`🔄 Falling back to individual access checks`);
                        accessChecks = await Promise.all(
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
                    }
                }

                console.log(`📊 Access check results:`, accessChecks);
                validConfigs = validConfigs.filter((doc, index) => accessChecks[index]);
                console.log(`✅ After access filtering: ${validConfigs.length} documents remaining`);
                
                if (validConfigs.length === 0) {
                    // Check if any of the requested documents exist at all and what their access requirements are
                    // Use service role client to bypass RLS when checking document existence and access levels
                    const docExistsChecks = await Promise.all(
                        docSlugs.map(async (slug) => {
                            const { data, error } = await serviceSupabase
                                .from('documents')
                                .select('slug, title, access_level, passcode')
                                .eq('slug', slug)
                                .eq('active', true)
                                .single();
                            return { 
                                slug, 
                                exists: !error && data,
                                access_level: data?.access_level,
                                requires_passcode: !!data?.passcode,
                                title: data?.title
                            };
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
                        // Check if any require passcode and none was provided
                        const passcodeRequiredDocs = existentDocs.filter(doc => 
                            doc.access_level === 'passcode' && doc.requires_passcode && !passcode
                        );
                        
                        if (passcodeRequiredDocs.length > 0) {
                            // Passcode required but not provided
                            const docInfo = existentDocs[0]; // Use first document for error info
                            console.log(`🔐 Returning passcode_required error for document: ${docInfo.slug}`);
                            return res.status(403).json({ 
                                error: 'This document requires a passcode to access',
                                error_type: 'passcode_required',
                                requested_slugs: docSlugs,
                                document_info: {
                                    title: docInfo.title || docInfo.slug,
                                    access_level: docInfo.access_level,
                                    requires_passcode: docInfo.requires_passcode
                                }
                            });
                        }
                        
                        // Regular access denied
                        console.log(`🚫 Returning access_denied error for document(s): ${docSlugs.join(', ')}`);
                        return res.status(403).json({ 
                            error: 'Access denied to requested document(s)',
                            error_type: 'access_denied',
                            requested_slugs: docSlugs
                        });
                    }
                }
                
                // Transform to API format
                const apiDocs = validConfigs.map(doc => {
                    // Extract keywords from metadata if available
                    const keywords = doc.metadata?.keywords || null;
                    
                    // Determine intro message: document override > owner default > null
                    let introMessage = null;
                    if (doc.intro_message) {
                        // Document has its own intro message (override)
                        introMessage = documentRegistry.sanitizeIntroHTML(doc.intro_message);
                    } else if (doc.owner_intro_message) {
                        // Use owner's default intro message
                        introMessage = documentRegistry.sanitizeIntroHTML(doc.owner_intro_message);
                    }
                    // Otherwise remains null (no intro message)
                    
                    return {
                        slug: doc.slug,
                        title: doc.title,
                        subtitle: doc.subtitle,
                        cover: doc.cover,
                        backLink: doc.back_link,
                        welcomeMessage: doc.welcome_message,
                        introMessage: introMessage,
                        embeddingType: doc.embedding_type,
                        year: doc.year,
                        category: doc.category,
                        active: doc.active,
                        owner: doc.owner,
                        metadata: doc.metadata || {},
                        keywords: keywords, // Include keywords for frontend display
                        downloads: doc.downloads || [], // Will be replaced with attachments if available
                        showDocumentSelector: doc.show_document_selector !== false, // Controls document selector visibility (default true)
                        showKeywords: doc.show_keywords !== false, // Controls keywords visibility (default true)
                        showDownloads: doc.show_downloads !== false, // Controls downloads visibility (default true)
                        ownerInfo: doc.owner_slug ? {
                            slug: doc.owner_slug,
                            name: doc.owner_name
                        } : null
                    };
                });

                // Fetch attachments for all documents in parallel
                const documentIds = validConfigs.map(doc => doc.id).filter(id => id);
                let attachmentsMap = {};
                if (documentIds.length > 0) {
                    try {
                        const { data: attachmentsData, error: attachmentsError } = await serviceSupabase
                            .from('document_attachments')
                            .select('id, document_id, title, url, display_order')
                            .in('document_id', documentIds)
                            .order('display_order', { ascending: true });
                        
                        if (!attachmentsError && attachmentsData) {
                            // Group attachments by document_id
                            attachmentsData.forEach(attachment => {
                                if (!attachmentsMap[attachment.document_id]) {
                                    attachmentsMap[attachment.document_id] = [];
                                }
                                attachmentsMap[attachment.document_id].push({
                                    title: attachment.title,
                                    url: attachment.url,
                                    attachment_id: attachment.id // Include attachment ID for tracking
                                });
                            });
                        }
                    } catch (error) {
                        console.error('Error fetching attachments:', error);
                        // Continue with legacy downloads as fallback
                    }
                }

                // Update downloads field with attachments if available
                apiDocs.forEach(doc => {
                    const docId = validConfigs.find(d => d.slug === doc.slug)?.id;
                    if (docId && attachmentsMap[docId] && attachmentsMap[docId].length > 0) {
                        doc.downloads = attachmentsMap[docId];
                    }
                });

                // No caching - always return fresh data
                res.set({
                    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                });

                console.log(`📄 Returned ${apiDocs.length} document(s) for doc=${doc}`);
                return res.json({ 
                    documents: apiDocs
                });
            }
            
            // If owner parameter is provided, return only that owner's documents with access filtering
            if (owner) {
                const allDocs = await documentRegistry.getDocumentsForAPI();
                let ownerDocs = allDocs.filter(d => d.ownerInfo && d.ownerInfo.slug === owner);

                if (ownerDocs.length === 0) {
                    return res.status(404).json({ error: 'No documents found for this owner' });
                }

                // Filter by access permissions (with optional passcode) - same logic as single document fetch
                console.log(`🔒 Checking access for ${ownerDocs.length} owner documents with userId: ${userId || 'null'}`);

                let accessChecks = [];
                // IMPORTANT: Skip batch access check if passcode is provided OR if any documents might be passcode-protected
                let hasPasscodeProtectedDocs = false;
                if (!passcode && ownerDocs.length > 0) {
                    // Query documents to check access_level using service role to bypass RLS
                    try {
                        const { data: docAccessLevels, error: accessLevelError } = await serviceSupabase
                            .from('documents')
                            .select('slug, access_level')
                            .in('slug', ownerDocs.map(doc => doc.slug))
                            .eq('active', true);

                        if (!accessLevelError && docAccessLevels) {
                            hasPasscodeProtectedDocs = docAccessLevels.some(doc => doc.access_level === 'passcode');
                            if (hasPasscodeProtectedDocs) {
                                console.log(`🔐 Found passcode-protected document(s) - using individual access checks`);
                            }
                        } else if (accessLevelError) {
                            console.log(`⚠️  Error checking access levels, using individual checks for safety:`, accessLevelError.message);
                            hasPasscodeProtectedDocs = true;
                        }
                    } catch (queryError) {
                        console.log(`⚠️  Exception checking access levels, using individual checks for safety:`, queryError.message);
                        hasPasscodeProtectedDocs = true;
                    }
                }

                if (!hasPasscodeProtectedDocs && !passcode) {
                    // Use batch access check for efficiency
                    console.log(`🔍 Using batch access check for ${ownerDocs.length} documents`);
                    try {
                        const { data: batchAccessResults, error: batchError } = await supabase
                            .rpc('batch_user_has_document_access', {
                                p_user_id: userId,
                                p_document_slugs: ownerDocs.map(doc => doc.slug)
                            });

                        if (!batchError && batchAccessResults) {
                            accessChecks = batchAccessResults.map(result => result.has_access);
                            console.log(`📊 Batch access results:`, accessChecks);
                        } else {
                            throw batchError || new Error('No batch results');
                        }
                    } catch (batchError) {
                        // Fallback to individual access checks
                        console.log(`🔄 Falling back to individual access checks for owner docs`);
                        accessChecks = await Promise.all(
                            ownerDocs.map(async (doc) => {
                                console.log(`🔍 Checking access for owner document: ${doc.slug}`);
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
                    }
                } else {
                    // Use individual access checks (required for passcode-protected docs)
                    console.log(`🔍 Using individual access checks for ${ownerDocs.length} owner documents`);
                    accessChecks = await Promise.all(
                        ownerDocs.map(async (doc) => {
                            console.log(`🔍 Checking access for owner document: ${doc.slug}`);
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
                }

                console.log(`📊 Owner document access check results:`, accessChecks);
                ownerDocs = ownerDocs.filter((doc, index) => accessChecks[index]);
                console.log(`✅ After access filtering: ${ownerDocs.length} owner documents remaining`);

                if (ownerDocs.length === 0) {
                    // Check if any documents exist for this owner and what their access requirements are
                    const { data: ownerDocData, error: ownerDocError } = await serviceSupabase
                        .from('documents')
                        .select('slug, title, access_level, passcode')
                        .eq('owner', owner)
                        .eq('active', true);

                    if (ownerDocError) {
                        console.log(`⚠️  Error checking owner documents:`, ownerDocError.message);
                        return res.status(500).json({ error: 'Failed to check owner documents' });
                    }

                    const passcodeRequiredDocs = ownerDocData.filter(doc =>
                        doc.access_level === 'passcode' && doc.passcode && !passcode
                    );

                    if (passcodeRequiredDocs.length > 0) {
                        // Passcode required but not provided
                        console.log(`🔐 Returning passcode_required error for owner: ${owner}`);
                        return res.status(403).json({
                            error: 'This owner\'s documents require a passcode to access',
                            error_type: 'passcode_required',
                            owner: owner,
                            document_count: passcodeRequiredDocs.length
                        });
                    }

                    // Regular access denied
                    console.log(`🚫 Returning access_denied error for owner: ${owner}`);
                    return res.status(403).json({
                        error: 'Access denied to this owner\'s documents',
                        error_type: 'access_denied',
                        owner: owner
                    });
                }

                console.log(`📂 Returned ${ownerDocs.length} accessible documents for owner=${owner}`);
                return res.json({
                    documents: ownerDocs
                });
            }
            
            // No filters - return all documents (backward compatibility)
            const docs = await documentRegistry.getDocumentsForAPI();
            console.log(`📚 Returned all ${docs.length} documents (no filters)`);
            res.json({ 
                documents: docs
            });
        } catch (error) {
            console.error('Error fetching documents:', error);
            console.error('Error stack:', error.stack);
            res.status(500).json({ error: 'Failed to fetch documents', details: error.message });
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

            // No caching - always return fresh data
            res.set({
                'Cache-Control': 'no-store, no-cache, must-revalidate, private',
                'Pragma': 'no-cache',
                'Expires': '0'
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

    // PUT /api/documents/:identifier - Update document fields (supports both slug and ID)
    router.put('/api/documents/:identifier', async (req, res) => {
        const { identifier } = req.params;
        const updates = req.body;

        try {
            // Get authenticated user
            let userId = null;
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.split(' ')[1];
                try {
                    const { data: { user }, error } = await supabase.auth.getUser(token);
                    if (!error && user) {
                        userId = user.id;
                    }
                } catch (error) {
                    console.error('Auth error:', error);
                }
            }

            if (!userId) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            // Get document info first (using service role to bypass RLS)
            const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
            const serviceSupabase = createClient(
                process.env.SUPABASE_URL,
                serviceRoleKey
            );

            // Check if identifier is a UUID (document ID) or a slug
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
            
            let docQuery = serviceSupabase
                .from('documents')
                .select('id, owner_id, slug');
            
            if (isUUID) {
                docQuery = docQuery.eq('id', identifier);
            } else {
                docQuery = docQuery.eq('slug', identifier);
            }
            
            const { data: doc, error: docError } = await docQuery.single();

            if (docError || !doc) {
                return res.status(404).json({ error: 'Document not found' });
            }

            // Check edit permissions using service role client to bypass RLS
            const { data: superAdminCheck, error: superAdminError } = await serviceSupabase
                .from('user_roles')
                .select('id, owner_id')
                .eq('user_id', userId)
                .eq('role', 'super_admin')
                .limit(10);

            let isSuperAdmin = false;
            if (!superAdminError && superAdminCheck && superAdminCheck.length > 0) {
                // Check if user is a global super admin (owner_id IS NULL)
                isSuperAdmin = superAdminCheck.some(r => r.owner_id === null);
                
                // Also check if user is super admin for document's owner group
                if (!isSuperAdmin && doc.owner_id) {
                    isSuperAdmin = superAdminCheck.some(r => r.owner_id === doc.owner_id);
                }
            }

            // Check if user is owner_admin for document's owner group
            let isOwnerAdmin = false;
            if (doc.owner_id) {
                const { data: ownerAdminCheck, error: ownerAdminError } = await serviceSupabase
                    .from('user_roles')
                    .select('id')
                    .eq('user_id', userId)
                    .eq('owner_id', doc.owner_id)
                    .eq('role', 'owner_admin')
                    .limit(1);
                
                isOwnerAdmin = !ownerAdminError && ownerAdminCheck && ownerAdminCheck.length > 0;
            }

            if (!isSuperAdmin && !isOwnerAdmin) {
                console.log(`❌ Permission denied for user ${userId} on document ${identifier}`);
                return res.status(403).json({ error: 'Permission denied' });
            }

            // Check if user is trying to change owner_id
            // Only super admins can change ownership
            if ('owner_id' in updates && updates.owner_id !== doc.owner_id) {
                if (!isSuperAdmin) {
                    console.log(`❌ Permission denied: Only super admins can change document ownership`);
                    return res.status(403).json({ error: 'Only super admins can change document ownership' });
                }
            }

            // Validate updates
            const allowedFields = [
                'title', 'subtitle', 'welcome_message', 'intro_message',
                'back_link', 'category', 'year', 'cover', 'downloads',
                'chunk_limit_override', 'show_document_selector', 'show_keywords', 'show_downloads', 'active',
                'access_level', 'passcode', 'slug', 'owner_id'
            ];

            const filteredUpdates = {};
            Object.keys(updates).forEach(key => {
                if (allowedFields.includes(key)) {
                    filteredUpdates[key] = updates[key];
                }
            });

            // Convert empty strings to null for UUID fields (owner_id)
            if ('owner_id' in filteredUpdates && filteredUpdates.owner_id === '') {
                filteredUpdates.owner_id = null;
            }

            // Sync owner string field when owner_id changes
            if ('owner_id' in filteredUpdates && filteredUpdates.owner_id !== doc.owner_id) {
                if (filteredUpdates.owner_id) {
                    // Fetch owner slug from owners table
                    const { data: ownerData, error: ownerError } = await serviceSupabase
                        .from('owners')
                        .select('slug')
                        .eq('id', filteredUpdates.owner_id)
                        .single();
                    
                    if (!ownerError && ownerData) {
                        filteredUpdates.owner = ownerData.slug;
                    } else {
                        console.warn(`⚠️  Could not find owner slug for owner_id: ${filteredUpdates.owner_id}`);
                    }
                } else {
                    // owner_id is null, set owner to null as well
                    filteredUpdates.owner = null;
                }
            }

            if (Object.keys(filteredUpdates).length === 0) {
                return res.status(400).json({ error: 'No valid fields to update' });
            }

            // Add updated_at timestamp
            filteredUpdates.updated_at = new Date().toISOString();

            // Update document using service role client to bypass RLS (use ID to ensure we update the correct document)
            const { data: updatedDoc, error: updateError } = await serviceSupabase
                .from('documents')
                .update(filteredUpdates)
                .eq('id', doc.id)
                .select()
                .single();

            if (updateError) {
                console.error('Document update error:', updateError);
                return res.status(500).json({ error: 'Failed to update document' });
            }

            // Refresh document registry cache
            await documentRegistry.refreshRegistry();

            console.log(`✅ Document ${doc.id} (${doc.slug}) updated by user ${userId}`);

            res.json(updatedDoc);

        } catch (error) {
            console.error('Update document error:', error);
            res.status(500).json({ error: 'Server error' });
        }
    });

    // ============================================================================
    // Attachment API Endpoints
    // ============================================================================

    // GET /api/attachments/:documentId - List attachments for a document
    router.get('/api/attachments/:documentId', async (req, res) => {
        try {
            const { documentId } = req.params;

            // Get authenticated user
            let userId = null;
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.split(' ')[1];
                try {
                    const { data: { user }, error } = await supabase.auth.getUser(token);
                    if (!error && user) {
                        userId = user.id;
                    }
                } catch (error) {
                    console.error('Auth error:', error);
                }
            }

            // Verify document exists and user has access
            const { data: doc, error: docError } = await supabase
                .from('documents')
                .select('id, slug, access_level, owner_id')
                .eq('id', documentId)
                .single();

            if (docError || !doc) {
                return res.status(404).json({ error: 'Document not found' });
            }

            // Check access (similar to document access check)
            // For now, we'll rely on RLS policies - attachments inherit document access
            const { data: attachments, error } = await supabase
                .from('document_attachments')
                .select('*')
                .eq('document_id', documentId)
                .order('display_order', { ascending: true });

            if (error) {
                console.error('Error fetching attachments:', error);
                return res.status(500).json({ error: 'Failed to fetch attachments' });
            }

            res.json({ attachments: attachments || [] });
        } catch (error) {
            console.error('Error in attachments API:', error);
            res.status(500).json({ error: 'Server error' });
        }
    });

    // POST /api/attachments/:documentId - Create attachment
    router.post('/api/attachments/:documentId', async (req, res) => {
        try {
            const { documentId } = req.params;
            const { title, url, storage_path, file_size, mime_type, display_order } = req.body;

            // Get authenticated user
            let userId = null;
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.split(' ')[1];
                try {
                    const { data: { user }, error } = await supabase.auth.getUser(token);
                    if (!error && user) {
                        userId = user.id;
                    }
                } catch (error) {
                    console.error('Auth error:', error);
                }
            }

            if (!userId) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            // Verify document exists
            const { data: doc, error: docError } = await supabase
                .from('documents')
                .select('id')
                .eq('id', documentId)
                .single();

            if (docError || !doc) {
                return res.status(404).json({ error: 'Document not found' });
            }

            // Validate required fields
            if (!title || !url) {
                return res.status(400).json({ error: 'Title and URL are required' });
            }

            // Get max display_order for this document if not provided
            let order = display_order;
            if (order === undefined || order === null) {
                const { data: existingAttachments } = await supabase
                    .from('document_attachments')
                    .select('display_order')
                    .eq('document_id', documentId)
                    .order('display_order', { ascending: false })
                    .limit(1);

                order = existingAttachments && existingAttachments.length > 0
                    ? existingAttachments[0].display_order + 1
                    : 0;
            }

            // Create attachment
            const { data: attachment, error: insertError } = await supabase
                .from('document_attachments')
                .insert({
                    document_id: documentId,
                    title: title.trim(),
                    url: url.trim(),
                    storage_path: storage_path || null,
                    file_size: file_size || null,
                    mime_type: mime_type || null,
                    display_order: order,
                    created_by_user_id: userId
                })
                .select()
                .single();

            if (insertError) {
                console.error('Error creating attachment:', insertError);
                return res.status(500).json({ error: 'Failed to create attachment' });
            }

            // Refresh document registry cache
            await documentRegistry.refreshRegistry();

            res.status(201).json({ attachment });
        } catch (error) {
            console.error('Error in create attachment API:', error);
            res.status(500).json({ error: 'Server error' });
        }
    });

    // PUT /api/attachments/:attachmentId - Update attachment
    router.put('/api/attachments/:attachmentId', async (req, res) => {
        try {
            const { attachmentId } = req.params;
            const updates = req.body;

            // Get authenticated user
            let userId = null;
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.split(' ')[1];
                try {
                    const { data: { user }, error } = await supabase.auth.getUser(token);
                    if (!error && user) {
                        userId = user.id;
                    }
                } catch (error) {
                    console.error('Auth error:', error);
                }
            }

            if (!userId) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            // Filter allowed fields
            const allowedFields = ['title', 'url', 'storage_path', 'file_size', 'mime_type', 'display_order'];
            const filteredUpdates = {};
            allowedFields.forEach(field => {
                if (updates[field] !== undefined) {
                    filteredUpdates[field] = updates[field];
                }
            });

            // Trim string fields
            if (filteredUpdates.title) filteredUpdates.title = filteredUpdates.title.trim();
            if (filteredUpdates.url) filteredUpdates.url = filteredUpdates.url.trim();

            filteredUpdates.updated_at = new Date().toISOString();

            // Update attachment
            const { data: attachment, error: updateError } = await supabase
                .from('document_attachments')
                .update(filteredUpdates)
                .eq('id', attachmentId)
                .select()
                .single();

            if (updateError) {
                console.error('Error updating attachment:', updateError);
                return res.status(500).json({ error: 'Failed to update attachment' });
            }

            // Refresh document registry cache
            await documentRegistry.refreshRegistry();

            res.json({ attachment });
        } catch (error) {
            console.error('Error in update attachment API:', error);
            res.status(500).json({ error: 'Server error' });
        }
    });

    // DELETE /api/attachments/:attachmentId - Delete attachment
    router.delete('/api/attachments/:attachmentId', async (req, res) => {
        try {
            const { attachmentId } = req.params;

            // Get authenticated user
            let userId = null;
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.split(' ')[1];
                try {
                    const { data: { user }, error } = await supabase.auth.getUser(token);
                    if (!error && user) {
                        userId = user.id;
                    }
                } catch (error) {
                    console.error('Auth error:', error);
                }
            }

            if (!userId) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            // Get attachment to check if it exists and get storage path
            const { data: attachment, error: fetchError } = await supabase
                .from('document_attachments')
                .select('id, storage_path')
                .eq('id', attachmentId)
                .single();

            if (fetchError || !attachment) {
                return res.status(404).json({ error: 'Attachment not found' });
            }

            // Delete from database (CASCADE will handle download tracking records)
            const { error: deleteError } = await supabase
                .from('document_attachments')
                .delete()
                .eq('id', attachmentId);

            if (deleteError) {
                console.error('Error deleting attachment:', deleteError);
                return res.status(500).json({ error: 'Failed to delete attachment' });
            }

            // Optionally delete from storage if storage_path exists
            if (attachment.storage_path) {
                try {
                    const DOWNLOADS_BUCKET = 'downloads';
                    const { error: storageError } = await supabase.storage
                        .from(DOWNLOADS_BUCKET)
                        .remove([attachment.storage_path]);

                    if (storageError) {
                        console.error('Error deleting file from storage:', storageError);
                        // Don't fail the request if storage deletion fails
                    }
                } catch (storageError) {
                    console.error('Storage deletion error:', storageError);
                }
            }

            // Refresh document registry cache
            await documentRegistry.refreshRegistry();

            res.json({ success: true, message: 'Attachment deleted' });
        } catch (error) {
            console.error('Error in delete attachment API:', error);
            res.status(500).json({ error: 'Server error' });
        }
    });

    // POST /api/attachments/:attachmentId/track-download - Track download event
    router.post('/api/attachments/:attachmentId/track-download', async (req, res) => {
        try {
            const { attachmentId } = req.params;

            // Get authenticated user (optional - can be null for anonymous)
            let userId = null;
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.split(' ')[1];
                try {
                    const { data: { user }, error } = await supabase.auth.getUser(token);
                    if (!error && user) {
                        userId = user.id;
                    }
                } catch (error) {
                    // Silent fail - anonymous download
                }
            }

            // Get IP address from request
            const ipAddress = getIpAddress(req);

            // Verify attachment exists
            const { data: attachment, error: attachmentError } = await supabase
                .from('document_attachments')
                .select('id')
                .eq('id', attachmentId)
                .single();

            if (attachmentError || !attachment) {
                return res.status(404).json({ error: 'Attachment not found' });
            }

            // Insert download tracking record
            const { error: insertError } = await supabase
                .from('document_attachment_downloads')
                .insert({
                    attachment_id: attachmentId,
                    user_id: userId,
                    ip_address: ipAddress
                });

            if (insertError) {
                console.error('Error tracking download:', insertError);
                // Don't fail the request if tracking fails
                return res.status(200).json({ success: true, tracked: false });
            }

            res.json({ success: true, tracked: true });
        } catch (error) {
            console.error('Error in track download API:', error);
            // Don't fail the request if tracking fails
            res.status(200).json({ success: true, tracked: false });
        }
    });

    // GET /api/documents/:documentId/analytics - Get document analytics
    router.get('/api/documents/:documentId/analytics', async (req, res) => {
        try {
            const { documentId } = req.params;

            // Get authenticated user
            let userId = null;
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.split(' ')[1];
                try {
                    const { data: { user }, error } = await supabase.auth.getUser(token);
                    if (!error && user) {
                        userId = user.id;
                    }
                } catch (error) {
                    console.error('Auth error:', error);
                }
            }

            if (!userId) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            // Create service role client for bypassing RLS
            const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
            let serviceSupabase = supabase;
            if (serviceRoleKey && process.env.SUPABASE_URL) {
                try {
                    serviceSupabase = createClient(
                        process.env.SUPABASE_URL,
                        serviceRoleKey
                    );
                } catch (error) {
                    console.error('Error creating service role client:', error);
                    serviceSupabase = supabase;
                }
            }

            // Verify document exists
            const { data: document, error: docError } = await serviceSupabase
                .from('documents')
                .select('id, title, slug')
                .eq('id', documentId)
                .single();

            if (docError || !document) {
                return res.status(404).json({ error: 'Document not found' });
            }

            // Query conversations - use JSONB containment operator to find conversations with this document_id
            // PostgreSQL JSONB @> operator checks if left JSONB contains right JSONB
            // For Supabase PostgREST, we need to use a filter that checks if the JSONB array contains the document ID
            // Also handle legacy conversations that use document_name/pdf_name instead of document_ids
            
            // Get query parameters for pagination
            const limit = parseInt(req.query.limit || '100', 10); // Default 100, max 1000
            const offset = parseInt(req.query.offset || '0', 10);
            const maxLimit = Math.min(limit, 1000); // Cap at 1000 for performance
            
            let conversations = [];
            let totalConversations = 0;
            let convData = null; // Declare outside try block for stats calculation
            const documentSlug = document.slug; // Declare outside try block for stats calculation
            
            try {
                // Query conversations with document_ids (new format)
                // Limit to recent 2000 for better performance (can be increased if needed)
                const { data: fetchedConvData, error: convError } = await serviceSupabase
                    .from('chat_conversations')
                    .select(`
                        id,
                        question,
                        response,
                        user_id,
                        ip_address,
                        created_at,
                        model,
                        session_id,
                        document_ids,
                        document_name,
                        pdf_name
                    `)
                    .order('created_at', { ascending: false })
                    .limit(2000); // Reduced from 5000 for better performance

                if (convError) {
                    console.error('Error fetching conversations:', convError);
                } else if (fetchedConvData) {
                    convData = fetchedConvData; // Store for stats calculation
                    // Filter conversations where:
                    // 1. document_ids array contains our documentId (new format)
                    // 2. OR document_name/pdf_name matches document slug (legacy format)
                    const matchingConversations = convData.filter(conv => {
                        // New format: check document_ids array
                        if (conv.document_ids && Array.isArray(conv.document_ids)) {
                            return conv.document_ids.includes(documentId);
                        }
                        // Legacy format: check document_name or pdf_name
                        if (documentSlug) {
                            const docName = conv.document_name || conv.pdf_name || '';
                            // Check if document_name/pdf_name contains the slug or matches document title
                            return docName.toLowerCase().includes(documentSlug.toLowerCase()) ||
                                   docName.toLowerCase().includes(document.title.toLowerCase());
                        }
                        return false;
                    });
                    
                    totalConversations = matchingConversations.length;
                    // Apply pagination
                    conversations = matchingConversations.slice(offset, offset + maxLimit);
                }
            } catch (err) {
                console.error('Error in conversation query:', err);
            }

            console.log(`Analytics: Found ${totalConversations} total conversations, returning ${conversations.length} (offset: ${offset}, limit: ${maxLimit}) for document ${documentId} (${document.slug})`);

            // Get user IDs from conversations
            const userIds = conversations ? [...new Set(conversations.map(c => c.user_id).filter(Boolean))] : [];
            
            // Fetch user profiles and emails
            let userMap = {};
            if (userIds.length > 0) {
                // Get user profiles
                const { data: profiles, error: profilesError } = await serviceSupabase
                    .from('user_profiles')
                    .select('user_id, first_name, last_name')
                    .in('user_id', userIds);

                if (!profilesError && profiles) {
                    profiles.forEach(profile => {
                        userMap[profile.user_id] = {
                            first_name: profile.first_name,
                            last_name: profile.last_name
                        };
                    });
                }

                // Get user emails from auth.users (requires service role)
                const { data: users, error: usersError } = await serviceSupabase.auth.admin.listUsers();
                if (!usersError && users && users.users) {
                    users.users.forEach(user => {
                        if (userMap[user.id]) {
                            userMap[user.id].email = user.email;
                        } else {
                            userMap[user.id] = { email: user.email };
                        }
                    });
                }
            }

            // Process conversations with user info
            const processedConversations = (conversations || []).map(conv => {
                const userInfo = conv.user_id ? userMap[conv.user_id] : null;
                return {
                    id: conv.id,
                    question: conv.question,
                    response: conv.response,
                    user_email: userInfo?.email || null,
                    user_name: userInfo?.first_name || userInfo?.last_name 
                        ? `${userInfo.first_name || ''} ${userInfo.last_name || ''}`.trim() 
                        : null,
                    ip_address: conv.ip_address || null,
                    created_at: conv.created_at,
                    model: conv.model,
                    session_id: conv.session_id
                };
            });

            // Calculate conversation statistics using ALL matching conversations (not just paginated)
            // We need to recalculate stats based on total matching conversations
            // For now, we'll calculate stats from the filtered results we have
            // Note: This is approximate since we're only looking at recent 2000 conversations
            const allMatchingConversations = convData ? convData.filter(conv => {
                if (conv.document_ids && Array.isArray(conv.document_ids)) {
                    return conv.document_ids.includes(documentId);
                }
                if (documentSlug) {
                    const docName = conv.document_name || conv.pdf_name || '';
                    return docName.toLowerCase().includes(documentSlug.toLowerCase()) ||
                           docName.toLowerCase().includes(document.title.toLowerCase());
                }
                return false;
            }) : [];
            
            const uniqueUserIds = new Set(allMatchingConversations.map(c => c.user_id).filter(Boolean));
            const uniqueIPs = new Set(allMatchingConversations.map(c => c.ip_address).filter(Boolean));
            const conversationStats = {
                total: totalConversations, // Use total count from pagination
                uniqueUsers: uniqueUserIds.size,
                uniqueIPs: uniqueIPs.size
            };

            // Query downloads via document_attachments
            const { data: attachments, error: attachmentsError } = await serviceSupabase
                .from('document_attachments')
                .select('id, title, url')
                .eq('document_id', documentId);

            if (attachmentsError) {
                console.error('Error fetching attachments:', attachmentsError);
            }

            const attachmentIds = attachments ? attachments.map(a => a.id) : [];
            let downloads = [];
            let totalDownloads = 0;
            let allDownloadRecords = []; // Store for stats calculation
            // Get download pagination params - declare outside if block
            const downloadLimit = parseInt(req.query.downloadLimit || '100', 10);
            const downloadOffset = parseInt(req.query.downloadOffset || '0', 10);
            const maxDownloadLimit = Math.min(downloadLimit, 1000);

            if (attachmentIds.length > 0) {
                // Query download tracking records
                const { data: downloadRecords, error: downloadsError } = await serviceSupabase
                    .from('document_attachment_downloads')
                    .select(`
                        id,
                        attachment_id,
                        user_id,
                        ip_address,
                        downloaded_at
                    `)
                    .in('attachment_id', attachmentIds)
                    .order('downloaded_at', { ascending: false })
                    .limit(2000); // Limit to recent 2000 for performance

                if (downloadsError) {
                    console.error('Error fetching downloads:', downloadsError);
                } else if (downloadRecords) {
                    allDownloadRecords = downloadRecords; // Store for stats calculation
                    totalDownloads = downloadRecords.length;
                    
                    // Create attachment map
                    const attachmentMap = {};
                    attachments.forEach(att => {
                        attachmentMap[att.id] = { title: att.title, url: att.url };
                    });

                    // Get user IDs from downloads
                    const downloadUserIds = [...new Set(downloadRecords.map(d => d.user_id).filter(Boolean))];
                    
                    // Fetch user info for downloads
                    let downloadUserMap = {};
                    if (downloadUserIds.length > 0) {
                        const { data: downloadProfiles, error: downloadProfilesError } = await serviceSupabase
                            .from('user_profiles')
                            .select('user_id, first_name, last_name')
                            .in('user_id', downloadUserIds);

                        if (!downloadProfilesError && downloadProfiles) {
                            downloadProfiles.forEach(profile => {
                                downloadUserMap[profile.user_id] = {
                                    first_name: profile.first_name,
                                    last_name: profile.last_name
                                };
                            });
                        }

                        // Get emails from auth.users
                        const { data: downloadUsers, error: downloadUsersError } = await serviceSupabase.auth.admin.listUsers();
                        if (!downloadUsersError && downloadUsers && downloadUsers.users) {
                            downloadUsers.users.forEach(user => {
                                if (downloadUserIds.includes(user.id)) {
                                    if (downloadUserMap[user.id]) {
                                        downloadUserMap[user.id].email = user.email;
                                    } else {
                                        downloadUserMap[user.id] = { email: user.email };
                                    }
                                }
                            });
                        }
                    }

                    // Process downloads with user info and apply pagination
                    const processedDownloads = downloadRecords.map(record => {
                        const attachment = attachmentMap[record.attachment_id];
                        const userInfo = record.user_id ? downloadUserMap[record.user_id] : null;
                        return {
                            id: record.id,
                            attachment_title: attachment ? attachment.title : 'Unknown',
                            attachment_url: attachment ? attachment.url : null,
                            user_email: userInfo?.email || null,
                            user_name: userInfo?.first_name || userInfo?.last_name 
                                ? `${userInfo.first_name || ''} ${userInfo.last_name || ''}`.trim() 
                                : null,
                            ip_address: record.ip_address || null,
                            downloaded_at: record.downloaded_at
                        };
                    });
                    
                    downloads = processedDownloads.slice(downloadOffset, downloadOffset + maxDownloadLimit);
                }
            }

            // Calculate download statistics using ALL download records (not just paginated)
            let uniqueDownloadUsers = 0;
            let uniqueDownloadIPs = new Set();
            
            if (allDownloadRecords.length > 0) {
                const allDownloadUserIds = [...new Set(allDownloadRecords.map(d => d.user_id).filter(Boolean))];
                const allDownloadUserEmails = new Set();
                
                // Fetch user emails for all downloads to calculate stats accurately
                if (allDownloadUserIds.length > 0) {
                    const { data: allDownloadUsers, error: allDownloadUsersError } = await serviceSupabase.auth.admin.listUsers();
                    if (!allDownloadUsersError && allDownloadUsers && allDownloadUsers.users) {
                        allDownloadUsers.users.forEach(user => {
                            if (allDownloadUserIds.includes(user.id) && user.email) {
                                allDownloadUserEmails.add(user.email);
                            }
                        });
                    }
                }
                
                uniqueDownloadUsers = allDownloadUserEmails.size > 0 
                    ? allDownloadUserEmails.size 
                    : new Set(allDownloadRecords.map(d => d.user_id).filter(Boolean)).size;
                uniqueDownloadIPs = new Set(allDownloadRecords.map(d => d.ip_address).filter(Boolean));
            }
            
            const downloadStats = {
                total: totalDownloads, // Use total count from pagination
                uniqueUsers: uniqueDownloadUsers,
                uniqueIPs: uniqueDownloadIPs.size
            };

            // Return analytics data
            const result = {
                conversationStats,
                conversations: processedConversations,
                conversationPagination: {
                    total: totalConversations,
                    limit: maxLimit,
                    offset: offset,
                    hasMore: (offset + maxLimit) < totalConversations
                },
                downloadStats,
                downloads,
                downloadPagination: {
                    total: totalDownloads,
                    limit: maxDownloadLimit,
                    offset: downloadOffset,
                    hasMore: (downloadOffset + maxDownloadLimit) < totalDownloads
                }
            };
            
            console.log(`Analytics response for ${documentId}:`, {
                conversationCount: processedConversations.length,
                totalConversations,
                downloadCount: downloads.length,
                totalDownloads,
                conversationStats,
                downloadStats
            });
            
            res.json(result);

        } catch (error) {
            console.error('Error in document analytics API:', error);
            console.error('Error stack:', error.stack);
            res.status(500).json({ 
                error: 'Failed to fetch analytics',
                message: error.message || 'Unknown error'
            });
        }
    });

    return router;
}

module.exports = {
    createDocumentsRouter
};

