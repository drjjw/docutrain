/**
 * Middleware to check if user has access to a document
 * Works for both authenticated and unauthenticated users
 */
async function checkDocumentAccess(supabase) {
    return async (req, res, next) => {
        const documentSlug = req.query.doc || req.params.slug || req.body.documentType;
        
        if (!documentSlug) {
            // No document specified - allow through (general endpoint)
            return next();
        }

        // Try to get authenticated user (optional)
        let userId = null;
        const authHeader = req.headers.authorization;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            try {
                const { data: { user } } = await supabase.auth.getUser(token);
                userId = user?.id || null;
            } catch (error) {
                // Ignore - treat as unauthenticated
            }
        }

        try {
            // Check access using database function
            const { data: hasAccess, error } = await supabase
                .rpc('user_has_document_access_by_slug', {
                    p_user_id: userId,
                    p_document_slug: documentSlug,
                });

            if (error) {
                console.error('Document access check error:', error);
                return res.status(500).json({ 
                    error: 'Failed to verify document access' 
                });
            }

            if (!hasAccess) {
                return res.status(403).json({ 
                    error: 'Access denied',
                    message: userId 
                        ? 'You do not have permission to access this document'
                        : 'This document requires authentication. Please log in.',
                    requires_auth: true,
                });
            }

            // User has access - proceed
            req.documentSlug = documentSlug;
            req.userId = userId;
            next();
        } catch (error) {
            console.error('Document access middleware error:', error);
            res.status(500).json({ error: 'Server error' });
        }
    };
}

module.exports = { checkDocumentAccess };

