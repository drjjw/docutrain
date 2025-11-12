/**
 * Handler for POST /api/process-document
 * Triggers processing for a user-uploaded document
 */

const { authenticateUser, createUserSupabaseClient } = require('../utils/processing-auth');
const { getProcessingLoad, incrementJobs, decrementJobs, checkCapacity } = require('../utils/concurrency-manager');
const { callEdgeFunction, shouldUseEdgeFunction, USE_EDGE_FUNCTIONS, EDGE_FUNCTION_MAX_FILE_SIZE } = require('../utils/edge-function-client');
const { processUserDocument, setActiveProcessingCount } = require('../document-processor');
const { enqueueJob } = require('../utils/job-queue');
const { debugLog } = require('../utils/debug');

/**
 * Handle document processing request
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} supabase - Supabase client
 * @param {Object} openaiClient - OpenAI client
 */
async function handleProcessDocument(req, res, supabase, openaiClient, groqClient = null) {
    debugLog('🔵 POST /api/process-document - Request received');
    debugLog('   URL:', req.url);
    debugLog('   Method:', req.method);
    debugLog('   Headers:', req.headers);
    debugLog('   Body:', req.body);
    debugLog('✅ About to process request...');
    
    try {
        debugLog('✅ Inside try block');
        const { user_document_id } = req.body;
        debugLog('✅ Extracted user_document_id:', user_document_id);

        if (!user_document_id) {
            debugLog('❌ Missing user_document_id - Sending 400');
            const response = {
                success: false,
                error: 'user_document_id is required'
            };
            debugLog('   Response:', response);
            return res.status(400).json(response);
        }

        debugLog('✅ user_document_id check passed');
        
        // Get authenticated user
        debugLog('✅ Checking auth header...');
        const authHeader = req.headers.authorization;
        debugLog('✅ Auth header:', authHeader ? 'Present' : 'Missing');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            debugLog('❌ Auth header missing or invalid - Sending 401');
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }

        debugLog('✅ Extracting token...');
        const token = authHeader.split(' ')[1];
        debugLog('✅ Token extracted, calling Supabase auth...');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        debugLog('✅ Supabase auth response received. User:', user ? user.email : 'null', 'Error:', authError ? authError.message : 'none');

        if (authError || !user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid authentication token'
            });
        }

        // Create authenticated Supabase client for this user
        debugLog('✅ Creating authenticated Supabase client...');
        const userSupabase = createUserSupabaseClient(authHeader);

        // Verify user owns this document
        debugLog('✅ Checking if user owns document...');
        debugLog('   Looking for document_id:', user_document_id);
        debugLog('   For user_id:', user.id);
        
        const { data: userDoc, error: fetchError } = await userSupabase
            .from('user_documents')
            .select('*')
            .eq('id', user_document_id)
            .eq('user_id', user.id)
            .single();

        debugLog('✅ Document lookup complete');
        debugLog('   Found document:', userDoc ? 'YES' : 'NO');
        debugLog('   Error:', fetchError ? fetchError.message : 'none');
        
        if (fetchError || !userDoc) {
            debugLog('❌ Document not found or access denied - Sending 404');
            debugLog('   This is the 404 the browser is seeing!');
            return res.status(404).json({
                success: false,
                error: 'Document not found or access denied'
            });
        }
        
        debugLog('✅ Document ownership verified!');

        // Check if document is already being processed or ready
        if (userDoc.status === 'processing') {
            // Check if this is a force retry request (document stuck for >5 minutes)
            const updatedAt = new Date(userDoc.updated_at);
            const now = new Date();
            const minutesSinceUpdate = (now - updatedAt) / 1000 / 60;
            
            if (minutesSinceUpdate > 5) {
                // Document is stuck - allow force retry by resetting to pending
                debugLog(`⚠️  Document stuck in processing for ${minutesSinceUpdate.toFixed(1)} minutes - allowing force retry`);
                const { error: resetError } = await userSupabase
                    .from('user_documents')
                    .update({ 
                        status: 'pending',
                        error_message: `Processing stalled - reset by user after ${minutesSinceUpdate.toFixed(1)} minutes`,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', user_document_id);
                
                if (resetError) {
                    console.error('Failed to reset stuck document:', resetError);
                    return res.status(500).json({
                        success: false,
                        error: 'Failed to reset stuck document'
                    });
                }
                
                debugLog('✅ Document reset to pending - proceeding with processing');
            } else {
                // Document is actively processing (updated recently)
                return res.status(409).json({
                    success: false,
                    error: 'Document is currently being processed. Please wait or try again in a few minutes.'
                });
            }
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

        // Check concurrency limit - queue if at capacity instead of rejecting
        debugLog(`🔍 Checking capacity for document ${user_document_id} (queue system active)`);
        const capacityError = checkCapacity();
        if (capacityError) {
            debugLog(`📥 Queueing processing request for document ${user_document_id} (capacity full)`);
            
            // Set status to pending if not already
            await userSupabase
                .from('user_documents')
                .update({ 
                    status: 'pending',
                    updated_at: new Date().toISOString()
                })
                .eq('id', user_document_id);
            
            // Queue the job
            const queueInfo = enqueueJob({
                userDocId: user_document_id,
                supabase: userSupabase,
                openaiClient: openaiClient,
                processingFunction: async (userDocId, supabaseClient, openaiClientInstance, jobMetadata) => {
                    // Use service role key for processing to avoid JWT expiration
                    const { createClient } = require('@supabase/supabase-js');
                    const serviceSupabase = createClient(
                        process.env.SUPABASE_URL,
                        process.env.SUPABASE_SERVICE_ROLE_KEY
                    );
                    return await processUserDocument(userDocId, serviceSupabase, openaiClientInstance, groqClient);
                },
                metadata: { userEmail: user.email }
            });
            
            return res.status(202).json({
                success: true,
                message: 'Document queued for processing',
                user_document_id,
                status: 'pending',
                queue: queueInfo
            });
        }

        const loadInfo = getProcessingLoad();
        debugLog(`🔄 Starting immediate processing for document ${user_document_id} (user: ${user.email})`);
        debugLog(`📊 Processing load: ${loadInfo.active}/${loadInfo.max} (${loadInfo.utilizationPercent}% utilized)`);

        // Try Edge Function first if enabled, otherwise use VPS processing
        let processingMethod = 'vps';
        let edgeFunctionAttempted = false;
        let processingDestination = 'VPS'; // For logging

        // Check file size - Edge Functions have CPU/resource limits
        // Large documents should use VPS to avoid WORKER_LIMIT errors
        const fileSize = userDoc.file_size || 0;
        const useEdgeFunction = shouldUseEdgeFunction(fileSize);

        if (useEdgeFunction) {
            edgeFunctionAttempted = true;
            processingMethod = 'edge_function';
            processingDestination = 'Edge Function';
            debugLog(`📡 Processing destination: EDGE FUNCTION`);
            debugLog(`   Document: ${user_document_id}`);
            debugLog(`   File size: ${(fileSize / 1024 / 1024).toFixed(2)}MB`);
            debugLog(`   Reason: Edge Functions enabled and file size within limit (≤${(EDGE_FUNCTION_MAX_FILE_SIZE / 1024 / 1024).toFixed(2)}MB)`);
        } else if (USE_EDGE_FUNCTIONS && fileSize > EDGE_FUNCTION_MAX_FILE_SIZE) {
            processingDestination = 'VPS (file too large for Edge Function)';
            debugLog(`🖥️  Processing destination: VPS`);
            debugLog(`   Document: ${user_document_id}`);
            debugLog(`   File size: ${(fileSize / 1024 / 1024).toFixed(2)}MB`);
            debugLog(`   Reason: Document exceeds Edge Function size limit (${(fileSize / 1024 / 1024).toFixed(2)}MB > ${(EDGE_FUNCTION_MAX_FILE_SIZE / 1024 / 1024).toFixed(2)}MB)`);
        } else if (!USE_EDGE_FUNCTIONS) {
            processingDestination = 'VPS (Edge Functions disabled)';
            debugLog(`🖥️  Processing destination: VPS`);
            debugLog(`   Document: ${user_document_id}`);
            debugLog(`   File size: ${(fileSize / 1024 / 1024).toFixed(2)}MB`);
            debugLog(`   Reason: Edge Functions disabled in configuration (USE_EDGE_FUNCTIONS=false or unset)`);
        } else {
            processingDestination = 'VPS';
            debugLog(`🖥️  Processing destination: VPS`);
            debugLog(`   Document: ${user_document_id}`);
            debugLog(`   File size: ${(fileSize / 1024 / 1024).toFixed(2)}MB`);
        }

        if (useEdgeFunction) {
            
            // Increment active job counter
            const activeJobs = incrementJobs();
            setActiveProcessingCount(activeJobs); // Update document-processor for adaptive delays
            
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
                    debugLog(`✅ Status updated to processing for ${user_document_id}`);
                })
                .catch(err => {
                    console.error(`⚠️ Failed to update status to processing:`, err);
                });

            // Start Edge Function processing asynchronously (fire-and-forget)
            // This allows the API to return immediately, similar to VPS processing
            debugLog(`📡 Using Edge Function processing (pdf-parse library)`);
            callEdgeFunction(user_document_id, token)
                .then(edgeResult => {
                    if (edgeResult.success) {
                        debugLog(`✅ Edge Function processing completed for ${user_document_id}`);
                        // Edge Function already updates status to 'ready' when done
                    } else {
                        console.warn(`⚠️ Edge Function returned failure for ${user_document_id}, falling back to VPS`);
                        // Fallback to VPS processing - use service role key to avoid JWT expiration
                        const { createClient } = require('@supabase/supabase-js');
                        const serviceSupabase = createClient(
                            process.env.SUPABASE_URL,
                            process.env.SUPABASE_SERVICE_ROLE_KEY
                        );
                        processUserDocument(user_document_id, serviceSupabase, openaiClient, groqClient)
                            .then(result => {
                                debugLog(`✅ VPS Processing complete (fallback) for ${user_document_id}:`, result);
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
                            // Fallback to VPS processing - use service role key to avoid JWT expiration
                            const { createClient } = require('@supabase/supabase-js');
                            const serviceSupabase = createClient(
                                process.env.SUPABASE_URL,
                                process.env.SUPABASE_SERVICE_ROLE_KEY
                            );
                            processUserDocument(user_document_id, serviceSupabase, openaiClient, groqClient)
                                .then(result => {
                                    console.log(`✅ VPS Processing complete (fallback) for ${user_document_id}:`, result);
                                })
                                .catch(error => {
                                    console.error(`❌ VPS Processing failed (fallback) for ${user_document_id}:`, error);
                                });
                        });
                })
                .finally(() => {
                    // Decrement counter when processing completes (success or failure)
                    const activeJobs = decrementJobs();
                    setActiveProcessingCount(activeJobs); // Update document-processor for adaptive delays
                    // Trigger queue processing if jobs are waiting
                    const { processQueueIfAvailable } = require('../utils/job-queue');
                    processQueueIfAvailable();
                });

            // Return IMMEDIATELY without waiting for anything
            debugLog(`✅ Edge Function processing initiated - API returning immediately`);
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
            debugLog(`🖥️ Using VPS processing for ${user_document_id}${fallbackNote}`);
            if (edgeFunctionAttempted) {
                debugLog(`   Note: Automatically falling back to VPS after Edge Function attempt`);
            }

            // Increment active job counter
            const activeJobs = incrementJobs();
            setActiveProcessingCount(activeJobs); // Update document-processor for adaptive delays

            // Mark as VPS processing
            await userSupabase
                .from('user_documents')
                .update({
                    processing_method: 'vps',
                    updated_at: new Date().toISOString()
                })
                .eq('id', user_document_id);

            debugLog(`📦 Using VPS processing (pdf.js-extract library)`);
            
            // Start processing asynchronously (don't wait for completion)
            // Use service role key to avoid JWT expiration during long processing
            const { createClient } = require('@supabase/supabase-js');
            const serviceSupabase = createClient(
                process.env.SUPABASE_URL,
                process.env.SUPABASE_SERVICE_ROLE_KEY
            );
            processUserDocument(user_document_id, serviceSupabase, openaiClient, groqClient)
                .then(result => {
                    debugLog(`✅ VPS Processing complete for ${user_document_id}:`, result);
                })
                .catch(error => {
                    console.error(`❌ VPS Processing failed for ${user_document_id}:`, error);
                })
                .finally(() => {
                    // Decrement counter when processing completes (success or failure)
                    const activeJobs = decrementJobs();
                    setActiveProcessingCount(activeJobs); // Update document-processor for adaptive delays
                    // Trigger queue processing if jobs are waiting
                    const { processQueueIfAvailable } = require('../utils/job-queue');
                    processQueueIfAvailable();
                });

            // Return immediately with processing status
            debugLog(`✅ VPS processing initiated - API returning immediately`);
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
}

module.exports = {
    handleProcessDocument
};




