/**
 * Handler for POST /api/retrain-document
 * Retrain an existing document with a new PDF
 * Replaces all chunks while preserving document metadata and slug
 */

const { authenticateUser, createUserSupabaseClient } = require('../utils/processing-auth');
const { incrementJobs, decrementJobs, checkCapacity, getProcessingLoad } = require('../utils/concurrency-manager');
const { shouldUseEdgeFunction, USE_EDGE_FUNCTIONS, EDGE_FUNCTION_MAX_FILE_SIZE } = require('../utils/edge-function-client');
const { reprocessDocument } = require('../document-processor');
const { enqueueJob, processQueueIfAvailable } = require('../utils/job-queue');
const { debugLog } = require('../utils/debug');

/**
 * Sanitize filename for storage (same as upload handler)
 */
function sanitizeFileName(fileName) {
    const lastDot = fileName.lastIndexOf('.');
    const name = lastDot > 0 ? fileName.substring(0, lastDot) : fileName;
    const ext = lastDot > 0 ? fileName.substring(lastDot) : '';
    
    const normalized = name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[\u2000-\u206F]/g, '-')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/_{2,}/g, '_')
        .replace(/^_+|_+$/g, '');
    
    const maxLength = 200 - ext.length;
    const sanitized = normalized.length > maxLength 
        ? normalized.substring(0, maxLength) 
        : normalized;
    
    return sanitized + ext;
}

/**
 * Handle document retraining request
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} supabase - Supabase client
 * @param {Object} openaiClient - OpenAI client
 */
