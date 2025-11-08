const express = require('express');
const { createClient } = require('@supabase/supabase-js');

/**
 * Create permissions router for user/owner access management
 */
function createPermissionsRouter(supabase) {
    // Create a service role client for operations that need to bypass RLS
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const serviceSupabase = serviceRoleKey ? createClient(
        process.env.SUPABASE_URL,
        serviceRoleKey
    ) : supabase; // Fallback to regular client if no service key
    const router = express.Router();

    /**
     * Middleware to extract authenticated user from Supabase JWT
     */
    async function requireAuth(req, res, next) {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.log(`🔒 [AUTH] No Authorization header or invalid format`);
            return res.status(401).json({ error: 'Authentication required' });
        }

        const token = authHeader.split(' ')[1];
        console.log(`🔒 [AUTH] Token received, length: ${token ? token.length : 0}`);

        try {
            const { data: { user }, error } = await supabase.auth.getUser(token);
            
            if (error || !user) {
                console.error(`🔒 [AUTH] Token validation failed:`, error?.message || 'No user returned');
                console.error(`🔒 [AUTH] Error details:`, error);
                return res.status(401).json({ error: 'Invalid or expired token', details: error?.message });
            }

            console.log(`🔒 [AUTH] Token validated successfully for user: ${user.id}`);
            req.user = user;
            next();
        } catch (error) {
            console.error('🔒 [AUTH] Auth middleware error:', error);
            res.status(500).json({ error: 'Authentication failed' });
        }
    }

    /**
     * GET /api/permissions
     * Get current user's permissions (roles and owner access)
     */
    router.get('/', requireAuth, async (req, res) => {
        try {
            const { data, error } = await supabase
                .from('user_permissions_summary')
                .select('*')
                .eq('user_id', req.user.id);

            if (error) {
                console.error('Failed to fetch permissions:', error);
                return res.status(500).json({ error: 'Failed to fetch permissions' });
            }

            // Check if user is super admin
            const isSuperAdmin = data.some(p => p.role === 'super_admin');

            res.json({
                permissions: data || [],
                is_super_admin: isSuperAdmin,
                owner_groups: data.map(p => ({
                    owner_id: p.owner_id,
                    owner_slug: p.owner_slug,
                    owner_name: p.owner_name,
                    owner_logo_url: p.owner_logo_url,
                    role: p.role,
                })),
            });
        } catch (error) {
            console.error('Permissions API error:', error);
            res.status(500).json({ error: 'Server error' });
        }
    });

    /**
     * GET /api/permissions/accessible-owners
     * Get list of owner groups user can access (with details including logo_url)
     */
    router.get('/accessible-owners', requireAuth, async (req, res) => {
        try {
            const { data, error } = await supabase
                .rpc('get_user_owner_access_with_details', { p_user_id: req.user.id });

            if (error) {
                console.error('Failed to fetch accessible owners:', error);
                return res.status(500).json({ error: 'Failed to fetch accessible owners' });
            }

            res.json(data || []);
        } catch (error) {
            console.error('Accessible owners API error:', error);
            res.status(500).json({ error: 'Server error' });
        }
    });

    /**
     * GET /api/permissions/accessible-documents
     * Get list of documents user can access (including private ones)
     */
    router.get('/accessible-documents', requireAuth, async (req, res) => {
        try {
            // Get user's owner access
            const { data: ownerAccess } = await supabase
                .rpc('get_user_owner_access', { p_user_id: req.user.id });

            const ownerIds = ownerAccess ? ownerAccess.map(o => o.owner_id) : [];
            
            // Check if super admin
            const isSuperAdmin = ownerAccess?.some(o => o.role === 'super_admin');

            let query = supabase
                .from('documents')
                .select('id, slug, title, owner, access_level, owner_id')
                .eq('active', true);

            // If not super admin, filter by accessible documents
            if (!isSuperAdmin) {
                // Include public documents and documents owned by user's owner groups
                if (ownerIds.length > 0) {
                    query = query.or(`access_level.eq.public,owner_id.in.(${ownerIds.join(',')})`);
                } else {
                    // User has no owner access, only show public documents
                    query = query.eq('access_level', 'public');
                }
            }

            const { data, error } = await query;

            if (error) {
                console.error('Failed to fetch accessible documents:', error);
                return res.status(500).json({ error: 'Failed to fetch documents' });
            }

            res.json({ documents: data || [] });
        } catch (error) {
            console.error('Accessible documents API error:', error);
            res.status(500).json({ error: 'Server error' });
        }
    });

    /**
     * GET /api/permissions/document-access/:slug
     * Check document access requirements and current access status
     * Returns: { requires_passcode: boolean, requires_auth: boolean, has_access: boolean }
     * This is a lightweight check that doesn't trigger 403 errors
     */
    router.get('/document-access/:slug', async (req, res) => {
        const { slug } = req.params;
        const { passcode: urlPasscode } = req.query;
        const authHeader = req.headers.authorization;
        let userId = null;

        // Try to get user if authenticated (optional)
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            try {
                const { data: { user } } = await supabase.auth.getUser(token);
                userId = user?.id || null;
            } catch (error) {
                // Ignore auth errors - just treat as unauthenticated
            }
        }

        try {
            // Check if document exists and what access it requires
            // Also fetch owner information for restricted documents
            const { data: docData, error: docError } = await serviceSupabase
                .from('documents')
                .select(`
                    title,
                    access_level,
                    passcode,
                    owner_id,
                    owners (
                        id,
                        name,
                        slug,
                        logo_url
                    )
                `)
                .eq('slug', slug)
                .eq('active', true)
                .single();

            if (docError || !docData) {
                return res.status(404).json({
                    requires_passcode: false,
                    requires_auth: false,
                    has_access: false,
                    document_exists: false
                });
            }

            const requiresPasscode = docData.access_level === 'passcode';
            // Auth is required for private, registered, owner_restricted, and owner_admin_only
            // But only set requires_auth if user is NOT authenticated (to trigger login redirect)
            const requiresAuth = docData.access_level === 'private' || 
                                 docData.access_level === 'registered' ||
                                 docData.access_level === 'owner_restricted' ||
                                 docData.access_level === 'owner_admin_only';
            const shouldRequireAuth = requiresAuth && !userId; // Only require auth if user is not authenticated

            // Check actual access, including passcode if available
            const { data: accessResult, error: accessError } = await supabase
                .rpc('user_has_document_access_by_slug', {
                    p_user_id: userId,
                    p_document_slug: slug,
                    p_passcode: urlPasscode || null,
                });

            let hasAccess = false;
            if (!accessError) {
                hasAccess = accessResult || false;
            }

            // Extract owner information if available
            let ownerInfo = null;
            if (docData.owners) {
                ownerInfo = {
                    id: docData.owners.id,
                    name: docData.owners.name,
                    slug: docData.owners.slug,
                    logo_url: docData.owners.logo_url
                };
            }

            res.json({
                requires_passcode: requiresPasscode,
                requires_auth: shouldRequireAuth, // Only true if auth is required AND user is not authenticated
                has_access: hasAccess,
                document_exists: true,
                owner: ownerInfo, // Include owner info for restricted documents
                document_title: docData.title // Include document title for passcode modal
            });
        } catch (error) {
            console.error('Document access check error:', error);
            res.status(500).json({ error: 'Server error' });
        }
    });

    /**
     * POST /api/permissions/check-access/:slug
     * Check if user can access a specific document
     * Request body can include: { passcode: "optional-passcode" }
     */
    router.post('/check-access/:slug', async (req, res) => {
        const { slug } = req.params;
        const { passcode } = req.body || {};
        const authHeader = req.headers.authorization;
        let userId = null;

        // Try to get user if authenticated (optional)
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            try {
                const { data: { user } } = await supabase.auth.getUser(token);
                userId = user?.id || null;
            } catch (error) {
                // Ignore auth errors - just treat as unauthenticated
            }
        }

        try {
            // Check access using RPC function (which handles all access logic including passcode)
            const { data: hasAccess, error: accessError } = await supabase
                .rpc('user_has_document_access_by_slug', {
                    p_user_id: userId,
                    p_document_slug: slug,
                    p_passcode: passcode || null,
                });

            if (accessError) {
                console.error('Access check error:', accessError);
                return res.status(500).json({ error: 'Failed to check access' });
            }

            // Always try to get document info and owner info (even when access denied)
            // Use service role client to bypass RLS
            let docInfo = null;
            const { data: docWithOwnerData } = await serviceSupabase
                .from('documents')
                .select(`
                    title,
                    access_level,
                    passcode,
                    owner_id,
                    owners (
                        id,
                        name,
                        slug,
                        logo_url
                    )
                `)
                .eq('slug', slug)
                .eq('active', true)
                .single();

            if (docWithOwnerData) {
                docInfo = {
                    title: docWithOwnerData.title,
                    access_level: docWithOwnerData.access_level || 'public',
                    requires_passcode: !!docWithOwnerData.passcode,
                    owner: docWithOwnerData.owners ? {
                        id: docWithOwnerData.owners.id,
                        name: docWithOwnerData.owners.name,
                        slug: docWithOwnerData.owners.slug,
                        logo_url: docWithOwnerData.owners.logo_url
                    } : null
                };
            }

            // Determine error type if access denied
            let errorType = null;
            let message = null;
            let documentExists = hasAccess; // If RPC returns false, we can't tell if doc exists or access denied

            if (!hasAccess) {
                // IMPORTANT: Check passcode requirement FIRST before checking auth status
                // This ensures passcode-protected docs show passcode modal, not login modal
                if (docInfo && docInfo.access_level === 'passcode' && docInfo.requires_passcode && !passcode) {
                    // Passcode required but not provided
                    errorType = 'passcode_required';
                    message = 'This document requires a passcode to access';
                    documentExists = true;
                } else if (docInfo && docInfo.access_level === 'passcode' && docInfo.requires_passcode && passcode) {
                    // Passcode was provided but incorrect
                    errorType = 'passcode_incorrect';
                    message = 'The passcode you entered is incorrect';
                    documentExists = true;
                } else if (!userId) {
                    // User not authenticated - could be auth required or doc doesn't exist
                    errorType = 'authentication_required';
                    message = 'This document requires authentication or does not exist';
                    documentExists = docInfo ? true : false; // We can now determine if doc exists
                } else {
                    // User authenticated but no access - could be permission denied or doc doesn't exist
                    errorType = 'permission_denied';
                    message = 'You do not have permission to access this document or it does not exist';
                    documentExists = docInfo ? true : false; // We can now determine if doc exists
                }
            } else {
                documentExists = true;
            }

            res.json({
                has_access: hasAccess || false,
                document_exists: documentExists,
                error_type: errorType,
                message: message,
                document_info: docInfo
            });
        } catch (error) {
            console.error('Check access API error:', error);
            res.status(500).json({ error: 'Server error' });
        }
    });

    /**
     * POST /api/permissions/grant-owner-access
     * Grant a user access to an owner group (owner_admin or super_admin only)
     */
    router.post('/grant-owner-access', requireAuth, async (req, res) => {
        const { target_user_id, owner_id } = req.body;

        if (!target_user_id || !owner_id) {
            return res.status(400).json({ error: 'target_user_id and owner_id required' });
        }

        try {
            const { data, error } = await supabase
                .from('user_owner_access')
                .insert({
                    user_id: target_user_id,
                    owner_id: owner_id,
                    granted_by: req.user.id,
                })
                .select()
                .single();

            if (error) {
                console.error('Failed to grant access:', error);
                return res.status(403).json({ error: 'Permission denied or access already granted' });
            }

            res.json({ success: true, access: data });
        } catch (error) {
            console.error('Grant access API error:', error);
            res.status(500).json({ error: 'Server error' });
        }
    });

    /**
     * DELETE /api/permissions/revoke-owner-access/:access_id
     * Revoke user's access to an owner group
     */
    router.delete('/revoke-owner-access/:access_id', requireAuth, async (req, res) => {
        const { access_id } = req.params;

        try {
            const { error } = await supabase
                .from('user_owner_access')
                .delete()
                .eq('id', access_id);

            if (error) {
                console.error('Failed to revoke access:', error);
                return res.status(403).json({ error: 'Permission denied' });
            }

            res.json({ success: true });
        } catch (error) {
            console.error('Revoke access API error:', error);
            res.status(500).json({ error: 'Server error' });
        }
    });

    /**
     * GET /api/permissions/can-edit-document/:slug
     * Check if user can edit a document
     * Returns true if:
     * - User is super_admin (can edit any document)
     * - User is owner_admin for document's owner group
     * - Future: User is creator of document (requires created_by field)
     */
    router.get('/can-edit-document/:slug', requireAuth, async (req, res) => {
        const { slug } = req.params;
        const userId = req.user.id;

        console.log(`\n🔧 [CAN EDIT] ==========================================`);
        console.log(`🔧 [CAN EDIT] Checking edit permissions for user ${userId} on document ${slug}`);
        console.log(`🔧 [CAN EDIT] ==========================================\n`);

        try {
            // Get document info including owner_id
            const { data: doc, error: docError } = await serviceSupabase
                .from('documents')
                .select('id, owner_id')
                .eq('slug', slug)
                .eq('active', true)
                .single();

            if (docError || !doc) {
                console.error('Document not found:', docError);
                return res.status(404).json({ can_edit: false, error: 'Document not found' });
            }

            console.log(`🔧 [CAN EDIT] Document found: id=${doc.id}, owner_id=${doc.owner_id || 'null'}`);

            // Check if user is super admin (including global super admins with owner_id IS NULL)
            // Use service role client to bypass RLS for this check
            const { data: superAdminCheck, error: superAdminError } = await serviceSupabase
                .from('user_roles')
                .select('id, owner_id')
                .eq('user_id', userId)
                .eq('role', 'super_admin')
                .limit(10); // Get all super admin roles for this user

            console.log(`🔧 [CAN EDIT] Super admin check result:`, superAdminCheck);
            console.log(`🔧 [CAN EDIT] Super admin check error:`, superAdminError);

            if (!superAdminError && superAdminCheck && superAdminCheck.length > 0) {
                // Check if user is a global super admin (owner_id IS NULL) - can edit any document
                // Also check for undefined/null values explicitly
                const isGlobalSuperAdmin = superAdminCheck.some(r => r.owner_id === null || r.owner_id === undefined);
                console.log(`🔧 [CAN EDIT] Super admin roles:`, JSON.stringify(superAdminCheck, null, 2));
                console.log(`🔧 [CAN EDIT] Is global super admin: ${isGlobalSuperAdmin}`);
                
                if (isGlobalSuperAdmin) {
                    console.log(`✅ User ${userId} is global super admin - can edit ${slug}`);
                    return res.json({ can_edit: true });
                }
                
                // Check if user is super admin for document's owner group
                if (doc.owner_id) {
                    const isOwnerSuperAdmin = superAdminCheck.some(r => r.owner_id === doc.owner_id);
                    console.log(`🔧 [CAN EDIT] Is owner super admin: ${isOwnerSuperAdmin}`);
                    if (isOwnerSuperAdmin) {
                        console.log(`✅ User ${userId} is super admin for owner ${doc.owner_id} - can edit ${slug}`);
                        return res.json({ can_edit: true });
                    }
                } else {
                    // Document has no owner - only global super admin can edit (already checked above)
                    // This should have been caught by the isGlobalSuperAdmin check
                    console.log(`🔧 [CAN EDIT] Document has no owner_id - only global super admin can edit`);
                }
            } else {
                console.log(`🔧 [CAN EDIT] No super admin roles found for user ${userId}`);
                if (superAdminError) {
                    console.error(`🔧 [CAN EDIT] Super admin check error:`, superAdminError);
                }
            }

            // If document has no owner, only super admin can edit
            if (!doc.owner_id) {
                return res.json({ can_edit: false });
            }

            // Check if user is owner_admin for document's owner group
            // Use service role client to bypass RLS
            const { data: ownerAdminCheck, error: ownerAdminError } = await serviceSupabase
                .from('user_roles')
                .select('id')
                .eq('user_id', userId)
                .eq('owner_id', doc.owner_id)
                .eq('role', 'owner_admin')
                .limit(1);

            console.log(`🔧 [CAN EDIT] Owner admin check result:`, ownerAdminCheck);
            console.log(`🔧 [CAN EDIT] Owner admin check error:`, ownerAdminError);

            if (!ownerAdminError && ownerAdminCheck && ownerAdminCheck.length > 0) {
                console.log(`User ${userId} is owner admin for document ${slug} - can edit`);
                return res.json({ can_edit: true });
            }

            // Future: Check if user is creator (requires created_by field migration)
            // if (doc.created_by === userId) {
            //     return res.json({ can_edit: true });
            // }

            // User doesn't have edit permissions
            return res.json({ can_edit: false });

        } catch (error) {
            console.error('Can edit document API error:', error);
            res.status(500).json({ can_edit: false, error: 'Server error' });
        }
    });

    return router;
}

module.exports = { createPermissionsRouter };

