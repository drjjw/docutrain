// API communication (RAG-only mode)
import { API_URL, getEmbeddingType } from './config.js';

// 🎯 FEATURE FLAG: Enable streaming responses
const USE_STREAMING = true; // Set to false to use non-streaming

// Send a message to the API with streaming support
export async function sendMessageToAPI(message, conversationHistory, selectedModel, sessionId, selectedDocument) {
    if (USE_STREAMING) {
        return sendMessageToAPIStreaming(message, conversationHistory, selectedModel, sessionId, selectedDocument);
    } else {
        return sendMessageToAPINonStreaming(message, conversationHistory, selectedModel, sessionId, selectedDocument);
    }
}

// Streaming version using Server-Sent Events
async function sendMessageToAPIStreaming(message, conversationHistory, selectedModel, sessionId, selectedDocument) {
    const embeddingType = getEmbeddingType();
    const endpoint = `${API_URL}/api/chat/stream?embedding=${embeddingType}`;

    // Get JWT token
    const headers = { 'Content-Type': 'application/json' };
    try {
        const sessionData = localStorage.getItem('sb-mlxctdgnojvkgfqldaob-auth-token');
        if (sessionData) {
            const session = JSON.parse(sessionData);
            const token = session?.access_token;
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
                console.log('🔑 Including JWT token in streaming chat API request');
            }
        }
    } catch (error) {
        console.log('⚠️ Could not get JWT token for chat request:', error);
    }

    // Get passcode from URL if present
    const urlParams = new URLSearchParams(window.location.search);
    const passcode = urlParams.get('passcode');
    
    const requestBody = {
        message,
        history: conversationHistory.slice(0, -1),
        model: selectedModel,
        sessionId: sessionId,
        doc: selectedDocument
    };
    
    // Add passcode if present
    if (passcode) {
        requestBody.passcode = passcode;
        console.log('🔐 Including passcode in chat API request');
    }

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody),
        cache: 'no-store'
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response; // Return response for streaming processing
}

// Original non-streaming version (fallback)
async function sendMessageToAPINonStreaming(message, conversationHistory, selectedModel, sessionId, selectedDocument) {
    // RAG-only mode - always use embedding type parameter
    const embeddingType = getEmbeddingType();
    const endpoint = `${API_URL}/api/chat?embedding=${embeddingType}`;

    // Create AbortController for timeout (60 seconds)
    const timeoutMs = 60000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // Prepare headers with authentication if available
    const headers = { 'Content-Type': 'application/json' };

    try {
        // Get JWT token from localStorage (same pattern as other API calls)
        const sessionData = localStorage.getItem('sb-mlxctdgnojvkgfqldaob-auth-token');
        if (sessionData) {
            const session = JSON.parse(sessionData);
            const token = session?.access_token;

            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
                console.log('🔑 Including JWT token in chat API request');
            }
        }
    } catch (error) {
        console.log('⚠️ Could not get JWT token for chat request:', error);
    }

    try {
        // Get passcode from URL if present
        const urlParams = new URLSearchParams(window.location.search);
        const passcode = urlParams.get('passcode');
        
        const requestBody = {
            message,
            history: conversationHistory.slice(0, -1),
            model: selectedModel,
            sessionId: sessionId,
            doc: selectedDocument
        };
        
        // Add passcode if present
        if (passcode) {
            requestBody.passcode = passcode;
            console.log('🔐 Including passcode in chat API request');
        }
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody),
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


