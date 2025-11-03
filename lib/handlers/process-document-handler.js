/**
 * Handler for POST /api/process-document
 * Triggers processing for a user-uploaded document
 */

const { authenticateUser, createUserSupabaseClient } = require('../utils/processing-auth');
const { getProcessingLoad, incrementJobs, decrementJobs, checkCapacity } = require('../utils/concurrency-manager');
const { callEdgeFunction, shouldUseEdgeFunction, USE_EDGE_FUNCTIONS, EDGE_FUNCTION_MAX_FILE_SIZE } = require('../utils/edge-function-client');
const { processUserDocument, setActiveProcessingCount } = require('../document-processor');

/**
 * Handle document processing request
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} supabase - Supabase client
 * @param {Object} openaiClient - OpenAI client
 */
async function handleProcessDocument(req, res, supabase, openaiClient) {
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
        const userSupabase = createUserSupabaseClient(authHeader);

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
            // Check if this is a force retry request (document stuck for >5 minutes)
            const updatedAt = new Date(userDoc.updated_at);
            const now = new Date();
            const minutesSinceUpdate = (now - updatedAt) / 1000 / 60;
            
            if (minutesSinceUpdate > 5) {
                // Document is stuck - allow force retry by resetting to pending
                console.log(`⚠️  Document stuck in processing for ${minutesSinceUpdate.toFixed(1)} minutes - allowing force retry`);
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
                
                console.log('✅ Document reset to pending - proceeding with processing');
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

        // Check concurrency limit
        const capacityError = checkCapacity();
        if (capacityError) {
            console.warn(`   Rejecting new processing request for document ${user_document_id}`);
            return res.status(capacityError.status).json(capacityError.json);
        }

        const loadInfo = getProcessingLoad();
        console.log(`🔄 Starting processing for document ${user_document_id} (user: ${user.email})`);
        console.log(`📊 Processing load: ${loadInfo.active}/${loadInfo.max} (${loadInfo.utilizationPercent}% utilized)`);

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
                })
                .finally(() => {
                    // Decrement counter when processing completes (success or failure)
                    const activeJobs = decrementJobs();
                    setActiveProcessingCount(activeJobs); // Update document-processor for adaptive delays
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

            console.log(`📦 Using VPS processing (pdf.js-extract library)`);
            
            // Start processing asynchronously (don't wait for completion)
            // Use the authenticated Supabase client so RLS policies allow access
            processUserDocument(user_document_id, userSupabase, openaiClient)
                .then(result => {
                    console.log(`✅ VPS Processing complete for ${user_document_id}:`, result);
                })
                .catch(error => {
                    console.error(`❌ VPS Processing failed for ${user_document_id}:`, error);
                })
                .finally(() => {
                    // Decrement counter when processing completes (success or failure)
                    const activeJobs = decrementJobs();
                    setActiveProcessingCount(activeJobs); // Update document-processor for adaptive delays
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
}

module.exports = {
    handleProcessDocument
};
