/**
 * Upload Document Handler
 * Handles direct file upload to backend (bypasses Supabase client 50MB limit)
 * This combines upload + processing into a single endpoint
 */

const { createUserSupabaseClient } = require('../utils/processing-auth');
const { processUserDocument } = require('../document-processor');
const { 
    incrementJobs, 
    decrementJobs, 
    checkCapacity, 
    getProcessingLoad 
} = require('../utils/concurrency-manager');
const { 
    callEdgeFunction, 
    shouldUseEdgeFunction 
} = require('../utils/edge-function-client');
const { enqueueJob } = require('../utils/job-queue');

/**
 * Sanitize filename for storage
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
 * Handle document upload + processing
 */
async function handleUploadDocument(req, res, supabase, openaiClient) {
    console.log('📥 Upload handler called!');
    console.log('   Headers:', Object.keys(req.headers));
    console.log('   Content-Type:', req.headers['content-type']);
    console.log('   File:', req.file ? 'Present' : 'Missing');
    
    try {
        // 1. Authenticate user
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }

        const token = authHeader.split(' ')[1];
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return res.status(401).json({ success: false, error: 'Invalid authentication token' });
        }

        // 2. Validate file upload
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        const file = req.file;
        const title = req.body.title || file.originalname.replace('.pdf', '');

        console.log(`📤 Upload request from user ${user.id}: ${title} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);

        // 3. Check if user is superadmin (for file size limits)
        const { createClient } = require('@supabase/supabase-js');
        const serviceSupabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        
        const { data: superAdminCheck, error: superAdminError } = await serviceSupabase
            .from('user_roles')
            .select('id')
            .eq('user_id', user.id)
            .eq('role', 'super_admin')
            .limit(1);
        
        const isSuperAdmin = !superAdminError && superAdminCheck && superAdminCheck.length > 0;
        
        // Validate file size based on user role
        const MAX_FILE_SIZE_REGULAR = 50 * 1024 * 1024; // 50MB
        const MAX_FILE_SIZE_SUPERADMIN = 75 * 1024 * 1024; // 75MB
        const maxFileSize = isSuperAdmin ? MAX_FILE_SIZE_SUPERADMIN : MAX_FILE_SIZE_REGULAR;
        
        if (file.size > maxFileSize) {
            const maxSizeMB = isSuperAdmin ? 75 : 50;
            console.log(`❌ File size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds limit of ${maxSizeMB}MB for ${isSuperAdmin ? 'superadmin' : 'regular user'}`);
            return res.status(413).json({
                success: false,
                error: `File too large. Maximum size is ${maxSizeMB}MB${isSuperAdmin ? ' for superadmin' : ''}.`
            });
        }

        // 4. Create user's authenticated Supabase client for RLS-compliant operations
        const userSupabase = createUserSupabaseClient(authHeader);

        // 5. Upload file to Supabase Storage
        // Use standard Storage API (not TUS) - TUS has size limits that cause 413 errors
        const sanitizedFileName = sanitizeFileName(file.originalname);
        const filePath = `${user.id}/${Date.now()}-${sanitizedFileName}`;

        console.log(`📤 Uploading ${(file.size / 1024 / 1024).toFixed(2)}MB file to storage: ${filePath}`);

        // Try uploading with user's auth token (respects RLS)
        // If this fails due to size limits, we'll try service role as fallback
        let uploadError = null;
        let uploadData = null;
        
        console.log('🔄 Attempting upload with user authentication...');
        const { data: userUploadData, error: userUploadError } = await userSupabase.storage
            .from('user-documents')
            .upload(filePath, file.buffer, {
                cacheControl: '3600',
                upsert: false,
                contentType: file.mimetype
            });

        if (userUploadError) {
            // Check if it's a size limit error
            const isSizeError = userUploadError.message?.includes('size') || 
                               userUploadError.message?.includes('413') ||
                               userUploadError.statusCode === '413' ||
                               userUploadError.status === 413;
            
            if (isSizeError) {
                // Try with service role key as fallback (may have different limits)
                console.log('⚠️  User token upload failed (size limit), trying with service role...');
                
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
                    console.log('✅ Upload succeeded with service role key');
                }
            } else {
                uploadData = userUploadData;
                uploadError = userUploadError;
            }
        } else {
            uploadData = userUploadData;
            console.log('✅ Upload succeeded with user authentication');
        }

        if (uploadError) {
            console.error('❌ Storage upload failed:', uploadError);
            return res.status(500).json({ 
                success: false, 
                error: `Upload failed: ${uploadError.message || 'Unknown error'}` 
            });
        }

        console.log(`✅ File uploaded to storage: ${filePath}`);

        // 6. Create user_documents record (using user's auth context for RLS)
        
        const { data: userDoc, error: dbError } = await userSupabase
            .from('user_documents')
            .insert({
                user_id: user.id,
                title: title,
                file_path: filePath,
                file_size: file.size,
                mime_type: file.mimetype,
                status: 'pending'
            })
            .select()
            .single();

        if (dbError) {
            console.error('❌ Database insert failed:', dbError);
            // Clean up uploaded file
            await supabase.storage.from('user-documents').remove([filePath]);
            return res.status(500).json({ 
                success: false, 
                error: `Database error: ${dbError.message}` 
            });
        }

        const user_document_id = userDoc.id;
        console.log(`✅ Database record created: ${user_document_id}`);

        // 7. Check concurrency limit - queue if at capacity instead of rejecting
        const capacityError = checkCapacity();
        if (capacityError) {
            console.log(`📥 Queueing upload processing request for document ${user_document_id} (capacity full)`);
            
            // Determine processing method (Edge Function vs VPS)
            const useEdgeFunction = shouldUseEdgeFunction(file.size);
            
            // Set status to pending
            await userSupabase
                .from('user_documents')
                .update({ 
                    status: 'pending',
                    processing_method: useEdgeFunction ? 'edge_function' : 'vps',
                    updated_at: new Date().toISOString()
                })
                .eq('id', user_document_id);
            
            // Create processing function wrapper (token is captured in closure)
            const processingFunction = async (userDocId, supabaseClient, openaiClientInstance, jobMetadata) => {
                const { createClient } = require('@supabase/supabase-js');
                const serviceSupabase = createClient(
                    process.env.SUPABASE_URL,
                    process.env.SUPABASE_SERVICE_ROLE_KEY
                );
                
                // Update status to processing
                await serviceSupabase
                    .from('user_documents')
                    .update({ 
                        status: 'processing',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', userDocId);
                
                // Check if Edge Function should be used
                const { data: doc } = await serviceSupabase
                    .from('user_documents')
                    .select('file_size, processing_method')
                    .eq('id', userDocId)
                    .single();
                
                const shouldUseEdge = shouldUseEdgeFunction(doc?.file_size || 0);
                
                if (shouldUseEdge && doc?.processing_method === 'edge_function') {
                    // Try Edge Function with fallback (use token from metadata or closure)
                    const edgeToken = jobMetadata?.token || token;
                    try {
                        const { callEdgeFunction } = require('../utils/edge-function-client');
                        await callEdgeFunction(userDocId, edgeToken);
                        return { success: true, method: 'edge_function' };
                    } catch (edgeError) {
                        console.error(`❌ Edge Function failed, falling back to VPS:`, edgeError.message);
                        await serviceSupabase
                            .from('user_documents')
                            .update({ processing_method: 'vps_fallback' })
                            .eq('id', userDocId);
                        // Fall through to VPS processing
                    }
                }
                
                // VPS processing (either direct or fallback)
                return await processUserDocument(userDocId, serviceSupabase, openaiClientInstance);
            };
            
            // Queue the job
            const queueInfo = enqueueJob({
                userDocId: user_document_id,
                supabase: userSupabase,
                openaiClient: openaiClient,
                processingFunction: processingFunction,
                metadata: { 
                    userEmail: user.email,
                    fileName: file.originalname,
                    fileSize: file.size,
                    token: token // Pass token for Edge Function calls
                }
            });
            
            return res.status(202).json({
                success: true,
                message: 'Document uploaded and queued for processing',
                user_document_id,
                status: 'pending',
                queue: queueInfo
            });
        }

        // 8. Determine processing method (Edge Function vs VPS)
        const useEdgeFunction = shouldUseEdgeFunction(file.size);
        console.log(`🔧 Processing method: ${useEdgeFunction ? 'Edge Function' : 'VPS'}`);

        // 9. Update status to processing
        await userSupabase
            .from('user_documents')
            .update({ 
                status: 'processing',
                processing_method: useEdgeFunction ? 'edge_function' : 'vps'
            })
            .eq('id', user_document_id);

        // 10. Trigger processing (fire and forget)
        incrementJobs();

        if (useEdgeFunction) {
            // Try Edge Function with fallback to VPS
            (async () => {
                try {
                    console.log(`🚀 Calling Edge Function for ${user_document_id}...`);
                    await callEdgeFunction(user_document_id, token);
                    console.log(`✅ Edge Function completed for ${user_document_id}`);
                } catch (edgeError) {
                    console.error(`❌ Edge Function failed for ${user_document_id}:`, edgeError.message);
                    console.log(`🔄 Falling back to VPS processing...`);
                    
                    // Update processing method
                    await userSupabase
                        .from('user_documents')
                        .update({ processing_method: 'vps_fallback' })
                        .eq('id', user_document_id);
                    
                    // Fall back to VPS processing with service role client
                    try {
                        const { createClient } = require('@supabase/supabase-js');
                        const serviceSupabase = createClient(
                            process.env.SUPABASE_URL,
                            process.env.SUPABASE_SERVICE_ROLE_KEY
                        );
                        await processUserDocument(user_document_id, serviceSupabase, openaiClient);
                    } catch (vpsError) {
                        console.error(`❌ VPS fallback also failed for ${user_document_id}:`, vpsError);
                    }
                } finally {
                    decrementJobs();
                    // Trigger queue processing if jobs are waiting
                    const { processQueueIfAvailable } = require('../utils/job-queue');
                    processQueueIfAvailable();
                }
            })();
        } else {
            // Direct VPS processing
            // Use service role client to bypass RLS for processing
            (async () => {
                try {
                    console.log(`🚀 Starting VPS processing for ${user_document_id}...`);
                    const { createClient } = require('@supabase/supabase-js');
                    const serviceSupabase = createClient(
                        process.env.SUPABASE_URL,
                        process.env.SUPABASE_SERVICE_ROLE_KEY
                    );
                    await processUserDocument(user_document_id, serviceSupabase, openaiClient);
                    console.log(`✅ VPS processing completed for ${user_document_id}`);
                } catch (error) {
                    console.error(`❌ VPS processing failed for ${user_document_id}:`, error);
                } finally {
                    decrementJobs();
                    // Trigger queue processing if jobs are waiting
                    const { processQueueIfAvailable } = require('../utils/job-queue');
                    processQueueIfAvailable();
                }
            })();
        }

        // 9. Return success immediately (processing continues in background)
        return res.json({
            success: true,
            message: 'Document uploaded and processing started',
            user_document_id,
            status: 'processing',
            method: useEdgeFunction ? 'edge_function' : 'vps'
        });

    } catch (error) {
        console.error('❌ Upload handler error:', error);
        console.error('❌ Error stack:', error.stack);
        console.error('❌ Error details:', {
            name: error.name,
            message: error.message,
            code: error.code
        });
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
}

module.exports = {
    handleUploadDocument
};

