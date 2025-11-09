/**
 * Create password route handlers
 * @param {Object} adminSupabase - Supabase admin client
 * @param {Object} middleware - Middleware functions
 * @returns {Object} Route handler functions
 */
function createPasswordHandlers(adminSupabase, middleware) {
    const { requireOwnerAdminOrSuperAdmin, canOwnerAdminAccessUser } = middleware;

    /**
     * POST /api/users/:email/reset-password - Reset user password
     */
    async function resetPassword(req, res) {
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
    }

    /**
     * PUT /api/users/:userId/password - Update user password directly
     */
    async function updatePassword(req, res) {
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
    }

    return {
        resetPassword,
        updatePassword
    };
}

module.exports = { createPasswordHandlers };

