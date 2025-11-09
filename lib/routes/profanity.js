/**
 * Profanity detection routes
 * Handles async profanity checking for conversations
 * Uses custom filter based on naughty-words comprehensive word list
 */

const express = require('express');
const { checkContent } = require('../utils/profanity-filter');
const router = express.Router();

/**
 * Create profanity router
 */
function createProfanityRouter(supabase) {
    // POST /api/profanity-check - Check conversation for profanity/junk and update banned flag
    router.post('/profanity-check', async (req, res) => {
        try {
            const { conversation_id, question } = req.body;

            if (!conversation_id) {
                return res.status(400).json({ 
                    success: false,
                    error: 'conversation_id is required' 
                });
            }

            if (!question || typeof question !== 'string') {
                return res.status(400).json({ 
                    success: false,
                    error: 'question is required and must be a string' 
                });
            }

            // Check if conversation is already banned (set synchronously before insert)
            // If already banned, skip the check to avoid redundant processing
            const { data: existingConv } = await supabase
                .from('chat_conversations')
                .select('id, banned, ban_reason')
                .eq('id', conversation_id)
                .single();

            if (existingConv?.banned === true) {
                // Already banned - return success without re-checking
                return res.json({ 
                    success: true, 
                    banned: true,
                    reason: existingConv.ban_reason || 'profanity',
                    message: 'Conversation already banned',
                    already_banned: true
                });
            }

            // Check for both profanity and junk
            const contentCheck = checkContent(question);

            if (contentCheck.shouldBan) {
                // Update conversation to mark as banned with reason
                const { error } = await supabase
                    .from('chat_conversations')
                    .update({ 
                        banned: true,
                        ban_reason: contentCheck.reason 
                    })
                    .eq('id', conversation_id);

                if (error) {
                    console.error('Failed to update banned flag:', error);
                    return res.status(500).json({
                        success: false,
                        error: 'Failed to update banned flag',
                        details: error.message
                    });
                }

                const reasonLabel = contentCheck.reason === 'profanity' ? 'Profanity' : 'Junk';
                console.log(`🚫 ${reasonLabel} detected in conversation ${conversation_id}, marked as banned (reason: ${contentCheck.reason})`);
                return res.json({ 
                    success: true, 
                    banned: true,
                    reason: contentCheck.reason,
                    message: `${reasonLabel} detected, conversation marked as banned` 
                });
            } else {
                // No issues detected
                return res.json({ 
                    success: true, 
                    banned: false,
                    reason: null,
                    message: 'Content check passed' 
                });
            }
        } catch (error) {
            console.error('Content check error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to check content',
                details: error.message
            });
        }
    });

    return router;
}

module.exports = {
    createProfanityRouter
};

