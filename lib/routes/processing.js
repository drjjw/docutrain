/**
 * Processing routes
 * Handles document processing (chunking and embedding) for user-uploaded PDFs
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');

// Import handlers
const { handleProcessDocument } = require('../handlers/process-document-handler');
const { handleRetrainDocument, handleRetrainDocumentText } = require('../handlers/retrain-document-handler');
const { handleUploadDocument } = require('../handlers/upload-document-handler');
const { handleUploadText } = require('../handlers/upload-text-handler');
const {
    handleProcessingStatus,
    handleUserDocuments,
    handleDocumentDownloadUrl,
    handleLogOperationDeletion
} = require('../handlers/document-query-handlers');

// Configure multer for file uploads (store in memory)
// Support 200MB uploads (matches Supabase bucket limit)
const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: MAX_FILE_SIZE
    },
    fileFilter: (req, file, cb) => {
        // Get file extension as fallback for MIME type detection
        // Handle filenames with or without extensions, and multiple dots
        const lastDotIndex = file.originalname.lastIndexOf('.');
        const fileExtension = lastDotIndex > 0 && lastDotIndex < file.originalname.length - 1
            ? file.originalname.substring(lastDotIndex + 1).toLowerCase().trim()
            : null;
        const audioExtensions = ['mp3', 'wav', 'm4a', 'ogg', 'flac', 'aac'];
        const audioMimeTypes = [
            'audio/mpeg', 
            'audio/wav', 
            'audio/x-m4a', 
            'audio/m4a', 
            'audio/mp4', // Some systems use this for m4a files
            'audio/ogg', 
            'audio/flac', 
            'audio/aac',
            'audio/x-aac' // Alternative AAC MIME type
        ];
        
        // Normalize MIME type (handle null/undefined/empty)
        const mimetype = file.mimetype ? file.mimetype.trim() : '';
        
        // Accept PDF files
        if (mimetype === 'application/pdf' || fileExtension === 'pdf') {
            console.log('[fileFilter] Accepted PDF:', { name: file.originalname, mimetype, extension: fileExtension });
            cb(null, true);
            return;
        }
        
        // Accept audio files (check MIME type, MIME type prefix, and extension)
        if ((mimetype && mimetype.startsWith('audio/')) || 
            (mimetype && audioMimeTypes.includes(mimetype)) ||
            (fileExtension && audioExtensions.includes(fileExtension))) {
            console.log('[fileFilter] Accepted audio:', { name: file.originalname, mimetype, extension: fileExtension });
            cb(null, true);
            return;
        }
        
        // Log for debugging
        console.log('[fileFilter] Rejected file:', {
            name: file.originalname,
            mimetype: file.mimetype,
            mimetypeNormalized: mimetype,
            extension: fileExtension
        });
        cb(new Error('Only PDF and audio files (MP3, WAV, M4A, OGG, FLAC, AAC) are allowed'));
    }
});

/**
 * Create processing router
 */
function createProcessingRouter(supabase, openaiClient, groqClient = null) {
    /**
     * POST /api/upload-document
     * Upload a document file directly to the backend (bypasses Supabase client 50MB limit)
     * This endpoint handles both upload to storage AND triggering processing
     */
    router.post('/upload-document', upload.single('file'), (req, res, next) => {
        // Pass to handler - multer errors will be caught by error handler below
        handleUploadDocument(req, res, supabase, openaiClient, groqClient).catch(next);
    });

    /**
     * POST /api/upload-text
     * Upload text content directly for training (bypasses PDF extraction)
     * This endpoint handles text input AND triggering processing
     */
    router.post('/upload-text', (req, res, next) => {
        handleUploadText(req, res, supabase, openaiClient, groqClient).catch(next);
    });

    /**
     * POST /api/process-document
     * Trigger processing for a user-uploaded document (legacy endpoint for already-uploaded files)
     */
    router.post('/process-document', (req, res) => {
        handleProcessDocument(req, res, supabase, openaiClient, groqClient);
    });

    /**
     * GET /api/processing-status/:user_document_id
     * Get processing status and logs for a document
     */
    router.get('/processing-status/:user_document_id', (req, res) => {
        handleProcessingStatus(req, res, supabase);
    });

    /**
     * POST /api/log-operation-deletion
     * Log when an operation is deleted/stopped in the UI progress queue
     */
    router.post('/log-operation-deletion', (req, res) => {
        handleLogOperationDeletion(req, res, supabase);
    });

    /**
     * GET /api/user-documents
     * Get all documents for the authenticated user
     */
    router.get('/user-documents', async (req, res, next) => {
        try {
            await handleUserDocuments(req, res, supabase);
        } catch (error) {
            console.error('[processing-router] ❌ Error in user-documents route:', error);
            console.error('[processing-router] ❌ Error stack:', error.stack);
            if (!res.headersSent) {
                return res.status(500).json({
                    success: false,
                    error: error.message || 'Internal server error',
                    code: error.code || null,
                    details: error.details || null,
                    hint: error.hint || null
                });
            }
            next(error);
        }
    });

    /**
     * POST /api/retrain-document
     * Retrain an existing document with a new PDF
     * Replaces all chunks while preserving document metadata and slug
     */
    router.post('/retrain-document', upload.single('file'), (req, res, next) => {
        handleRetrainDocument(req, res, supabase, openaiClient, groqClient).catch(next);
    });

    /**
     * POST /api/retrain-document-text
     * Retrain an existing document with new text content
     * Replaces all chunks while preserving document metadata and slug
     */
    router.post('/retrain-document-text', (req, res, next) => {
        handleRetrainDocumentText(req, res, supabase, openaiClient, groqClient).catch(next);
    });

    /**
     * GET /api/document-download-url/:documentId
     * Generate a signed URL for downloading the original training PDF
     * (NOT the supplementary downloads in the downloads field)
     */
    router.get('/document-download-url/:documentId', (req, res) => {
        handleDocumentDownloadUrl(req, res, supabase);
    });

    // Error handler for multer upload errors (e.g., file too large)
    // Must be after all routes but before returning router
    router.use((err, req, res, next) => {
        console.error('[processing-router] ❌ Unhandled error:', err);
        console.error('[processing-router] ❌ Error stack:', err.stack);
        
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({
                    success: false,
                    error: `File too large. Maximum size is 200MB.`
                });
            }
            return res.status(400).json({
                success: false,
                error: `Upload error: ${err.message}`
            });
        }
        if (err) {
            // Ensure we send a proper JSON response
            if (!res.headersSent) {
                return res.status(err.status || 500).json({
                    success: false,
                    error: err.message || 'Internal server error',
                    code: err.code || null,
                    details: err.details || null,
                    hint: err.hint || null
                });
            }
        }
        next();
    });

    return router;
}

module.exports = {
    createProcessingRouter
};
