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
    handleDocumentDownloadUrl
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
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed'));
        }
    }
});

/**
 * Create processing router
 */
function createProcessingRouter(supabase, openaiClient) {
    /**
     * POST /api/upload-document
     * Upload a document file directly to the backend (bypasses Supabase client 50MB limit)
     * This endpoint handles both upload to storage AND triggering processing
     */
    router.post('/upload-document', upload.single('file'), (req, res, next) => {
        // Pass to handler - multer errors will be caught by error handler below
        handleUploadDocument(req, res, supabase, openaiClient).catch(next);
    });

    /**
     * POST /api/upload-text
     * Upload text content directly for training (bypasses PDF extraction)
     * This endpoint handles text input AND triggering processing
     */
    router.post('/upload-text', (req, res, next) => {
        handleUploadText(req, res, supabase, openaiClient).catch(next);
    });

    /**
     * POST /api/process-document
     * Trigger processing for a user-uploaded document (legacy endpoint for already-uploaded files)
     */
    router.post('/process-document', (req, res) => {
        handleProcessDocument(req, res, supabase, openaiClient);
    });

    /**
     * GET /api/processing-status/:user_document_id
     * Get processing status and logs for a document
     */
    router.get('/processing-status/:user_document_id', (req, res) => {
        handleProcessingStatus(req, res, supabase);
    });

    /**
     * GET /api/user-documents
     * Get all documents for the authenticated user
     */
    router.get('/user-documents', (req, res, next) => {
        handleUserDocuments(req, res, supabase).catch(next);
    });

    /**
     * POST /api/retrain-document
     * Retrain an existing document with a new PDF
     * Replaces all chunks while preserving document metadata and slug
     */
    router.post('/retrain-document', upload.single('file'), (req, res, next) => {
        handleRetrainDocument(req, res, supabase, openaiClient).catch(next);
    });

    /**
     * POST /api/retrain-document-text
     * Retrain an existing document with new text content
     * Replaces all chunks while preserving document metadata and slug
     */
    router.post('/retrain-document-text', (req, res) => {
        handleRetrainDocumentText(req, res, supabase, openaiClient);
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
            return res.status(400).json({
                success: false,
                error: err.message || 'Upload error'
            });
        }
        next();
    });

    return router;
}

module.exports = {
    createProcessingRouter
};
