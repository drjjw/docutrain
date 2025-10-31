/**
 * Processing routes
 * Handles document processing (chunking and embedding) for user-uploaded PDFs
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { processUserDocument, reprocessDocument } = require('../document-processor');

// Configure multer for file uploads (store in memory)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed'));
        }
    }
});

/**
 * Configuration: Enable/disable Edge Functions for processing
 * Set USE_EDGE_FUNCTIONS=true in .env to enable, false or unset to use VPS processing
 */
const USE_EDGE_FUNCTIONS = process.env.USE_EDGE_FUNCTIONS === 'true';
const EDGE_FUNCTION_URL = process.env.SUPABASE_EDGE_FUNCTIONS_URL || 
    `${process.env.SUPABASE_URL}/functions/v1/process-document`;
const EDGE_FUNCTION_TIMEOUT_MS = 380000; // 380s (20s buffer before 400s Edge Function limit)

// Edge Functions have CPU/resource limits - use VPS for large documents
// Threshold: 5MB (5 * 1024 * 1024 bytes) - documents larger than this use VPS
const EDGE_FUNCTION_MAX_FILE_SIZE = parseInt(process.env.EDGE_FUNCTION_MAX_FILE_SIZE) || (5 * 1024 * 1024);

/**
 * Helper function to call Edge Function for document processing
 */
