/**
 * Handler for POST /api/retrain-document
 * Retrain an existing document with a new PDF
 * Replaces all chunks while preserving document metadata and slug
 */

const { authenticateUser, createUserSupabaseClient } = require('../utils/processing-auth');
const { incrementJobs, decrementJobs, checkCapacity } = require('../utils/concurrency-manager');
const { shouldUseEdgeFunction, USE_EDGE_FUNCTIONS, EDGE_FUNCTION_MAX_FILE_SIZE } = require('../utils/edge-function-client');
const { reprocessDocument } = require('../document-processor');

/**
 * Handle document retraining request
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} supabase - Supabase client
 * @param {Object} openaiClient - OpenAI client
 */
async function handleRetrainDocument(req, res, supabase, openaiClient) {
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
        const userSupabase = createUserSupabaseClient(authHeader);

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

        // Check concurrency limit before starting reprocessing
        const capacityError = checkCapacity();
        if (capacityError) {
            console.warn(`   Rejecting retraining request for document ${document_id}`);
            return res.status(capacityError.status).json(capacityError.json);
        }

        // Increment active job counter
        incrementJobs();

        // Step 3: Trigger reprocessing (preserving document slug)
        const shouldUseEdgeFunctionForRetrain = use_edge_function && USE_EDGE_FUNCTIONS && fileSize <= EDGE_FUNCTION_MAX_FILE_SIZE;

        if (shouldUseEdgeFunctionForRetrain) {
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
                })
                .finally(() => {
                    // Decrement counter when reprocessing completes
                    decrementJobs();
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
                })
                .finally(() => {
                    // Decrement counter when reprocessing completes
                    decrementJobs();
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
}

module.exports = {
    handleRetrainDocument
};




