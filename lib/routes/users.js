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

            console.log('requireOwnerAdminOrSuperAdmin - User permissions:', {
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
     * Defined early so it can be used by routes below
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
    });

    /**
     * GET /api/users/pending-invitations - Get pending invitations
     * Returns invitations that haven't been used yet and haven't expired
     * Requires owner admin or super admin authentication
     * Owner admins only see invitations for their owner groups
     * NOTE: Must come before all /:userId/* routes to avoid route conflicts
     */
    router.get('/pending-invitations', requireOwnerAdminOrSuperAdmin, async (req, res) => {
        try {
            const now = new Date().toISOString();

            // Build query for pending invitations (not used and not expired)
            let query = adminSupabase
                .from('user_invitations')
                .select(`
                    id,
                    email,
                    owner_id,
                    invited_by,
                    expires_at,
                    created_at,
                    owners:owner_id (
                        id,
                        name,
                        slug
                    )
                `)
                .is('used_at', null)
                .gt('expires_at', now)
                .order('created_at', { ascending: false });

            // If owner admin, filter by their owner groups
            if (!req.isSuperAdmin && req.isOwnerAdmin && req.ownerGroups.length > 0) {
                query = query.in('owner_id', req.ownerGroups);
            }

            const { data: invitations, error: invitationsError } = await query;

            if (invitationsError) {
                console.error('Get pending invitations error:', invitationsError);
                return res.status(500).json({ error: 'Failed to fetch pending invitations' });
            }

            // Get inviter emails for display
            const inviterIds = [...new Set(invitations.map(inv => inv.invited_by))];
            const inviterEmails = {};
            
            if (inviterIds.length > 0) {
                const { data: inviters, error: invitersError } = await adminSupabase.auth.admin.listUsers();
                if (!invitersError && inviters) {
                    inviters.users.forEach(user => {
                        if (inviterIds.includes(user.id)) {
                            inviterEmails[user.id] = user.email || 'Unknown';
                        }
                    });
                }
            }

            // Format invitations with owner and inviter info
            const formattedInvitations = (invitations || []).map(inv => {
                const owner = Array.isArray(inv.owners) ? inv.owners[0] : inv.owners;
                const expiresAt = new Date(inv.expires_at);
                const isExpired = expiresAt < new Date();

                return {
                    id: inv.id,
                    email: inv.email,
                    owner_id: inv.owner_id,
                    owner_name: owner?.name || 'Unknown',
                    owner_slug: owner?.slug || null,
                    invited_by: inv.invited_by,
                    invited_by_email: inviterEmails[inv.invited_by] || null,
                    expires_at: inv.expires_at,
                    created_at: inv.created_at,
                    is_expired: isExpired,
                };
            });

            res.json(formattedInvitations);
        } catch (error) {
            console.error('Get pending invitations error:', error);
            res.status(500).json({ error: 'Failed to fetch pending invitations', details: error.message });
        }
    });

    /**
     * DELETE /api/users/pending-invitations/:invitationId - Delete a pending invitation
     * Requires owner admin or super admin authentication
     * Owner admins can only delete invitations for their owner groups
     * NOTE: Must come before all /:userId/* routes to avoid route conflicts
     */
    router.delete('/pending-invitations/:invitationId', requireOwnerAdminOrSuperAdmin, async (req, res) => {
        try {
            const { invitationId } = req.params;

            // Get the invitation to check permissions
            const { data: invitation, error: fetchError } = await adminSupabase
                .from('user_invitations')
                .select('id, owner_id, used_at')
                .eq('id', invitationId)
                .single();

            if (fetchError || !invitation) {
                return res.status(404).json({ error: 'Invitation not found' });
            }

            // Check if invitation has already been used
            if (invitation.used_at) {
                return res.status(400).json({ error: 'Cannot delete an invitation that has already been used' });
            }

            // Check permissions - owner admins can only delete invitations for their owner groups
            if (!req.isSuperAdmin && req.isOwnerAdmin) {
                const ownerIdStr = String(invitation.owner_id).trim();
                const ownerGroupIds = req.ownerGroups.map(id => String(id).trim());
                
                if (!ownerGroupIds.includes(ownerIdStr)) {
                    return res.status(403).json({ error: 'You can only delete invitations for your own owner groups' });
                }
            }

            // Delete the invitation
            const { error: deleteError } = await adminSupabase
                .from('user_invitations')
                .delete()
                .eq('id', invitationId);

            if (deleteError) {
                console.error('Delete invitation error:', deleteError);
                return res.status(500).json({ error: 'Failed to delete invitation' });
            }

            res.json({ success: true, message: 'Invitation deleted successfully' });
        } catch (error) {
            console.error('Delete invitation error:', error);
            res.status(500).json({ error: 'Failed to delete invitation', details: error.message });
        }
    });

    /**
     * POST /api/users/pending-invitations/:invitationId/resend - Resend a pending invitation
     * Deletes the old invitation and creates a new one via the edge function
     * Requires owner admin or super admin authentication
     * Owner admins can only resend invitations for their owner groups
     * NOTE: Must come before all /:userId/* routes to avoid route conflicts
     */
    router.post('/pending-invitations/:invitationId/resend', requireOwnerAdminOrSuperAdmin, async (req, res) => {
        try {
            const { invitationId } = req.params;

            // Get the invitation details
            const { data: invitation, error: fetchError } = await adminSupabase
                .from('user_invitations')
                .select('id, email, owner_id, invited_by, used_at')
                .eq('id', invitationId)
                .single();

            if (fetchError || !invitation) {
                return res.status(404).json({ error: 'Invitation not found' });
            }

            // Check if invitation has already been used
            if (invitation.used_at) {
                return res.status(400).json({ error: 'Cannot resend an invitation that has already been used' });
            }

            // Check permissions - owner admins can only resend invitations for their owner groups
            if (!req.isSuperAdmin && req.isOwnerAdmin) {
                const ownerIdStr = String(invitation.owner_id).trim();
                const ownerGroupIds = req.ownerGroups.map(id => String(id).trim());
                
                if (!ownerGroupIds.includes(ownerIdStr)) {
                    return res.status(403).json({ error: 'You can only resend invitations for your own owner groups' });
                }
            }

            // Delete the old invitation
            const { error: deleteError } = await adminSupabase
                .from('user_invitations')
                .delete()
                .eq('id', invitationId);

            if (deleteError) {
                console.error('Delete old invitation error:', deleteError);
                return res.status(500).json({ error: 'Failed to delete old invitation' });
            }

            // Call the edge function to send a new invitation
            const edgeFunctionUrl = `${process.env.SUPABASE_URL}/functions/v1/send-invitation`;
            const inviteResponse = await fetch(edgeFunctionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
                },
                body: JSON.stringify({
                    email: invitation.email,
                    owner_id: invitation.owner_id,
                    invited_by_user_id: invitation.invited_by,
                }),
            });

            if (!inviteResponse.ok) {
                const errorText = await inviteResponse.text();
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch {
                    errorData = { error: errorText };
                }
                console.error('Resend invitation edge function error:', errorData);
                return res.status(500).json({ 
                    error: errorData.error || 'Failed to resend invitation email' 
                });
            }

            const inviteResult = await inviteResponse.json();

            res.json({
                success: true,
                message: `Invitation resent to ${invitation.email}`,
                invitation_id: inviteResult.invitation_id,
            });
        } catch (error) {
            console.error('Resend invitation error:', error);
            res.status(500).json({ error: 'Failed to resend invitation', details: error.message });
        }
    });

    /**
     * GET /api/users/me/profile - Get own profile (self-service)
     * Allows any authenticated user to get their own profile data
     * NOTE: Must come before all /:userId/* routes to avoid route conflicts
     */
    router.get('/me/profile', requireAuth, async (req, res) => {
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
    });

    /**
     * POST /api/users/signup-profile - Create profile during signup (unauthenticated)
     * Creates user profile with name and TOS acceptance during signup
     * This endpoint is used when email confirmation is required and no session exists yet
     * NOTE: Must come before all /:userId/* routes to avoid route conflicts
     */
    router.post('/signup-profile', async (req, res) => {
        try {
            const { user_id, first_name, last_name, tos_accepted_at, tos_version } = req.body;

            if (!user_id) {
                return res.status(400).json({ error: 'user_id is required' });
            }

            // Verify user exists in auth.users and was created recently (within last 5 minutes)
            // This prevents abuse of the endpoint
            const { data: userData, error: userError } = await adminSupabase.auth.admin.getUserById(user_id);
            
            if (userError || !userData || !userData.user) {
                return res.status(404).json({ error: 'User not found' });
            }

            const user = userData.user;
            const userCreatedAt = new Date(user.created_at);
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            
            if (userCreatedAt < fiveMinutesAgo) {
                return res.status(403).json({ error: 'Profile can only be created within 5 minutes of signup' });
            }

            // Create user profile with provided data
            const profileData = {
                user_id: user_id,
                first_name: first_name || null,
                last_name: last_name || null,
                tos_accepted_at: tos_accepted_at || null,
                tos_version: tos_version || null,
                updated_at: new Date().toISOString(),
            };

            const { error: profileError } = await adminSupabase
                .from('user_profiles')
                .upsert(profileData, {
                    onConflict: 'user_id',
                });

            if (profileError) {
                console.error('Signup profile creation error:', profileError);
                return res.status(500).json({ error: 'Failed to create profile', details: profileError.message });
            }

            res.json({ message: 'Profile created successfully' });
        } catch (error) {
            console.error('Signup profile creation error:', error);
            res.status(500).json({ error: 'Failed to create profile', details: error.message });
        }
    });

    /**
     * POST /api/users/complete-invite-signup - Complete signup for invited users
     * Auto-verifies email, adds user to owner group, and marks invitation as used
     * Public endpoint (no auth required) - called during signup
     * NOTE: Must come before all /:userId/* routes to avoid route conflicts
     */
    router.post('/complete-invite-signup', async (req, res) => {
        try {
            const { user_id, invite_token } = req.body;

            if (!user_id || !invite_token) {
                return res.status(400).json({ success: false, error: 'user_id and invite_token are required' });
            }

            // Get invitation from database
            const { data: invitation, error: inviteError } = await adminSupabase
                .from('user_invitations')
                .select(`
                    id,
                    email,
                    invite_token,
                    expires_at,
                    used_at,
                    owner_id,
                    owners:owner_id (
                        id,
                        name
                    )
                `)
                .eq('invite_token', invite_token)
                .single();

            if (inviteError || !invitation) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Invalid invitation token' 
                });
            }

            // Verify email matches
            const { data: userData, error: userError } = await adminSupabase.auth.admin.getUserById(user_id);
            if (userError || !userData || !userData.user) {
                return res.status(404).json({ success: false, error: 'User not found' });
            }

            const user = userData.user;

            // Normalize emails for comparison (trim and lowercase)
            const userEmailNormalized = user.email?.toLowerCase().trim() || '';
            const invitationEmailNormalized = invitation.email?.toLowerCase().trim() || '';

            if (userEmailNormalized !== invitationEmailNormalized) {
                console.error('Email mismatch:', {
                    user_email: user.email,
                    user_email_normalized: userEmailNormalized,
                    invitation_email: invitation.email,
                    invitation_email_normalized: invitationEmailNormalized,
                    user_id: user_id,
                    invite_token: invite_token?.substring(0, 10) + '...' // Only log first 10 chars for security
                });
                return res.status(400).json({ 
                    success: false, 
                    error: `Email does not match invitation. Expected: ${invitation.email}, Got: ${user.email || 'undefined'}` 
                });
            }

            // Check if invitation has been used
            if (invitation.used_at) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Invitation has already been used' 
                });
            }

            // Check if invitation has expired
            const expiresAt = new Date(invitation.expires_at);
            const now = new Date();
            if (expiresAt < now) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Invitation has expired' 
                });
            }

            // Auto-verify email
            const { error: verifyError } = await adminSupabase.auth.admin.updateUserById(user_id, {
                email_confirm: true,
            });

            if (verifyError) {
                console.error('Failed to verify email:', verifyError);
                return res.status(500).json({ success: false, error: 'Failed to verify email' });
            }

            // Add user role (registered) for the owner group
            const { error: roleError } = await adminSupabase
                .from('user_roles')
                .insert({
                    user_id: user_id,
                    role: 'registered',
                    owner_id: invitation.owner_id,
                });

            if (roleError) {
                console.error('Failed to add user role:', roleError);
                // Check if role already exists
                const { data: existingRole } = await adminSupabase
                    .from('user_roles')
                    .select('id')
                    .eq('user_id', user_id)
                    .eq('owner_id', invitation.owner_id)
                    .maybeSingle();

                if (!existingRole) {
                    return res.status(500).json({ success: false, error: 'Failed to assign user role' });
                }
            }

            // Add user to owner group access
            const { error: accessError } = await adminSupabase
                .from('user_owner_access')
                .insert({
                    user_id: user_id,
                    owner_id: invitation.owner_id,
                    granted_by: invitation.invited_by,
                });

            if (accessError) {
                console.error('Failed to add user to owner group:', accessError);
                // Check if user already has access (might have been added manually)
                const { data: existingAccess } = await adminSupabase
                    .from('user_owner_access')
                    .select('id')
                    .eq('user_id', user_id)
                    .eq('owner_id', invitation.owner_id)
                    .maybeSingle();

                if (!existingAccess) {
                    return res.status(500).json({ success: false, error: 'Failed to add user to owner group' });
                }
            }

            // Mark invitation as used
            const { error: markUsedError } = await adminSupabase
                .from('user_invitations')
                .update({ used_at: new Date().toISOString() })
                .eq('id', invitation.id);

            if (markUsedError) {
                console.error('Failed to mark invitation as used:', markUsedError);
                // Don't fail the request - user is already added
            }

            // Generate a session token for the user so they can be logged in immediately
            const { data: sessionData, error: sessionError } = await adminSupabase.auth.admin.generateLink({
                type: 'magiclink',
                email: user.email,
            });

            if (sessionError) {
                console.error('Failed to generate session link:', sessionError);
                // Don't fail - user is verified and added, they can log in normally
            }

            return res.json({
                success: true,
                message: 'Account created and verified successfully',
                owner_name: invitation.owners?.name || 'Unknown',
                session_token: sessionData?.properties?.hashed_token || null,
            });
        } catch (error) {
            console.error('Complete invite signup error:', error);
            res.status(500).json({ success: false, error: 'Failed to complete invite signup' });
        }
    });

    /**
     * GET /api/users/validate-invite - Validate invitation token and return invitation details
     * Public endpoint (no auth required) for validating invite tokens
     * NOTE: Must come before all /:userId/* routes to avoid route conflicts
     */
    router.get('/validate-invite', async (req, res) => {
        try {
            const token = req.query.token;

            if (!token) {
                return res.status(400).json({ success: false, error: 'Invitation token is required' });
            }

            // Get invitation from database
            const { data: invitation, error: inviteError } = await adminSupabase
                .from('user_invitations')
                .select(`
                    id,
                    email,
                    invite_token,
                    expires_at,
                    used_at,
                    owner_id,
                    owners:owner_id (
                        id,
                        name,
                        slug
                    )
                `)
                .eq('invite_token', token)
                .single();

            if (inviteError || !invitation) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Invalid or expired invitation link' 
                });
            }

            // Check if invitation has been used
            if (invitation.used_at) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'This invitation has already been used' 
                });
            }

            // Check if invitation has expired
            const expiresAt = new Date(invitation.expires_at);
            const now = new Date();
            if (expiresAt < now) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'This invitation has expired' 
                });
            }

            return res.json({
                success: true,
                invitation: {
                    email: invitation.email,
                    owner_name: invitation.owners?.name || 'Unknown',
                    owner_slug: invitation.owners?.slug || null,
                    expires_at: invitation.expires_at,
                }
            });
        } catch (error) {
            console.error('Validate invite error:', error);
            res.status(500).json({ success: false, error: 'Failed to validate invitation' });
        }
    });

    /**
     * POST /api/users/invite - Invite a user to join an owner group
     * Requires owner admin or super admin authentication
     * If user exists, adds them to owner group and sends notification
     * If user doesn't exist, creates invitation and sends signup email
     * NOTE: Must come before all /:userId/* routes to avoid route conflicts
     */
    router.post('/invite', requireOwnerAdminOrSuperAdmin, async (req, res) => {
        try {
            const { email, owner_id } = req.body;

            // Validate required fields
            if (!email || !owner_id) {
                return res.status(400).json({ error: 'email and owner_id are required' });
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({ error: 'Invalid email format' });
            }

            // Validate owner_id access for owner admins
            if (!req.isSuperAdmin && req.isOwnerAdmin) {
                // Convert both to strings for comparison (UUIDs might be in different formats)
                const ownerIdStr = String(owner_id).trim();
                const ownerGroupIds = req.ownerGroups.map(id => String(id).trim());
                
                if (!ownerGroupIds.includes(ownerIdStr)) {
                    console.error('Owner admin invite validation failed:', {
                        requested_owner_id: ownerIdStr,
                        user_owner_groups: ownerGroupIds,
                        isSuperAdmin: req.isSuperAdmin,
                        isOwnerAdmin: req.isOwnerAdmin
                    });
                    return res.status(403).json({ error: 'You can only invite users to your own owner groups' });
                }
            }

            // Check if owner exists
            const { data: owner, error: ownerError } = await adminSupabase
                .from('owners')
                .select('id, name')
                .eq('id', owner_id)
                .single();

            if (ownerError || !owner) {
                return res.status(404).json({ error: 'Owner group not found' });
            }

            // Check if user already exists
            const { data: existingUsers, error: listError } = await adminSupabase.auth.admin.listUsers();
            
            if (listError) {
                console.error('List users error:', listError);
                return res.status(500).json({ error: 'Failed to check existing users' });
            }

            const existingUser = existingUsers.users.find(
                u => u.email?.toLowerCase() === email.toLowerCase().trim() && !u.deleted_at
            );

            if (existingUser) {
                // User exists - add to owner group and send notification
                console.log(`User ${email} already exists, adding to owner group ${owner.name}`);

                // Check if user already has access to this owner group
                const { data: existingAccess, error: accessCheckError } = await adminSupabase
                    .from('user_owner_access')
                    .select('id')
                    .eq('user_id', existingUser.id)
                    .eq('owner_id', owner_id)
                    .maybeSingle();

                if (accessCheckError) {
                    console.error('Access check error:', accessCheckError);
                    return res.status(500).json({ error: 'Failed to check existing access' });
                }

                if (existingAccess) {
                    return res.status(400).json({ 
                        error: 'User already has access to this owner group',
                        user_id: existingUser.id 
                    });
                }

                // Add user to owner group
                const { error: addAccessError } = await adminSupabase
                    .from('user_owner_access')
                    .insert({
                        user_id: existingUser.id,
                        owner_id: owner_id,
                        granted_by: req.user.id,
                    });

                if (addAccessError) {
                    console.error('Add access error:', addAccessError);
                    return res.status(500).json({ error: 'Failed to add user to owner group' });
                }

                // Create invitation record (marked as used immediately) for audit trail
                const { error: inviteError } = await adminSupabase
                    .from('user_invitations')
                    .insert({
                        email: email.toLowerCase().trim(),
                        invite_token: `used-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                        owner_id: owner_id,
                        invited_by: req.user.id,
                        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                        used_at: new Date().toISOString(),
                    });

                if (inviteError) {
                    console.error('Invitation record error (non-critical):', inviteError);
                    // Continue even if invitation record fails
                }

                // Call notify-existing-user edge function
                try {
                    const notifyUrl = `${process.env.SUPABASE_URL}/functions/v1/notify-existing-user`;
                    const notifyResponse = await fetch(notifyUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
                            'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY
                        },
                        body: JSON.stringify({
                            email: email.toLowerCase().trim(),
                            owner_id: owner_id,
                        }),
                    });

                    if (!notifyResponse.ok) {
                        const errorText = await notifyResponse.text();
                        console.error('Notify edge function error:', errorText);
                        // Don't fail the request if notification fails
                    }
                } catch (notifyError) {
                    console.error('Failed to call notify edge function:', notifyError);
                    // Don't fail the request if notification fails
                }

                return res.json({
                    success: true,
                    message: `User ${email} has been added to ${owner.name}`,
                    user_id: existingUser.id,
                    action: 'added_to_group'
                });
            } else {
                // User doesn't exist - create invitation and send signup email
                console.log(`User ${email} doesn't exist, creating invitation for ${owner.name}`);

                // Call send-invitation edge function
                const inviteUrl = `${process.env.SUPABASE_URL}/functions/v1/send-invitation`;
                const inviteResponse = await fetch(inviteUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
                        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY
                    },
                    body: JSON.stringify({
                        email: email.toLowerCase().trim(),
                        owner_id: owner_id,
                        invited_by_user_id: req.user.id,
                    }),
                });

                if (!inviteResponse.ok) {
                    const errorText = await inviteResponse.text();
                    let errorData;
                    try {
                        errorData = JSON.parse(errorText);
                    } catch {
                        errorData = { error: errorText };
                    }
                    console.error('Send invitation edge function error:', errorData);
                    return res.status(500).json({ 
                        error: errorData.error || 'Failed to send invitation email' 
                    });
                }

                const inviteResult = await inviteResponse.json();

                return res.json({
                    success: true,
                    message: `Invitation sent to ${email}`,
                    invitation_id: inviteResult.invitation_id,
                    action: 'invitation_sent'
                });
            }
        } catch (error) {
            console.error('Invite user error:', error);
            res.status(500).json({ error: 'Failed to invite user', details: error.message });
        }
    });

    /**
     * PUT /api/users/me/profile - Update own profile (self-service)
     * Allows any authenticated user to update their own email, first_name, last_name, tos_accepted_at, tos_version
     * NOTE: Must come before all /:userId/* routes to avoid route conflicts
     */
    router.put('/me/profile', requireAuth, async (req, res) => {
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
     * For admins managing other users (or themselves via admin endpoint)
     */
    router.put('/:userId/profile', requireOwnerAdminOrSuperAdmin, async (req, res) => {
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
