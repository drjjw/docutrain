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
                    owner_groups: ownerGroups, // Use owner_groups (not ownerGroups) to match frontend expectation
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
            let { role, owner_id } = req.body;

            // Convert empty string to null for owner_id
            if (owner_id === '' || owner_id === undefined) {
                owner_id = null;
            }

            // Validate role
            if (!role || !['registered', 'owner_admin', 'super_admin'].includes(role)) {
                return res.status(400).json({ error: 'Invalid role specified' });
            }

            // Validate owner_id requirement for roles that need it
            if ((role === 'owner_admin' || role === 'registered') && !owner_id) {
                return res.status(400).json({ 
                    error: `owner_id is required for ${role} role` 
                });
            }

            // Validate super_admin owner_id (must be null)
            if (role === 'super_admin' && owner_id !== null) {
                owner_id = null; // Force null for super_admin
            }

            // Check if this is the protected super admin being downgraded
            const { data: userData, error: userError } = await adminSupabase.auth.admin.getUserById(userId);
            
            if (userError) {
                console.error('Get user error:', userError);
                return res.status(500).json({ error: 'Failed to get user information' });
            }

            // Check if user is the protected super admin
            if (userData.user.email === 'drjweinstein@gmail.com') {
                // Get current role
                const { data: currentRoles } = await adminSupabase
                    .from('user_roles')
                    .select('role')
                    .eq('user_id', userId)
                    .eq('role', 'super_admin')
                    .limit(1);

                // Prevent downgrading from super_admin
                if (currentRoles && currentRoles.length > 0 && role !== 'super_admin') {
                    return res.status(403).json({ 
                        error: 'Cannot downgrade the primary super admin. This user must remain a super admin.' 
                    });
                }

                // Ensure owner_id is NULL for protected super admin (global super admin)
                if (role === 'super_admin' && owner_id !== null) {
                    return res.status(400).json({ 
                        error: 'The primary super admin must be a global super admin (no owner group)' 
                    });
                }
            }

            // First, check if this exact role+owner_id combination already exists
            let checkQuery = adminSupabase
                .from('user_roles')
                .select('*')
                .eq('user_id', userId)
                .eq('role', role);
            
            if (owner_id) {
                checkQuery = checkQuery.eq('owner_id', owner_id);
            } else {
                checkQuery = checkQuery.is('owner_id', null);
            }
            
            const { data: existingRole, error: checkError } = await checkQuery.maybeSingle();

            if (checkError) {
                console.error('Check existing role error:', checkError);
                return res.status(500).json({ 
                    error: 'Failed to check existing role',
                    details: checkError.message 
                });
            }

            // If the role already exists exactly as requested, return success
            // This prevents unnecessary delete/insert operations
            if (existingRole) {
                console.log(`Role already exists for user ${userId}: ${role} with owner_id ${owner_id || 'null'}`);
                // Return the existing role - this will cause loadData() to refresh the UI
                return res.json(existingRole);
            }

            // Remove any existing role for this user with this role type
            // For owner_admin, delete ALL owner_admin roles first (users can only belong to one owner group)
            // For super_admin, delete all super_admin roles (owner_id should be null)
            let deleteQuery = adminSupabase
                .from('user_roles')
                .delete()
                .eq('user_id', userId);

            if (role === 'owner_admin') {
                // Delete ALL owner_admin roles (user can only belong to one owner group)
                deleteQuery = deleteQuery.eq('role', 'owner_admin');
            } else if (role === 'super_admin') {
                // For super_admin, delete all super_admin roles (they should all have owner_id = null)
                deleteQuery = deleteQuery.eq('role', 'super_admin').is('owner_id', null);
            } else if (role === 'registered') {
                // For registered, delete all registered roles for this user
                deleteQuery = deleteQuery.eq('role', 'registered');
            }
            // Otherwise, delete all roles for this user

            const { error: deleteError, data: deleteResult } = await deleteQuery;
            
            if (deleteError) {
                console.error('Delete user role error:', deleteError);
                return res.status(500).json({ 
                    error: 'Failed to remove existing role',
                    details: deleteError.message 
                });
            }

            // Then insert the new role
            const roleData = {
                user_id: userId,
                role,
                owner_id: owner_id,
            };

            const { data, error } = await adminSupabase
                .from('user_roles')
                .insert(roleData)
                .select()
                .single();

            if (error) {
                console.error('Update user role error:', error);
                console.error('Role data attempted:', roleData);
                // If it's a duplicate key error, try to return the existing record
                if (error.code === '23505') { // Unique violation
                    let fetchQuery = adminSupabase
                        .from('user_roles')
                        .select('*')
                        .eq('user_id', userId)
                        .eq('role', role);
                    
                    if (owner_id) {
                        fetchQuery = fetchQuery.eq('owner_id', owner_id);
                    } else {
                        fetchQuery = fetchQuery.is('owner_id', null);
                    }
                    
                    const { data: existing } = await fetchQuery.single();
                    
                    if (existing) {
                        return res.json(existing);
                    }
                }
                return res.status(500).json({ 
                    error: 'Failed to update user role',
                    details: error.message,
                    code: error.code,
                    hint: error.hint
                });
            }

            res.json(data);
        } catch (error) {
            console.error('Update user role error:', error);
            res.status(500).json({ 
                error: 'Failed to update user role',
                details: error.message 
            });
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

            // Check if this is the protected super admin
            const { data: userData, error: userError } = await adminSupabase.auth.admin.getUserById(userId);
            
            if (userError) {
                console.error('Get user error:', userError);
                return res.status(500).json({ error: 'Failed to get user information' });
            }

            // Prevent deletion of protected super admin
            if (userData.user.email === 'drjweinstein@gmail.com') {
                return res.status(403).json({ 
                    error: 'Cannot delete the primary super admin. This user cannot be removed from the system.' 
                });
            }

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
