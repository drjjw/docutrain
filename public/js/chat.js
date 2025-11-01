// Chat logic and conversation management
import { sendMessageToAPI } from './api.js';
import { addMessage, addLoading, removeLoading, buildResponseWithMetadata } from './ui.js';
import { getDocument } from './config.js';
import { styleReferences, wrapDrugConversionContent } from './ui-content-styling.js';
import { dismissAIHint } from './ai-hint.js';

// ============================================================================
// AUTO-SCROLL MANAGEMENT
// ============================================================================
// Track whether user has manually scrolled and wants to pause auto-scroll
let userHasScrolled = false;
let scrollTimeout = null;

function setupScrollInterruptDetection(chatContainer) {
    // Detect user scroll via wheel/trackpad
    chatContainer.addEventListener('wheel', () => {
        userHasScrolled = true;
    }, { passive: true });

    // Detect user scroll via touch (mobile/trackpad gestures)
    chatContainer.addEventListener('touchmove', () => {
        userHasScrolled = true;
    }, { passive: true });

    // Detect manual scrollbar dragging or keyboard scrolling
    chatContainer.addEventListener('scroll', () => {
        // Clear any existing timeout
        if (scrollTimeout) {
            clearTimeout(scrollTimeout);
        }

        // Set a timeout to detect if this was user-initiated
        // (auto-scroll happens immediately, user scroll has momentum/continuation)
        scrollTimeout = setTimeout(() => {
            const isAtBottom = Math.abs(
                chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight
            ) < 50; // 50px threshold
            
            if (!isAtBottom && !userHasScrolled) {
                userHasScrolled = true;
            }
        }, 100);
    }, { passive: true });
}

function shouldAutoScroll() {
    return !userHasScrolled;
}

function resetAutoScroll() {
    userHasScrolled = false;
    console.log('🔄 Auto-scroll resumed for new response');
}

// Export for use in other modules
export { setupScrollInterruptDetection, shouldAutoScroll, resetAutoScroll };

// ============================================================================
// STREAMING RESPONSE HANDLER
// ============================================================================
async function handleStreamingResponse(response, state, elements) {
    console.log('📡 Receiving streaming response...');
    removeLoading();

    // Reset auto-scroll for new response
    resetAutoScroll();

    // Setup scroll detection if not already done
    if (!elements.chatContainer.hasAttribute('data-scroll-detection-setup')) {
        setupScrollInterruptDetection(elements.chatContainer);
        elements.chatContainer.setAttribute('data-scroll-detection-setup', 'true');
    }

    // Create a placeholder message that we'll update
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant';
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    messageDiv.appendChild(contentDiv);
    elements.chatContainer.appendChild(messageDiv);

    let fullResponse = '';
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const jsonStr = line.slice(6);
                    try {
                        const data = JSON.parse(jsonStr);

                        if (data.type === 'content' && data.chunk) {
                            fullResponse += data.chunk;
                            // Update the message in real-time
                            contentDiv.innerHTML = marked.parse(fullResponse);
                            
                            // Apply styling to references and drug conversions
                            wrapDrugConversionContent(contentDiv);
                            styleReferences(contentDiv);
                            
                            // Auto-scroll to show new content (only if user hasn't scrolled)
                            if (shouldAutoScroll()) {
                                elements.chatContainer.scrollTop = elements.chatContainer.scrollHeight;
                            }
                        } else if (data.type === 'done') {
                            console.log('✅ Streaming completed');

                            // Log the actual model being used and detect overrides
                            if (data.metadata && data.metadata.model) {
                                const actualModel = data.metadata.model;
                                const requestedModel = state.selectedModel;

                                const expectedActual = requestedModel === 'grok' ? 'grok-4-fast-non-reasoning' :
                                                     requestedModel === 'grok-reasoning' ? 'grok-4-fast-reasoning' :
                                                     'gemini-2.5-flash';

                                const wasOverridden = expectedActual !== actualModel;

                                if (wasOverridden) {
                                    console.log('\n🔒 MODEL OVERRIDE DETECTED:');
                                    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                                    console.log(`  Requested:  ${requestedModel} (${expectedActual})`);
                                    console.log(`  Actually used: ${actualModel}`);
                                    console.log(`  Reason: Owner-configured safety mechanism`);
                                    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
                                } else {
                                    console.log(`🤖 Response generated using: ${actualModel}`);
                                }
                            }

                            console.log(`📊 Metadata:`, data.metadata);
                        } else if (data.type === 'error') {
                            console.error('❌ Streaming error:', data.error);
                            contentDiv.innerHTML = `<p>Error: ${data.error}</p>`;
                        }
                    } catch (parseError) {
                        // Ignore parse errors for incomplete chunks
                    }
                }
            }
        }

        // Add to conversation history
        state.conversationHistory.push({ role: 'assistant', content: fullResponse });

    } catch (streamError) {
        console.error('Stream reading error:', streamError);
        contentDiv.innerHTML += `<p><em>Error reading stream: ${streamError.message}</em></p>`;
    }
}

