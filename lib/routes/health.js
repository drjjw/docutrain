/**
 * Health and monitoring routes
 * Handles readiness checks, health checks, and analytics
 */

const express = require('express');

/**
 * Create health router
 */
function createHealthRouter(supabase, documentRegistry, registryState) {
    const router = express.Router();
    
    // GET /api/ready - Readiness check for load balancers
    router.get('/ready', async (req, res) => {
        try {
            // Ensure registry is loaded
            if (!registryState.documentRegistryLoaded) {
                return res.status(503).json({
                    status: 'not_ready',
                    message: 'Document registry not loaded yet'
                });
            }

            // Server is ready to serve requests (RAG-only, no PDF loading required)
            res.json({
                status: 'ready',
                message: 'Server is fully ready to serve requests',
                availableDocuments: registryState.activeDocumentSlugs.length,
                mode: 'rag-only'
            });
        } catch (error) {
            console.error('Readiness check error:', error);
            res.status(503).json({
                status: 'error',
                message: 'Readiness check failed',
                error: error.message
            });
        }
    });

    // GET /api/health - Health check
    router.get('/health', async (req, res) => {
        try {
            const requestedDoc = req.query.doc || 'smh';

            // Ensure registry is loaded for health check
            if (!registryState.documentRegistryLoaded) {
                await documentRegistry.loadDocuments();
                registryState.activeDocumentSlugs = await documentRegistry.getActiveSlugs();
                registryState.documentRegistryLoaded = true;
            }

            // Validate using registry
            const isValid = await documentRegistry.isValidSlug(requestedDoc);
            const docType = isValid ? requestedDoc : 'smh';

            // Get document info from registry (metadata only)
            let currentDocInfo;
            if (isValid) {
                const docConfig = await documentRegistry.getDocumentBySlug(docType);
                currentDocInfo = {
                    title: docConfig.title,
                    embeddingType: docConfig.embedding_type,
                    year: docConfig.year
                };
            }

            res.json({
                status: 'ok',
                mode: 'rag-only',
                currentDocument: currentDocInfo?.title || 'Unknown',
                currentDocumentType: docType,
                availableDocuments: registryState.activeDocumentSlugs,
                totalAvailableDocuments: registryState.activeDocumentSlugs.length,
                requestedDoc: requestedDoc
            });
        } catch (error) {
            console.error('Health check error:', error);
            res.status(500).json({ status: 'error', message: error.message });
        }
    });

    // GET /api/version - Server version and architecture info
    router.get('/version', async (req, res) => {
        res.json({
            version: '2.0.0-refactored',
            architecture: 'modular',
            serverFile: 'server.js (224 lines)',
            modules: [
                'lib/utils.js',
                'lib/middleware.js',
                'lib/rag.js',
                'lib/routes/chat.js',
                'lib/routes/documents.js',
                'lib/routes/health.js',
                'lib/routes/rating.js',
                'lib/routes/cache.js'
            ],
            refactoredDate: '2025-10-20',
            totalModules: 8
        });
    });

    // GET /api/debug-config - Public endpoint for frontend debug configuration
    router.get('/debug-config', (req, res) => {
        try {
            const allowOverride = process.env.ALLOW_DEBUG_OVERRIDE === undefined 
                ? true  // Default to true if not set
                : process.env.ALLOW_DEBUG_OVERRIDE !== 'false';  // true unless explicitly 'false'
            
            res.json({
                allowDebugOverride: allowOverride
            });
        } catch (error) {
            console.error('Debug config error:', error);
            if (!res.headersSent) {
                res.status(500).json({ 
                    error: 'Failed to get debug config',
                    message: error.message 
                });
            }
        }
    });

    // GET /api/analytics - Analytics endpoint
    router.get('/analytics', async (req, res) => {
        try {
            const { timeframe = '24h' } = req.query;
            
            // Calculate time filter
            const hoursBack = timeframe === '24h' ? 24 : timeframe === '7d' ? 168 : timeframe === '30d' ? 720 : 24;
            const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
            
            // Get conversation stats
            const { data: conversations, error } = await supabase
                .from('chat_conversations')
                .select('*')
                .gte('created_at', since)
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            
            // Get unique documents
            const documentStats = {};
            conversations.forEach(c => {
                const docName = c.document_name || c.pdf_name || 'unknown';
                if (!documentStats[docName]) {
                    documentStats[docName] = {
                        count: 0,
                        version: c.document_version,
                        avgResponseTime: 0,
                        totalTime: 0
                    };
                }
                documentStats[docName].count++;
                documentStats[docName].totalTime += c.response_time_ms || 0;
            });
            
            // Calculate averages for documents
            Object.keys(documentStats).forEach(doc => {
                documentStats[doc].avgResponseTime = Math.round(
                    documentStats[doc].totalTime / documentStats[doc].count
                );
                delete documentStats[doc].totalTime;
            });
            
            // Calculate rating statistics
            const ratedConversations = conversations.filter(c => c.user_rating !== null);
            const thumbsUp = conversations.filter(c => c.user_rating === 'thumbs_up').length;
            const thumbsDown = conversations.filter(c => c.user_rating === 'thumbs_down').length;
            const totalRatings = thumbsUp + thumbsDown;
            const ratingPercentage = totalRatings > 0 ? Math.round((thumbsUp / totalRatings) * 100) : 0;
            
            // Ratings by model
            const ratingsByModel = {
                gemini: {
                    thumbsUp: conversations.filter(c => c.model === 'gemini' && c.user_rating === 'thumbs_up').length,
                    thumbsDown: conversations.filter(c => c.model === 'gemini' && c.user_rating === 'thumbs_down').length,
                    total: conversations.filter(c => c.model === 'gemini' && c.user_rating !== null).length
                },
                grok: {
                    thumbsUp: conversations.filter(c => c.model === 'grok' && c.user_rating === 'thumbs_up').length,
                    thumbsDown: conversations.filter(c => c.model === 'grok' && c.user_rating === 'thumbs_down').length,
                    total: conversations.filter(c => c.model === 'grok' && c.user_rating !== null).length
                }
            };
            
            // Calculate analytics
            const stats = {
                totalConversations: conversations.length,
                byModel: {
                    gemini: conversations.filter(c => c.model === 'gemini').length,
                    grok: conversations.filter(c => c.model === 'grok').length
                },
                byDocument: documentStats,
                avgResponseTime: {
                    gemini: Math.round(
                        conversations.filter(c => c.model === 'gemini')
                            .reduce((sum, c) => sum + (c.response_time_ms || 0), 0) / 
                        conversations.filter(c => c.model === 'gemini').length || 1
                    ),
                    grok: Math.round(
                        conversations.filter(c => c.model === 'grok')
                            .reduce((sum, c) => sum + (c.response_time_ms || 0), 0) / 
                        conversations.filter(c => c.model === 'grok').length || 1
                    )
                },
                ratings: {
                    total: totalRatings,
                    thumbsUp: thumbsUp,
                    thumbsDown: thumbsDown,
                    positivePercentage: ratingPercentage,
                    byModel: ratingsByModel
                },
                errors: conversations.filter(c => c.error).length,
                uniqueSessions: new Set(conversations.map(c => c.session_id)).size,
                uniqueDocuments: Object.keys(documentStats).length,
                timeframe: timeframe,
                recentQuestions: conversations.slice(0, 10).map(c => ({
                    question: c.question,
                    model: c.model,
                    document: c.document_name || c.pdf_name,
                    timestamp: c.created_at,
                    responseTime: c.response_time_ms
                }))
            };
            
            res.json(stats);
        } catch (error) {
            console.error('Analytics error:', error);
            res.status(500).json({ error: 'Failed to fetch analytics' });
        }
    });

    return router;
}

module.exports = {
    createHealthRouter
};

