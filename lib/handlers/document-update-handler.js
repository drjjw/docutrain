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

    console.log(`🔍 [document-update] Received PUT request:`);
    console.log(`   Path: ${req.path}`);
    console.log(`   Method: ${req.method}`);
    console.log(`   Identifier: ${identifier}`);
    console.log(`   Updates:`, updates);

    try {
        // Get authenticated user
        const { userId } = await authenticateUser(req, supabase);

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Get document info first (using service role to bypass RLS)
        const serviceSupabase = createServiceRoleClient(supabase);
        
        // Verify service role client is being used
        const isServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
        console.log(`🔍 [document-update] Using service role client: ${isServiceRole ? 'YES' : 'NO (fallback to regular client)'}`);

        // Check permissions and get document
        console.log(`🔍 [document-update] Looking up document with identifier: ${identifier}`);
        const { isSuperAdmin, isOwnerAdmin, doc } = await checkDocumentPermissions(
            userId,
            identifier,
            serviceSupabase
        );

        if (!doc) {
            console.error(`❌ [document-update] Document not found for identifier: ${identifier}`);
            return res.status(404).json({ error: 'Document not found' });
        }
        
        console.log(`✅ [document-update] Found document: ${doc.id} (slug: ${doc.slug})`);

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
            'back_link', 'category_id', 'year', 'cover', 'downloads',
            'chunk_limit_override', 'show_document_selector', 'show_keywords', 'show_downloads', 'show_references', 'show_recent_questions', 'show_country_flags', 'show_quizzes', 'active',
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

        // Note: updated_at is automatically set by the update_documents_updated_at trigger
        // No need to set it manually

        // Update document using service role client to bypass RLS (use ID to ensure we update the correct document)
        console.log(`🔍 [document-update] Updating document ${doc.id} with fields:`, Object.keys(filteredUpdates));
        console.log(`🔍 [document-update] Update payload:`, JSON.stringify(filteredUpdates, null, 2));
        console.log(`🔍 [document-update] Current document slug: ${doc.slug}`);
        if ('slug' in filteredUpdates) {
            console.log(`🔍 [document-update] Changing slug from "${doc.slug}" to "${filteredUpdates.slug}"`);
        }
        
        const { data: updatedDoc, error: updateError } = await serviceSupabase
            .from('documents')
            .update(filteredUpdates)
            .eq('id', doc.id)
            .select()
            .single();

        if (updateError) {
            console.error('❌ [document-update] Document update error:', updateError);
            console.error('❌ [document-update] Error code:', updateError.code);
            console.error('❌ [document-update] Error message:', updateError.message);
            console.error('❌ [document-update] Error details:', updateError.details);
            console.error('❌ [document-update] Error hint:', updateError.hint);
            console.error('❌ [document-update] Full error object:', JSON.stringify(updateError, null, 2));
            console.error('❌ [document-update] Attempted updates:', JSON.stringify(filteredUpdates, null, 2));
            console.error('❌ [document-update] Document ID:', doc.id);
            console.error('❌ [document-update] Current slug:', doc.slug);
            
            // Return more detailed error information
            return res.status(500).json({ 
                error: 'Failed to update document',
                details: updateError.message || updateError.toString(),
                code: updateError.code,
                hint: updateError.hint,
                // Include the attempted slug change if that's what failed
                ...(filteredUpdates.slug ? { attemptedSlug: filteredUpdates.slug, currentSlug: doc.slug } : {})
            });
        }

        // Refresh document registry cache
        await documentRegistry.refreshRegistry();

        console.log(`✅ Document ${doc.id} (${doc.slug}) updated by user ${userId}`);

        res.json(updatedDoc);

    } catch (error) {
        console.error('❌ [document-update] Unexpected error:', error);
        console.error('❌ [document-update] Error stack:', error.stack);
        console.error('❌ [document-update] Error name:', error.name);
        console.error('❌ [document-update] Error message:', error.message);
        res.status(500).json({ 
            error: 'Server error',
            details: error.message || error.toString()
        });
    }
}

module.exports = {
    handleUpdateDocument
};

