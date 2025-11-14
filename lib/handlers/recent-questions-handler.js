/**
 * Recent Questions Handler
 * Handles GET /api/documents/:documentId/recent-questions
 * Handles DELETE /api/conversations/:conversationId
 */

const { createClient } = require('@supabase/supabase-js');
const { createServiceRoleClient } = require('../utils/documents-auth');

/**
 * Handle GET /api/documents/:documentId/recent-questions
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {object} supabase - Supabase client
 */
async function handleGetRecentQuestions(req, res, supabase) {
    try {
        const { documentId } = req.params;
        const limit = parseInt(req.query.limit || '12', 10);
        const maxLimit = Math.min(limit, 50); // Cap at 50 for performance

        if (!documentId) {
            return res.status(400).json({ 
                error: 'Document ID is required',
                questions: []
            });
        }

        // Create service role client for bypassing RLS
        const serviceSupabase = createServiceRoleClient(supabase);

        // Query recent questions directly filtered by document ID using JSONB containment
        // Use PostgreSQL's @> operator via PostgREST's cs (contains) filter
        // This is much more efficient than fetching all conversations and filtering client-side
        // Note: PostgREST cs operator checks if left JSONB contains right JSONB
        const jsonbFilter = JSON.stringify([documentId]); // Format as JSON array string
        const { data: matchingConversations, error: convError } = await serviceSupabase
            .from('chat_conversations')
            .select('id, question, response, created_at, document_ids, document_name, country')
            .eq('banned', false)
            .not('question', 'is', null)
            .filter('document_ids', 'cs', jsonbFilter) // cs = contains (JSONB array contains)
            .order('created_at', { ascending: false })
            .limit(maxLimit * 3); // Fetch more than needed for deduplication, then slice

        if (convError) {
            console.error('[RecentQuestions] Error fetching conversations:', convError);
            return res.status(500).json({ 
                error: 'Failed to fetch recent questions',
                questions: []
            });
        }

        // Deduplicate by normalized question text (keep most recent)
        // Since we're already sorted by created_at DESC, we keep the first occurrence of each unique question
        const seenQuestions = new Map();
        const uniqueMatchingQuestions = [];
        for (const conv of (matchingConversations || [])) {
            const normalizedQ = conv.question?.trim().toLowerCase() || '';
            if (normalizedQ && !seenQuestions.has(normalizedQ)) {
                seenQuestions.set(normalizedQ, true);
                uniqueMatchingQuestions.push(conv);
            }
        }
        
        // Slice to limit (already sorted by created_at DESC from query)
        const sortedMatchingQuestions = uniqueMatchingQuestions.slice(0, maxLimit);

        // Also check legacy document_name field for backwards compatibility
        // First get the document slug to check document_name
        const { data: docData } = await serviceSupabase
            .from('documents')
            .select('slug')
            .eq('id', documentId)
            .single();

        let legacyQuestions = [];
        if (docData?.slug) {
            const { data: legacyData } = await serviceSupabase
                .from('chat_conversations')
                .select('id, question, response, created_at, country')
                .eq('banned', false)
                .eq('document_name', docData.slug)
                .not('question', 'is', null)
                .is('document_ids', null) // Only get legacy records without document_ids
                .order('created_at', { ascending: false })
                .limit(maxLimit);

            if (legacyData) {
                legacyQuestions = legacyData;
            }
        }

        // Combine and deduplicate by ID (already deduplicated by question text above)
        const allQuestions = [...sortedMatchingQuestions, ...legacyQuestions];
        const uniqueQuestions = Array.from(
            new Map(allQuestions.map(q => [q.id, q])).values()
        )
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, maxLimit);

        // Log country data for debugging
        console.log('[RecentQuestions] Returning questions with country data:', 
            uniqueQuestions.map(q => ({ 
                id: q.id, 
                question: q.question?.substring(0, 30), 
                country: q.country 
            }))
        );

        return res.json({
            questions: uniqueQuestions,
            count: uniqueQuestions.length
        });

    } catch (error) {
        console.error('[RecentQuestions] Unexpected error:', error);
        return res.status(500).json({ 
            error: 'Internal server error',
            questions: []
        });
    }
}

/**
 * Handle DELETE /api/conversations/:conversationId - Delete a conversation (super admin only)
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {object} supabase - Supabase client
 */
async function handleDeleteConversation(req, res, supabase) {
    try {
        const { conversationId } = req.params;
        const authHeader = req.headers.authorization;

        if (!conversationId) {
            return res.status(400).json({ 
                error: 'Conversation ID is required'
            });
        }

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No authorization token provided' });
        }

        const token = authHeader.split(' ')[1];

        // Create admin client with service role key for admin operations
        const adminSupabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // Verify user and check super admin status
        const { data: { user }, error: userError } = await adminSupabase.auth.getUser(token);

        if (userError || !user) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        // Check if user has super admin role
        const { data: permissions, error: permError } = await adminSupabase
            .from('user_permissions_summary')
            .select('*')
            .eq('user_id', user.id);

        if (permError) {
            console.error('[DeleteConversation] Error checking permissions:', permError);
            return res.status(500).json({ error: 'Failed to check permissions' });
        }

        const isSuperAdmin = permissions?.some(p => p.role === 'super_admin') || false;

        if (!isSuperAdmin) {
            return res.status(403).json({ error: 'Super admin access required' });
        }

        // Create service role client for bypassing RLS
        const { createServiceRoleClient } = require('../utils/documents-auth');
        const serviceSupabase = createServiceRoleClient(supabase);

        // Delete the conversation
        const { error: deleteError } = await serviceSupabase
            .from('chat_conversations')
            .delete()
            .eq('id', conversationId);

        if (deleteError) {
            console.error('[DeleteConversation] Error deleting conversation:', deleteError);
            return res.status(500).json({ error: 'Failed to delete conversation' });
        }

        return res.json({ 
            success: true,
            message: 'Conversation deleted successfully'
        });

    } catch (error) {
        console.error('[DeleteConversation] Unexpected error:', error);
        return res.status(500).json({ 
            error: 'Internal server error'
        });
    }
}

module.exports = {
    handleGetRecentQuestions,
    handleDeleteConversation
};

