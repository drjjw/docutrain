// UI Messages - Message rendering and display
import { styleReferences, wrapDrugConversionContent } from './ui-content-styling.js';

// Update model name in about tooltip
export function updateModelInTooltip(selectedModel) {
    const modelNameElement = document.getElementById('modelName');
    if (modelNameElement) {
        // Check if we're in local environment
        const isLocalEnv = window.location.hostname === 'localhost' ||
                          window.location.hostname === '127.0.0.1' ||
                          window.location.hostname === '';

        let modelDisplayName;
        if (isLocalEnv) {
            // Detailed labels in local environment
            modelDisplayName = selectedModel === 'gemini' ? 'Gemini 2.5' :
                              selectedModel === 'grok' ? 'Grok 4 Fast' :
                              selectedModel === 'grok-reasoning' ? 'Grok 4 Fast Reasoning' :
                              'Unknown Model';
        } else {
            // Simple labels in production
            modelDisplayName = selectedModel === 'gemini' ? 'Gemini' :
                              (selectedModel === 'grok' || selectedModel === 'grok-reasoning') ? 'Grok' :
                              'Unknown Model';
        }

        modelNameElement.textContent = modelDisplayName;
    }
}

// Build response text with metadata (RAG-only mode)
export function buildResponseWithMetadata(data, isLocalEnv) {
    let responseText = data.response;

    // Add metadata based on environment
    if (data.metadata && data.metadata.chunksUsed) {
        let metaInfo;
        if (isLocalEnv) {
            // Local: Show detailed debug info
            const embeddingInfo = data.metadata.embedding_type 
                ? ` | Embedding: ${data.metadata.embedding_type} (${data.metadata.embedding_dimensions}D)` 
                : '';
            const multiDocInfo = data.metadata.isMultiDocument 
                ? ` | Multi-doc: ${data.metadata.documentSlugs.length} sources`
                : '';
            metaInfo = `\n\n---\n*🔍 Used ${data.metadata.chunksUsed} relevant chunks (retrieval: ${data.metadata.retrievalTime}ms, total: ${data.metadata.responseTime}ms)${embeddingInfo}${multiDocInfo}*`;
        } else {
            // Production: Show only response time
            const multiDocInfo = data.metadata.isMultiDocument 
                ? ` | ${data.metadata.documentSlugs.length} documents`
                : '';
            metaInfo = `\n\n---\n*Response time: ${data.metadata.responseTime}ms${multiDocInfo}*`;
        }
        responseText += metaInfo;

        // Log RAG performance
        console.log('📊 RAG Performance:', {
            chunks: data.metadata.chunksUsed,
            retrievalTime: data.metadata.retrievalTime,
            totalTime: data.metadata.responseTime,
            isMultiDocument: data.metadata.isMultiDocument,
            documentSlugs: data.metadata.documentSlugs,
            similarities: data.metadata.chunkSimilarities
        });
    }

    return responseText;
}

// Handle model switching for re-asking with different model
function handleModelSwitch(userMessage, currentModel, state, chatContainer, sendMessageCallback) {
    if (!userMessage || !state || !sendMessageCallback) {
        console.error('Cannot switch models: missing user message, state, or callback');
        return;
    }

    // Switch to the other model
    const newModel = currentModel === 'gemini' ? 'grok' : 'gemini';
    state.selectedModel = newModel;

    // Update tooltip
    updateModelInTooltip(newModel);

    console.log(`🔄 Switched to ${newModel} model for re-asking question`);

    // Create temporary state and elements objects for sendMessage
    const tempState = { ...state, selectedModel: newModel };
    const tempElements = {
        messageInput: { value: userMessage },
        sendButton: { disabled: false },
        chatContainer: chatContainer
    };

    // Call the callback function with the switched model
    sendMessageCallback(tempState, tempElements);
}

// Create rating buttons for a message
function createRatingButtons(conversationId) {
    const ratingContainer = document.createElement('div');
    ratingContainer.className = 'rating-container';

    // Add the question text
    const questionText = document.createElement('div');
    questionText.className = 'rating-question';
    questionText.textContent = 'Do you like this response?';
    ratingContainer.appendChild(questionText);

    const ratingButtons = document.createElement('div');
    ratingButtons.className = 'rating-buttons';

    const thumbsUpBtn = document.createElement('button');
    thumbsUpBtn.className = 'rating-btn thumbs-up';
    thumbsUpBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 11H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h3z"/></svg>';
    thumbsUpBtn.title = 'Rate this response as helpful';
    thumbsUpBtn.onclick = () => window.submitRating(conversationId, 'thumbs_up', ratingContainer);

    const thumbsDownBtn = document.createElement('button');
    thumbsDownBtn.className = 'rating-btn thumbs-down';
    thumbsDownBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zM17 13h3a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-3z"/></svg>';
    thumbsDownBtn.title = 'Rate this response as not helpful';
    thumbsDownBtn.onclick = () => window.submitRating(conversationId, 'thumbs_down', ratingContainer);

    ratingButtons.appendChild(thumbsUpBtn);
    ratingButtons.appendChild(thumbsDownBtn);

    ratingContainer.appendChild(ratingButtons);

    return ratingContainer;
}

// Add a message to the chat
export function addMessage(content, role, model = null, conversationId = null, chatContainer, userMessage = null, state = null, sendMessageCallback = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    // Render markdown for assistant messages, plain text for user
    if (role === 'assistant') {
        contentDiv.innerHTML = marked.parse(content);

        // Wrap all tables in a scrollable container for mobile responsiveness
        const tables = contentDiv.querySelectorAll('table');
        tables.forEach(table => {
            if (!table.parentElement.classList.contains('table-wrapper')) {
                const wrapper = document.createElement('div');
                wrapper.className = 'table-wrapper';
                table.parentNode.insertBefore(wrapper, table);
                wrapper.appendChild(table);
            }
        });

        // Detect and wrap drug conversion calculations (after tables but before references)
        wrapDrugConversionContent(contentDiv);

        // Style references section
        styleReferences(contentDiv);

        // TEMPORARILY HIDDEN: Model badge and switch button (may restore later)
        /*
        // Add subtle model badge
        if (model) {
            const badge = document.createElement('div');
            badge.className = 'model-badge';
            badge.textContent = model === 'gemini' ? '🤖 Gemini' : '🚀 Grok';
            contentDiv.appendChild(badge);

            // Add model switch button
            const switchBtn = document.createElement('button');
            switchBtn.className = 'model-switch-btn';
            switchBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 12px; height: 12px; margin-right: 4px;">
                    <path d="m16 3 4 4-4 4"/>
                    <path d="M20 7H4"/>
                    <path d="m8 21-4-4 4-4"/>
                    <path d="M4 17h16"/>
                </svg>
                ${model === 'gemini' ? 'Try with Grok' : 'Try with Gemini'}
            `;
            switchBtn.title = `Try this question with ${model === 'gemini' ? 'Grok 4' : 'Gemini 2.5'} instead`;
            switchBtn.onclick = () => handleModelSwitch(userMessage, model, state, chatContainer, sendMessageCallback);
            contentDiv.appendChild(switchBtn);
        }
        */

        // Add rating buttons for assistant messages
        if (conversationId) {
            const ratingButtons = createRatingButtons(conversationId);
            contentDiv.appendChild(ratingButtons);
        }
    } else {
        contentDiv.textContent = content;
    }

    messageDiv.appendChild(contentDiv);
    chatContainer.appendChild(messageDiv);

    // Scroll to show the top of the new message (not the bottom)
    if (role === 'assistant') {
        messageDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
        // For user messages, scroll to bottom to show input was received
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
}

