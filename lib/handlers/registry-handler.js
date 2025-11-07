/**
 * Registry route handler
 * Handles POST /api/refresh-registry - Force registry refresh (admin)
 */

/**
 * Handle POST /api/refresh-registry
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {object} documentRegistry - Document registry instance
 * @param {object} registryState - Registry state object
 */
async function handleRefreshRegistry(req, res, documentRegistry, registryState) {
    try {
        console.log('🔄 Forcing document registry refresh...');

        // Force refresh the document registry
        await documentRegistry.refreshRegistry();

        // Reload active slugs
        registryState.activeDocumentSlugs = await documentRegistry.getActiveSlugs();

        console.log('✅ Document registry refreshed successfully');

        res.json({
            success: true,
            message: 'Document registry cache cleared and refreshed',
            documentCount: registryState.activeDocumentSlugs.length
        });

    } catch (error) {
        console.error('Registry refresh error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to refresh document registry',
            error: error.message
        });
    }
}

module.exports = {
    handleRefreshRegistry
};

