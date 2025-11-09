const { debugLog } = require('../../../utils/debug');

/**
 * Create role route handlers
 * @param {Object} adminSupabase - Supabase admin client
 * @param {Object} middleware - Middleware functions
 * @returns {Object} Route handler functions
 */
function createRoleHandlers(adminSupabase, middleware) {
    const { requireSuperAdmin } = middleware;

    /**
     * PUT /api/users/:userId/role - Update user role (super admin only)
     */
    async function updateUserRole(req, res) {
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
                debugLog(`Role already exists for user ${userId}: ${role} with owner_id ${owner_id || 'null'}`);
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
    }

    return {
        updateUserRole
    };
}

module.exports = { createRoleHandlers };

