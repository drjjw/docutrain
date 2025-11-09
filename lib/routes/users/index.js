const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { createMiddleware } = require('./middleware');
const { createUsersHandler } = require('./handlers/users-handler');
const { createInvitationsHandlers } = require('./handlers/invitations-handler');
const { createProfileHandlers } = require('./handlers/profile-handler');
const { createSignupHandlers } = require('./handlers/signup-handler');
const { createRoleHandlers } = require('./handlers/role-handler');
const { createPasswordHandlers } = require('./handlers/password-handler');
const { createUserManagementHandlers } = require('./handlers/user-management-handler');
const { createConfigHandlers } = require('./handlers/config-handler');

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

    // Initialize middleware
    const middleware = createMiddleware(adminSupabase);

    // Initialize handlers
    const usersHandler = createUsersHandler(adminSupabase, middleware);
    const invitationsHandlers = createInvitationsHandlers(adminSupabase, middleware);
    const profileHandlers = createProfileHandlers(adminSupabase, middleware);
    const signupHandlers = createSignupHandlers(adminSupabase);
    const roleHandlers = createRoleHandlers(adminSupabase, middleware);
    const passwordHandlers = createPasswordHandlers(adminSupabase, middleware);
    const userManagementHandlers = createUserManagementHandlers(adminSupabase, middleware);
    const configHandlers = createConfigHandlers(adminSupabase, middleware);

    // Register routes in correct order (important for route precedence)
    
    // 1. GET /api/users - List all users
    router.get('/', middleware.requireOwnerAdminOrSuperAdmin, usersHandler);

    // 2. Invitation routes (must come before /:userId/* routes)
    router.get('/pending-invitations', middleware.requireOwnerAdminOrSuperAdmin, invitationsHandlers.getPendingInvitations);
    router.delete('/pending-invitations/:invitationId', middleware.requireOwnerAdminOrSuperAdmin, invitationsHandlers.deletePendingInvitation);
    router.post('/pending-invitations/:invitationId/resend', middleware.requireOwnerAdminOrSuperAdmin, invitationsHandlers.resendPendingInvitation);
    router.get('/validate-invite', invitationsHandlers.validateInvite);
    router.post('/invite', middleware.requireOwnerAdminOrSuperAdmin, invitationsHandlers.inviteUser);

    // 3. Self-service profile routes (must come before /:userId/* routes)
    router.get('/me/profile', middleware.requireAuth, profileHandlers.getOwnProfile);
    router.put('/me/profile', middleware.requireAuth, profileHandlers.updateOwnProfile);

    // 4. Signup routes (must come before /:userId/* routes)
    router.post('/signup-profile', signupHandlers.createSignupProfile);
    router.post('/create-invited-user', signupHandlers.createInvitedUser);
    router.post('/complete-invite-signup', signupHandlers.completeInviteSignup);

    // 5. Config route (must come before /:userId/* routes)
    router.get('/config', middleware.requireSuperAdmin, configHandlers.getConfig);

    // 6. User-specific routes (most specific last)
    router.put('/:userId/role', middleware.requireSuperAdmin, roleHandlers.updateUserRole);
    router.post('/:email/reset-password', middleware.requireOwnerAdminOrSuperAdmin, passwordHandlers.resetPassword);
    router.put('/:userId/password', middleware.requireOwnerAdminOrSuperAdmin, passwordHandlers.updatePassword);
    router.get('/:userId/profile', middleware.requireOwnerAdminOrSuperAdmin, profileHandlers.getUserProfile);
    router.put('/:userId/profile', middleware.requireOwnerAdminOrSuperAdmin, profileHandlers.updateUserProfile);
    router.delete('/:userId', middleware.requireOwnerAdminOrSuperAdmin, userManagementHandlers.deleteOrBanUser);
    router.get('/:userId/stats', middleware.requireOwnerAdminOrSuperAdmin, userManagementHandlers.getUserStats);

    return router;
}

module.exports = { createUsersRouter };

