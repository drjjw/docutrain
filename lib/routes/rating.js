/**
 * Rating routes
 * Handles conversation rating submissions
 */

const express = require('express');
const router = express.Router();

/**
 * Update conversation rating in database
 */
async function updateConversationRating(supabase, conversationId, rating) {
    try {
        const { error } = await supabase
            .from('chat_conversations')
            .update({ user_rating: rating })
            .eq('id', conversationId);

        if (error) {
            console.error('Failed to update conversation rating:', error);
            throw error;
        }

        return { success: true };
    } catch (err) {
        console.error('Error updating conversation rating:', err);
        throw err;
    }
}

/**
 * Create rating router
 */
function createRatingRouter(supabase) {
    // POST /api/rate - Submit rating
    router.post('/rate', async (req, res) => {
        try {
            const { conversationId, rating } = req.body;

            if (!conversationId) {
                return res.status(400).json({ error: 'conversationId is required' });
            }

            // Allow null to remove rating, or valid rating values
            if (rating !== null && !['thumbs_up', 'thumbs_down'].includes(rating)) {
                return res.status(400).json({ error: 'rating must be either "thumbs_up", "thumbs_down", or null' });
            }

            await updateConversationRating(supabase, conversationId, rating);

            res.json({ success: true, message: rating ? 'Rating submitted successfully' : 'Rating removed successfully' });
        } catch (error) {
            console.error('Rating error:', error);
            res.status(500).json({
                error: 'Failed to submit rating',
                details: error.message
            });
        }
    });

    return router;
}

module.exports = {
    createRatingRouter
};

