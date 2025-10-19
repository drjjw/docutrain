// Main initialization and event wiring
import { API_URL, generateSessionId, getEmbeddingType, preloadLogos, parseDocumentSlugs } from './config.js?v=20251019-02';
import { updateDocumentUI, updateModelInTooltip } from './ui.js?v=20251019-02';
import { sendMessage } from './chat.js?v=20251019-02';
import { submitRating } from './rating.js?v=20251019-02';
import { initializePubMedPopup } from './pubmed-popup.js?v=20251019-02';

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
    sendButton: document.getElementById('sendButton'),
    geminiBtn: document.getElementById('geminiBtn'),
    grokBtn: document.getElementById('grokBtn'),
    grokReasoningBtn: document.getElementById('grokReasoningBtn'),
    headerToggle: document.getElementById('headerToggle'),
    mainHeader: document.getElementById('mainHeader'),
    headerContent: document.getElementById('headerContent')
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
        // Update button states
        if (modelParam === 'grok') {
            elements.grokBtn.classList.add('active');
            elements.geminiBtn.classList.remove('active');
            elements.grokReasoningBtn.classList.remove('active');
        } else if (modelParam === 'grok-reasoning') {
            elements.grokReasoningBtn.classList.add('active');
            elements.grokBtn.classList.remove('active');
            elements.geminiBtn.classList.remove('active');
        } else {
            elements.geminiBtn.classList.add('active');
            elements.grokBtn.classList.remove('active');
            elements.grokReasoningBtn.classList.remove('active');
        }
        // Update tooltip
        updateModelInTooltip(modelParam);
    } else {
        // Default model - update button states and tooltip
        if (state.selectedModel === 'grok') {
            elements.grokBtn.classList.add('active');
            elements.geminiBtn.classList.remove('active');
            elements.grokReasoningBtn.classList.remove('active');
        } else if (state.selectedModel === 'grok-reasoning') {
            elements.grokReasoningBtn.classList.add('active');
            elements.grokBtn.classList.remove('active');
            elements.geminiBtn.classList.remove('active');
        } else {
            elements.geminiBtn.classList.add('active');
            elements.grokBtn.classList.remove('active');
            elements.grokReasoningBtn.classList.remove('active');
        }
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

        // Update button text for local environment (detailed labels)
        elements.geminiBtn.textContent = 'Gemini 2.5';
        elements.grokBtn.textContent = 'Grok 4 Fast';
        elements.grokReasoningBtn.textContent = 'Grok 4 Fast Reasoning';

        // Show additional Grok model option in local environment
        if (elements.grokReasoningBtn) {
            elements.grokReasoningBtn.style.display = 'inline-block';
        }

        // Show URL parameters info in welcome message
        const urlParamsInfo = document.getElementById('urlParamsInfo');
        if (urlParamsInfo) {
            urlParamsInfo.style.display = 'inline';
        }
    } else {
        console.log('🌐 Production environment - retrieval controls hidden');

        // In production, set default model to grok-4-fast-non-reasoning
        state.selectedModel = 'grok';

        // Update button text for production (simple labels)
        elements.geminiBtn.textContent = 'Gemini';
        elements.grokBtn.textContent = 'Grok';
        elements.grokReasoningBtn.textContent = 'Grok';
    }

    // Update UI based on selected document (async) - force refresh to get latest data
    await updateDocumentUI(state.selectedDocument, true);
}

// Model selector event listeners
elements.geminiBtn.addEventListener('click', () => {
    state.selectedModel = 'gemini';
    elements.geminiBtn.classList.add('active');
    elements.grokBtn.classList.remove('active');
    updateModelInTooltip('gemini');
});

elements.grokBtn.addEventListener('click', () => {
    state.selectedModel = 'grok';
    elements.grokBtn.classList.add('active');
    elements.geminiBtn.classList.remove('active');
    elements.grokReasoningBtn.classList.remove('active');
    updateModelInTooltip('grok');
});

elements.grokReasoningBtn.addEventListener('click', () => {
    state.selectedModel = 'grok-reasoning';
    elements.grokReasoningBtn.classList.add('active');
    elements.grokBtn.classList.remove('active');
    elements.geminiBtn.classList.remove('active');
    updateModelInTooltip('grok-reasoning');
});

// Event listeners for chat
elements.sendButton.addEventListener('click', () => sendMessage(state, elements));
elements.messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage(state, elements);
});

// Header collapse/expand functionality
function initializeHeaderToggle() {
    const STORAGE_KEY = 'ukidney-header-collapsed';
    
    // Load saved state from localStorage (defaults to false/expanded if not set)
    const savedState = localStorage.getItem(STORAGE_KEY);
    const isCollapsed = savedState === 'true';
    
    // Apply collapsed state only if explicitly saved as collapsed
    if (isCollapsed && elements.mainHeader && elements.headerContent) {
        elements.mainHeader.classList.add('collapsed');
        console.log('Header initialized as collapsed (from localStorage)');
    } else {
        // Ensure it starts expanded (remove any collapsed class that might exist)
        elements.mainHeader?.classList.remove('collapsed');
        console.log('Header initialized as expanded (default)');
    }
    
    // Toggle header on button click
    if (elements.headerToggle && elements.mainHeader && elements.headerContent) {
        elements.headerToggle.addEventListener('click', () => {
            const isCurrentlyCollapsed = elements.mainHeader.classList.toggle('collapsed');
            
            // Save state to localStorage
            localStorage.setItem(STORAGE_KEY, isCurrentlyCollapsed.toString());
            
            // Notify parent window if in iframe (for embedded usage)
            if (window.parent !== window) {
                try {
                    window.parent.postMessage({
                        type: 'headerCollapsed',
                        collapsed: isCurrentlyCollapsed
                    }, '*');
                } catch (e) {
                    console.log('Could not notify parent:', e);
                }
            }
            
            console.log(`Header ${isCurrentlyCollapsed ? 'collapsed' : 'expanded'}`);
        });
    }
}

// Expose submitRating to window for rating button clicks
window.submitRating = submitRating;

// Initialize (async to ensure document is loaded before health check)
(async () => {
    // Preload logos to prevent layout shift
    preloadLogos();

    await initializeDocument();
    initializeHeaderToggle();

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
