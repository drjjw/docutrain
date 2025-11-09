/**
 * Create user management route handlers
 * @param {Object} adminSupabase - Supabase admin client
 * @param {Object} middleware - Middleware functions
 * @returns {Object} Route handler functions
 */
function createUserManagementHandlers(adminSupabase, middleware) {
    const { requireOwnerAdminOrSuperAdmin, canOwnerAdminAccessUser } = middleware;

    /**
     * DELETE /api/users/:userId - Delete or ban user
     */
    async function deleteOrBanUser(req, res) {
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
    }

    /**
     * GET /api/users/:userId/stats - Get user statistics
     */
    async function getUserStats(req, res) {
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
    }

    return {
        deleteOrBanUser,
        getUserStats
    };
}

module.exports = { createUserManagementHandlers };

