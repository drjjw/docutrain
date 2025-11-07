const express = require('express');
const { createClient } = require('@supabase/supabase-js');

/**
 * Create owners router with admin functionality
 */
function createOwnersRouter() {
    const router = express.Router();

    // Create admin client with service role key for admin operations
    const adminSupabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    /**
     * Middleware to check if user is super admin
     */
    async function requireSuperAdmin(req, res, next) {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No authorization token provided' });
        }

        const token = authHeader.split(' ')[1];

        try {
            const { data: { user }, error } = await adminSupabase.auth.getUser(token);

            if (error || !user) {
                return res.status(401).json({ error: 'Invalid or expired token' });
            }

            // Check if user has super admin role
            const { data: permissions, error: permError } = await adminSupabase
                .from('user_permissions_summary')
                .select('*')
                .eq('user_id', user.id);

            if (permError) {
                return res.status(500).json({ error: 'Failed to check permissions' });
            }

            const isSuperAdmin = permissions?.some(p => p.role === 'super_admin') || false;

            if (!isSuperAdmin) {
                return res.status(403).json({ error: 'Super admin access required' });
            }

            req.user = user;
            next();
        } catch (error) {
            console.error('Super admin check error:', error);
            res.status(500).json({ error: 'Authentication error' });
        }
    }

    /**
     * GET /api/owners - Get all owners (super admin only)
     */
    router.get('/', requireSuperAdmin, async (req, res) => {
        try {
            const { data: owners, error } = await adminSupabase
                .from('owners')
                .select('*')
                .order('name', { ascending: true });

            if (error) {
                console.error('Get owners error:', error);
                return res.status(500).json({ error: 'Failed to fetch owners' });
            }

            // Get document counts for each owner
            const ownersWithCounts = await Promise.all(
                (owners || []).map(async (owner) => {
                    const { count, error: countError } = await adminSupabase
                        .from('documents')
                        .select('*', { count: 'exact', head: true })
                        .eq('owner_id', owner.id);

                    return {
                        ...owner,
                        document_count: countError ? 0 : (count || 0),
                    };
                })
            );

            res.json(ownersWithCounts);
        } catch (error) {
            console.error('Get owners error:', error);
            res.status(500).json({ error: 'Failed to fetch owners' });
        }
    });

    /**
     * GET /api/owners/:id - Get a single owner (super admin only)
     */
    router.get('/:id', requireSuperAdmin, async (req, res) => {
        try {
            const { id } = req.params;

            const { data, error } = await adminSupabase
                .from('owners')
                .select('*')
                .eq('id', id)
                .single();

            if (error) {
                console.error('Get owner error:', error);
                return res.status(500).json({ error: 'Failed to fetch owner' });
            }

            if (!data) {
                return res.status(404).json({ error: 'Owner not found' });
            }

            res.json(data);
        } catch (error) {
            console.error('Get owner error:', error);
            res.status(500).json({ error: 'Failed to fetch owner' });
        }
    });

    /**
     * POST /api/owners - Create a new owner (super admin only)
     */
    router.post('/', requireSuperAdmin, async (req, res) => {
        try {
            const {
                name,
                slug,
                description,
                default_chunk_limit,
                logo_url,
                intro_message,
                default_cover,
                custom_domain,
                forced_grok_model,
                metadata,
            } = req.body;

            // Validation
            if (!name || !slug) {
                return res.status(400).json({ error: 'Name and slug are required' });
            }

            if (default_chunk_limit && (default_chunk_limit < 1 || default_chunk_limit > 200)) {
                return res.status(400).json({ error: 'Chunk limit must be between 1 and 200' });
            }

            // Check if slug already exists
            const { data: existingOwner } = await adminSupabase
                .from('owners')
                .select('id')
                .eq('slug', slug)
                .single();

            if (existingOwner) {
                return res.status(400).json({ error: 'Slug already exists' });
            }

            // Check if custom_domain already exists (if provided)
            if (custom_domain) {
                const { data: existingDomain } = await adminSupabase
                    .from('owners')
                    .select('id')
                    .eq('custom_domain', custom_domain)
                    .single();

                if (existingDomain) {
                    return res.status(400).json({ error: 'Custom domain already exists' });
                }
            }

            const { data, error } = await adminSupabase
                .from('owners')
                .insert({
                    name,
                    slug,
                    description: description || null,
                    default_chunk_limit: default_chunk_limit || 50,
                    logo_url: logo_url || null,
                    intro_message: intro_message || null,
                    default_cover: default_cover || null,
                    custom_domain: custom_domain || null,
                    forced_grok_model: forced_grok_model || null,
                    metadata: metadata || {},
                })
                .select()
                .single();

            if (error) {
                console.error('Create owner error:', error);
                return res.status(500).json({ error: 'Failed to create owner', details: error.message });
            }

            res.status(201).json(data);
        } catch (error) {
            console.error('Create owner error:', error);
            res.status(500).json({ error: 'Failed to create owner' });
        }
    });

    /**
     * PUT /api/owners/:id - Update an owner (super admin only)
     */
    router.put('/:id', requireSuperAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            const {
                name,
                slug,
                description,
                default_chunk_limit,
                logo_url,
                intro_message,
                default_cover,
                custom_domain,
                forced_grok_model,
            } = req.body;

            // Validation
            if (name !== undefined && !name.trim()) {
                return res.status(400).json({ error: 'Name cannot be empty' });
            }

            if (slug !== undefined && !slug.trim()) {
                return res.status(400).json({ error: 'Slug cannot be empty' });
            }

            if (default_chunk_limit !== undefined && (default_chunk_limit < 1 || default_chunk_limit > 200)) {
                return res.status(400).json({ error: 'Chunk limit must be between 1 and 200' });
            }

            // Check if slug already exists (excluding current owner)
            if (slug) {
                const { data: existingOwner } = await adminSupabase
                    .from('owners')
                    .select('id')
                    .eq('slug', slug)
                    .neq('id', id)
                    .single();

                if (existingOwner) {
                    return res.status(400).json({ error: 'Slug already exists' });
                }
            }

            // Check if custom_domain already exists (excluding current owner)
            if (custom_domain) {
                const { data: existingDomain } = await adminSupabase
                    .from('owners')
                    .select('id')
                    .eq('custom_domain', custom_domain)
                    .neq('id', id)
                    .single();

                if (existingDomain) {
                    return res.status(400).json({ error: 'Custom domain already exists' });
                }
            }

            const updates = {};
            if (name !== undefined) updates.name = name.trim();
            if (slug !== undefined) updates.slug = slug.trim();
            if (description !== undefined) updates.description = description?.trim() || null;
            if (default_chunk_limit !== undefined) updates.default_chunk_limit = default_chunk_limit;
            if (logo_url !== undefined) updates.logo_url = logo_url?.trim() || null;
            if (intro_message !== undefined) updates.intro_message = intro_message?.trim() || null;
            if (default_cover !== undefined) updates.default_cover = default_cover?.trim() || null;
            if (custom_domain !== undefined) updates.custom_domain = custom_domain?.trim() || null;
            if (forced_grok_model !== undefined) updates.forced_grok_model = forced_grok_model || null;
            
            // Handle metadata updates - merge with existing metadata
            if (metadata !== undefined) {
                // Get current owner to merge metadata
                const { data: currentOwner } = await adminSupabase
                    .from('owners')
                    .select('metadata')
                    .eq('id', id)
                    .single();
                
                const currentMetadata = currentOwner?.metadata || {};
                updates.metadata = { ...currentMetadata, ...metadata };
            }

            updates.updated_at = new Date().toISOString();

            const { data, error } = await adminSupabase
                .from('owners')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) {
                console.error('Update owner error:', error);
                return res.status(500).json({ error: 'Failed to update owner', details: error.message });
            }

            if (!data) {
                return res.status(404).json({ error: 'Owner not found' });
            }

            res.json(data);
        } catch (error) {
            console.error('Update owner error:', error);
            res.status(500).json({ error: 'Failed to update owner' });
        }
    });

    /**
     * DELETE /api/owners/:id - Delete an owner (super admin only)
     */
    router.delete('/:id', requireSuperAdmin, async (req, res) => {
        try {
            const { id } = req.params;

            // Check if owner has associated documents
            const { data: documents, error: docsError } = await adminSupabase
                .from('documents')
                .select('id')
                .eq('owner_id', id)
                .limit(1);

            if (docsError) {
                console.error('Check documents error:', docsError);
                return res.status(500).json({ error: 'Failed to check associated documents' });
            }

            if (documents && documents.length > 0) {
                return res.status(400).json({ 
                    error: 'Cannot delete owner with associated documents. Please reassign or delete documents first.' 
                });
            }

            // Check if owner has associated user roles
            const { data: roles, error: rolesError } = await adminSupabase
                .from('user_roles')
                .select('id')
                .eq('owner_id', id)
                .limit(1);

            if (rolesError) {
                console.error('Check roles error:', rolesError);
                return res.status(500).json({ error: 'Failed to check associated user roles' });
            }

            if (roles && roles.length > 0) {
                return res.status(400).json({ 
                    error: 'Cannot delete owner with associated user roles. Please reassign or remove user roles first.' 
                });
            }

            const { error } = await adminSupabase
                .from('owners')
                .delete()
                .eq('id', id);

            if (error) {
                console.error('Delete owner error:', error);
                return res.status(500).json({ error: 'Failed to delete owner', details: error.message });
            }

            res.status(204).send();
        } catch (error) {
            console.error('Delete owner error:', error);
            res.status(500).json({ error: 'Failed to delete owner' });
        }
    });

    return router;
}

module.exports = { createOwnersRouter };

