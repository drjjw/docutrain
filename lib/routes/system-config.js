const express = require('express');
const { createClient } = require('@supabase/supabase-js');

/**
 * Create system config router for managing system-wide configuration
 */
function createSystemConfigRouter() {
    const router = express.Router();

    // Create admin client with service role key for admin operations
    const adminSupabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    /**
     * Middleware to check if user is authenticated
     */
    async function requireAuth(req, res, next) {
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

            req.user = user;
            next();
        } catch (error) {
            console.error('Auth check error:', error);
            res.status(500).json({ error: 'Authentication error' });
        }
    }

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
     * Validate default_categories value
     * Must be an array of non-empty strings
     */
    function validateDefaultCategories(value) {
        if (!Array.isArray(value)) {
            return { valid: false, error: 'default_categories must be an array' };
        }

        if (value.length === 0) {
            return { valid: false, error: 'default_categories cannot be empty' };
        }

        for (const item of value) {
            if (typeof item !== 'string') {
                return { valid: false, error: 'All category items must be strings' };
            }
            if (item.trim().length === 0) {
                return { valid: false, error: 'Category names cannot be empty' };
            }
        }

        return { valid: true };
    }

    /**
     * GET /api/system-config/:key - Fetch config value (authenticated users)
     */
    router.get('/:key', requireAuth, async (req, res) => {
        try {
            const { key } = req.params;

            const { data, error } = await adminSupabase
                .from('system_config')
                .select('*')
                .eq('key', key)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    // Not found
                    return res.status(404).json({ error: `Configuration key '${key}' not found` });
                }
                console.error('Get system config error:', error);
                return res.status(500).json({ error: 'Failed to fetch system config' });
            }

            res.json(data);
        } catch (error) {
            console.error('Get system config error:', error);
            res.status(500).json({ error: 'Failed to fetch system config' });
        }
    });

    /**
     * GET /api/system-config - List all configs (super admin only)
     */
    router.get('/', requireSuperAdmin, async (req, res) => {
        try {
            const { data, error } = await adminSupabase
                .from('system_config')
                .select('*')
                .order('key', { ascending: true });

            if (error) {
                console.error('List system configs error:', error);
                return res.status(500).json({ error: 'Failed to fetch system configs' });
            }

            res.json(data || []);
        } catch (error) {
            console.error('List system configs error:', error);
            res.status(500).json({ error: 'Failed to fetch system configs' });
        }
    });

    /**
     * PUT /api/system-config/:key - Update config (super admin only)
     */
    router.put('/:key', requireSuperAdmin, async (req, res) => {
        try {
            const { key } = req.params;
            const { value } = req.body;

            if (value === undefined) {
                return res.status(400).json({ error: 'Value is required' });
            }

            // Special validation for default_categories
            if (key === 'default_categories') {
                const validation = validateDefaultCategories(value);
                if (!validation.valid) {
                    return res.status(400).json({ error: validation.error });
                }
            }

            // Get current config to check if it exists
            const { data: currentConfig, error: fetchError } = await adminSupabase
                .from('system_config')
                .select('*')
                .eq('key', key)
                .single();

            if (fetchError && fetchError.code === 'PGRST116') {
                // Config doesn't exist - don't auto-create
                return res.status(404).json({ error: `Configuration key '${key}' not found` });
            }

            if (fetchError) {
                console.error('Fetch system config error:', fetchError);
                return res.status(500).json({ error: 'Failed to fetch existing config' });
            }

            // Update config
            const { data, error } = await adminSupabase
                .from('system_config')
                .update({
                    value,
                    updated_at: new Date().toISOString(),
                    updated_by: req.user.id,
                })
                .eq('key', key)
                .select()
                .single();

            if (error) {
                console.error('Update system config error:', error);
                return res.status(500).json({ error: 'Failed to update system config' });
            }

            res.json(data);
        } catch (error) {
            console.error('Update system config error:', error);
            res.status(500).json({ error: 'Failed to update system config' });
        }
    });

    return router;
}

module.exports = { createSystemConfigRouter };

