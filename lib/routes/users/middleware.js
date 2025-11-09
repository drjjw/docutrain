const { debugLog } = require('../../utils/debug');

/**
 * Create authentication and authorization middleware functions
 * @param {Object} adminSupabase - Supabase admin client
 * @returns {Object} Middleware functions
 */
function createMiddleware(adminSupabase) {
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
     * Middleware to check if user is owner admin or super admin
     */
    async function requireOwnerAdminOrSuperAdmin(req, res, next) {
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

            // Check if user has super admin or owner admin role
            const { data: permissions, error: permError } = await adminSupabase
                .from('user_permissions_summary')
                .select('*')
                .eq('user_id', user.id);

            if (permError) {
                return res.status(500).json({ error: 'Failed to check permissions' });
            }

            const isSuperAdmin = permissions?.some(p => p.role === 'super_admin') || false;
            const isOwnerAdmin = permissions?.some(p => p.role === 'owner_admin') || false;

            if (!isSuperAdmin && !isOwnerAdmin) {
                return res.status(403).json({ error: 'Admin access required' });
            }

            // Get owner groups for owner admin
            const ownerGroups = permissions
                ?.filter(p => p.role === 'owner_admin')
                .map(p => p.owner_id)
                .filter(id => id !== null) || [];

            debugLog('requireOwnerAdminOrSuperAdmin - User permissions:', {
                userId: user.id,
                email: user.email,
                isSuperAdmin,
                isOwnerAdmin,
                ownerGroups: ownerGroups,
                permissionsCount: permissions?.length || 0
            });

            req.user = user;
            req.isSuperAdmin = isSuperAdmin;
            req.isOwnerAdmin = isOwnerAdmin;
            req.ownerGroups = ownerGroups;
            next();
        } catch (error) {
            console.error('Admin check error:', error);
            res.status(500).json({ error: 'Authentication error' });
        }
    }

    /**
     * Helper function to check if owner admin can access a user
     */
    async function canOwnerAdminAccessUser(ownerGroups, targetUserId) {
        if (!ownerGroups || ownerGroups.length === 0) {
            return false;
        }

        // Check if target user belongs to any of the owner admin's groups
        for (const ownerId of ownerGroups) {
            const { data, error } = await adminSupabase
                .rpc('get_owner_admin_accessible_users', { p_owner_id: ownerId });
            
            if (!error && data) {
                const accessibleUserIds = data.map(row => row.user_id);
                if (accessibleUserIds.includes(targetUserId)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Middleware to extract authenticated user (for self-service endpoints)
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
            console.error('Auth middleware error:', error);
            res.status(500).json({ error: 'Authentication error' });
        }
    }

    return {
        requireSuperAdmin,
        requireOwnerAdminOrSuperAdmin,
        requireAuth,
        canOwnerAdminAccessUser
    };
}

module.exports = { createMiddleware };

