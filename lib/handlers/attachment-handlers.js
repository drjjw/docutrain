/**
 * Attachment route handlers
 * Handles CRUD operations and download tracking for document attachments
 */

const { authenticateUser } = require('../utils/documents-auth');
const { getIpAddress } = require('../utils');

/**
 * Handle GET /api/attachments/:documentId - List attachments for a document
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {object} supabase - Supabase client
 */
async function handleGetAttachments(req, res, supabase) {
    try {
        const { documentId } = req.params;

        // Get authenticated user (optional for this endpoint)
        const { userId } = await authenticateUser(req, supabase);

        // Verify document exists and user has access
        const { data: doc, error: docError } = await supabase
            .from('documents')
            .select('id, slug, access_level, owner_id')
            .eq('id', documentId)
            .single();

        if (docError || !doc) {
            return res.status(404).json({ error: 'Document not found' });
        }

        // Check access (similar to document access check)
        // For now, we'll rely on RLS policies - attachments inherit document access
        const { data: attachments, error } = await supabase
            .from('document_attachments')
            .select('*')
            .eq('document_id', documentId)
            .order('display_order', { ascending: true });

        if (error) {
            console.error('❌ Error fetching attachments:', error);
            console.error('❌ Error code:', error.code);
            console.error('❌ Error message:', error.message);
            console.error('❌ Error details:', JSON.stringify(error, null, 2));
            console.error('❌ Error hint:', error.hint);
            return res.status(500).json({ 
                error: 'Failed to fetch attachments', 
                details: error.message,
                code: error.code,
                hint: error.hint
            });
        }

        res.json({ attachments: attachments || [] });
    } catch (error) {
        console.error('Error in attachments API:', error);
        console.error('Error stack:', error.stack);
        // Ensure we send a proper JSON response even on error
        if (!res.headersSent) {
            res.status(500).json({ 
                error: 'Server error', 
                details: error.message || 'Unknown error',
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    }
}

/**
 * Handle POST /api/attachments/:documentId - Create attachment
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {object} supabase - Supabase client
 * @param {object} documentRegistry - Document registry instance
 */
async function handleCreateAttachment(req, res, supabase, documentRegistry) {
    try {
        const { documentId } = req.params;
        const { title, url, storage_path, file_size, mime_type, display_order, copyright_acknowledged_at } = req.body;

        // Get authenticated user
        const { userId } = await authenticateUser(req, supabase);

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Verify document exists
        const { data: doc, error: docError } = await supabase
            .from('documents')
            .select('id')
            .eq('id', documentId)
            .single();

        if (docError || !doc) {
            return res.status(404).json({ error: 'Document not found' });
        }

        // Validate required fields
        if (!title || !url) {
            return res.status(400).json({ error: 'Title and URL are required' });
        }

        // Get max display_order for this document if not provided
        let order = display_order;
        if (order === undefined || order === null) {
            const { data: existingAttachments } = await supabase
                .from('document_attachments')
                .select('display_order')
                .eq('document_id', documentId)
                .order('display_order', { ascending: false })
                .limit(1);

            order = existingAttachments && existingAttachments.length > 0
                ? existingAttachments[0].display_order + 1
                : 0;
        }

        // Create attachment
        const insertData = {
            document_id: documentId,
            title: title.trim(),
            url: url.trim(),
            storage_path: storage_path || null,
            file_size: file_size || null,
            mime_type: mime_type || null,
            display_order: order,
            created_by_user_id: userId,
            copyright_acknowledged_at: copyright_acknowledged_at || null
        };
        
        console.log('Creating attachment with data:', JSON.stringify(insertData, null, 2));
        
        const { data: attachment, error: insertError } = await supabase
            .from('document_attachments')
            .insert(insertData)
            .select()
            .single();

        if (insertError) {
            console.error('❌ Error creating attachment:', insertError);
            console.error('❌ Error code:', insertError.code);
            console.error('❌ Error message:', insertError.message);
            console.error('❌ Error details:', JSON.stringify(insertError, null, 2));
            console.error('❌ Error hint:', insertError.hint);
            return res.status(500).json({ 
                error: 'Failed to create attachment', 
                details: insertError.message,
                code: insertError.code,
                hint: insertError.hint
            });
        }

        // Refresh document registry cache
        await documentRegistry.refreshRegistry();

        res.status(201).json({ attachment });
    } catch (error) {
        console.error('Error in create attachment API:', error);
        console.error('Error stack:', error.stack);
        // Ensure we send a proper JSON response even on error
        if (!res.headersSent) {
            res.status(500).json({ 
                error: 'Server error', 
                details: error.message || 'Unknown error',
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    }
}

/**
 * Handle PUT /api/attachments/:attachmentId - Update attachment
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {object} supabase - Supabase client
 * @param {object} documentRegistry - Document registry instance
 */
async function handleUpdateAttachment(req, res, supabase, documentRegistry) {
    try {
        const { attachmentId } = req.params;
        const updates = req.body;

        // Get authenticated user
        const { userId } = await authenticateUser(req, supabase);

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Filter allowed fields
        const allowedFields = ['title', 'url', 'storage_path', 'file_size', 'mime_type', 'display_order'];
        const filteredUpdates = {};
        allowedFields.forEach(field => {
            if (updates[field] !== undefined) {
                filteredUpdates[field] = updates[field];
            }
        });

        // Trim string fields
        if (filteredUpdates.title) filteredUpdates.title = filteredUpdates.title.trim();
        if (filteredUpdates.url) filteredUpdates.url = filteredUpdates.url.trim();

        filteredUpdates.updated_at = new Date().toISOString();

        // Update attachment
        const { data: attachment, error: updateError } = await supabase
            .from('document_attachments')
            .update(filteredUpdates)
            .eq('id', attachmentId)
            .select()
            .single();

        if (updateError) {
            console.error('Error updating attachment:', updateError);
            return res.status(500).json({ error: 'Failed to update attachment' });
        }

        // Refresh document registry cache
        await documentRegistry.refreshRegistry();

        res.json({ attachment });
    } catch (error) {
        console.error('Error in update attachment API:', error);
        res.status(500).json({ error: 'Server error' });
    }
}

/**
 * Handle DELETE /api/attachments/:attachmentId - Delete attachment
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {object} supabase - Supabase client
 * @param {object} documentRegistry - Document registry instance
 */
async function handleDeleteAttachment(req, res, supabase, documentRegistry) {
    try {
        const { attachmentId } = req.params;

        // Get authenticated user
        const { userId } = await authenticateUser(req, supabase);

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Get attachment to check if it exists and get storage path
        const { data: attachment, error: fetchError } = await supabase
            .from('document_attachments')
            .select('id, storage_path')
            .eq('id', attachmentId)
            .single();

        if (fetchError || !attachment) {
            return res.status(404).json({ error: 'Attachment not found' });
        }

        // Delete from database (CASCADE will handle download tracking records)
        const { error: deleteError } = await supabase
            .from('document_attachments')
            .delete()
            .eq('id', attachmentId);

        if (deleteError) {
            console.error('Error deleting attachment:', deleteError);
            return res.status(500).json({ error: 'Failed to delete attachment' });
        }

        // Optionally delete from storage if storage_path exists
        if (attachment.storage_path) {
            try {
                const DOWNLOADS_BUCKET = 'downloads';
                const { error: storageError } = await supabase.storage
                    .from(DOWNLOADS_BUCKET)
                    .remove([attachment.storage_path]);

                if (storageError) {
                    console.error('Error deleting file from storage:', storageError);
                    // Don't fail the request if storage deletion fails
                }
            } catch (storageError) {
                console.error('Storage deletion error:', storageError);
            }
        }

        // Refresh document registry cache
        await documentRegistry.refreshRegistry();

        res.json({ success: true, message: 'Attachment deleted' });
    } catch (error) {
        console.error('Error in delete attachment API:', error);
        res.status(500).json({ error: 'Server error' });
    }
}

/**
 * Handle POST /api/attachments/:attachmentId/track-download - Track download event
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {object} supabase - Supabase client
 */
async function handleTrackDownload(req, res, supabase) {
    try {
        const { attachmentId } = req.params;

        // Get authenticated user (optional - can be null for anonymous)
        let userId = null;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            try {
                const { data: { user }, error } = await supabase.auth.getUser(token);
                if (!error && user) {
                    userId = user.id;
                }
            } catch (error) {
                // Silent fail - anonymous download
            }
        }

        // Get IP address from request
        const ipAddress = getIpAddress(req);

        // Verify attachment exists
        const { data: attachment, error: attachmentError } = await supabase
            .from('document_attachments')
            .select('id')
            .eq('id', attachmentId)
            .single();

        if (attachmentError || !attachment) {
            return res.status(404).json({ error: 'Attachment not found' });
        }

        // Insert download tracking record
        const { error: insertError } = await supabase
            .from('document_attachment_downloads')
            .insert({
                attachment_id: attachmentId,
                user_id: userId,
                ip_address: ipAddress
            });

        if (insertError) {
            console.error('Error tracking download:', insertError);
            // Don't fail the request if tracking fails
            return res.status(200).json({ success: true, tracked: false });
        }

        res.json({ success: true, tracked: true });
    } catch (error) {
        console.error('Error in track download API:', error);
        // Don't fail the request if tracking fails
        res.status(200).json({ success: true, tracked: false });
    }
}

module.exports = {
    handleGetAttachments,
    handleCreateAttachment,
    handleUpdateAttachment,
    handleDeleteAttachment,
    handleTrackDownload
};

