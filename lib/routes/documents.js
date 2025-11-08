/**
 * Document routes
 * Handles document registry, meta tags, and owner configurations
 */

const express = require('express');

// Import handlers
const {
    handleRootRoute,
    handleGoodbyeRoute,
    handleIndexPhpRoute,
    handlePhpCatchAll
} = require('../handlers/document-serving-handler');

const { handleGetDocuments } = require('../handlers/document-api-handler');
const { handleGetOwners } = require('../handlers/owner-api-handler');
const { handleRefreshRegistry } = require('../handlers/registry-handler');
const { handleUpdateDocument } = require('../handlers/document-update-handler');
const {
    handleGetAttachments,
    handleCreateAttachment,
    handleUpdateAttachment,
    handleDeleteAttachment,
    handleTrackDownload
} = require('../handlers/attachment-handlers');
const { handleDocumentAnalytics } = require('../handlers/analytics-handler');

/**
 * Create documents router
 */
function createDocumentsRouter(supabase, documentRegistry, registryState, escapeHtml) {
    const router = express.Router();
    console.log('✅ Using REFACTORED documents router (modular architecture with handlers and utilities)');
    
    // GET / - Root route with dynamic meta tags
    router.get('/', handleRootRoute);

    // GET /goodbye - Goodbye page for declined disclaimer (excluded from document modal)
    router.get('/goodbye', handleGoodbyeRoute);

    // GET /index.php - Joomla/Apache compatibility
    router.get('/index.php', async (req, res) => {
        await handleIndexPhpRoute(req, res, documentRegistry, escapeHtml);
    });

    // GET *.php - Catch-all for PHP requests
    router.get('*.php', handlePhpCatchAll);

    // GET /api/documents - Document registry API with optional filtering
    router.get('/documents', async (req, res) => {
        await handleGetDocuments(req, res, { supabase, documentRegistry });
    });

    // GET /api/owner-logos - Owner logo configurations (public endpoint)
    // Note: Using /api/owner-logos instead of /api/owners to avoid conflict with admin router
    router.get('/owner-logos', async (req, res) => {
        await handleGetOwners(req, res, supabase);
    });

    // POST /api/refresh-registry - Force registry refresh (admin)
    router.post('/refresh-registry', async (req, res) => {
        await handleRefreshRegistry(req, res, documentRegistry, registryState);
    });

    // PUT /api/documents/:identifier - Update document fields (supports both slug and ID)
    router.put('/documents/:identifier', async (req, res) => {
        console.log(`🔍 [documents-router] PUT /documents/:identifier matched`);
        console.log(`   req.path: ${req.path}`);
        console.log(`   req.url: ${req.url}`);
        console.log(`   req.baseUrl: ${req.baseUrl}`);
        await handleUpdateDocument(req, res, { supabase, documentRegistry });
    });

    // ============================================================================
    // Attachment API Endpoints
    // ============================================================================

    // GET /api/attachments/:documentId - List attachments for a document
    router.get('/attachments/:documentId', async (req, res) => {
        await handleGetAttachments(req, res, supabase);
    });

    // POST /api/attachments/:documentId - Create attachment
    router.post('/attachments/:documentId', async (req, res) => {
        await handleCreateAttachment(req, res, supabase, documentRegistry);
    });

    // PUT /api/attachments/:attachmentId - Update attachment
    router.put('/attachments/:attachmentId', async (req, res) => {
        await handleUpdateAttachment(req, res, supabase, documentRegistry);
    });

    // DELETE /api/attachments/:attachmentId - Delete attachment
    router.delete('/attachments/:attachmentId', async (req, res) => {
        await handleDeleteAttachment(req, res, supabase, documentRegistry);
    });

    // POST /api/attachments/:attachmentId/track-download - Track download event
    router.post('/attachments/:attachmentId/track-download', async (req, res) => {
        await handleTrackDownload(req, res, supabase);
    });

    // GET /api/documents/:documentId/analytics - Get document analytics
    router.get('/documents/:documentId/analytics', async (req, res) => {
        await handleDocumentAnalytics(req, res, supabase);
    });

    return router;
}

module.exports = {
    createDocumentsRouter
};
