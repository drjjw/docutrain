// Main initialization and event wiring
// This is a thin orchestrator that imports functionality from specialized modules

import { API_URL, generateSessionId } from './config.js';
import { sendMessage, setupScrollInterruptDetection, resetAutoScroll } from './chat.js';
import { submitRating } from './rating.js';
import { debugLog } from './debug-logger.js';
import { initializeMobileKeyboardSupport } from './mobile-keyboard.js';
import { initializeMobileHeaderBehavior } from './mobile-header.js';
import { initializePage } from './page-loader.js';

// Export debug logger for backward compatibility
export { DEBUG_LEVEL, DEBUG_LEVELS, debugLog } from './debug-logger.js';

// Configure marked for better formatting
marked.setOptions({
    breaks: false, // Prevent awkward line breaks in lists
    gfm: true
});

// Application state (RAG-only mode)
const state = {
    conversationHistory: [],
    isLoading: false,
    selectedModel: 'grok',
    sessionId: generateSessionId(),
    selectedDocument: 'smh', // Default to SMH (can be string or array for multi-doc)
    selectedDocuments: ['smh'], // Array of selected documents
    isLocalEnv: false
};

// DOM elements
const elements = {
    chatContainer: document.getElementById('chatContainer'),
    messageInput: document.getElementById('messageInput'),
    sendButton: document.getElementById('sendButton')
};

// Initialize mobile keyboard support
initializeMobileKeyboardSupport(elements);

// Initialize mobile header behavior
initializeMobileHeaderBehavior();

// Initialize scroll interrupt detection for smart auto-scrolling
if (elements.chatContainer) {
    setupScrollInterruptDetection(elements.chatContainer);
    elements.chatContainer.setAttribute('data-scroll-detection-setup', 'true');
    console.log('📜 Smart auto-scroll initialized');
}

console.log('🔍 URL Detection:');
console.log('  - Current path:', window.location.pathname);
console.log('  - API Base URL:', API_URL);
console.log('  - Health endpoint:', `${API_URL}/api/health`);

// Event listeners for chat
elements.sendButton.addEventListener('click', () => {
    resetAutoScroll(); // User is sending a message, they're ready for new content
    sendMessage(state, elements);
});

elements.messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        resetAutoScroll(); // User is sending a message, they're ready for new content
        sendMessage(state, elements);
    }
});

// Expose submitRating to window for rating button clicks
window.submitRating = submitRating;

// Initialize page (async to ensure document is loaded before health check)
(async () => {
    await initializePage(state, elements);
})();
