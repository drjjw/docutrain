/**
 * Owner API route handler
 * Handles GET /api/owners - Owner logo configurations
 */

/**
 * Handle GET /api/owners
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {object} supabase - Supabase client
 */
async function handleGetOwners(req, res, supabase) {
    try {
        const { data: owners, error } = await supabase
            .from('owners')
            .select('slug, name, logo_url, metadata')
            .not('logo_url', 'is', null);

        if (error) {
            console.error('Error fetching owners:', error);
            return res.status(500).json({ error: 'Failed to fetch owners' });
        }

        // Transform the data to match the expected format
        const ownerConfigs = {};
        owners.forEach(owner => {
            if (owner.logo_url) {
                ownerConfigs[owner.slug] = {
                    logo: owner.logo_url,
                    alt: owner.metadata?.logo_alt || owner.name,
                    link: owner.metadata?.logo_link || '#',
                    accentColor: owner.metadata?.accent_color || '#34a2ff'
                };
            }
        });

        // No caching - always return fresh data
        res.set({
            'Cache-Control': 'no-store, no-cache, must-revalidate, private',
            'Pragma': 'no-cache',
            'Expires': '0'
        });

        res.json({ owners: ownerConfigs });
    } catch (error) {
        console.error('Error in owners API:', error);
        res.status(500).json({ error: 'Failed to fetch owners' });
    }
}

module.exports = {
    handleGetOwners
};

