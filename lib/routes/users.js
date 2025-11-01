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
     * GET /api/users - Get all users with roles (super admin and owner admin)
     */
    router.get('/', requireOwnerAdminOrSuperAdmin, async (req, res) => {
        try {
            // Get all users from auth.users
            const { data: users, error: usersError } = await adminSupabase.auth.admin.listUsers();

            if (usersError) {
                console.error('List users error:', usersError);
                return res.status(500).json({ error: 'Failed to fetch users' });
            }

            // Filter out deleted users
            const activeUsers = users.users.filter(user => !user.deleted_at);

            // Get accessible user IDs for owner admins
            let accessibleUserIds = null;
            if (!req.isSuperAdmin && req.isOwnerAdmin) {
                accessibleUserIds = new Set();
                for (const ownerId of req.ownerGroups) {
                    const { data, error } = await adminSupabase
                        .rpc('get_owner_admin_accessible_users', { p_owner_id: ownerId });
                    
                    if (!error && data) {
                        data.forEach(row => accessibleUserIds.add(row.user_id));
                    }
                }
            }

            // Filter users based on access level
            let filteredUsers = activeUsers;
            if (accessibleUserIds !== null) {
                filteredUsers = activeUsers.filter(user => accessibleUserIds.has(user.id));
            }

            // Get user roles for filtered users
            const userIds = filteredUsers.map(user => user.id);
            const { data: userRoles, error: rolesError } = await adminSupabase
                .from('user_permissions_summary')
                .select('*')
                .in('user_id', userIds);

            if (rolesError) {
                console.error('User roles error:', rolesError);
                return res.status(500).json({ error: 'Failed to fetch user roles' });
            }

            // Combine user data with roles
            const usersWithRoles = filteredUsers.map(user => {
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
                    banned_until: user.banned_until,
                    deleted_at: user.deleted_at,
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

            // Check if user is trying to downgrade themselves from super_admin
            const isEditingSelf = req.user.id === userId;
            
            // Get current role
            const { data: currentRoles } = await adminSupabase
                .from('user_roles')
                .select('role')
                .eq('user_id', userId)
                .eq('role', 'super_admin')
                .limit(1);

            // Prevent any super admin from downgrading themselves
            if (isEditingSelf && currentRoles && currentRoles.length > 0 && role !== 'super_admin') {
                return res.status(403).json({ 
                    error: 'Super admins cannot downgrade their own role. You must remain a super admin.' 
                });
            }

            // Check if user is the protected super admin
            if (userData.user.email === 'drjweinstein@gmail.com') {
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
     * POST /api/users/:email/reset-password - Reset user password (super admin and owner admin)
     */
    router.post('/:email/reset-password', requireOwnerAdminOrSuperAdmin, async (req, res) => {
        try {
            const { email } = req.params;

            // Get user by email to check permissions
            const { data: { users: targetUsers }, error: findError } = await adminSupabase.auth.admin.listUsers();
            if (findError) {
                return res.status(500).json({ error: 'Failed to find user' });
            }

            const targetUser = targetUsers.find(u => u.email === email);
            if (!targetUser) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Check if owner admin has access to this user
            if (!req.isSuperAdmin) {
                const hasAccess = await canOwnerAdminAccessUser(req.ownerGroups, targetUser.id);
                if (!hasAccess) {
                    return res.status(403).json({ error: 'You do not have permission to manage this user' });
                }
            }

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
     * PUT /api/users/:userId/password - Update user password directly (super admin and owner admin)
     */
    router.put('/:userId/password', requireOwnerAdminOrSuperAdmin, async (req, res) => {
        try {
            const { userId } = req.params;
            const { password } = req.body;

            if (!password || password.length < 6) {
                return res.status(400).json({ error: 'Password must be at least 6 characters' });
            }

            // Check if owner admin has access to this user
            if (!req.isSuperAdmin) {
                const hasAccess = await canOwnerAdminAccessUser(req.ownerGroups, userId);
                if (!hasAccess) {
                    return res.status(403).json({ error: 'You do not have permission to manage this user' });
                }
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
     * GET /api/users/:userId/profile - Get user profile (first_name, last_name)
     */
    router.get('/:userId/profile', requireOwnerAdminOrSuperAdmin, async (req, res) => {
        try {
            const { userId } = req.params;

            // Check if owner admin has access to this user
            if (!req.isSuperAdmin) {
                const hasAccess = await canOwnerAdminAccessUser(req.ownerGroups, userId);
                if (!hasAccess) {
                    return res.status(403).json({ error: 'You do not have permission to view this user' });
                }
            }

            // Get user profile
            const { data: profile, error: profileError } = await adminSupabase
                .from('user_profiles')
                .select('first_name, last_name')
                .eq('user_id', userId)
                .single();

            if (profileError) {
                if (profileError.code === 'PGRST116') {
                    // No profile exists yet - return null values
                    return res.json({ first_name: null, last_name: null });
                }
                console.error('Get profile error:', profileError);
                return res.status(500).json({ error: 'Failed to get profile', details: profileError.message });
            }

            res.json(profile || { first_name: null, last_name: null });
        } catch (error) {
            console.error('Get user profile error:', error);
            res.status(500).json({ error: 'Failed to get user profile', details: error.message });
        }
    });

    /**
     * PUT /api/users/:userId/profile - Update user profile (email, first_name, last_name)
     */
    router.put('/:userId/profile', requireOwnerAdminOrSuperAdmin, async (req, res) => {
        try {
            const { userId } = req.params;
            const { email, first_name, last_name } = req.body;

            // Check if owner admin has access to this user
            if (!req.isSuperAdmin) {
                const hasAccess = await canOwnerAdminAccessUser(req.ownerGroups, userId);
                if (!hasAccess) {
                    return res.status(403).json({ error: 'You do not have permission to manage this user' });
                }
            }

            // Update email in auth if provided
            if (email) {
                const { error: emailError } = await adminSupabase.auth.admin.updateUserById(userId, {
                    email: email,
                });

                if (emailError) {
                    console.error('Update email error:', emailError);
                    return res.status(500).json({ error: 'Failed to update email', details: emailError.message });
                }
            }

            // Update user profile (first_name, last_name) if provided
            if (first_name !== undefined || last_name !== undefined) {
                const profileUpdate = {};
                if (first_name !== undefined) profileUpdate.first_name = first_name || null;
                if (last_name !== undefined) profileUpdate.last_name = last_name || null;
                profileUpdate.updated_at = new Date().toISOString();

                const { error: profileError } = await adminSupabase
                    .from('user_profiles')
                    .upsert({
                        user_id: userId,
                        ...profileUpdate,
                    }, {
                        onConflict: 'user_id',
                    });

                if (profileError) {
                    console.error('Update profile error:', profileError);
                    return res.status(500).json({ error: 'Failed to update profile', details: profileError.message });
                }
            }

            res.json({ message: 'User profile updated successfully' });
        } catch (error) {
            console.error('Update user profile error:', error);
            res.status(500).json({ error: 'Failed to update user profile', details: error.message });
        }
    });

    /**
     * DELETE /api/users/:userId - Delete or ban user (super admin and owner admin)
     * Query params: action=delete|ban|unban, ban_duration=permanent|temporary, ban_hours=<number>
     */
    router.delete('/:userId', requireOwnerAdminOrSuperAdmin, async (req, res) => {
        try {
            const { userId } = req.params;
            const { action = 'delete', ban_duration = 'permanent', ban_hours = 24 } = req.query;

            // Check if this is the protected super admin
            const { data: userData, error: userError } = await adminSupabase.auth.admin.getUserById(userId);
            
            if (userError) {
                console.error('Get user error:', userError);
                return res.status(500).json({ error: 'Failed to get user information' });
            }

            // Prevent deletion/ban of protected super admin
            if (userData.user.email === 'drjweinstein@gmail.com') {
                return res.status(403).json({ 
                    error: 'Cannot delete or ban the primary super admin. This user cannot be removed from the system.' 
                });
            }

            // Check if owner admin has access to this user
            if (!req.isSuperAdmin) {
                const hasAccess = await canOwnerAdminAccessUser(req.ownerGroups, userId);
                if (!hasAccess) {
                    return res.status(403).json({ error: 'You do not have permission to manage this user' });
                }

                // Owner admins cannot delete/ban super admins or other owner admins
                const { data: targetUserRoles } = await adminSupabase
                    .from('user_roles')
                    .select('role')
                    .eq('user_id', userId)
                    .in('role', ['super_admin', 'owner_admin']);
                
                if (targetUserRoles && targetUserRoles.length > 0) {
                    return res.status(403).json({ 
                        error: 'Owner admins cannot delete or ban super admins or other owner admins' 
                    });
                }
            }

            if (action === 'ban') {
                // Ban user
                let bannedUntil;
                if (ban_duration === 'permanent') {
                    bannedUntil = '9999-12-31T23:59:59Z'; // Far future date for permanent ban
                } else {
                    const hours = parseInt(ban_hours) || 24;
                    const banDate = new Date();
                    banDate.setHours(banDate.getHours() + hours);
                    bannedUntil = banDate.toISOString();
                }

                const { error } = await adminSupabase.auth.admin.updateUserById(userId, {
                    ban_duration: bannedUntil,
                });

                if (error) {
                    console.error('Ban user error:', error);
                    return res.status(500).json({ error: 'Failed to ban user' });
                }

                res.json({ 
                    message: ban_duration === 'permanent' ? 'User banned permanently' : `User banned for ${ban_hours} hours`,
                    banned_until: bannedUntil
                });
            } else if (action === 'unban') {
                // Unban user
                const { error } = await adminSupabase.auth.admin.updateUserById(userId, {
                    ban_duration: 'none',
                });

                if (error) {
                    console.error('Unban user error:', error);
                    return res.status(500).json({ error: 'Failed to unban user' });
                }

                res.json({ message: 'User unbanned successfully' });
            } else {
                // Hard delete user (only super admins should typically do this)
                const { error } = await adminSupabase.auth.admin.deleteUser(userId);

                if (error) {
                    console.error('Delete user error:', error);
                    return res.status(500).json({ error: 'Failed to delete user' });
                }

                res.json({ message: 'User deleted successfully' });
            }
        } catch (error) {
            console.error('Delete/ban user error:', error);
            res.status(500).json({ error: 'Failed to process user action' });
        }
    });

    /**
     * GET /api/users/:userId/stats - Get user statistics (super admin and owner admin)
     */
    router.get('/:userId/stats', requireOwnerAdminOrSuperAdmin, async (req, res) => {
        try {
            const { userId } = req.params;

            // Check if owner admin has access to this user
            if (!req.isSuperAdmin) {
                const hasAccess = await canOwnerAdminAccessUser(req.ownerGroups, userId);
                if (!hasAccess) {
                    return res.status(403).json({ error: 'You do not have permission to view this user\'s statistics' });
                }
            }

            // Get user info
            const { data: userData, error: userError } = await adminSupabase.auth.admin.getUserById(userId);
            if (userError) {
                return res.status(500).json({ error: 'Failed to get user information' });
            }

            // Get documents uploaded by this user
            const { data: documents, error: docsError } = await adminSupabase
                .from('documents')
                .select('slug, title, created_at, owner_id')
                .eq('uploaded_by_user_id', userId)
                .order('created_at', { ascending: false });

            if (docsError) {
                console.error('Get documents error:', docsError);
                return res.status(500).json({ error: 'Failed to fetch user documents' });
            }

            // Calculate total storage (if we track file sizes)
            // For now, we'll return 0 as a placeholder
            const totalStorageBytes = 0;

            const statistics = {
                document_count: documents?.length || 0,
                documents: (documents || []).map(doc => ({
                    slug: doc.slug,
                    title: doc.title,
                    uploaded_at: doc.created_at,
                    owner_id: doc.owner_id
                })),
                total_storage_bytes: totalStorageBytes,
                last_login: userData.user.last_sign_in_at,
                account_created: userData.user.created_at,
                email_verified: !!userData.user.email_confirmed_at,
                is_banned: userData.user.banned_until && new Date(userData.user.banned_until) > new Date()
            };

            res.json(statistics);
        } catch (error) {
            console.error('Get user stats error:', error);
            res.status(500).json({ error: 'Failed to get user statistics' });
        }
    });

    return router;
}

module.exports = { createUsersRouter };
