/**
 * Document routes authentication utilities
 * Centralized authentication and service role client creation
 */

const { createClient } = require('@supabase/supabase-js');

/**
 * Authenticate user from request authorization header
 * @param {object} req - Express request object
 * @param {object} supabase - Supabase client
 * @returns {Promise<{userId: string|null}>}
 */
async function authenticateUser(req, supabase) {
    let userId = null;
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        console.log(`🔐 Auth header present, extracting user from token...`);
        try {
            const { data: { user }, error } = await supabase.auth.getUser(token);
            if (error) {
                console.log(`❌ Auth error:`, error);
            } else if (user) {
                userId = user.id;
                console.log(`✅ Authenticated user: ${userId} (${user.email})`);
            } else {
                console.log(`⚠️ No user returned from token`);
            }
        } catch (error) {
            console.log(`❌ Exception getting user:`, error);
            // Ignore - treat as unauthenticated
        }
    } else {
        console.log(`🔓 No auth header - treating as unauthenticated`);
    }
    
    return { userId };
}

/**
 * Create service role Supabase client for bypassing RLS
 * @param {object} supabase - Regular Supabase client (fallback)
 * @returns {object} Service role Supabase client or fallback to regular client
 */
function createServiceRoleClient(supabase) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    let serviceSupabase = supabase; // Default to regular client
    
    if (serviceRoleKey && process.env.SUPABASE_URL) {
        try {
            serviceSupabase = createClient(
                process.env.SUPABASE_URL,
                serviceRoleKey
            );
        } catch (error) {
            console.error('Error creating service role client:', error);
            // Fallback to regular client
            serviceSupabase = supabase;
        }
    }
    
    return serviceSupabase;
}

module.exports = {
    authenticateUser,
    createServiceRoleClient
};