async function handleRetrainDocument(req, res, supabase, openaiClient) {
    debugLog('🔵 POST /api/retrain-document - Request received [UPDATED VERSION]');
    debugLog('   Request body keys:', Object.keys(req.body || {}));
    debugLog('   File:', req.file ? `${req.file.originalname} (${req.file.size} bytes)` : 'none');
    debugLog('   File buffer:', req.file?.buffer ? `Present (${req.file.buffer.length} bytes)` : 'MISSING');
    
    try {
        const { document_id, use_edge_function, retrain_mode = 'replace' } = req.body;
        
        // Validate retrain_mode
        if (retrain_mode !== 'replace' && retrain_mode !== 'add') {
            return res.status(400).json({
                success: false,
                error: `Invalid retrain_mode: ${retrain_mode}. Must be 'replace' or 'add'`
            });
        }
        
        if (!document_id) {
            console.error('❌ Missing document_id in request');
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
        const { data: userRoles, error: rolesError } = await userSupabase
            .from('user_roles')
            .select('role, owner_id')
            .eq('user_id', user.id);
        
        let isAdmin = false;
        let isSuperAdmin = false;
        let isOwnerAdmin = false;
        
        if (!rolesError && userRoles && userRoles.length > 0) {
            // Check for super_admin role
            const superAdminRoles = userRoles.filter(r => r.role === 'super_admin');
            if (superAdminRoles.length > 0) {
                // Check if user is a global super admin (owner_id IS NULL)
                isSuperAdmin = superAdminRoles.some(r => r.owner_id === null);
                
                // Also check if user is super admin for document's owner group
                if (!isSuperAdmin && document.owner_id) {
                    isSuperAdmin = superAdminRoles.some(r => r.owner_id === document.owner_id);
                }
            }
            
            // Check for owner_admin role for document's owner group
            if (document.owner_id) {
                isOwnerAdmin = userRoles.some(r => 
                    r.role === 'owner_admin' && r.owner_id === document.owner_id
                );
            }
            
            // Legacy admin role check (if it exists)
            isAdmin = userRoles.some(r => r.role === 'admin');
        }

        if (!isOwner && !isSuperAdmin && !isOwnerAdmin && !isAdmin) {
            return res.status(403).json({
                success: false,
                error: 'You do not have permission to retrain this document'
            });
        }

        debugLog(`🔄 Starting retraining for document ${document_id} (${document.slug})`);
        debugLog(`   User: ${user.email}`);
        debugLog(`   Is Owner: ${isOwner}, Is SuperAdmin: ${isSuperAdmin}, Is OwnerAdmin: ${isOwnerAdmin}, Is Admin: ${isAdmin}`);

        // Check if file was uploaded (multipart form data will be handled by multer middleware)
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'PDF file is required for retraining'
            });
        }

        const file = req.file;
        const fileSize = file.size;

        debugLog(`📄 New PDF file: ${file.originalname} (${(fileSize / 1024 / 1024).toFixed(2)}MB)`);
        debugLog(`   File buffer available: ${!!file.buffer}, size: ${file.buffer?.length || 0} bytes`);
        
        if (!file.buffer || file.buffer.length === 0) {
            console.error('❌ File buffer is empty or missing!');
            return res.status(400).json({
                success: false,
                error: 'File buffer is empty or missing',
                details: 'The uploaded file could not be read properly'
            });
        }

        // Step 1: Delete existing chunks (only for "replace" mode)
        if (retrain_mode === 'replace') {
            debugLog('🗑️  Deleting existing chunks (replace mode)...');
            
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

            debugLog(`✅ Existing chunks deleted: ${deletedChunks?.length || 0} chunks removed`);
            
            // Verify deletion completed
            const { count: remainingCount, error: countError } = await serviceSupabase
                .from('document_chunks')
                .select('id', { count: 'exact', head: true })
                .eq('document_slug', document.slug);
            
            if (countError) {
                console.error('⚠️  Warning: Could not verify chunk deletion:', countError);
                // Continue anyway - deletion might have succeeded
            } else if (remainingCount > 0) {
                console.error(`⚠️  Warning: ${remainingCount} chunks still exist after deletion`);
                return res.status(500).json({
                    success: false,
                    error: `Failed to delete all chunks. ${remainingCount} chunks remain.`
                });
            }
            
            debugLog('✅ Verified: All chunks deleted successfully');
        } else {
            debugLog('➕ Add mode: Preserving existing chunks');
        }

        // Step 2: Upload new PDF to storage
        let userDocId = null;
        let filePath = null;

        // For retraining, always upload to a new file path to avoid conflicts
        // Use same sanitization as upload handler
        const sanitizedFileName = sanitizeFileName(file.originalname);
        filePath = `${user.id}/${Date.now()}-${sanitizedFileName}`;
        
        debugLog(`📤 Uploading ${(fileSize / 1024 / 1024).toFixed(2)}MB file to storage: ${filePath}`);

        // Upload to storage (same pattern as upload handler)
        // Try uploading with user's auth token (respects RLS)
        // If this fails due to size limits, we'll try service role as fallback
        let uploadError = null;
        let uploadData = null;
        
        debugLog('🔄 Attempting upload with user authentication...');
        const { data: userUploadData, error: userUploadError } = await userSupabase.storage
            .from('user-documents')
            .upload(filePath, file.buffer, {
                cacheControl: '3600',
                upsert: false,
                contentType: file.mimetype
            });

        if (userUploadError) {
            // Check if it's a size limit error (same logic as upload handler)
            const isSizeError = userUploadError.message?.includes('size') || 
                               userUploadError.message?.includes('413') ||
                               userUploadError.statusCode === '413' ||
                               userUploadError.status === 413;
            
            if (isSizeError) {
                // Try with service role key as fallback (may have different limits)
                debugLog('⚠️  User token upload failed (size limit), trying with service role...');
                
                // Use the serviceSupabase we already created for chunk deletion
                const { data: serviceUploadData, error: serviceUploadError } = await serviceSupabase.storage
                    .from('user-documents')
                    .upload(filePath, file.buffer, {
                        cacheControl: '3600',
                        upsert: false,
                        contentType: file.mimetype
                    });
                
                uploadData = serviceUploadData;
                uploadError = serviceUploadError;
                
                if (!serviceUploadError) {
                    debugLog('✅ Upload succeeded with service role key');
                }
            } else {
                uploadData = userUploadData;
                uploadError = userUploadError;
            }
        } else {
            uploadData = userUploadData;
            debugLog('✅ Upload succeeded with user authentication');
        }

        if (uploadError) {
            console.error('❌ Storage upload failed:', uploadError);
            return res.status(500).json({ 
                success: false, 
                error: `Upload failed: ${uploadError.message || 'Unknown error'}`,
                details: uploadError.message || uploadError.error || 'Storage upload failed'
            });
        }

        debugLog(`✅ File uploaded to storage: ${filePath}`);

        // Check if there's an existing user_documents record
        const existingUserDocId = document.metadata?.user_document_id;
        
        if (existingUserDocId) {
            // Update existing user_documents record with new file path
            debugLog(`🔄 Updating existing user_documents record: ${existingUserDocId}`);
            
            // First fetch the existing record to preserve metadata
            const { data: existingUserDocData, error: fetchError } = await userSupabase
                .from('user_documents')
                .select('*')
                .eq('id', existingUserDocId)
                .single();
            
            if (fetchError || !existingUserDocData) {
                console.error('❌ Error fetching existing user_documents record:', fetchError);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to fetch existing document record',
                    details: fetchError?.message || 'Database fetch failed'
                });
            }
            
            const { data: existingUserDoc, error: updateError } = await userSupabase
                .from('user_documents')
                .update({
                    title: document.title,
                    file_path: filePath,
                    file_size: fileSize,
                    mime_type: 'application/pdf',
                    status: 'processing',
                    error_message: null,
                    // Clear text-related metadata when retraining with PDF
                    metadata: {
                        ...(existingUserDocData.metadata || {}),
                        upload_type: null, // Clear upload_type for PDF retraining
                        text_content: null, // Clear text_content if it exists
                        character_count: null // Clear character_count if it exists
                    },
                    updated_at: new Date().toISOString()
                })
                .eq('id', existingUserDocId)
                .select()
                .single();

            if (updateError || !existingUserDoc) {
                console.error('❌ Error updating user_documents record:', updateError);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to update document record',
                    details: updateError?.message || 'Database update failed'
                });
            }

            userDocId = existingUserDocId;
        } else {
            // Create new user_documents record
            debugLog('📝 Creating new user_documents record...');
            
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
                console.error('❌ Error creating user_documents record:', createError);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to create document record',
                    details: createError?.message || 'Database insert failed'
                });
            }

            userDocId = newUserDoc.id;

            // Update document metadata to link to user_documents
            // For PDF retraining, clear upload_type if it was previously text
            await userSupabase
                .from('documents')
                .update({
                    metadata: {
                        ...document.metadata,
                        user_document_id: userDocId,
                        retraining: true,
                        retrained_at: new Date().toISOString(),
                        upload_type: null // Clear upload_type for PDF retraining (allows references)
                    },
                    pdf_subdirectory: 'user-uploads',
                    pdf_filename: sanitizedFileName
                })
                .eq('id', document_id);
        }

        // Mark document as being retrained (for existing user_documents)
        if (existingUserDocId) {
            await userSupabase
                .from('documents')
                .update({
                    metadata: {
                        ...document.metadata,
                        retraining: true,
                        retrained_at: new Date().toISOString(),
                        upload_type: null // Clear upload_type for PDF retraining (allows references)
                    },
                    pdf_subdirectory: 'user-uploads',
                    pdf_filename: sanitizedFileName
                })
                .eq('id', document_id);
        }

        debugLog(`✅ PDF uploaded successfully. user_document_id: ${userDocId}`);

        // Check concurrency limit - queue if at capacity instead of rejecting
        debugLog(`🔍 Checking capacity for retrain document ${document_id} (queue system active)`);
        const capacityError = checkCapacity();
        if (capacityError) {
            debugLog(`📥 Queueing retraining request for document ${document_id} (capacity full)`);
            
            // Set status to pending if not already
            await userSupabase
                .from('user_documents')
                .update({ 
                    status: 'pending',
                    updated_at: new Date().toISOString()
                })
                .eq('id', userDocId);
            
            // Queue the job
            const queueInfo = enqueueJob({
                userDocId: userDocId,
                supabase: userSupabase,
                openaiClient: openaiClient,
                processingFunction: async (userDocId, supabaseClient, openaiClientInstance, jobMetadata) => {
                    // Use service role key for processing to avoid JWT expiration
                    const { createClient } = require('@supabase/supabase-js');
                    const serviceSupabase = createClient(
                        process.env.SUPABASE_URL,
                        process.env.SUPABASE_SERVICE_ROLE_KEY
                    );
                    // Preserve document slug for retraining
                    return await reprocessDocument(userDocId, document.slug, serviceSupabase, openaiClientInstance, retrain_mode);
                },
                metadata: { 
                    userEmail: user.email,
                    documentId: document_id,
                    documentSlug: document.slug,
                    fileName: file.originalname,
                    fileSize: fileSize,
                    retrain_mode: retrain_mode
                }
            });
            
            return res.status(202).json({
                success: true,
                message: 'Document retraining queued for processing',
                document_id,
                user_document_id: userDocId,
                status: 'pending',
                queue: queueInfo
            });
        }

        const loadInfo = getProcessingLoad();
        debugLog(`🔄 Starting immediate retraining for document ${document_id}`);
        debugLog(`📊 Processing load: ${loadInfo.active}/${loadInfo.max} (${loadInfo.utilizationPercent}% utilized)`);

        // Increment active job counter
        incrementJobs();

        // Step 3: Trigger reprocessing (preserving document slug)
        const shouldUseEdgeFunctionForRetrain = use_edge_function && USE_EDGE_FUNCTIONS && fileSize <= EDGE_FUNCTION_MAX_FILE_SIZE;

        if (shouldUseEdgeFunctionForRetrain) {
            debugLog('📡 Starting Edge Function reprocessing...');
            
            // Note: Edge Function uses processUserDocument which creates new slug
            // For retraining, we need VPS to use reprocessDocument
            // So we'll fall back to VPS for retraining to preserve slug
            debugLog('⚠️  Edge Function not supported for retraining (would create new slug)');
            debugLog('🖥️  Using VPS processing instead to preserve document slug');
            
            // Start VPS reprocessing asynchronously
            reprocessDocument(userDocId, document.slug, userSupabase, openaiClient, retrain_mode)
                .then(result => {
                    debugLog(`✅ VPS retraining complete for ${document.slug}:`, result);
                })
                .catch(error => {
                    console.error(`❌ VPS retraining failed for ${document.slug}:`, error);
                })
                .finally(() => {
                    // Decrement counter when reprocessing completes
                    const activeJobs = decrementJobs();
                    // Trigger queue processing if jobs are waiting
                    processQueueIfAvailable();
                });

            return res.json({
                success: true,
                message: 'Document retraining started (using VPS to preserve slug)',
                document_id,
                user_document_id: userDocId,
                status: 'processing',
                method: 'vps',
                retrain_mode: retrain_mode
            });
        } else {
            debugLog('🖥️  Starting VPS reprocessing...');
            debugLog(`📦 Using VPS reprocessing (pdf.js-extract library)`);
            
            // Start VPS reprocessing asynchronously
            reprocessDocument(userDocId, document.slug, userSupabase, openaiClient, retrain_mode)
                .then(result => {
                    debugLog(`✅ VPS retraining complete for ${document.slug}:`, result);
                })
                .catch(error => {
                    console.error(`❌ VPS retraining failed for ${document.slug}:`, error);
                })
                .finally(() => {
                    // Decrement counter when reprocessing completes
                    const activeJobs = decrementJobs();
                    // Trigger queue processing if jobs are waiting
                    processQueueIfAvailable();
                });

            return res.json({
                success: true,
                message: 'Document retraining started',
                document_id,
                user_document_id: userDocId,
                status: 'processing',
                method: 'vps',
                retrain_mode: retrain_mode
            });
        }

    } catch (error) {
        console.error('❌ Error in retrain-document endpoint:', error);
        console.error('   Error stack:', error.stack);
        console.error('   Request body:', req.body);
        console.error('   File present:', !!req.file);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}

