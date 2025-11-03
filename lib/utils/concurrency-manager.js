/**
 * Concurrency control for document processing
 * Limits simultaneous processing jobs to prevent OpenAI rate limits
 */

/**
 * Configuration: Maximum concurrent processing jobs
 * Adjust based on your OpenAI tier and expected load
 */
const MAX_CONCURRENT_PROCESSING = parseInt(process.env.MAX_CONCURRENT_PROCESSING) || 5;

/**
 * Active processing jobs counter
 * Tracks how many documents are currently being processed
 */
let activeProcessingJobs = 0;

/**
 * Get current processing load information
 * 
 * @returns {Object} Load information with active, max, available, and utilization percentage
 */
function getProcessingLoad() {
    return {
        active: activeProcessingJobs,
        max: MAX_CONCURRENT_PROCESSING,
        available: Math.max(0, MAX_CONCURRENT_PROCESSING - activeProcessingJobs),
        utilizationPercent: Math.round((activeProcessingJobs / MAX_CONCURRENT_PROCESSING) * 100)
    };
}

/**
 * Increment active processing jobs counter
 * Call when starting a new processing job
 * 
 * @returns {number} New active job count
 */
function incrementJobs() {
    activeProcessingJobs++;
    console.log(`📈 Active processing jobs: ${activeProcessingJobs}/${MAX_CONCURRENT_PROCESSING}`);
    return activeProcessingJobs;
}

/**
 * Decrement active processing jobs counter
 * Call when a processing job completes (success or failure)
 * 
 * @returns {number} New active job count
 */
function decrementJobs() {
    activeProcessingJobs--;
    console.log(`📉 Active processing jobs: ${activeProcessingJobs}/${MAX_CONCURRENT_PROCESSING}`);
    return activeProcessingJobs;
}

/**
 * Check if server has capacity for new processing jobs
 * Returns error response object if at capacity
 * 
 * @returns {Object|null} Error response object if at capacity, null if capacity available
 */
function checkCapacity() {
    const loadInfo = getProcessingLoad();
    
    if (activeProcessingJobs >= MAX_CONCURRENT_PROCESSING) {
        console.warn(`⚠️  Processing limit reached (${activeProcessingJobs}/${MAX_CONCURRENT_PROCESSING})`);
        return {
            status: 503,
            json: {
                success: false,
                error: 'Server is currently processing the maximum number of documents. Please try again in a moment.',
                retry_after: 30,
                load: loadInfo
            }
        };
    }
    
    return null;
}

/**
 * Get current active job count
 * 
 * @returns {number} Current active processing jobs
 */
function getActiveJobCount() {
    return activeProcessingJobs;
}

module.exports = {
    getProcessingLoad,
    incrementJobs,
    decrementJobs,
    checkCapacity,
    getActiveJobCount
};



