// Authentication middleware for Supabase JWT verification
const { createClient } = require('@supabase/supabase-js');

/**
 * Middleware to verify Supabase JWT token
 * Adds user object to req.user if authenticated
 */
async function requireAuth(req, res, next) {
    try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Missing or invalid authorization header'
            });
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        // Create Supabase client with the user's token
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY
        );

        // Verify the token and get user
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid or expired token'
            });
        }

        // Attach user to request object
        req.user = user;
        req.token = token;
        
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Authentication failed'
        });
    }
}

/**
 * Optional authentication - doesn't fail if no token provided
 * Useful for endpoints that work with or without authentication
 */
async function optionalAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);

            const supabase = createClient(
                process.env.SUPABASE_URL,
                process.env.SUPABASE_ANON_KEY
            );

            const { data: { user }, error } = await supabase.auth.getUser(token);

            if (!error && user) {
                req.user = user;
                req.token = token;
            }
        }
        
        next();
    } catch (error) {
        console.error('Optional auth middleware error:', error);
        next(); // Continue even if authentication fails
    }
}

module.exports = {
    requireAuth,
    optionalAuth
};
