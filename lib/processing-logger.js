/**
 * Processing Logger
 * Provides dual logging (file + database) for document processing operations
 */

const fs = require('fs');
const path = require('path');

// Ensure logs directory exists
const LOGS_DIR = path.join(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOGS_DIR, 'document-processing.log');

if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
}

/**
 * Log stages for document processing
 */
const STAGES = {
    DOWNLOAD: 'download',
    EXTRACT: 'extract',
    TRANSCRIBE: 'transcribe',
    CHUNK: 'chunk',
    EMBED: 'embed',
    STORE: 'store',
    COMPLETE: 'complete',
    QUIZ: 'quiz',
    ERROR: 'error'
};

/**
 * Log statuses
 */
const STATUSES = {
    STARTED: 'started',
    PROGRESS: 'progress',
    COMPLETED: 'completed',
    FAILED: 'failed'
};

/**
 * Format log message for file
 */
function formatFileLog(userDocId, stage, status, message, metadata = {}) {
    const timestamp = new Date().toISOString();
    const metaStr = Object.keys(metadata).length > 0 ? ` | ${JSON.stringify(metadata)}` : '';
    return `[${timestamp}] [${userDocId}] [${stage}:${status}] ${message}${metaStr}\n`;
}

/**
 * Write to log file
 */
function writeToFile(logMessage) {
    try {
        fs.appendFileSync(LOG_FILE, logMessage, 'utf8');
    } catch (error) {
        console.error('Failed to write to log file:', error);
    }
}

/**
 * Write to database
 */
async function writeToDatabase(supabase, userDocId, documentSlug, stage, status, message, metadata = {}, processingMethod = 'vps') {
    try {
        if (!supabase) {
            console.error(`[Processing Logger] No supabase client provided for ${stage}:${status}`);
            return;
        }
        
        const { data, error } = await supabase
            .from('document_processing_logs')
            .insert({
                user_document_id: userDocId,
                document_slug: documentSlug,
                stage,
                status,
                message,
                metadata,
                processing_method: processingMethod
            })
            .select();

        if (error) {
            console.error(`[Processing Logger] Failed to write to database log (${stage}:${status}):`, error);
            console.error(`[Processing Logger] Error details:`, {
                code: error.code,
                message: error.message,
                details: error.details,
                hint: error.hint
            });
            // Log batch info for embed progress errors
            if (stage === STAGES.EMBED && status === STATUSES.PROGRESS && metadata.batch) {
                console.error(`[Processing Logger] Failed batch log: batch ${metadata.batch}/${metadata.total_batches}`);
            }
        } else {
            // Debug: Log successful writes for important stages
            if (status === STATUSES.COMPLETED || status === STATUSES.FAILED) {
                console.debug(`[Processing Logger] ✅ Successfully wrote ${stage}:${status} log`);
            }
        }
    } catch (error) {
        console.error(`[Processing Logger] Exception writing to database log (${stage}:${status}):`, error);
        console.error(`[Processing Logger] Exception details:`, {
            message: error.message,
            stack: error.stack
        });
        if (stage === STAGES.EMBED && status === STATUSES.PROGRESS && metadata.batch) {
            console.error(`[Processing Logger] Exception for batch log: batch ${metadata.batch}/${metadata.total_batches}`);
        }
    }
}

/**
 * Main logging function - writes to both file and database
 */
async function log(supabase, userDocId, documentSlug, stage, status, message, metadata = {}, processingMethod = 'vps') {
    // Always write to file
    const fileLog = formatFileLog(userDocId, stage, status, message, metadata);
    writeToFile(fileLog);
    
    // Also log to console for real-time monitoring
    console.log(`[Processing ${userDocId}] [${processingMethod}] ${stage}:${status} - ${message}`);
    
    // Write to database
    // For progress logs (especially batch progress), we await to ensure UI gets updates
    // For other logs, we can fire-and-forget to avoid slowing down processing
    if (supabase) {
        if (status === STATUSES.PROGRESS && stage === STAGES.EMBED) {
            // Await embed progress logs so UI can see accurate batch progress
            try {
                await writeToDatabase(supabase, userDocId, documentSlug, stage, status, message, metadata, processingMethod);
            } catch (err) {
                console.error('Database logging failed for embed progress:', err);
            }
        } else {
            // For important stages (completed, failed), await to ensure they're written
            // For other logs, fire-and-forget but log errors
            if (status === STATUSES.COMPLETED || status === STATUSES.FAILED) {
                try {
                    await writeToDatabase(supabase, userDocId, documentSlug, stage, status, message, metadata, processingMethod);
                } catch (err) {
                    console.error(`[Processing Logger] CRITICAL: Failed to write ${stage}:${status} log:`, err);
                }
            } else {
                // Fire-and-forget for other logs to avoid slowing down processing
                writeToDatabase(supabase, userDocId, documentSlug, stage, status, message, metadata, processingMethod).catch(err => {
                    console.error(`[Processing Logger] Failed to write ${stage}:${status} log:`, err);
                });
            }
        }
    }
}

/**
 * Convenience methods for common log patterns
 */
const logger = {
    STAGES,
    STATUSES,
    
    async started(supabase, userDocId, stage, message, metadata, processingMethod = 'vps') {
        await log(supabase, userDocId, null, stage, STATUSES.STARTED, message, metadata, processingMethod);
    },
    
    async progress(supabase, userDocId, documentSlug, stage, message, metadata, processingMethod = 'vps') {
        await log(supabase, userDocId, documentSlug, stage, STATUSES.PROGRESS, message, metadata, processingMethod);
    },
    
    async completed(supabase, userDocId, documentSlug, stage, message, metadata, processingMethod = 'vps') {
        await log(supabase, userDocId, documentSlug, stage, STATUSES.COMPLETED, message, metadata, processingMethod);
    },
    
    async failed(supabase, userDocId, documentSlug, stage, message, metadata, processingMethod = 'vps') {
        await log(supabase, userDocId, documentSlug, stage, STATUSES.FAILED, message, metadata, processingMethod);
    },
    
    async error(supabase, userDocId, documentSlug, message, error, metadata = {}, processingMethod = 'vps') {
        const errorMeta = {
            ...metadata,
            error: error.message,
            stack: error.stack
        };
        await log(supabase, userDocId, documentSlug, STAGES.ERROR, STATUSES.FAILED, message, errorMeta, processingMethod);
    }
};

module.exports = logger;

