/**
 * Document API route handler
 * Handles GET /api/documents - Document registry API with optional filtering
 */

const { authenticateUser, createServiceRoleClient } = require('../utils/documents-auth');
const { checkDocumentAccessMultiple, hasPasscodeProtectedDocs } = require('../utils/documents-access');

/**
 * Handle GET /api/documents
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {object} dependencies - Dependencies object containing supabase, documentRegistry
 */
async function handleGetDocuments(req, res, dependencies) {
    const { supabase, documentRegistry } = dependencies;
    
    try {
        const { doc, owner, passcode, forceRefresh } = req.query;
        const shouldForceRefresh = forceRefresh === 'true' || forceRefresh === true;
        
        // Create service role client for bypassing RLS when checking access levels
        const serviceSupabase = createServiceRoleClient(supabase);
        
        // Try to get authenticated user (optional)
        const { userId } = await authenticateUser(req, supabase);
        
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

            const accessChecks = await checkDocumentAccessMultiple(
                userId,
                validConfigs.map(doc => doc.slug),
                supabase,
                serviceSupabase,
                passcode
            );

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
                
                // Debug logging for owner info
                if (doc.owner_id && !doc.owner_slug) {
                    console.warn(`⚠️  API: Document ${doc.slug} has owner_id but no owner_slug`);
                }
                
                const ownerInfo = doc.owner_slug ? {
                    slug: doc.owner_slug,
                    name: doc.owner_name
                } : null;
                
                if (doc.slug === 'smh') {
                    console.log(`🔍 [DEBUG] SMH document owner info:`, {
                        owner_id: doc.owner_id,
                        owner_slug: doc.owner_slug,
                        owner_name: doc.owner_name,
                        ownerInfo: ownerInfo
                    });
                }
                
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
                    showReferences: doc.show_references !== false, // Controls references visibility (default true)
                    showDisclaimer: doc.show_disclaimer === true, // Controls disclaimer visibility
                    disclaimerText: doc.disclaimer_text || null, // Custom disclaimer text (null uses default)
                    ownerInfo: ownerInfo
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
            console.log(`📋 Document slugs:`, ownerDocs.map(doc => doc.slug));

            let accessChecks = [];
            // IMPORTANT: Skip batch access check if passcode is provided OR if any documents might be passcode-protected
            let hasPasscodeProtectedDocsFlag = false;
            if (!passcode && ownerDocs.length > 0) {
                hasPasscodeProtectedDocsFlag = await hasPasscodeProtectedDocs(
                    ownerDocs.map(doc => doc.slug),
                    serviceSupabase
                );
            }

            if (!hasPasscodeProtectedDocsFlag && !passcode) {
                // Use batch access check for efficiency
                console.log(`🔍 Using batch access check for ${ownerDocs.length} documents`);
                try {
                    // Try the batch function first (if it exists)
                    const { data: batchAccessResults, error: batchError } = await supabase
                        .rpc('user_has_multiple_document_access', {
                            p_user_id: userId,
                            p_document_slugs: ownerDocs.map(doc => doc.slug)
                        });

                    if (!batchError && batchAccessResults) {
                        // Convert batch results to access array
                        const accessMap = {};
                        batchAccessResults.forEach(result => {
                            accessMap[result.document_slug] = result.has_access;
                        });
                        accessChecks = ownerDocs.map(doc => accessMap[doc.slug] || false);
                        console.log(`📊 Batch access results:`, accessChecks);
                    } else {
                        console.log(`⚠️ Batch function error or missing, falling back:`, batchError?.message || 'No results');
                        throw batchError || new Error('No batch results');
                    }
                } catch (batchError) {
                    // Fallback to individual access checks
                    console.log(`🔄 Falling back to individual access checks for owner docs`);
                    accessChecks = await checkDocumentAccessMultiple(
                        userId,
                        ownerDocs.map(doc => doc.slug),
                        supabase,
                        serviceSupabase,
                        passcode
                    );
                    console.log(`📊 Individual access check results:`, accessChecks);
                }
            } else {
                // Use individual access checks (required for passcode-protected docs)
                console.log(`🔍 Using individual access checks for ${ownerDocs.length} owner documents`);
                accessChecks = await checkDocumentAccessMultiple(
                    userId,
                    ownerDocs.map(doc => doc.slug),
                    supabase,
                    serviceSupabase,
                    passcode
                );
                console.log(`📊 Individual access check results:`, accessChecks);
            }

            console.log(`📊 Owner document access check results:`, accessChecks);
            console.log(`📋 Documents before filtering:`, ownerDocs.map(doc => ({ slug: doc.slug, access_level: doc.access_level })));
            ownerDocs = ownerDocs.filter((doc, index) => accessChecks[index]);
            console.log(`✅ After access filtering: ${ownerDocs.length} owner documents remaining`);
            console.log(`📋 Documents after filtering:`, ownerDocs.map(doc => ({ slug: doc.slug, access_level: doc.access_level })));

            if (ownerDocs.length === 0) {
                // Check if any documents exist for this owner and what their access requirements are
                // First, get the owner_id from the owners table using the slug
                const { data: ownerRecord, error: ownerLookupError } = await serviceSupabase
                    .from('owners')
                    .select('id')
                    .eq('slug', owner)
                    .single();
                
                if (ownerLookupError || !ownerRecord) {
                    // Owner doesn't exist
                    console.log(`⚠️  Owner ${owner} not found`);
                    return res.status(404).json({ error: 'Owner not found' });
                }
                
                const { data: ownerDocData, error: ownerDocError } = await serviceSupabase
                    .from('documents')
                    .select('slug, title, access_level, passcode')
                    .eq('owner_id', ownerRecord.id)
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

                // Check if there are any public documents for this owner
                const publicDocs = ownerDocData.filter(doc => doc.access_level === 'public');
                
                // If no public documents exist and user is not authenticated, require login
                if (publicDocs.length === 0 && !userId) {
                    console.log(`🔒 No public documents for owner ${owner} and user not authenticated - requiring login`);
                    
                    // Fetch owner information for login page display
                    const { data: ownerInfo, error: ownerInfoError } = await serviceSupabase
                        .from('owners')
                        .select('id, name, slug, logo_url')
                        .eq('slug', owner)
                        .single();
                    
                    return res.status(403).json({
                        error: 'This owner\'s documents require authentication to access',
                        error_type: 'access_denied',
                        requires_auth: true,
                        owner: owner,
                        message: 'Please log in to access these documents',
                        owner_info: ownerInfo ? {
                            id: ownerInfo.id,
                            name: ownerInfo.name,
                            slug: ownerInfo.slug,
                            logo_url: ownerInfo.logo_url
                        } : null
                    });
                }

                // If user is authenticated but has no access, return empty array (not an error)
                // This allows the UI to show an empty state rather than an error
                if (userId) {
                    console.log(`📭 Authenticated user has no access to owner ${owner} documents, returning empty array`);
                    return res.json({ documents: [] });
                }

                // Regular access denied (unauthenticated user without permission)
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
}

module.exports = {
    handleGetDocuments
};

