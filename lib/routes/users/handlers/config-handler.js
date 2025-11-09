const { extractFrontendConfig } = require('../utils');

/**
 * Create config route handlers
 * @param {Object} adminSupabase - Supabase admin client
 * @param {Object} middleware - Middleware functions
 * @returns {Object} Route handler functions
 */
function createConfigHandlers(adminSupabase, middleware) {
    const { requireSuperAdmin } = middleware;

    /**
     * GET /api/users/config - Get system configuration values
     */
    async function getConfig(req, res) {
        try {
            // Extract frontend config from bundle
            const frontendConfig = extractFrontendConfig();
            
            const config = {
                // Conversation limits
                MAX_CONVERSATION_LENGTH: parseInt(process.env.MAX_CONVERSATION_LENGTH || '3', 10),
                
                // Rate limiting (from chat.js RateLimiter class)
                RATE_LIMIT_PER_MINUTE: 10,
                RATE_LIMIT_PER_TEN_SECONDS: 3,
                
                // RAG Configuration
                RAG_SIMILARITY_THRESHOLD: parseFloat(process.env.RAG_SIMILARITY_THRESHOLD || '0.3'),
                USE_EDGE_FUNCTIONS: process.env.USE_EDGE_FUNCTIONS === 'true',
                
                // Server Configuration
                PORT: parseInt(process.env.PORT || '3458', 10),
                NODE_ENV: process.env.NODE_ENV || 'development',
                
                // Supabase Configuration (masked for security)
                SUPABASE_URL: process.env.SUPABASE_URL ? '✓ Configured' : '✗ Missing',
                SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? '✓ Configured' : '✗ Missing',
                SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ Configured' : '✗ Missing',
                
                // API Keys (masked for security)
                GEMINI_API_KEY: process.env.GEMINI_API_KEY ? '✓ Configured' : '✗ Missing',
                XAI_API_KEY: process.env.XAI_API_KEY ? '✓ Configured' : '✗ Missing',
                OPENAI_API_KEY: process.env.OPENAI_API_KEY ? '✓ Configured' : '✗ Missing',
                
                // Email Configuration
                RESEND_API_KEY: process.env.RESEND_API_KEY ? '✓ Configured' : '✗ Missing',
                CONTACT_EMAIL: process.env.CONTACT_EMAIL || 'Not set',
                RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL || 'Not set',
                
                // Debug Configuration
                DEBUG: process.env.DEBUG === 'true',
                
                // Frontend Configuration (extracted from bundle)
                VITE_MAX_CONVERSATION_LENGTH: frontendConfig.value !== null 
                    ? frontendConfig.value 
                    : (frontendConfig.error || 'Unable to extract from bundle'),
                
                // Metadata
                timestamp: new Date().toISOString(),
                serverTime: new Date().toLocaleString(),
            };
            
            res.json({
                success: true,
                config,
                note: 'Sensitive values are masked for security. Actual values are loaded from environment variables.',
                frontendBundleInfo: {
                    bundlePath: frontendConfig.bundlePath,
                    extractionError: frontendConfig.error || null
                }
            });
        } catch (error) {
            console.error('Error fetching configuration:', error);
            res.status(500).json({ 
                success: false,
                error: 'Failed to fetch configuration',
                details: error.message 
            });
        }
    }

    return {
        getConfig
    };
}

module.exports = { createConfigHandlers };

