/**
 * Authentication utilities for processing routes
 * Consolidates repeated authentication logic
 */

/**
 * Authenticate user from request
 * Extracts token from Authorization header and verifies with Supabase
 * 
 * @param {Object} req - Express request object
 * @param {Object} supabase - Supabase client
 * @returns {Promise<{user: Object, token: string, authHeader: string} | {error: Object}>}
 */
async function authenticateUser(req, supabase) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return {
            error: {
                status: 401,
                json: {
                    success: false,
                    error: 'Authentication required'
                }
            }
        };
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
        return {
            error: {
                status: 401,
                json: {
                    success: false,
                    error: 'Invalid authentication token'
                }
            }
        };
    }

    return { user, token, authHeader };
}

/**
 * Create authenticated Supabase client for a user
 * Uses the Authorization header to create a client with user context
 * 
 * @param {string} authHeader - Authorization header value (e.g., "Bearer <token>")
 * @returns {Object} Authenticated Supabase client
 */
function createUserSupabaseClient(authHeader) {
    const { createClient } = require('@supabase/supabase-js');
    return createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY,
        {
            global: {
                headers: {
                    Authorization: authHeader
                }
            }
        }
    );
}

module.exports = {
    authenticateUser,
    createUserSupabaseClient
};



