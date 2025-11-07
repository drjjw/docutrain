/**
 * Handlers for document query endpoints
 * Handles status checks, document listing, and download URL generation
 */

const { authenticateUser, createUserSupabaseClient } = require('../utils/processing-auth');

/**
 * Handle GET /api/processing-status/:user_document_id
 * Get processing status and logs for a document
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} supabase - Supabase client
 */
async function handleProcessingStatus(req, res, supabase) {
    try {
        const { user_document_id } = req.params;

        // Get authenticated user
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }

        const token = authHeader.split(' ')[1];
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid authentication token'
            });
        }

        // Create authenticated Supabase client for this user
        const userSupabase = createUserSupabaseClient(authHeader);

        // Get document status
        const { data: userDoc, error: fetchError } = await userSupabase
            .from('user_documents')
            .select('*')
            .eq('id', user_document_id)
            .eq('user_id', user.id)
            .single();

        if (fetchError || !userDoc) {
            return res.status(404).json({
                success: false,
                error: 'Document not found or access denied'
            });
        }

        // Get processing logs
        const { data: logs, error: logsError } = await userSupabase
            .from('document_processing_logs')
            .select('*')
            .eq('user_document_id', user_document_id)
            .order('created_at', { ascending: true });

        if (logsError) {
            console.error('Error fetching processing logs:', logsError);
        }

        return res.json({
            success: true,
            document: {
                id: userDoc.id,
                title: userDoc.title,
                status: userDoc.status,
                error_message: userDoc.error_message,
                created_at: userDoc.created_at,
                updated_at: userDoc.updated_at
            },
            logs: logs || []
        });

    } catch (error) {
        console.error('Error in processing-status endpoint:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
}

/**
 * Handle GET /api/user-documents
 * Get all documents for the authenticated user
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} supabase - Supabase client
 */
async function handleUserDocuments(req, res, supabase) {
    try {
        console.log('[user-documents] Request received');
        
        // Get authenticated user
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.log('[user-documents] No auth header');
            if (!res.headersSent) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication required'
                });
            }
            return;
        }

        const token = authHeader.split(' ')[1];
        console.log('[user-documents] Getting user from token');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            console.log('[user-documents] Auth error:', authError?.message);
            if (!res.headersSent) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid authentication token'
                });
            }
            return;
        }

        console.log('[user-documents] Creating authenticated Supabase client for user:', user.id);
        // Create authenticated Supabase client for this user
        const userSupabase = createUserSupabaseClient(authHeader);

        console.log('[user-documents] Querying user_documents table');
        // Get user's documents
        const { data: documents, error: fetchError } = await userSupabase
            .from('user_documents')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (fetchError) {
            console.error('[user-documents] ❌ Database error:', fetchError);
            console.error('[user-documents] ❌ Error code:', fetchError.code);
            console.error('[user-documents] ❌ Error message:', fetchError.message);
            console.error('[user-documents] ❌ Error details:', JSON.stringify(fetchError, null, 2));
            console.error('[user-documents] ❌ Error hint:', fetchError.hint);
            
            if (!res.headersSent) {
                return res.status(500).json({
                    success: false,
                    error: 'Database error',
                    message: fetchError.message || 'Failed to fetch documents',
                    code: fetchError.code || null,
                    details: fetchError.details || null,
                    hint: fetchError.hint || null
                });
            }
            return;
        }

        console.log('[user-documents] Success, returning', documents?.length || 0, 'documents');
        if (!res.headersSent) {
            return res.json({
                success: true,
                documents: documents || []
            });
        }

    } catch (error) {
        console.error('[user-documents] ❌ Error in user-documents endpoint:', error);
        console.error('[user-documents] ❌ Error details:', {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
            stack: error.stack
        });
        
        // Ensure we haven't already sent a response
        if (!res.headersSent) {
            return res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error.message || 'An unexpected error occurred',
                code: error.code || null,
                details: error.details || null,
                hint: error.hint || null
            });
        } else {
            console.error('[user-documents] Response already sent, cannot send error response');
        }
    }
}

/**
 * Handle GET /api/document-download-url/:documentId
 * Generate a signed URL for downloading the original training PDF
 * (NOT the supplementary downloads in the downloads field)
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} supabase - Supabase client (not used, uses service role internally)
 */
async function handleDocumentDownloadUrl(req, res, supabase) {
    try {
        const { documentId } = req.params;

        // Create a service role client to bypass RLS for document metadata lookup
        const { createClient } = require('@supabase/supabase-js');
        const serviceSupabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // Get the document to find its PDF location
        const { data: document, error: docError } = await serviceSupabase
            .from('documents')
            .select('pdf_filename, pdf_subdirectory')
            .eq('id', documentId)
            .single();

        if (docError || !document) {
            console.error('Document lookup error:', docError);
            return res.status(404).json({
                success: false,
                error: 'Document not found'
            });
        }

        if (!document.pdf_filename) {
            return res.status(404).json({
                success: false,
                error: 'No PDF file associated with this document'
            });
        }

        // For user-uploaded documents in the private user-documents bucket
        if (document.pdf_subdirectory === 'user-uploads') {
            // Find the file in user_documents table using service role
            const { data: userDoc, error: userDocError } = await serviceSupabase
                .from('user_documents')
                .select('file_path, user_id')
                .ilike('file_path', `%${document.pdf_filename}`)
                .single();

            if (userDocError || !userDoc) {
                console.error('User document not found:', userDocError);
                return res.status(404).json({
                    success: false,
                    error: 'PDF file not found in storage'
                });
            }

            // Generate signed URL (valid for 1 hour) using service role
            const { data: signedUrlData, error: signedUrlError } = await serviceSupabase.storage
                .from('user-documents')
                .createSignedUrl(userDoc.file_path, 3600);

            if (signedUrlError || !signedUrlData) {
                console.error('Failed to create signed URL:', signedUrlError);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to generate download URL'
                });
            }

            return res.json({
                success: true,
                url: signedUrlData.signedUrl,
                title: 'Download Original PDF'
            });
        }

        // For other documents, try the downloads bucket (public)
        if (document.pdf_subdirectory && document.pdf_filename) {
            const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/downloads/${document.pdf_subdirectory}/${document.pdf_filename}`;
            
            return res.json({
                success: true,
                url: publicUrl,
                title: 'Download Original PDF'
            });
        }

        // No download available
        return res.status(404).json({
            success: false,
            error: 'No PDF file available for download'
        });

    } catch (error) {
        console.error('Error generating download URL:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

module.exports = {
    handleProcessingStatus,
    handleUserDocuments,
    handleDocumentDownloadUrl
};