// ============================================================================
// NON-STREAMING RESPONSE HANDLER
// ============================================================================
async function handleNonStreamingResponse(response, state, elements, sendMessage) {
    let data;
    try {
        data = await response.json();
    } catch (jsonError) {
        console.error('Failed to parse response as JSON:', jsonError);
        removeLoading();
        addMessage('Server returned an invalid response. Please try again.', 'assistant', null, null, elements.chatContainer, null, null, null);
        state.isLoading = false;
        elements.sendButton.disabled = false;
        elements.messageInput.focus();
        return;
    }

    removeLoading();

    if (response.ok) {
        // Log the actual model being used and detect overrides
        if (data.actualModel) {
            const requestedModel = state.selectedModel;
            const actualModel = data.actualModel;
            
            const expectedActual = requestedModel === 'grok' ? 'grok-4-fast-non-reasoning' :
                                 requestedModel === 'grok-reasoning' ? 'grok-4-fast-reasoning' :
                                 'gemini-2.5-flash';
            
            const wasOverridden = expectedActual !== actualModel;
            
            if (wasOverridden) {
                console.log('\n🔒 MODEL OVERRIDE DETECTED:');
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log(`  Requested:  ${requestedModel} (${expectedActual})`);
                console.log(`  Actually used: ${actualModel}`);
                console.log(`  Reason: Owner-configured safety mechanism`);
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            } else {
                console.log(`🤖 Response generated using: ${actualModel}`);
            }
        }

        // Build response with metadata
        const responseText = buildResponseWithMetadata(data, state.isLocalEnv);

        // Get the last user message for the switch button
        const lastUserMessage = state.conversationHistory.length > 0 &&
            state.conversationHistory[state.conversationHistory.length - 1].role === 'user'
            ? state.conversationHistory[state.conversationHistory.length - 1].content
            : null;

        addMessage(responseText, 'assistant', data.model, data.conversationId, elements.chatContainer, lastUserMessage, state, sendMessage);
        state.conversationHistory.push({ role: 'assistant', content: data.response });
    } else {
        const errorMsg = data.error || 'Unknown error occurred';
        const details = data.details ? ` (${data.details})` : '';
        addMessage(`Error: ${errorMsg}${details}`, 'assistant', null, null, elements.chatContainer, null, null, null);
    }
}

// ============================================================================
// MAIN SEND MESSAGE FUNCTION
// ============================================================================
export async function sendMessage(state, elements) {
    const message = elements.messageInput.value.trim();
    if (!message || state.isLoading) return;

    // Dismiss AI hint when user starts chatting (demonstrates understanding)
    dismissAIHint();

    state.isLoading = true;
    elements.sendButton.disabled = true;

    // Add user message
    addMessage(message, 'user', null, null, elements.chatContainer, null, null, null);
    state.conversationHistory.push({ role: 'user', content: message });
    elements.messageInput.value = '';

    // Show loading (with owner-specific facts)
    let documentOwner = null;
    try {
        const docConfig = await getDocument(state.selectedDocument);
        // Try owner field first, then fall back to ownerInfo.slug
        // Handle empty strings as well as null/undefined
        const ownerFromField = docConfig?.owner?.trim?.() || docConfig?.owner;
        const ownerFromInfo = docConfig?.ownerInfo?.slug?.trim?.() || docConfig?.ownerInfo?.slug;
        documentOwner = ownerFromField || ownerFromInfo || null;
    } catch (error) {
        console.log('Could not get document owner for loading facts:', error);
    }
    addLoading(elements.chatContainer, documentOwner);

    try {
        const response = await sendMessageToAPI(
            message,
            state.conversationHistory,
            state.selectedModel,
            state.sessionId,
            state.selectedDocument
        );

        // Check if this is a streaming response
        const contentType = response.headers.get('content-type');
        const isStreaming = contentType && contentType.includes('text/event-stream');

        if (isStreaming) {
            await handleStreamingResponse(response, state, elements);
        } else {
            await handleNonStreamingResponse(response, state, elements, sendMessage);
        }
    } catch (error) {
        removeLoading();
        const errorMessage = error.message || 'Failed to connect to server. Please try again.';
        addMessage(errorMessage, 'assistant', null, null, elements.chatContainer, null, null, null);
        console.error('Error:', error);
    }

    state.isLoading = false;
    elements.sendButton.disabled = false;
    // Only focus input if it's a real DOM element (not during model switching)
    if (elements.messageInput && typeof elements.messageInput.focus === 'function') {
        elements.messageInput.focus();
    }
}