async function callEdgeFunction(user_document_id, authToken) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), EDGE_FUNCTION_TIMEOUT_MS);

    try {
        const response = await fetch(EDGE_FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
                'apikey': process.env.SUPABASE_ANON_KEY
            },
            body: JSON.stringify({ user_document_id }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Edge Function returned ${response.status}: ${errorText}`);
        }

        return await response.json();
    } catch (error) {
        clearTimeout(timeoutId);
        
        // Handle timeout/abort errors
        if (error.name === 'AbortError') {
            throw new Error('Edge Function timeout - exceeded 380s limit');
        }
        
        // Handle network errors
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            throw new Error(`Edge Function unavailable: ${error.message}`);
        }
        
        // Re-throw other errors
        throw error;
    }
}

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

            // Try Edge Function first if enabled, otherwise use VPS processing
            let processingMethod = 'vps';
            let edgeFunctionAttempted = false;
            let processingDestination = 'VPS'; // For logging

            // Check file size - Edge Functions have CPU/resource limits
            // Large documents should use VPS to avoid WORKER_LIMIT errors
            const fileSize = userDoc.file_size || 0;
            const useEdgeFunction = USE_EDGE_FUNCTIONS && fileSize <= EDGE_FUNCTION_MAX_FILE_SIZE;

            if (useEdgeFunction) {
                edgeFunctionAttempted = true;
                processingMethod = 'edge_function';
                processingDestination = 'Edge Function';
                console.log(`📡 Processing destination: EDGE FUNCTION`);
                console.log(`   Document: ${user_document_id}`);
                console.log(`   File size: ${(fileSize / 1024 / 1024).toFixed(2)}MB`);
                console.log(`   Reason: Edge Functions enabled and file size within limit (≤${(EDGE_FUNCTION_MAX_FILE_SIZE / 1024 / 1024).toFixed(2)}MB)`);
            } else if (USE_EDGE_FUNCTIONS && fileSize > EDGE_FUNCTION_MAX_FILE_SIZE) {
                processingDestination = 'VPS (file too large for Edge Function)';
                console.log(`🖥️  Processing destination: VPS`);
                console.log(`   Document: ${user_document_id}`);
                console.log(`   File size: ${(fileSize / 1024 / 1024).toFixed(2)}MB`);
                console.log(`   Reason: Document exceeds Edge Function size limit (${(fileSize / 1024 / 1024).toFixed(2)}MB > ${(EDGE_FUNCTION_MAX_FILE_SIZE / 1024 / 1024).toFixed(2)}MB)`);
            } else if (!USE_EDGE_FUNCTIONS) {
                processingDestination = 'VPS (Edge Functions disabled)';
                console.log(`🖥️  Processing destination: VPS`);
                console.log(`   Document: ${user_document_id}`);
                console.log(`   File size: ${(fileSize / 1024 / 1024).toFixed(2)}MB`);
                console.log(`   Reason: Edge Functions disabled in configuration (USE_EDGE_FUNCTIONS=false or unset)`);
            } else {
                processingDestination = 'VPS';
                console.log(`🖥️  Processing destination: VPS`);
                console.log(`   Document: ${user_document_id}`);
                console.log(`   File size: ${(fileSize / 1024 / 1024).toFixed(2)}MB`);
            }

            if (useEdgeFunction) {
                
                // Update status to processing asynchronously (don't wait for it)
                // This allows the API to return immediately
                userSupabase
                    .from('user_documents')
                    .update({ 
                        status: 'processing',
                        processing_method: 'edge_function',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', user_document_id)
                    .then(() => {
                        console.log(`✅ Status updated to processing for ${user_document_id}`);
                    })
                    .catch(err => {
                        console.error(`⚠️ Failed to update status to processing:`, err);
                    });

                // Start Edge Function processing asynchronously (fire-and-forget)
                // This allows the API to return immediately, similar to VPS processing
                console.log(`📡 Using Edge Function processing (pdf-parse library)`);
                callEdgeFunction(user_document_id, token)
                    .then(edgeResult => {
                        if (edgeResult.success) {
                            console.log(`✅ Edge Function processing completed for ${user_document_id}`);
                            // Edge Function already updates status to 'ready' when done
                        } else {
                            console.warn(`⚠️ Edge Function returned failure for ${user_document_id}, falling back to VPS`);
                            // Fallback to VPS processing
                            processUserDocument(user_document_id, userSupabase, openaiClient)
                                .then(result => {
                                    console.log(`✅ VPS Processing complete (fallback) for ${user_document_id}:`, result);
                                })
                                .catch(error => {
                                    console.error(`❌ VPS Processing failed (fallback) for ${user_document_id}:`, error);
                                });
                        }
                    })
                    .catch(error => {
                        // Edge Function error (timeout, network error, etc.)
                        // Log detailed error to console (not shown to users)
                        console.error(`❌ Edge Function error for ${user_document_id}, falling back to VPS:`, error.message);
                        console.error(`   Full error details:`, error);
                        
                        // Update document status to indicate fallback (no error_message - automatic fallback is normal)
                        userSupabase
                            .from('user_documents')
                            .update({
                                processing_method: 'vps',
                                error_message: null  // Clear any previous error messages - fallback is automatic
                            })
                            .eq('id', user_document_id)
                            .then(() => {
                                // Fallback to VPS processing
                                processUserDocument(user_document_id, userSupabase, openaiClient)
                                    .then(result => {
                                        console.log(`✅ VPS Processing complete (fallback) for ${user_document_id}:`, result);
                                    })
                                    .catch(error => {
                                        console.error(`❌ VPS Processing failed (fallback) for ${user_document_id}:`, error);
                                    });
                            });
                    });

                // Return IMMEDIATELY without waiting for anything
                console.log(`✅ Edge Function processing initiated - API returning immediately`);
                return res.json({
                    success: true,
                    message: 'Document processing started via Edge Function',
                    user_document_id,
                    status: 'processing',
                    method: 'edge_function'
                });
            }

            // VPS Processing (either USE_EDGE_FUNCTIONS=false OR fallback from above)
            if (processingMethod === 'vps') {
                const fallbackNote = edgeFunctionAttempted ? ' (fallback from Edge Function)' : '';
                console.log(`🖥️ Using VPS processing for ${user_document_id}${fallbackNote}`);
                if (edgeFunctionAttempted) {
                    console.log(`   Note: Automatically falling back to VPS after Edge Function attempt`);
                }

                // Mark as VPS processing
                await userSupabase
                    .from('user_documents')
                    .update({
                        processing_method: 'vps',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', user_document_id);

                console.log(`📦 Using VPS processing (pdf.js-extract library)`);
                
                // Start processing asynchronously (don't wait for completion)
                // Use the authenticated Supabase client so RLS policies allow access
                processUserDocument(user_document_id, userSupabase, openaiClient)
                    .then(result => {
                        console.log(`✅ VPS Processing complete for ${user_document_id}:`, result);
                    })
                    .catch(error => {
                        console.error(`❌ VPS Processing failed for ${user_document_id}:`, error);
                    });

                // Return immediately with processing status
                console.log(`✅ VPS processing initiated - API returning immediately`);
                return res.json({
                    success: true,
                    message: 'Document processing started',
                    user_document_id,
                    status: 'processing',
                    method: 'vps'
                });
            }

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
     * POST /api/retrain-document
     * Retrain an existing document with a new PDF
     * Replaces all chunks while preserving document metadata and slug
     */
    router.post('/retrain-document', upload.single('file'), async (req, res) => {
        console.log('🔵 POST /api/retrain-document - Request received');
        
        try {
            const { document_id, use_edge_function } = req.body;
            
            if (!document_id) {
                return res.status(400).json({
                    success: false,
                    error: 'document_id is required'
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

            // Create authenticated Supabase client
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

            // Get the document to retrain
            const { data: document, error: docError } = await userSupabase
                .from('documents')
                .select('*')
                .eq('id', document_id)
                .single();

            if (docError || !document) {
                return res.status(404).json({
                    success: false,
                    error: 'Document not found'
                });
            }

            // Check permissions - user must own the document or be admin
            const isOwner = document.metadata?.user_id === user.id;
            
            // Check if user is admin by querying user_roles table
            const { data: userRole } = await userSupabase
                .from('user_roles')
                .select('role')
                .eq('user_id', user.id)
                .single();
            
            const isAdmin = userRole?.role === 'admin' || userRole?.role === 'superadmin';

            if (!isOwner && !isAdmin) {
                return res.status(403).json({
                    success: false,
                    error: 'You do not have permission to retrain this document'
                });
            }

            console.log(`🔄 Starting retraining for document ${document_id} (${document.slug})`);
            console.log(`   User: ${user.email}`);
            console.log(`   Is Owner: ${isOwner}, Is Admin: ${isAdmin}`);

            // Check if file was uploaded (multipart form data will be handled by multer middleware)
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: 'PDF file is required for retraining'
                });
            }

            const file = req.file;
            const fileSize = file.size;

            console.log(`📄 New PDF file: ${file.originalname} (${(fileSize / 1024 / 1024).toFixed(2)}MB)`);

            // Step 1: Delete existing chunks (use service role to bypass RLS)
            console.log('🗑️  Deleting existing chunks...');
            
            // Use service role client for deletion (bypasses RLS)
            const { createClient: createServiceClient } = require('@supabase/supabase-js');
            const serviceSupabase = createServiceClient(
                process.env.SUPABASE_URL,
                process.env.SUPABASE_SERVICE_ROLE_KEY
            );
            
            const { data: deletedChunks, error: deleteError } = await serviceSupabase
                .from('document_chunks')
                .delete()
                .eq('document_slug', document.slug)
                .select('id');

            if (deleteError) {
                console.error('Error deleting chunks:', deleteError);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to delete existing chunks'
                });
            }

            console.log(`✅ Existing chunks deleted: ${deletedChunks?.length || 0} chunks removed`);
            
            // Verify deletion completed
            const { count: remainingCount } = await serviceSupabase
                .from('document_chunks')
                .select('id', { count: 'exact', head: true })
                .eq('document_slug', document.slug);
            
            if (remainingCount > 0) {
                console.error(`⚠️  Warning: ${remainingCount} chunks still exist after deletion`);
                return res.status(500).json({
                    success: false,
                    error: `Failed to delete all chunks. ${remainingCount} chunks remain.`
                });
            }
            
            console.log('✅ Verified: All chunks deleted successfully');

            // Step 2: Upload new PDF to storage
            let userDocId = null;
            let filePath = null;

            // Check if there's an existing user_documents record
            const existingUserDocId = document.metadata?.user_document_id;
            
            if (existingUserDocId) {
                // Update existing user_documents record
                const { data: existingUserDoc } = await userSupabase
                    .from('user_documents')
                    .select('*')
                    .eq('id', existingUserDocId)
                    .single();

                if (existingUserDoc) {
                    userDocId = existingUserDocId;
                    filePath = existingUserDoc.file_path;
                    
                    // Replace the file in storage (delete old, upload new)
                    console.log(`📤 Replacing PDF in storage at: ${filePath}`);
                    
                    // First, delete the old file
                    await userSupabase.storage
                        .from('user-documents')
                        .remove([filePath]);
                    
                    // Then upload the new file
                    const { error: uploadError } = await userSupabase.storage
                        .from('user-documents')
                        .upload(filePath, file.buffer, {
                            contentType: 'application/pdf',
                            upsert: true
                        });

                    if (uploadError) {
                        console.error('Error uploading file:', uploadError);
                        return res.status(500).json({
                            success: false,
                            error: 'Failed to upload new PDF'
                        });
                    }

                    // Update user_documents record
                    await userSupabase
                        .from('user_documents')
                        .update({
                            title: document.title,
                            file_size: fileSize,
                            status: 'processing',
                            error_message: null,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', userDocId);
                }
            }
            
            // If no existing user_documents record, create a new one
            if (!userDocId) {
                console.log('📤 Creating new user_documents record and uploading PDF...');
                
                // Generate file path
                const timestamp = Date.now();
                const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
                filePath = `${user.id}/${timestamp}-${sanitizedFilename}`;

                // Upload to storage
                const { error: uploadError } = await userSupabase.storage
                    .from('user-documents')
                    .upload(filePath, file.buffer, {
                        contentType: 'application/pdf'
                    });

                if (uploadError) {
                    console.error('Error uploading file:', uploadError);
                    return res.status(500).json({
                        success: false,
                        error: 'Failed to upload new PDF'
                    });
                }

                // Create user_documents record
                const { data: newUserDoc, error: createError } = await userSupabase
                    .from('user_documents')
                    .insert({
                        user_id: user.id,
                        title: document.title,
                        file_path: filePath,
                        file_size: fileSize,
                        mime_type: 'application/pdf',
                        status: 'processing'
                    })
                    .select()
                    .single();

                if (createError || !newUserDoc) {
                    console.error('Error creating user_documents record:', createError);
                    return res.status(500).json({
                        success: false,
                        error: 'Failed to create document record'
                    });
                }

                userDocId = newUserDoc.id;

                // Update document metadata to link to user_documents
                await userSupabase
                    .from('documents')
                    .update({
                        metadata: {
                            ...document.metadata,
                            user_document_id: userDocId,
                            retraining: true,
                            retrained_at: new Date().toISOString()
                        },
                        pdf_subdirectory: 'user-uploads',
                        pdf_filename: sanitizedFilename
                    })
                    .eq('id', document_id);
            } else {
                // Mark document as being retrained
                await userSupabase
                    .from('documents')
                    .update({
                        metadata: {
                            ...document.metadata,
                            retraining: true,
                            retrained_at: new Date().toISOString()
                        }
                    })
                    .eq('id', document_id);
            }

            console.log(`✅ PDF uploaded successfully. user_document_id: ${userDocId}`);

            // Step 3: Trigger reprocessing (preserving document slug)
            const shouldUseEdgeFunction = use_edge_function && USE_EDGE_FUNCTIONS && fileSize <= EDGE_FUNCTION_MAX_FILE_SIZE;

            if (shouldUseEdgeFunction) {
                console.log('📡 Starting Edge Function reprocessing...');
                
                // Note: Edge Function uses processUserDocument which creates new slug
                // For retraining, we need VPS to use reprocessDocument
                // So we'll fall back to VPS for retraining to preserve slug
                console.log('⚠️  Edge Function not supported for retraining (would create new slug)');
                console.log('🖥️  Using VPS processing instead to preserve document slug');
                
                // Start VPS reprocessing asynchronously
                reprocessDocument(userDocId, document.slug, userSupabase, openaiClient)
                    .then(result => {
                        console.log(`✅ VPS retraining complete for ${document.slug}:`, result);
                    })
                    .catch(error => {
                        console.error(`❌ VPS retraining failed for ${document.slug}:`, error);
                    });

                return res.json({
                    success: true,
                    message: 'Document retraining started (using VPS to preserve slug)',
                    document_id,
                    user_document_id: userDocId,
                    status: 'processing',
                    method: 'vps'
                });
            } else {
                console.log('🖥️  Starting VPS reprocessing...');
                console.log(`📦 Using VPS reprocessing (pdf.js-extract library)`);
                
                // Start VPS reprocessing asynchronously
                reprocessDocument(userDocId, document.slug, userSupabase, openaiClient)
                    .then(result => {
                        console.log(`✅ VPS retraining complete for ${document.slug}:`, result);
                    })
                    .catch(error => {
                        console.error(`❌ VPS retraining failed for ${document.slug}:`, error);
                    });

                return res.json({
                    success: true,
                    message: 'Document retraining started',
                    document_id,
                    user_document_id: userDocId,
                    status: 'processing',
                    method: 'vps'
                });
            }

        } catch (error) {
            console.error('Error in retrain-document endpoint:', error);
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

