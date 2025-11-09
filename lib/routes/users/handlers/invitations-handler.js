const { debugLog } = require('../../../utils/debug');

/**
 * Create invitation route handlers
 * @param {Object} adminSupabase - Supabase admin client
 * @param {Object} middleware - Middleware functions
 * @returns {Object} Route handler functions
 */
function createInvitationsHandlers(adminSupabase, middleware) {
    const { requireOwnerAdminOrSuperAdmin } = middleware;

    /**
     * GET /api/users/pending-invitations - Get pending invitations
     */
    async function getPendingInvitations(req, res) {
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
    }

    /**
     * DELETE /api/users/pending-invitations/:invitationId - Delete a pending invitation
     */
    async function deletePendingInvitation(req, res) {
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
    }

    /**
     * POST /api/users/pending-invitations/:invitationId/resend - Resend a pending invitation
     */
    async function resendPendingInvitation(req, res) {
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
    }

    /**
     * GET /api/users/validate-invite - Validate invitation token
     */
    async function validateInvite(req, res) {
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
    }

    /**
     * POST /api/users/invite - Invite a user to join an owner group
     */
    async function inviteUser(req, res) {
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
                debugLog(`User ${email} already exists, adding to owner group ${owner.name}`);

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
                debugLog(`User ${email} doesn't exist, creating invitation for ${owner.name}`);

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
    }

    return {
        getPendingInvitations,
        deletePendingInvitation,
        resendPendingInvitation,
        validateInvite,
        inviteUser
    };
}

module.exports = { createInvitationsHandlers };

