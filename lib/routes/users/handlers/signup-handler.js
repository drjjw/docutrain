const { debugLog } = require('../../../utils/debug');

/**
 * Create signup route handlers
 * @param {Object} adminSupabase - Supabase admin client
 * @returns {Object} Route handler functions
 */
function createSignupHandlers(adminSupabase) {
    /**
     * POST /api/users/signup-profile - Create profile during signup (unauthenticated)
     */
    async function createSignupProfile(req, res) {
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
    }

    /**
     * POST /api/users/create-invited-user - Create user account for invited users via Admin API
     */
    async function createInvitedUser(req, res) {
        try {
            const { invite_token, email, password, first_name, last_name, tos_accepted_at, tos_version } = req.body;

            if (!invite_token || !email || !password) {
                return res.status(400).json({ success: false, error: 'invite_token, email, and password are required' });
            }

            // Normalize email
            const normalizedEmail = email.toLowerCase().trim();

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
                    invited_by,
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

            // Verify email matches invitation
            const invitationEmailNormalized = invitation.email?.toLowerCase().trim() || '';
            if (normalizedEmail !== invitationEmailNormalized) {
                return res.status(400).json({ 
                    success: false, 
                    error: `Email does not match invitation. Expected: ${invitation.email}` 
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

            // Check if user already exists
            const { data: existingUsers, error: listError } = await adminSupabase.auth.admin.listUsers();
            const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase().trim() === normalizedEmail);
            
            if (existingUser) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'An account with this email already exists' 
                });
            }

            // Create user via Admin API (this won't send confirmation email)
            const { data: newUserData, error: createError } = await adminSupabase.auth.admin.createUser({
                email: normalizedEmail,
                password: password,
                email_confirm: true, // Verify email immediately
                user_metadata: {
                    invite_token: invite_token,
                },
            });

            if (createError || !newUserData?.user) {
                console.error('Failed to create user:', createError);
                return res.status(500).json({ 
                    success: false, 
                    error: createError?.message || 'Failed to create user account' 
                });
            }

            const userId = newUserData.user.id;

            // Create user profile with name and TOS acceptance
            if (first_name !== undefined || last_name !== undefined || tos_accepted_at !== undefined) {
                const profileData = {
                    user_id: userId,
                    first_name: first_name ? first_name.trim() : null,
                    last_name: last_name ? last_name.trim() : null,
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
                    console.error('Failed to create user profile:', profileError);
                    // Don't fail - profile can be updated later
                }
            }

            // Add user role (registered) for the owner group
            const { error: roleError } = await adminSupabase
                .from('user_roles')
                .insert({
                    user_id: userId,
                    role: 'registered',
                    owner_id: invitation.owner_id,
                });

            if (roleError) {
                console.error('Failed to add user role:', roleError);
                // Check if role already exists
                const { data: existingRole } = await adminSupabase
                    .from('user_roles')
                    .select('id')
                    .eq('user_id', userId)
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
                    user_id: userId,
                    owner_id: invitation.owner_id,
                    granted_by: invitation.invited_by,
                });

            if (accessError) {
                console.error('Failed to add user to owner group:', accessError);
                // Check if user already has access
                const { data: existingAccess } = await adminSupabase
                    .from('user_owner_access')
                    .select('id')
                    .eq('user_id', userId)
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
                // Don't fail - user is already created
            }

            // Generate a session for the user
            const { data: sessionData, error: sessionError } = await adminSupabase.auth.admin.generateLink({
                type: 'magiclink',
                email: normalizedEmail,
            });

            if (sessionError) {
                console.error('Failed to generate session link:', sessionError);
                // Don't fail - user can sign in with password
            }

            return res.json({
                success: true,
                message: 'Account created and verified successfully',
                user: {
                    id: newUserData.user.id,
                    email: newUserData.user.email,
                },
                owner_name: invitation.owners?.name || 'Unknown',
            });
        } catch (error) {
            console.error('Create invited user error:', error);
            res.status(500).json({ success: false, error: 'Failed to create user account' });
        }
    }

    /**
     * POST /api/users/complete-invite-signup - Complete signup for invited users
     * @deprecated Use /api/users/create-invited-user instead to prevent confirmation emails
     */
    async function completeInviteSignup(req, res) {
        try {
            const { user_id, invite_token, first_name, last_name, tos_accepted_at, tos_version } = req.body;

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

            // Create user profile with name and TOS acceptance (if provided)
            if (first_name !== undefined || last_name !== undefined || tos_accepted_at !== undefined) {
                const profileData = {
                    user_id: user_id,
                    first_name: first_name ? first_name.trim() : null,
                    last_name: last_name ? last_name.trim() : null,
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
                    console.error('Failed to create user profile:', profileError);
                    // Don't fail the request - user is verified and added, profile can be updated later
                } else {
                    debugLog('User profile created successfully with name and TOS acceptance');
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
    }

    return {
        createSignupProfile,
        createInvitedUser,
        completeInviteSignup
    };
}

module.exports = { createSignupHandlers };

