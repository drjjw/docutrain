const express = require('express');
const { createClient } = require('@supabase/supabase-js');

/**
 * Create users router with admin functionality
 */
function createUsersRouter() {
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
     * GET /api/users - Get all users with roles (super admin only)
     */
    router.get('/', requireSuperAdmin, async (req, res) => {
        try {
            // Get all users from auth.users
            const { data: users, error: usersError } = await adminSupabase.auth.admin.listUsers();

            if (usersError) {
                console.error('List users error:', usersError);
                return res.status(500).json({ error: 'Failed to fetch users' });
            }

            // Get user roles for each user
            const userIds = users.users.map(user => user.id);
            const { data: userRoles, error: rolesError } = await adminSupabase
                .from('user_permissions_summary')
                .select('*')
                .in('user_id', userIds);

            if (rolesError) {
                console.error('User roles error:', rolesError);
                return res.status(500).json({ error: 'Failed to fetch user roles' });
            }

            // Combine user data with roles
            const usersWithRoles = users.users.map(user => {
                const roles = (userRoles || []).filter(ur => ur.user_id === user.id);
                const ownerGroups = roles.map(r => ({
                    owner_id: r.owner_id,
                    owner_slug: r.owner_slug,
                    owner_name: r.owner_name,
                    role: r.role,
                }));

                return {
                    id: user.id,
                    email: user.email || '',
                    email_confirmed_at: user.email_confirmed_at,
                    phone: user.phone,
                    phone_confirmed_at: user.phone_confirmed_at,
                    last_sign_in_at: user.last_sign_in_at,
                    created_at: user.created_at,
                    updated_at: user.updated_at,
                    is_anonymous: user.is_anonymous || false,
                    raw_app_meta_data: user.app_metadata,
                    raw_user_meta_data: user.user_metadata,
                    roles: roles.map(r => ({
                        id: r.id || '',
                        user_id: r.user_id,
                        role: r.role,
                        owner_id: r.owner_id,
                        created_at: r.created_at || '',
                        updated_at: r.updated_at || '',
                    })),
                    ownerGroups,
                };
            });

            res.json(usersWithRoles);
        } catch (error) {
            console.error('Get users error:', error);
            res.status(500).json({ error: 'Failed to get users' });
        }
    });

    /**
     * PUT /api/users/:userId/role - Update user role (super admin only)
     */
    router.put('/:userId/role', requireSuperAdmin, async (req, res) => {
        try {
            const { userId } = req.params;
            const { role, owner_id } = req.body;

            // First, remove any existing role for this user (and owner if specified)
            let deleteQuery = adminSupabase
                .from('user_roles')
                .delete()
                .eq('user_id', userId);

            if (owner_id) {
                deleteQuery = deleteQuery.eq('owner_id', owner_id);
            }

            await deleteQuery;

            // Then insert the new role
            const { data, error } = await adminSupabase
                .from('user_roles')
                .insert({
                    user_id: userId,
                    role,
                    owner_id: owner_id,
                })
                .select()
                .single();

            if (error) {
                console.error('Update user role error:', error);
                return res.status(500).json({ error: 'Failed to update user role' });
            }

            res.json(data);
        } catch (error) {
            console.error('Update user role error:', error);
            res.status(500).json({ error: 'Failed to update user role' });
        }
    });

    /**
     * POST /api/users/:email/reset-password - Reset user password (super admin only)
     */
    router.post('/:email/reset-password', requireSuperAdmin, async (req, res) => {
        try {
            const { email } = req.params;

            const { error } = await adminSupabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${req.protocol}://${req.get('host')}/app/reset-password`,
            });

            if (error) {
                console.error('Reset password error:', error);
                return res.status(500).json({ error: 'Failed to reset password' });
            }

            res.json({ message: 'Password reset email sent' });
        } catch (error) {
            console.error('Reset password error:', error);
            res.status(500).json({ error: 'Failed to reset password' });
        }
    });

    /**
     * PUT /api/users/:userId/password - Update user password directly (super admin only)
     */
    router.put('/:userId/password', requireSuperAdmin, async (req, res) => {
        try {
            const { userId } = req.params;
            const { password } = req.body;

            if (!password || password.length < 6) {
                return res.status(400).json({ error: 'Password must be at least 6 characters' });
            }

            const { error } = await adminSupabase.auth.admin.updateUserById(userId, {
                password: password,
            });

            if (error) {
                console.error('Update password error:', error);
                return res.status(500).json({ error: 'Failed to update password' });
            }

            res.json({ message: 'Password updated successfully' });
        } catch (error) {
            console.error('Update password error:', error);
            res.status(500).json({ error: 'Failed to update password' });
        }
    });

    /**
     * DELETE /api/users/:userId - Delete user (super admin only)
     */
    router.delete('/:userId', requireSuperAdmin, async (req, res) => {
        try {
            const { userId } = req.params;

            const { error } = await adminSupabase.auth.admin.deleteUser(userId);

            if (error) {
                console.error('Delete user error:', error);
                return res.status(500).json({ error: 'Failed to delete user' });
            }

            res.json({ message: 'User deleted successfully' });
        } catch (error) {
            console.error('Delete user error:', error);
            res.status(500).json({ error: 'Failed to delete user' });
        }
    });

    return router;
}

module.exports = { createUsersRouter };
