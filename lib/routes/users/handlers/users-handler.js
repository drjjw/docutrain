/**
 * Handler for GET /api/users - Get all users with roles
 * @param {Object} adminSupabase - Supabase admin client
 * @param {Function} requireOwnerAdminOrSuperAdmin - Middleware function
 * @returns {Function} Express route handler
 */
function createUsersHandler(adminSupabase, requireOwnerAdminOrSuperAdmin) {
    return async (req, res) => {
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

            // Get user profiles for filtered users
            const { data: userProfiles, error: profilesError } = await adminSupabase
                .from('user_profiles')
                .select('user_id, first_name, last_name')
                .in('user_id', userIds);

            if (profilesError) {
                console.error('User profiles error:', profilesError);
                // Don't fail - just continue without profiles
            }

            // Create a map of user_id to profile data
            const profileMap = {};
            if (userProfiles) {
                userProfiles.forEach(profile => {
                    profileMap[profile.user_id] = {
                        first_name: profile.first_name,
                        last_name: profile.last_name
                    };
                });
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

                const profile = profileMap[user.id] || {};

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
                    first_name: profile.first_name || null,
                    last_name: profile.last_name || null,
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
    };
}

module.exports = { createUsersHandler };

