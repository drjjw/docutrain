/**
 * Chat routes
 * Handles RAG chat endpoint with multi-document support
 */

const express = require('express');
const router = express.Router();
const { createChatPostHandler } = require('./chat-handlers/chat-post-handler');
const { createChatStreamHandler } = require('./chat-handlers/chat-stream-handler');
const {
    createGetSharedHandler,
    createPostShareHandler,
    createGetBannedStatusHandler
} = require('./chat-handlers/share-handlers');

/**
 * Create chat router
 */
function createChatRouter(dependencies) {
    const {
        supabase,
        documentRegistry,
        rag,
        localEmbeddings,
        embeddingCache,
        clients
    } = dependencies;

    // Create handlers with dependencies
    const chatPostHandler = createChatPostHandler({
        supabase,
        documentRegistry,
        rag,
        localEmbeddings,
        embeddingCache,
        clients
    });

    const chatStreamHandler = createChatStreamHandler({
        supabase,
        documentRegistry,
        rag,
        localEmbeddings,
        embeddingCache,
        clients
    });

    const getSharedHandler = createGetSharedHandler({ supabase });
    const postShareHandler = createPostShareHandler({ supabase });
    const getBannedStatusHandler = createGetBannedStatusHandler({ supabase });

    // Register routes
    router.post('/chat', chatPostHandler);
    router.post('/chat/stream', chatStreamHandler);
    router.get('/shared/:shareToken', getSharedHandler);
    router.post('/chat/share', postShareHandler);
    router.get('/chat/conversation/:conversationId/banned-status', getBannedStatusHandler);

    return router;
}

module.exports = {
    createChatRouter
};
