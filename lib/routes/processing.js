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
        console.log('🔵 POST /api/process-document - Request received');
        console.log('   URL:', req.url);
        console.log('   Method:', req.method);
        console.log('   Headers:', req.headers);
        console.log('   Body:', req.body);
        console.log('✅ About to process request...');
        
        try {
            console.log('✅ Inside try block');
            const { user_document_id } = req.body;
            console.log('✅ Extracted user_document_id:', user_document_id);

            if (!user_document_id) {
                console.log('❌ Missing user_document_id - Sending 400');
                const response = {
                    success: false,
                    error: 'user_document_id is required'
                };
                console.log('   Response:', response);
                return res.status(400).json(response);
            }

            console.log('✅ user_document_id check passed');
            
            // Get authenticated user
            console.log('✅ Checking auth header...');
            const authHeader = req.headers.authorization;
            console.log('✅ Auth header:', authHeader ? 'Present' : 'Missing');
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                console.log('❌ Auth header missing or invalid - Sending 401');
                return res.status(401).json({
                    success: false,
                    error: 'Authentication required'
                });
            }

            console.log('✅ Extracting token...');
            const token = authHeader.split(' ')[1];
            console.log('✅ Token extracted, calling Supabase auth...');
            const { data: { user }, error: authError } = await supabase.auth.getUser(token);
            console.log('✅ Supabase auth response received. User:', user ? user.email : 'null', 'Error:', authError ? authError.message : 'none');

            if (authError || !user) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid authentication token'
                });
            }

            // Create authenticated Supabase client for this user
            console.log('✅ Creating authenticated Supabase client...');
            const { createClient } = require('@supabase/supabase-js');
            const userSupabase = createClient(
                process.env.SUPABASE_URL,
                process.env.SUPABASE_ANON_KEY,
                {
                    global: {
                        headers: {
                            Authorization: authHeader
                        }
                    }
                }
            );

            // Verify user owns this document
            console.log('✅ Checking if user owns document...');
            console.log('   Looking for document_id:', user_document_id);
            console.log('   For user_id:', user.id);
            
            const { data: userDoc, error: fetchError } = await userSupabase
                .from('user_documents')
                .select('*')
                .eq('id', user_document_id)
                .eq('user_id', user.id)
                .single();

            console.log('✅ Document lookup complete');
            console.log('   Found document:', userDoc ? 'YES' : 'NO');
            console.log('   Error:', fetchError ? fetchError.message : 'none');
            
            if (fetchError || !userDoc) {
                console.log('❌ Document not found or access denied - Sending 404');
                console.log('   This is the 404 the browser is seeing!');
                return res.status(404).json({
                    success: false,
                    error: 'Document not found or access denied'
                });
            }
            
            console.log('✅ Document ownership verified!');

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
            // Use the authenticated Supabase client so RLS policies allow access
            processUserDocument(user_document_id, userSupabase, openaiClient)
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

            // Create authenticated Supabase client for this user
            const { createClient } = require('@supabase/supabase-js');
            const userSupabase = createClient(
                process.env.SUPABASE_URL,
                process.env.SUPABASE_ANON_KEY,
                {
                    global: {
                        headers: {
                            Authorization: authHeader
                        }
                    }
                }
            );

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

            // Create authenticated Supabase client for this user
            const { createClient } = require('@supabase/supabase-js');
            const userSupabase = createClient(
                process.env.SUPABASE_URL,
                process.env.SUPABASE_ANON_KEY,
                {
                    global: {
                        headers: {
                            Authorization: authHeader
                        }
                    }
                }
            );

            // Get user's documents
            const { data: documents, error: fetchError } = await userSupabase
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

    /**
     * GET /api/document-download-url/:documentId
     * Generate a signed URL for downloading the original training PDF
     * (NOT the supplementary downloads in the downloads field)
     */
    router.get('/document-download-url/:documentId', async (req, res) => {
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
    });

    return router;
}

module.exports = {
    createProcessingRouter
};

