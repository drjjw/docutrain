// Main initialization and event wiring
import { API_URL, generateSessionId, getEmbeddingType, preloadLogos, parseDocumentSlugs } from './config.js?v=20251019-02';
import { updateDocumentUI, updateModelInTooltip } from './ui.js?v=20251019-02';
import { sendMessage } from './chat.js?v=20251019-02';
import { submitRating } from './rating.js?v=20251019-02';
import { initializePubMedPopup } from './pubmed-popup.js?v=20251019-02';
import { initAuthUI, restoreSession } from './auth.js?v=20251020-01';

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

console.log('🔍 URL Detection:');
console.log('  - Current path:', window.location.pathname);
console.log('  - API Base URL:', API_URL);
console.log('  - Health endpoint:', `${API_URL}/api/health`);

// Initialize document and method selection from URL parameters (now async with registry validation)
async function initializeDocument() {
    const urlParams = new URLSearchParams(window.location.search);
    const docParam = urlParams.get('doc');
    const methodParam = urlParams.get('method');
    const embeddingParam = getEmbeddingType();
    const modelParam = urlParams.get('model');

    // Set model from URL parameter
    if (modelParam && (modelParam === 'gemini' || modelParam === 'grok' || modelParam === 'grok-reasoning')) {
        state.selectedModel = modelParam;
        updateModelInTooltip(modelParam);
    } else {
        // Default model - update tooltip
        updateModelInTooltip(state.selectedModel);
    }

    // Validate document slugs using registry - supports multi-document with + separator
    let validatedSlugs = [];
    if (docParam) {
        try {
            const { documentExists, getDocument } = await import('./config.js?v=20251019-02');
            const requestedSlugs = parseDocumentSlugs();
            
            console.log(`📋 Validating ${requestedSlugs.length} document(s): ${requestedSlugs.join(', ')}`);
            
            // Validate each slug
            for (const slug of requestedSlugs) {
                try {
                    // Force refresh to avoid stale cache
                    const exists = await documentExists(slug, true);
                    if (exists) {
                        // Get the actual document to ensure we use the correct case
                        const doc = await getDocument(slug, true);
                        if (doc && doc.slug) {
                            validatedSlugs.push(doc.slug);
                            console.log(`  ✓ Validated: ${doc.slug}`);
                        } else {
                            console.warn(`  ⚠️  Document '${slug}' returned invalid config`);
                        }
                    } else {
                        console.warn(`  ⚠️  Document '${slug}' not found in registry`);
                    }
                } catch (slugError) {
                    console.error(`  ❌ Error validating '${slug}':`, slugError);
                }
            }
        } catch (error) {
            console.error('❌ Error during document validation:', error);
        }
    }
    
    // Set state based on validated slugs
    if (validatedSlugs.length > 0) {
        state.selectedDocuments = validatedSlugs;
        // For backward compatibility, set selectedDocument to joined string
        state.selectedDocument = validatedSlugs.join('+');
        console.log(`✓ Documents set: ${state.selectedDocument}`);
    } else {
        state.selectedDocuments = [];
        state.selectedDocument = null;
        console.warn('⚠️  No valid documents found, showing generic interface');
    }

    // Log all URL parameters
    console.log('\n📋 URL Parameters Applied:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  Document:        ${docParam || 'none specified'}`);
    console.log(`  Validated as:    ${validatedSlugs.length > 0 ? validatedSlugs.join(' + ') : 'none (generic interface)'}`);
    console.log(`  Multi-document:  ${validatedSlugs.length > 1 ? 'Yes (' + validatedSlugs.length + ' docs)' : 'No'}`);
    console.log(`  Model:           ${state.selectedModel}`);
    console.log(`  Mode:            RAG-only (database retrieval)`);
    console.log(`  Embedding Type:  ${embeddingParam} ${embeddingParam === 'openai' ? '(1536D)' : '(384D)'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Check if running on localhost
    state.isLocalEnv = window.location.hostname === 'localhost' || 
                 window.location.hostname === '127.0.0.1' ||
                 window.location.hostname === '';
    
    // Add class to body for CSS targeting
    if (state.isLocalEnv) {
        document.body.classList.add('local-env');
        console.log('🏠 Local environment detected - retrieval controls visible');

        // Show URL parameters info in welcome message
        const urlParamsInfo = document.getElementById('urlParamsInfo');
        if (urlParamsInfo) {
            urlParamsInfo.style.display = 'inline';
        }
    } else {
        console.log('🌐 Production environment - retrieval controls hidden');

        // In production, set default model to grok-4-fast-non-reasoning
        // UNLESS explicitly overridden by URL parameter
        if (!modelParam) {
            state.selectedModel = 'grok';
        }
    }

    // Update UI based on selected document (async) - force refresh to get latest data
    await updateDocumentUI(state.selectedDocument, true);
}

// Event listeners for chat
elements.sendButton.addEventListener('click', () => sendMessage(state, elements));
elements.messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage(state, elements);
});


// Expose submitRating to window for rating button clicks
window.submitRating = submitRating;

// Initialize (async to ensure document is loaded before health check)
(async () => {
    // Preload logos to prevent layout shift
    await preloadLogos();

    // Initialize authentication
    console.log('🔐 Initializing authentication...');
    initAuthUI();
    
    // Try to restore previous session
    const sessionRestored = await restoreSession();
    if (sessionRestored) {
        console.log('✓ Previous session restored');
    } else {
        console.log('ℹ️  No previous session found');
    }

    await initializeDocument();

    // Initialize PubMed popup functionality
    initializePubMedPopup();

    // Health check logged to console (no status bar)
    console.log('✓ Server health check - RAG-only mode active');

    // Show disclaimer only for UKidney documents
    if (state.selectedDocument) {
        const { getDocument } = await import('./config.js');
        const docConfig = await getDocument(state.selectedDocument);
        if (docConfig && docConfig.owner === 'ukidney') {
            const { showDisclaimerIfNeeded } = await import('./disclaimer.js');
            showDisclaimerIfNeeded();
        }
    }

    // Focus input
    elements.messageInput.focus();
})();
