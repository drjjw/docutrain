/**
 * Document update route handler
 * Handles PUT /api/documents/:identifier - Update document fields (supports both slug and ID)
 */

const { authenticateUser, createServiceRoleClient } = require('../utils/documents-auth');
const { checkDocumentPermissions } = require('../utils/documents-access');

/**
 * Handle PUT /api/documents/:identifier
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {object} dependencies - Dependencies object containing supabase, documentRegistry
 */
async function handleUpdateDocument(req, res, dependencies) {
    const { supabase, documentRegistry } = dependencies;
    const { identifier } = req.params;
    const updates = req.body;

    try {
        // Get authenticated user
        const { userId } = await authenticateUser(req, supabase);

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Get document info first (using service role to bypass RLS)
        const serviceSupabase = createServiceRoleClient(supabase);

        // Check permissions and get document
        const { isSuperAdmin, isOwnerAdmin, doc } = await checkDocumentPermissions(
            userId,
            identifier,
            serviceSupabase
        );

        if (!doc) {
            return res.status(404).json({ error: 'Document not found' });
        }

        if (!isSuperAdmin && !isOwnerAdmin) {
            console.log(`❌ Permission denied for user ${userId} on document ${identifier}`);
            return res.status(403).json({ error: 'Permission denied' });
        }

        // Check if user is trying to change owner_id
        // Only super admins can change ownership
        if ('owner_id' in updates && updates.owner_id !== doc.owner_id) {
            if (!isSuperAdmin) {
                console.log(`❌ Permission denied: Only super admins can change document ownership`);
                return res.status(403).json({ error: 'Only super admins can change document ownership' });
            }
        }

        // Validate updates
        const allowedFields = [
            'title', 'subtitle', 'welcome_message', 'intro_message',
            'back_link', 'category', 'year', 'cover', 'downloads',
            'chunk_limit_override', 'show_document_selector', 'show_keywords', 'show_downloads', 'show_references', 'active',
            'access_level', 'passcode', 'slug', 'owner_id', 'show_disclaimer', 'disclaimer_text'
        ];

        const filteredUpdates = {};
        Object.keys(updates).forEach(key => {
            if (allowedFields.includes(key)) {
                filteredUpdates[key] = updates[key];
            }
        });

        // Convert empty strings to null for UUID fields (owner_id)
        if ('owner_id' in filteredUpdates && filteredUpdates.owner_id === '') {
            filteredUpdates.owner_id = null;
        }

        // Sync owner string field when owner_id changes
        if ('owner_id' in filteredUpdates && filteredUpdates.owner_id !== doc.owner_id) {
            if (filteredUpdates.owner_id) {
                // Fetch owner slug from owners table
                const { data: ownerData, error: ownerError } = await serviceSupabase
                    .from('owners')
                    .select('slug')
                    .eq('id', filteredUpdates.owner_id)
                    .single();
                
                if (!ownerError && ownerData) {
                    filteredUpdates.owner = ownerData.slug;
                } else {
                    console.warn(`⚠️  Could not find owner slug for owner_id: ${filteredUpdates.owner_id}`);
                }
            } else {
                // owner_id is null, set owner to null as well
                filteredUpdates.owner = null;
            }
        }

        if (Object.keys(filteredUpdates).length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        // Add updated_at timestamp
        filteredUpdates.updated_at = new Date().toISOString();

        // Update document using service role client to bypass RLS (use ID to ensure we update the correct document)
        const { data: updatedDoc, error: updateError } = await serviceSupabase
            .from('documents')
            .update(filteredUpdates)
            .eq('id', doc.id)
            .select()
            .single();

        if (updateError) {
            console.error('Document update error:', updateError);
            return res.status(500).json({ error: 'Failed to update document' });
        }

        // Refresh document registry cache
        await documentRegistry.refreshRegistry();

        console.log(`✅ Document ${doc.id} (${doc.slug}) updated by user ${userId}`);

        res.json(updatedDoc);

    } catch (error) {
        console.error('Update document error:', error);
        res.status(500).json({ error: 'Server error' });
    }
}

module.exports = {
    handleUpdateDocument
};

