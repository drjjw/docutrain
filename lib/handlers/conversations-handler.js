/**
 * Conversations Handler
 * Handles GET /api/conversations - Get conversations filtered by admin permissions
 * Super admins see all conversations, owner admins see only their owner group's conversations
 */

const { createClient } = require('@supabase/supabase-js');
const { createServiceRoleClient } = require('../utils/documents-auth');
const { debugLog } = require('../utils/debug');

/**
 * Handle GET /api/conversations
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {object} supabase - Supabase client
 */
async function handleGetConversations(req, res, supabase) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No authorization token provided' });
        }

        const token = authHeader.split(' ')[1];
        const limit = parseInt(req.query.limit || '100', 10);
        const maxLimit = Math.min(limit, 500); // Cap at 500 for performance

        // Create admin client with service role key for admin operations
        const adminSupabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // Verify user and check permissions
        const { data: { user }, error: userError } = await adminSupabase.auth.getUser(token);

        if (userError || !user) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        // Check user permissions
        const { data: permissions, error: permError } = await adminSupabase
            .from('user_permissions_summary')
            .select('*')
            .eq('user_id', user.id);

        if (permError) {
            debugLog('[Conversations] Error checking permissions:', permError);
            return res.status(500).json({ error: 'Failed to check permissions' });
        }

        const isSuperAdmin = permissions?.some(p => p.role === 'super_admin') || false;
        const isOwnerAdmin = permissions?.some(p => p.role === 'owner_admin') || false;

        if (!isSuperAdmin && !isOwnerAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        // Get owner IDs for owner admins
        const ownerIds = permissions
            ?.filter(p => p.role === 'owner_admin')
            .map(p => p.owner_id)
            .filter(id => id !== null) || [];

        // Create service role client for bypassing RLS
        const serviceSupabase = createServiceRoleClient(supabase);

        // Fetch conversations
        let conversationsQuery = serviceSupabase
            .from('chat_conversations')
            .select(`
                id,
                question,
                response,
                user_id,
                ip_address,
                created_at,
                model,
                session_id,
                document_ids,
                document_name,
                country,
                banned
            `)
            .eq('banned', false)
            .not('question', 'is', null)
            .order('created_at', { ascending: false })
            .limit(maxLimit);

        const { data: allConversations, error: convError } = await conversationsQuery;

        if (convError) {
            debugLog('[Conversations] Error fetching conversations:', convError);
            return res.status(500).json({ 
                error: 'Failed to fetch conversations',
                conversations: []
            });
        }

        // If super admin, return all conversations
        if (isSuperAdmin) {
            return res.json({
                conversations: allConversations || [],
                total: allConversations?.length || 0
            });
        }

        // For owner admins, filter conversations by documents belonging to their owner groups
        // First, get all document IDs for documents belonging to owner groups
        const { data: documents, error: docsError } = await serviceSupabase
            .from('documents')
            .select('id, owner_id')
            .in('owner_id', ownerIds);

        if (docsError) {
            debugLog('[Conversations] Error fetching documents:', docsError);
            return res.status(500).json({ 
                error: 'Failed to fetch documents',
                conversations: []
            });
        }

        const allowedDocumentIds = new Set((documents || []).map(doc => doc.id));

        // Filter conversations where document_ids array contains any allowed document ID
        const filteredConversations = (allConversations || []).filter(conv => {
            // New format: check document_ids array
            if (conv.document_ids && Array.isArray(conv.document_ids)) {
                return conv.document_ids.some(docId => allowedDocumentIds.has(docId));
            }
            // Legacy format: check document_name (would need to map slug to owner)
            // For now, skip legacy conversations for owner admins
            return false;
        });

        return res.json({
            conversations: filteredConversations,
            total: filteredConversations.length
        });

    } catch (error) {
        debugLog('[Conversations] Unexpected error:', error);
        return res.status(500).json({ 
            error: 'Internal server error',
            conversations: []
        });
    }
}

module.exports = {
    handleGetConversations
};

