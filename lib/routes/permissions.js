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
            return res.status(401).json({ error: 'Authentication required' });
        }

        const token = authHeader.split(' ')[1];

        try {
            const { data: { user }, error } = await supabase.auth.getUser(token);
            
            if (error || !user) {
                return res.status(401).json({ error: 'Invalid or expired token' });
            }

            req.user = user;
            next();
        } catch (error) {
            console.error('Auth middleware error:', error);
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

    return router;
}

module.exports = { createPermissionsRouter };

