/**
 * Processing routes
 * Handles document processing (chunking and embedding) for user-uploaded PDFs
 */

const express = require('express');
const router = express.Router();
const { processUserDocument } = require('../document-processor');

/**
 * Create processing router
 */
function createProcessingRouter(supabase, openaiClient) {
    /**
     * POST /api/process-document
     * Trigger processing for a user-uploaded document
     */
    router.post('/process-document', async (req, res) => {
        try {
            const { user_document_id } = req.body;

            if (!user_document_id) {
                return res.status(400).json({
                    success: false,
                    error: 'user_document_id is required'
                });
            }

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

            // Verify user owns this document
            const { data: userDoc, error: fetchError } = await supabase
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

            // Check if document is already being processed or ready
            if (userDoc.status === 'processing') {
                return res.status(409).json({
                    success: false,
                    error: 'Document is already being processed'
                });
            }

            if (userDoc.status === 'ready') {
                return res.status(409).json({
                    success: false,
                    error: 'Document has already been processed'
                });
            }

            // Check if OpenAI client is available
            if (!openaiClient) {
                return res.status(503).json({
                    success: false,
                    error: 'OpenAI service is not available. Please contact administrator.'
                });
            }

            console.log(`🔄 Starting processing for document ${user_document_id} (user: ${user.email})`);

            // Start processing asynchronously (don't wait for completion)
            processUserDocument(user_document_id, supabase, openaiClient)
                .then(result => {
                    console.log(`✅ Processing complete for ${user_document_id}:`, result);
                })
                .catch(error => {
                    console.error(`❌ Processing failed for ${user_document_id}:`, error);
                });

            // Return immediately with processing status
            return res.json({
                success: true,
                message: 'Document processing started',
                user_document_id,
                status: 'processing'
            });

        } catch (error) {
            console.error('Error in process-document endpoint:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error.message
            });
        }
    });

    /**
     * GET /api/processing-status/:user_document_id
     * Get processing status and logs for a document
     */
    router.get('/processing-status/:user_document_id', async (req, res) => {
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

            // Get document status
            const { data: userDoc, error: fetchError } = await supabase
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
            const { data: logs, error: logsError } = await supabase
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
    });

    /**
     * GET /api/user-documents
     * Get all documents for the authenticated user
     */
    router.get('/user-documents', async (req, res) => {
        try {
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

            // Get user's documents
            const { data: documents, error: fetchError } = await supabase
                .from('user_documents')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (fetchError) {
                throw fetchError;
            }

            return res.json({
                success: true,
                documents: documents || []
            });

        } catch (error) {
            console.error('Error in user-documents endpoint:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error.message
            });
        }
    });

    return router;
}

module.exports = {
    createProcessingRouter
};

