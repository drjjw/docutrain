/**
 * Recent Questions Handler
 * Handles GET /api/documents/:documentId/recent-questions
 */

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

        // Query recent questions from chat_conversations
        // Filter by document_ids JSONB array containing the document ID
        // Exclude banned conversations
        // Note: PostgREST doesn't support direct JSONB array containment queries easily,
        // so we'll fetch and filter client-side for now (similar to analytics handler)
        const { data: allConversations, error: convError } = await serviceSupabase
            .from('chat_conversations')
            .select('id, question, created_at, document_ids, document_name')
            .eq('banned', false)
            .not('question', 'is', null)
            .order('created_at', { ascending: false })
            .limit(500); // Fetch more than needed, then filter

        if (convError) {
            console.error('[RecentQuestions] Error fetching conversations:', convError);
            return res.status(500).json({ 
                error: 'Failed to fetch recent questions',
                questions: []
            });
        }

        // Filter conversations where document_ids array contains our documentId
        const matchingQuestions = (allConversations || []).filter(conv => {
            // New format: check document_ids array
            if (conv.document_ids && Array.isArray(conv.document_ids)) {
                return conv.document_ids.includes(documentId);
            }
            // Legacy format: check document_name (will be handled in legacy query below)
            return false;
        }).slice(0, maxLimit);

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
                .select('id, question, created_at')
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

        // Combine and deduplicate by ID
        const allQuestions = [...matchingQuestions, ...legacyQuestions];
        const uniqueQuestions = Array.from(
            new Map(allQuestions.map(q => [q.id, q])).values()
        )
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, maxLimit);

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

module.exports = {
    handleGetRecentQuestions
};

