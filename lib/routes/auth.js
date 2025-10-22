const express = require('express');

/**
 * Create auth router with Supabase integration
 */
function createAuthRouter(supabase) {
    const router = express.Router();

    /**
     * Middleware to extract and verify Supabase user from JWT
     */
    async function extractSupabaseUser(req, res, next) {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No authorization token provided' });
        }

        const token = authHeader.split(' ')[1];

        try {
            const { data: { user }, error } = await supabase.auth.getUser(token);
            
            if (error || !user) {
                return res.status(401).json({ error: 'Invalid or expired token' });
            }

            req.user = user;
            next();
        } catch (error) {
            console.error('Auth middleware error:', error);
            res.status(500).json({ error: 'Authentication failed' });
        }
    }

    /**
     * POST /api/auth/verify
     * Verify JWT token and return user info
     */
    router.post('/verify', async (req, res) => {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ error: 'Token is required' });
        }

        try {
            const { data: { user }, error } = await supabase.auth.getUser(token);
            
            if (error || !user) {
                return res.status(401).json({ error: 'Invalid or expired token' });
            }

            res.json({ user });
        } catch (error) {
            console.error('Token verification error:', error);
            res.status(500).json({ error: 'Verification failed' });
        }
    });

    /**
     * GET /api/auth/user
     * Get current authenticated user
     * Requires Authorization header with Bearer token
     */
    router.get('/user', extractSupabaseUser, (req, res) => {
        res.json({ user: req.user });
    });

    return router;
}

module.exports = { createAuthRouter };

