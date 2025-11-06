/**
 * Job Queue Manager
 * Queues document processing jobs when capacity is full instead of rejecting with 503
 * Automatically processes queued jobs when capacity becomes available
 */

const { getProcessingLoad, incrementJobs, decrementJobs, checkCapacity } = require('./concurrency-manager');

/**
 * Job queue - stores pending processing jobs
 * Format: { userDocId, supabase, openaiClient, processingFunction, metadata }
 */
const jobQueue = [];
let isProcessingQueue = false;

/**
 * Add a job to the queue
 * 
 * @param {Object} job - Job object with userDocId, supabase, openaiClient, processingFunction, metadata
 * @returns {Object} Queue information
 */
function enqueueJob(job) {
    const { userDocId, supabase, openaiClient, processingFunction, metadata = {} } = job;
    
    if (!userDocId || !supabase || !openaiClient || !processingFunction) {
        throw new Error('Job must have userDocId, supabase, openaiClient, and processingFunction');
    }
    
    jobQueue.push({
        userDocId,
        supabase,
        openaiClient,
        processingFunction,
        metadata,
        enqueuedAt: Date.now()
    });
    
    const queueInfo = {
        queued: true,
        queuePosition: jobQueue.length,
        estimatedWaitTime: estimateWaitTime(jobQueue.length),
        load: getProcessingLoad()
    };
    
    console.log(`📥 Job queued: ${userDocId} (position: ${queueInfo.queuePosition}, estimated wait: ${queueInfo.estimatedWaitTime}s)`);
    
    // Try to process queue if not already processing
    processQueueIfAvailable();
    
    return queueInfo;
}

/**
 * Estimate wait time based on queue position and current load
 * 
 * @param {number} queuePosition - Position in queue
 * @returns {number} Estimated wait time in seconds
 */
function estimateWaitTime(queuePosition) {
    const load = getProcessingLoad();
    const avgProcessingTime = 5 * 60; // 5 minutes average (conservative estimate)
    
    // If there's available capacity, wait time is minimal
    if (load.available > 0) {
        return Math.max(10, queuePosition * 30); // 30 seconds per position, min 10s
    }
    
    // If at capacity, estimate based on queue position and average processing time
    // Assume jobs complete roughly in order, so wait for current jobs + queue position
    const currentJobsRemaining = Math.ceil(avgProcessingTime / 2); // Assume halfway through
    const totalWait = (currentJobsRemaining + queuePosition) * (avgProcessingTime / load.max);
    
    return Math.min(totalWait, 30 * 60); // Cap at 30 minutes
}

/**
 * Process queue if capacity is available
 * This is called automatically when:
 * - A new job is enqueued
 * - A processing job completes (via processNextJob)
 */
async function processQueueIfAvailable() {
    // Prevent concurrent queue processing
    if (isProcessingQueue) {
        return;
    }
    
    // Check if we have capacity and queued jobs
    const capacityError = checkCapacity();
    if (capacityError || jobQueue.length === 0) {
        return;
    }
    
    isProcessingQueue = true;
    
    try {
        // Process next job in queue
        await processNextJob();
    } catch (error) {
        console.error('❌ Error processing queue:', error);
    } finally {
        isProcessingQueue = false;
        
        // If there are more jobs and capacity, process again
        if (jobQueue.length > 0) {
            const stillHasCapacity = !checkCapacity();
            if (stillHasCapacity) {
                // Use setImmediate to avoid stack overflow
                setImmediate(() => processQueueIfAvailable());
            }
        }
    }
}

/**
 * Process the next job in the queue
 */
async function processNextJob() {
    if (jobQueue.length === 0) {
        return;
    }
    
    const capacityError = checkCapacity();
    if (capacityError) {
        // No capacity available, wait for a job to complete
        return;
    }
    
    // Get next job from queue (FIFO)
    const job = jobQueue.shift();
    const { userDocId, supabase, openaiClient, processingFunction, metadata, enqueuedAt } = job;
    
    const waitTime = ((Date.now() - enqueuedAt) / 1000).toFixed(1);
    console.log(`🔄 Processing queued job: ${userDocId} (waited ${waitTime}s, ${jobQueue.length} remaining in queue)`);
    
    // Increment active job counter
    const activeJobs = incrementJobs();
    
    // Update status to processing
    try {
        await supabase
            .from('user_documents')
            .update({
                status: 'processing',
                updated_at: new Date().toISOString()
            })
            .eq('id', userDocId);
    } catch (error) {
        console.error(`⚠️ Failed to update status to processing for ${userDocId}:`, error);
    }
    
    // Execute processing function (pass metadata as 4th parameter)
    processingFunction(userDocId, supabase, openaiClient, metadata)
        .then(result => {
            console.log(`✅ Queued job completed: ${userDocId}`, result);
        })
        .catch(error => {
            console.error(`❌ Queued job failed: ${userDocId}:`, error);
        })
        .finally(() => {
            // Decrement counter when processing completes
            const activeJobs = decrementJobs();
            
            // Process next job in queue if available
            setImmediate(() => processQueueIfAvailable());
        });
}

/**
 * Get queue status
 * 
 * @returns {Object} Queue status information
 */
function getQueueStatus() {
    return {
        queueLength: jobQueue.length,
        isProcessing: isProcessingQueue,
        load: getProcessingLoad(),
        queuedJobs: jobQueue.map(job => ({
            userDocId: job.userDocId,
            enqueuedAt: job.enqueuedAt,
            waitTime: ((Date.now() - job.enqueuedAt) / 1000).toFixed(1)
        }))
    };
}

/**
 * Clear queue (for testing/admin purposes)
 */
function clearQueue() {
    const cleared = jobQueue.length;
    jobQueue.length = 0;
    console.log(`🧹 Queue cleared: ${cleared} jobs removed`);
    return cleared;
}

module.exports = {
    enqueueJob,
    processQueueIfAvailable,
    getQueueStatus,
    clearQueue
};
