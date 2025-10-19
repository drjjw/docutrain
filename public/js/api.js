// API communication (RAG-only mode)
import { API_URL, getEmbeddingType } from './config.js';

// Send a message to the API (RAG-only mode)
export async function sendMessageToAPI(message, conversationHistory, selectedModel, sessionId, selectedDocument) {
    // RAG-only mode - always use embedding type parameter
    const embeddingType = getEmbeddingType();
    const endpoint = `${API_URL}/api/chat?embedding=${embeddingType}`;

    // Create AbortController for timeout (60 seconds)
    const timeoutMs = 60000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message,
                history: conversationHistory.slice(0, -1),
                model: selectedModel,
                sessionId: sessionId,
                doc: selectedDocument
            }),
            signal: controller.signal,
            // Disable any caching to ensure fresh requests
            cache: 'no-store'
        });

        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error(`Request timeout after ${timeoutMs / 1000} seconds. This may happen with complex queries. Please try again or simplify your question.`);
        }
        throw error;
    }
}


