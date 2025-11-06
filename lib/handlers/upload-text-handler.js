/**
 * Upload Text Handler
 * Handles direct text upload for training (bypasses PDF extraction)
 * This combines text input + processing into a single endpoint
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
const { validateTextInput } = require('../utils/input-validator');
const { enqueueJob } = require('../utils/job-queue');

/**
 * Handle text upload + processing
 */
async function handleUploadText(req, res, supabase, openaiClient) {
    console.log('📝 Upload text handler called!');
    console.log('   Headers:', Object.keys(req.headers));
    console.log('   Content-Type:', req.headers['content-type']);
    console.log('   Body keys:', Object.keys(req.body || {}));

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

        // 2. Validate text input
        const { title, content } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ success: false, error: 'Title is required' });
        }

        if (!content || typeof content !== 'string') {
            return res.status(400).json({ success: false, error: 'Text content is required' });
        }

        // Validate text content
        const validationError = validateTextInput(content);
        if (validationError) {
            return res.status(400).json({ success: false, error: validationError });
        }

        // Check text size limits (similar to PDF limits but for text)
        const MAX_TEXT_LENGTH = 5000000; // 5M characters (roughly 1M words)
        if (content.length > MAX_TEXT_LENGTH) {
            return res.status(413).json({
                success: false,
                error: `Text too long. Maximum ${MAX_TEXT_LENGTH.toLocaleString()} characters allowed.`
            });
        }

        console.log(`📤 Text upload request from user ${user.id}: ${title} (${(content.length / 1000).toFixed(1)}K characters)`);

        // Debug: Log what we're about to store
        console.log('📝 About to create user_documents record with metadata:', {
            user_id: user.id,
            title: title.trim(),
            file_path: 'text-upload', // Placeholder for text uploads
            file_size: content.length,
            mime_type: 'text/plain',
            status: 'pending',
            metadata: {
                text_content: content.substring(0, 100) + '...', // Log first 100 chars only
                upload_type: 'text',
                character_count: content.length
            }
        });

        // 3. Check if user is superadmin (for text size limits)
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

        // Validate text size based on user role
        const MAX_TEXT_LENGTH_REGULAR = 2000000; // 2M characters for regular users
        const MAX_TEXT_LENGTH_SUPERADMIN = 10000000; // 10M characters for superadmin
        const maxTextLength = isSuperAdmin ? MAX_TEXT_LENGTH_SUPERADMIN : MAX_TEXT_LENGTH_REGULAR;

        if (content.length > maxTextLength) {
            const maxLengthFormatted = maxTextLength.toLocaleString();
            console.log(`❌ Text size ${(content.length / 1000).toFixed(1)}K characters exceeds limit of ${maxLengthFormatted} characters for ${isSuperAdmin ? 'superadmin' : 'regular user'}`);
            return res.status(413).json({
                success: false,
                error: `Text too long. Maximum ${maxLengthFormatted} characters allowed${isSuperAdmin ? ' for superadmin' : ''}.`
            });
        }

        // 4. Create user's authenticated Supabase client for RLS-compliant operations
        const userSupabase = createUserSupabaseClient(authHeader);

        // 5. Create user_documents record (no file storage needed for text)
        const { data: userDoc, error: dbError } = await userSupabase
            .from('user_documents')
            .insert({
                user_id: user.id,
                title: title.trim(),
                file_path: 'text-upload', // Placeholder for text uploads (required field)
                file_size: content.length, // Store character count as "file size"
                mime_type: 'text/plain', // Use text/plain for text content
                status: 'pending',
                // Store text content in metadata for processing
                metadata: {
                    text_content: content,
                    upload_type: 'text',
                    character_count: content.length
                }
            })
            .select()
            .single();

        if (dbError) {
            console.error('❌ Database insert failed:', dbError);
            return res.status(500).json({
                success: false,
                error: `Database error: ${dbError.message}`
            });
        }

        const user_document_id = userDoc.id;
        console.log(`✅ Database record created: ${user_document_id}`);

        // 6. Check concurrency limit - queue if at capacity instead of rejecting
        const capacityError = checkCapacity();
        if (capacityError) {
            console.log(`📥 Queueing text upload processing request for document ${user_document_id} (capacity full)`);
            
            // Determine processing method (Edge Function vs VPS)
            const useEdgeFunction = shouldUseEdgeFunction(0); // 0 bytes since no file download
            
            // Set status to pending
            await userSupabase
                .from('user_documents')
                .update({ 
                    status: 'pending',
                    processing_method: useEdgeFunction ? 'edge_function' : 'vps',
                    updated_at: new Date().toISOString()
                })
                .eq('id', user_document_id);
            
            // Create processing function wrapper
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
                    .select('processing_method')
                    .eq('id', userDocId)
                    .single();
                
                if (useEdgeFunction && doc?.processing_method === 'edge_function') {
                    // Try Edge Function with fallback
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
                    textLength: content.length,
                    token: token
                }
            });
            
            return res.status(202).json({
                success: true,
                message: 'Text uploaded and queued for processing',
                user_document_id,
                status: 'pending',
                queue: queueInfo
            });
        }

        // 7. Determine processing method (Edge Function vs VPS)
        // For text, we can use Edge Functions since there's no file download needed
        const useEdgeFunction = shouldUseEdgeFunction(0); // 0 bytes since no file download
        console.log(`🔧 Processing method: ${useEdgeFunction ? 'Edge Function' : 'VPS'}`);

        // 8. Update status to processing
        await userSupabase
            .from('user_documents')
            .update({
                status: 'processing',
                processing_method: useEdgeFunction ? 'edge_function' : 'vps'
            })
            .eq('id', user_document_id);

        // 9. Trigger processing (fire and forget)
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
            message: 'Text uploaded and processing started',
            user_document_id,
            status: 'processing',
            method: useEdgeFunction ? 'edge_function' : 'vps',
            character_count: content.length
        });

    } catch (error) {
        console.error('❌ Upload text handler error:', error);
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
    handleUploadText
};
