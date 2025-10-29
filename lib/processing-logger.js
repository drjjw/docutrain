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
    CHUNK: 'chunk',
    EMBED: 'embed',
    STORE: 'store',
    COMPLETE: 'complete',
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
async function writeToDatabase(supabase, userDocId, documentSlug, stage, status, message, metadata = {}) {
    try {
        const { error } = await supabase
            .from('document_processing_logs')
            .insert({
                user_document_id: userDocId,
                document_slug: documentSlug,
                stage,
                status,
                message,
                metadata
            });

        if (error) {
            console.error('Failed to write to database log:', error);
        }
    } catch (error) {
        console.error('Exception writing to database log:', error);
    }
}

/**
 * Main logging function - writes to both file and database
 */
async function log(supabase, userDocId, documentSlug, stage, status, message, metadata = {}) {
    // Always write to file
    const fileLog = formatFileLog(userDocId, stage, status, message, metadata);
    writeToFile(fileLog);
    
    // Also log to console for real-time monitoring
    console.log(`[Processing ${userDocId}] ${stage}:${status} - ${message}`);
    
    // Write to database (async, don't wait)
    if (supabase) {
        writeToDatabase(supabase, userDocId, documentSlug, stage, status, message, metadata).catch(err => {
            console.error('Database logging failed:', err);
        });
    }
}

/**
 * Convenience methods for common log patterns
 */
const logger = {
    STAGES,
    STATUSES,
    
    async started(supabase, userDocId, stage, message, metadata) {
        await log(supabase, userDocId, null, stage, STATUSES.STARTED, message, metadata);
    },
    
    async progress(supabase, userDocId, documentSlug, stage, message, metadata) {
        await log(supabase, userDocId, documentSlug, stage, STATUSES.PROGRESS, message, metadata);
    },
    
    async completed(supabase, userDocId, documentSlug, stage, message, metadata) {
        await log(supabase, userDocId, documentSlug, stage, STATUSES.COMPLETED, message, metadata);
    },
    
    async failed(supabase, userDocId, documentSlug, stage, message, metadata) {
        await log(supabase, userDocId, documentSlug, stage, STATUSES.FAILED, message, metadata);
    },
    
    async error(supabase, userDocId, documentSlug, message, error, metadata = {}) {
        const errorMeta = {
            ...metadata,
            error: error.message,
            stack: error.stack
        };
        await log(supabase, userDocId, documentSlug, STAGES.ERROR, STATUSES.FAILED, message, errorMeta);
    }
};

module.exports = logger;

