/**
 * Cache management routes
 * Handles embedding cache statistics and clearing
 */

const express = require('express');
const router = express.Router();

/**
 * Create cache router
 */
function createCacheRouter(embeddingCache) {
    const { getCacheStats, clearCache } = embeddingCache;

    // GET /api/cache/stats - Get cache statistics
    router.get('/cache/stats', async (req, res) => {
        try {
            const stats = getCacheStats();
            res.json({
                success: true,
                cache: stats
            });
        } catch (error) {
            console.error('Error getting cache stats:', error);
            res.status(500).json({ error: 'Failed to get cache statistics' });
        }
    });

    // POST /api/cache/clear - Clear cache
    router.post('/cache/clear', async (req, res) => {
        try {
            clearCache();
            res.json({
                success: true,
                message: 'Embedding cache cleared'
            });
        } catch (error) {
            console.error('Error clearing cache:', error);
            res.status(500).json({ error: 'Failed to clear cache' });
        }
    });

    return router;
}

module.exports = {
    createCacheRouter
};