/**
 * Handle text retraining request
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} supabase - Supabase client
 * @param {Object} openaiClient - OpenAI client
 */
async function handleRetrainDocumentText(req, res, supabase, openaiClient) {
    debugLog('🔵 POST /api/retrain-document-text - Request received');

    try {
        const { document_id, content, retrain_mode = 'replace' } = req.body;
        
        // Validate retrain_mode
        if (retrain_mode !== 'replace' && retrain_mode !== 'add') {
            return res.status(400).json({
                success: false,
                error: `Invalid retrain_mode: ${retrain_mode}. Must be 'replace' or 'add'`
            });
        }

        if (!document_id) {
            return res.status(400).json({
                success: false,
                error: 'document_id is required'
            });
        }

        if (!content || typeof content !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'content is required and must be a string'
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
        const { createUserSupabaseClient } = require('../utils/processing-auth');
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
        const { data: userRoles, error: rolesError } = await userSupabase
            .from('user_roles')
            .select('role, owner_id')
            .eq('user_id', user.id);
        
        let isAdmin = false;
        let isSuperAdmin = false;
        let isOwnerAdmin = false;
        
        if (!rolesError && userRoles && userRoles.length > 0) {
            // Check for super_admin role
            const superAdminRoles = userRoles.filter(r => r.role === 'super_admin');
            if (superAdminRoles.length > 0) {
                // Check if user is a global super admin (owner_id IS NULL)
                isSuperAdmin = superAdminRoles.some(r => r.owner_id === null);
                
                // Also check if user is super admin for document's owner group
                if (!isSuperAdmin && document.owner_id) {
                    isSuperAdmin = superAdminRoles.some(r => r.owner_id === document.owner_id);
                }
            }
            
            // Check for owner_admin role for document's owner group
            if (document.owner_id) {
                isOwnerAdmin = userRoles.some(r => 
                    r.role === 'owner_admin' && r.owner_id === document.owner_id
                );
            }
            
            // Legacy admin role check (if it exists)
            isAdmin = userRoles.some(r => r.role === 'admin');
        }

        if (!isOwner && !isSuperAdmin && !isOwnerAdmin && !isAdmin) {
            return res.status(403).json({
                success: false,
                error: 'You do not have permission to retrain this document'
            });
        }

        // Validate text content
        const { validateTextInput } = require('../utils/input-validator');
        const validationError = validateTextInput(content);
        if (validationError) {
            return res.status(400).json({ success: false, error: validationError });
        }

        // Check text size limits
        const MAX_TEXT_LENGTH = 5000000; // 5M characters
        if (content.length > MAX_TEXT_LENGTH) {
            return res.status(413).json({
                success: false,
                error: `Text too long. Maximum ${MAX_TEXT_LENGTH.toLocaleString()} characters allowed.`
            });
        }

        debugLog(`🔄 Starting text retraining for document ${document_id} (${document.slug})`);
        debugLog(`   User: ${user.email}`);
        debugLog(`   Is Owner: ${isOwner}, Is SuperAdmin: ${isSuperAdmin}, Is OwnerAdmin: ${isOwnerAdmin}, Is Admin: ${isAdmin}`);
        debugLog(`   Text length: ${(content.length / 1000).toFixed(1)}K characters`);
        debugLog(`   Retrain mode: ${retrain_mode}`);

        // Step 1: Delete existing chunks (only for "replace" mode)
        if (retrain_mode === 'replace') {
            debugLog('🗑️  Deleting existing chunks (replace mode)...');

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

            debugLog(`✅ Existing chunks deleted: ${deletedChunks?.length || 0} chunks removed`);

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

            debugLog('✅ Verified: All chunks deleted successfully');
        } else {
            debugLog('➕ Add mode: Preserving existing chunks');
        }

        // Step 2: Create or update user_documents record for text content
        let userDocId = null;

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
                
                // If there was a PDF file in storage, remove it since we're switching to text
                if (existingUserDoc.file_path && 
                    existingUserDoc.file_path !== 'text-upload' && 
                    existingUserDoc.file_path !== 'text-retrain') {
                    debugLog(`🗑️  Removing old PDF file from storage: ${existingUserDoc.file_path}`);
                    await userSupabase.storage
                        .from('user-documents')
                        .remove([existingUserDoc.file_path]);
                }

                // Update user_documents record
                await userSupabase
                    .from('user_documents')
                    .update({
                        title: document.title,
                        file_path: 'text-retrain', // Update to text indicator (was PDF path)
                        file_size: content.length, // Store character count as "file size"
                        mime_type: 'text/plain',
                        status: 'processing',
                        error_message: null,
                        // Update text content in metadata
                        metadata: {
                            text_content: content,
                            upload_type: 'text_retrain',
                            character_count: content.length
                        },
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', userDocId);
                    
                // Update document to reflect text retrain (update pdf_filename for detection)
                await userSupabase
                    .from('documents')
                    .update({
                        pdf_filename: 'text-content.txt', // Set to text indicator for detection
                        pdf_subdirectory: 'text-retrain',
                        metadata: {
                            ...document.metadata,
                            retraining: true,
                            retrained_at: new Date().toISOString(),
                            upload_type: 'text_retrain'
                        },
                        show_references: false // Disable references for text retrains
                    })
                    .eq('id', document_id);
            }
        }

        // If no existing user_documents record, create a new one
        if (!userDocId) {
            debugLog('📝 Creating new user_documents record for text retraining...');

            // Create user_documents record
            const { data: newUserDoc, error: createError } = await userSupabase
                .from('user_documents')
                .insert({
                    user_id: user.id,
                    title: document.title,
                    file_path: 'text-retrain', // Placeholder for text retraining
                    file_size: content.length, // Store character count as "file size"
                    mime_type: 'text/plain',
                    status: 'processing',
                    // Store text content in metadata
                    metadata: {
                        text_content: content,
                        upload_type: 'text_retrain',
                        character_count: content.length
                    }
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
            // Set upload_type and disable references for text retrains
            await userSupabase
                .from('documents')
                .update({
                    metadata: {
                        ...document.metadata,
                        user_document_id: userDocId,
                        retraining: true,
                        retrained_at: new Date().toISOString(),
                        upload_type: 'text_retrain' // Mark as text retrain
                    },
                    pdf_subdirectory: 'text-retrain',
                    pdf_filename: 'text-content.txt',
                    show_references: false // Disable references for text uploads (no pages)
                })
                .eq('id', document_id);
        } else {
            // Mark document as being retrained (for existing user_documents with text_retrain)
            // Update upload_type and disable references if it's a text retrain
            const existingUploadType = document.metadata?.upload_type;
            const isTextRetrain = existingUploadType === 'text_retrain' || existingUploadType === 'text';
            
            await userSupabase
                .from('documents')
                .update({
                    metadata: {
                        ...document.metadata,
                        retraining: true,
                        retrained_at: new Date().toISOString(),
                        upload_type: isTextRetrain ? 'text_retrain' : document.metadata?.upload_type
                    },
                    ...(isTextRetrain && { show_references: false }) // Disable references for text retrains
                })
                .eq('id', document_id);
        }

        debugLog(`✅ Text content prepared for retraining. user_document_id: ${userDocId}`);

        // Ensure status is set to processing before checking capacity
        // This ensures the UI can immediately see the document is processing
        // Use service role client to ensure update succeeds (bypasses RLS)
        const { createClient: createServiceClient } = require('@supabase/supabase-js');
        const serviceSupabaseForStatus = createServiceClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        
        await serviceSupabaseForStatus
            .from('user_documents')
            .update({ 
                status: 'processing',
                updated_at: new Date().toISOString()
            })
            .eq('id', userDocId);

        debugLog(`✅ Set user_documents status to 'processing' for ${userDocId}`);

        // Check concurrency limit - queue if at capacity instead of rejecting
        debugLog(`🔍 Checking capacity for text retrain document ${document_id} (queue system active)`);
        const capacityError = checkCapacity();
        if (capacityError) {
            debugLog(`📥 Queueing text retraining request for document ${document_id} (capacity full)`);
            
            // Set status to pending if not already (queue will update to processing when it starts)
            await serviceSupabaseForStatus
                .from('user_documents')
                .update({ 
                    status: 'pending',
                    updated_at: new Date().toISOString()
                })
                .eq('id', userDocId);
            
            debugLog(`✅ Set user_documents status to 'pending' for queued job ${userDocId}`);
            
            // Queue the job
            const queueInfo = enqueueJob({
                userDocId: userDocId,
                supabase: userSupabase,
                openaiClient: openaiClient,
                processingFunction: async (userDocId, supabaseClient, openaiClientInstance, jobMetadata) => {
                    // Use service role key for processing to avoid JWT expiration
                    const { createClient } = require('@supabase/supabase-js');
                    const serviceSupabase = createClient(
                        process.env.SUPABASE_URL,
                        process.env.SUPABASE_SERVICE_ROLE_KEY
                    );
                    // Preserve document slug for retraining
                    debugLog(`🔄 Queued text retraining: Starting reprocessDocument for ${document.slug}`);
                    return await reprocessDocument(userDocId, document.slug, serviceSupabase, openaiClientInstance, retrain_mode);
                },
                metadata: { 
                    userEmail: user.email,
                    documentId: document_id,
                    documentSlug: document.slug,
                    textLength: content.length,
                    retrain_mode: retrain_mode
                }
            });
            
            return res.status(202).json({
                success: true,
                message: 'Document text retraining queued for processing',
                document_id,
                user_document_id: userDocId,
                status: 'pending',
                queue: queueInfo
            });
        }

        const loadInfo = getProcessingLoad();
        debugLog(`🔄 Starting immediate text retraining for document ${document_id}`);
        debugLog(`📊 Processing load: ${loadInfo.active}/${loadInfo.max} (${loadInfo.utilizationPercent}% utilized)`);

        // Increment active job counter
        incrementJobs();

        // Step 3: Trigger reprocessing (preserving document slug)
        debugLog('🖥️  Starting VPS reprocessing for text content...');
        debugLog(`   Document ID: ${document_id}`);
        debugLog(`   Document Slug: ${document.slug}`);
        debugLog(`   User Document ID: ${userDocId}`);
        debugLog(`   Retrain Mode: ${retrain_mode}`);

        // Import and use the reprocessDocument function but for text content
        const { reprocessDocument } = require('../document-processor');

        // Use service role client for processing to avoid JWT expiration (same as queued jobs)
        const { createClient } = require('@supabase/supabase-js');
        const serviceSupabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // Start VPS reprocessing asynchronously
        reprocessDocument(userDocId, document.slug, serviceSupabase, openaiClient, retrain_mode)
            .then(result => {
                debugLog(`✅ VPS text retraining complete for ${document.slug}:`, result);
            })
            .catch(error => {
                console.error(`❌ VPS text retraining failed for ${document.slug}:`, error);
                console.error(`   Error stack:`, error.stack);
                console.error(`   Error message:`, error.message);
            })
            .finally(() => {
                // Decrement counter when reprocessing completes
                const activeJobs = decrementJobs();
                // Trigger queue processing if jobs are waiting
                processQueueIfAvailable();
            });

        return res.json({
            success: true,
            message: 'Document text retraining started',
            document_id,
            user_document_id: userDocId,
            status: 'processing',
            method: 'vps',
            character_count: content.length,
            retrain_mode: retrain_mode
        });

    } catch (error) {
        console.error('Error in retrain-document-text endpoint:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
}

module.exports = {
    handleRetrainDocument,
    handleRetrainDocumentText
};




