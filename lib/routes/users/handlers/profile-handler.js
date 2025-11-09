/**
 * Create profile route handlers
 * @param {Object} adminSupabase - Supabase admin client
 * @param {Object} middleware - Middleware functions
 * @returns {Object} Route handler functions
 */
function createProfileHandlers(adminSupabase, middleware) {
    const { requireAuth, requireOwnerAdminOrSuperAdmin, canOwnerAdminAccessUser } = middleware;

    /**
     * GET /api/users/me/profile - Get own profile (self-service)
     */
    async function getOwnProfile(req, res) {
        try {
            const userId = req.user.id;

            // Get user profile
            const { data: profile, error: profileError } = await adminSupabase
                .from('user_profiles')
                .select('first_name, last_name')
                .eq('user_id', userId)
                .single();

            if (profileError) {
                if (profileError.code === 'PGRST116') {
                    // No profile exists yet - return null values
                    return res.json({ first_name: null, last_name: null, email: req.user.email });
                }
                console.error('Get profile error:', profileError);
                return res.status(500).json({ error: 'Failed to get profile', details: profileError.message });
            }

            res.json({
                first_name: profile?.first_name || null,
                last_name: profile?.last_name || null,
                email: req.user.email
            });
        } catch (error) {
            console.error('Get profile error:', error);
            res.status(500).json({ error: 'Failed to get profile', details: error.message });
        }
    }

    /**
     * PUT /api/users/me/profile - Update own profile (self-service)
     */
    async function updateOwnProfile(req, res) {
        try {
            const userId = req.user.id;
            const { email, first_name, last_name, tos_accepted_at, tos_version } = req.body;

            // Update email in auth if provided
            if (email !== undefined && email !== req.user.email) {
                const { error: emailError } = await adminSupabase.auth.admin.updateUserById(userId, {
                    email: email,
                });

                if (emailError) {
                    console.error('Update email error:', emailError);
                    return res.status(500).json({ error: 'Failed to update email', details: emailError.message });
                }
            }

            // Update user profile (first_name, last_name, tos fields) if provided
            if (first_name !== undefined || last_name !== undefined || tos_accepted_at !== undefined || tos_version !== undefined) {
                const profileUpdate = {};
                if (first_name !== undefined) profileUpdate.first_name = first_name || null;
                if (last_name !== undefined) profileUpdate.last_name = last_name || null;
                if (tos_accepted_at !== undefined) profileUpdate.tos_accepted_at = tos_accepted_at || null;
                if (tos_version !== undefined) profileUpdate.tos_version = tos_version || null;
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

            res.json({ message: 'Profile updated successfully' });
        } catch (error) {
            console.error('Update profile error:', error);
            res.status(500).json({ error: 'Failed to update profile', details: error.message });
        }
    }

    /**
     * GET /api/users/:userId/profile - Get user profile (admin)
     */
    async function getUserProfile(req, res) {
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
    }

    /**
     * PUT /api/users/:userId/profile - Update user profile (admin)
     */
    async function updateUserProfile(req, res) {
        try {
            const { userId } = req.params;
            const { email, first_name, last_name } = req.body;

            // Allow users to update their own profile via admin endpoint if they have admin access
            // OR allow admins to update users they have access to
            const isSelfUpdate = req.user.id === userId;
            const isSuperAdmin = req.isSuperAdmin;

            if (!isSelfUpdate && !isSuperAdmin) {
                // For owner admins updating other users, check access
                const hasAccess = await canOwnerAdminAccessUser(req.ownerGroups, userId);
                if (!hasAccess) {
                    return res.status(403).json({ error: 'You do not have permission to manage this user' });
                }
            }

            // Update email in auth if provided
            if (email !== undefined) {
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
    }

    return {
        getOwnProfile,
        updateOwnProfile,
        getUserProfile,
        updateUserProfile
    };
}

module.exports = { createProfileHandlers };

