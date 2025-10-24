// Main initialization and event wiring
import { API_URL, generateSessionId, getEmbeddingType, preloadLogos, parseDocumentSlugs } from './config.js?v=20251019-02';
import { updateDocumentUI, updateModelInTooltip } from './ui.js?v=20251022-01';
import { sendMessage } from './chat.js?v=20251019-02';
import { submitRating } from './rating.js?v=20251019-02';
import { initializePubMedPopup } from './pubmed-popup.js?v=20251019-02';
import { initializeAIHint } from './ai-hint.js?v=20251021-01';
import { checkDocumentAccess } from './access-check.js';

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
    const ownerParam = urlParams.get('owner');
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
    console.log(`  Owner:           ${ownerParam || 'none specified'}`);
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

    // Handle owner parameter - show document selector modal for owner's documents
    if (ownerParam) {
        // Try to show owner's logo in owner mode
        const { getOwnerLogoConfig } = await import('./config.js?v=20251019-02');
        const ownerLogoConfig = await getOwnerLogoConfig(ownerParam);
        console.log('🎨 Owner logo config for', ownerParam, ':', ownerLogoConfig);

        // In owner mode, update header to show owner name
        const headerTitle = document.getElementById('headerTitle');
        if (headerTitle) {
            // Use the owner's display name from the config, with smart fallbacks
            let ownerDisplayName = ownerLogoConfig?.name || ownerLogoConfig?.alt ||
                                 `${ownerParam.charAt(0).toUpperCase() + ownerParam.slice(1)}`;

            // Special handling for known owners to show full names
            if (ownerParam === 'ukidney' && ownerDisplayName === 'UKidney') {
                ownerDisplayName = 'UKidney Medical';
            }

            headerTitle.textContent = `${ownerDisplayName} Documents`;
            headerTitle.classList.remove('loading-text');
        }

        if (ownerLogoConfig && ownerLogoConfig.logo) {
            const logoImg = document.getElementById('headerLogo');
            const logoLink = logoImg?.parentElement; // Get the <a> tag
            console.log('🎨 Logo img element found:', !!logoImg, 'Link element found:', !!logoLink);
            if (logoImg) {
                logoImg.src = ownerLogoConfig.logo;
                logoImg.alt = ownerLogoConfig.alt || `${ownerParam} logo`;
                logoImg.style.display = 'block';
                console.log('🎨 Owner logo set:', ownerLogoConfig.logo);
            }
            if (logoLink && ownerLogoConfig.link) {
                logoLink.href = ownerLogoConfig.link;
                console.log('🔗 Owner logo link set:', ownerLogoConfig.link);
            }
        } else {
            console.log('❌ No logo config found for owner:', ownerParam);
        }

        // In owner mode, don't update document UI - let document selector handle everything
        console.log('🎯 Owner mode active - skipping document UI update');
        return;
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

// User menu functionality
function initializeUserMenu() {
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userMenuDropdown = document.getElementById('userMenuDropdown');
    const signOutBtn = document.getElementById('signOutBtn');

    if (!userMenuBtn || !userMenuDropdown) return;

    // Toggle dropdown
    userMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = userMenuDropdown.classList.contains('open');

        if (isOpen) {
            closeUserMenuDropdown();
        } else {
            openUserMenuDropdown();
        }
    });

    // Sign out functionality
    if (signOutBtn) {
        signOutBtn.addEventListener('click', async () => {
            try {
                // Clear Supabase session
                const sessionKey = 'sb-mlxctdgnojvkgfqldaob-auth-token';
                localStorage.removeItem(sessionKey);

                // Close dropdown
                closeUserMenuDropdown();

                // Hide user menu
                updateUserMenuVisibility();

                // Show success message or redirect
                console.log('👋 User signed out successfully');

                // Optional: Show a brief notification or redirect to login
                // For now, just log and let the UI update naturally

            } catch (error) {
                console.error('Error signing out:', error);
            }
        });
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!userMenuBtn.contains(e.target) && !userMenuDropdown.contains(e.target)) {
            closeUserMenuDropdown();
        }
    });

    // Close dropdown on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeUserMenuDropdown();
        }
    });
}

function openUserMenuDropdown() {
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userMenuDropdown = document.getElementById('userMenuDropdown');

    if (userMenuBtn && userMenuDropdown) {
        userMenuBtn.classList.add('open');
        userMenuDropdown.classList.add('open');
    }
}

function closeUserMenuDropdown() {
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userMenuDropdown = document.getElementById('userMenuDropdown');

    if (userMenuBtn && userMenuDropdown) {
        userMenuBtn.classList.remove('open');
        userMenuDropdown.classList.remove('open');
    }
}

// Initialize (async to ensure document is loaded before health check)
(async () => {
    // Preload logos to prevent layout shift
    await preloadLogos();
    
    // Check document access before initializing
    const urlParams = new URLSearchParams(window.location.search);
    const docParam = urlParams.get('doc');
    if (docParam) {
        const hasAccess = await checkDocumentAccess(docParam);
        if (!hasAccess) {
            // Access denied - modal will handle redirect
            return;
        }
    }

    await initializeDocument();

    // Initialize PubMed popup functionality
    initializePubMedPopup();

    // Initialize AI hint message
    initializeAIHint();

    // Initialize user menu functionality
    initializeUserMenu();

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

    // Check authentication and show/hide user menu
    updateUserMenuVisibility();
})();

/**
 * Check if user is authenticated and show/hide user menu accordingly
 */
function updateUserMenuVisibility() {
    const userMenuSection = document.getElementById('userMenuSection');
    const userEmailElement = document.getElementById('userEmail');

    try {
        // Check for Supabase JWT token
        const sessionKey = 'sb-mlxctdgnojvkgfqldaob-auth-token';
        const sessionData = localStorage.getItem(sessionKey);

        if (sessionData) {
            const session = JSON.parse(sessionData);
            const token = session?.access_token;
            const user = session?.user;

            if (token && user) {
                // User is authenticated, show user menu and populate email
                if (userMenuSection) {
                    userMenuSection.style.display = 'flex';
                    console.log('👤 User menu shown for authenticated user');
                }
                if (userEmailElement && user.email) {
                    userEmailElement.textContent = user.email;
                }
                return;
            }
        }

        // User is not authenticated, hide user menu
        if (userMenuSection) {
            userMenuSection.style.display = 'none';
            console.log('👤 User menu hidden for unauthenticated user');
        }
    } catch (error) {
        console.error('Error checking authentication for user menu:', error);
        if (userMenuSection) userMenuSection.style.display = 'none';
    }
}
