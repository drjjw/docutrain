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

        // 3. Create user's authenticated Supabase client for RLS-compliant operations
        const userSupabase = createUserSupabaseClient(authHeader);

        // 4. Upload file to Supabase Storage
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
                const { createClient } = require('@supabase/supabase-js');
                const serviceClient = createClient(
                    process.env.SUPABASE_URL,
                    process.env.SUPABASE_SERVICE_ROLE_KEY
                );
                
                const { data: serviceUploadData, error: serviceUploadError } = await serviceClient.storage
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

        // 5. Create user_documents record (using user's auth context for RLS)
        
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

        // 5. Check concurrency limit
        const capacityError = checkCapacity();
        if (capacityError) {
            console.log(`⚠️  Processing queue full`);
            return res.status(capacityError.status).json(capacityError.json);
        }

        // 6. Determine processing method (Edge Function vs VPS)
        const useEdgeFunction = shouldUseEdgeFunction(file.size);
        console.log(`🔧 Processing method: ${useEdgeFunction ? 'Edge Function' : 'VPS'}`);

        // 7. Update status to processing
        await userSupabase
            .from('user_documents')
            .update({ 
                status: 'processing',
                processing_method: useEdgeFunction ? 'edge_function' : 'vps'
            })
            .eq('id', user_document_id);

        // 8. Trigger processing (fire and forget)
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

