const express = require('express');

/**
 * Create permissions router for user/owner access management
 */
function createPermissionsRouter(supabase) {
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
                .select('id, slug, title, owner, is_public, requires_auth')
                .eq('active', true);

            // If not super admin, filter by accessible documents
            if (!isSuperAdmin) {
                query = query.or(`is_public.eq.true,owner_id.in.(${ownerIds.join(',')})`);
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
     */
    router.post('/check-access/:slug', async (req, res) => {
        const { slug } = req.params;
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
            // First check if document exists
            const { data: docExists, error: docError } = await supabase
                .from('documents')
                .select('id, slug, title, is_public, requires_auth')
                .eq('slug', slug)
                .eq('active', true)
                .single();

            if (docError || !docExists) {
                // Document doesn't exist
                return res.json({ 
                    has_access: false, 
                    document_exists: false,
                    error_type: 'document_not_found',
                    message: 'Document not found'
                });
            }

            // Document exists, now check access
            const { data, error } = await supabase
                .rpc('user_has_document_access_by_slug', {
                    p_user_id: userId,
                    p_document_slug: slug,
                });

            if (error) {
                console.error('Access check error:', error);
                return res.status(500).json({ error: 'Failed to check access' });
            }

            // Determine why access was denied
            let errorType = null;
            let message = null;
            
            if (!data) {
                if (!userId) {
                    // User not authenticated
                    errorType = 'authentication_required';
                    message = docExists.requires_auth 
                        ? 'This document requires authentication'
                        : 'This document requires authentication';
                } else {
                    // User authenticated but no permission
                    errorType = 'permission_denied';
                    message = 'You do not have permission to access this document';
                }
            }

            res.json({ 
                has_access: data || false,
                document_exists: true,
                error_type: errorType,
                message: message,
                document_info: {
                    title: docExists.title,
                    is_public: docExists.is_public,
                    requires_auth: docExists.requires_auth
                }
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

