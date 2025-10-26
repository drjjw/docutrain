// Main initialization and event wiring
import { API_URL, generateSessionId, getEmbeddingType, preloadLogos, parseDocumentSlugs } from './config.js';
import { updateDocumentUI, updateModelInTooltip } from './ui.js';
import { sendMessage, setupScrollInterruptDetection, resetAutoScroll } from './chat.js';
import { submitRating } from './rating.js';
import { initializePubMedPopup } from './pubmed-popup.js';
import { initializeAIHint } from './ai-hint.js';
import { checkDocumentAccess } from './access-check.js';
import mobileMenu from './mobile-menu.js';

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

// Mobile keyboard handling fallback
function initializeMobileKeyboardSupport() {
    // Check if we're on a mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (!isMobile) return;

    const inputContainer = document.querySelector('.input-container');
    const chatContainer = document.querySelector('.chat-container');
    
    if (!inputContainer || !chatContainer) return;

    let initialViewportHeight = window.innerHeight;
    let keyboardHeight = 0;

    // Handle viewport changes (keyboard show/hide)
    function handleViewportChange() {
        const currentHeight = window.innerHeight;
        const heightDifference = initialViewportHeight - currentHeight;
        
        // If height decreased significantly, keyboard is likely open
        if (heightDifference > 150) {
            keyboardHeight = heightDifference;
            // Adjust chat container height to prevent overlap
            chatContainer.style.height = `calc(100vh - ${keyboardHeight}px - 200px)`;
            chatContainer.style.minHeight = '200px';
            
            // Scroll to bottom to keep input visible
            setTimeout(() => {
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }, 100);
        } else {
            // Keyboard closed, reset heights
            keyboardHeight = 0;
            chatContainer.style.height = '';
            chatContainer.style.minHeight = '';
        }
    }

    // Listen for resize events
    window.addEventListener('resize', handleViewportChange);
    
    // Listen for focus events on input to ensure proper scrolling
    elements.messageInput.addEventListener('focus', () => {
        setTimeout(() => {
            handleViewportChange();
            // Scroll chat to bottom when input is focused
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }, 300); // Delay to allow keyboard animation
    });

    // Listen for blur events
    elements.messageInput.addEventListener('blur', () => {
        setTimeout(() => {
            handleViewportChange();
        }, 300);
    });

    console.log('📱 Mobile keyboard support initialized');
}

// Initialize mobile keyboard support
initializeMobileKeyboardSupport();

// Mobile header auto-hide functionality
function initializeMobileHeaderBehavior() {
    // Only activate on mobile devices
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (!isMobile || window.innerWidth > 768) return;

    const header = document.getElementById('mainHeader');
    const chatContainer = document.querySelector('.chat-container');
    const messageInput = document.getElementById('messageInput');
    const headerToggle = document.getElementById('mobileHeaderToggle');

    if (!header || !chatContainer || !headerToggle) return;

    let lastScrollTop = 0;
    let scrollThreshold = 50; // pixels to scroll before hiding
    let hideTimeout;
    let isHeaderHidden = false;

    // Function to show header
    function showHeader() {
        header.classList.remove('hidden');
        headerToggle.classList.remove('show');
        isHeaderHidden = false;
        clearTimeout(hideTimeout);
    }

    // Function to hide header
    function hideHeader() {
        if (!messageInput.matches(':focus')) { // Don't hide if input is focused
            header.classList.add('hidden');
            headerToggle.classList.add('show');
            isHeaderHidden = true;
        }
    }

    // Toggle button click handler
    headerToggle.addEventListener('click', () => {
        showHeader();
        autoHideHeader(); // Will auto-hide after delay
    });

    // Function to auto-hide header after delay
    function autoHideHeader() {
        clearTimeout(hideTimeout);
        hideTimeout = setTimeout(() => {
            hideHeader();
        }, 2000); // Hide after 2 seconds of inactivity
    }

    // Scroll detection for auto-hide
    function handleScroll() {
        const currentScrollTop = chatContainer.scrollTop;

        // Show header when scrolling up significantly
        if (currentScrollTop < lastScrollTop - scrollThreshold) {
            showHeader();
            autoHideHeader(); // Will auto-hide after delay
        }
        // Hide header when scrolling down
        else if (currentScrollTop > lastScrollTop + scrollThreshold) {
            hideHeader();
        }

        lastScrollTop = currentScrollTop;
    }

    // Touch events to show header temporarily
    function handleTouchStart() {
        showHeader();
    }

    // Input focus events
    messageInput.addEventListener('focus', () => {
        showHeader();
        clearTimeout(hideTimeout); // Don't auto-hide while typing
    });

    messageInput.addEventListener('blur', () => {
        autoHideHeader(); // Start auto-hide timer when input loses focus
    });

    // Add scroll listener to chat container
    chatContainer.addEventListener('scroll', handleScroll, { passive: true });

    // Add touch listeners to show header on interaction
    document.addEventListener('touchstart', handleTouchStart, { passive: true });

    // Show header initially for a brief moment, then auto-hide
    setTimeout(() => {
        autoHideHeader();
    }, 1000);

    console.log('📱 Mobile header auto-hide behavior initialized');
}

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
            const { documentExists, getDocument } = await import('./config.js');
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
        const { getOwnerLogoConfig } = await import('./config.js');
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
            if (logoLink) {
                // Check if owner_link=false parameter is present to disable logo link
                const urlParams = new URLSearchParams(window.location.search);
                const ownerLinkDisabled = urlParams.get('owner_link') === 'false';
                
                if (ownerLinkDisabled) {
                    // Disable logo link functionality
                    logoLink.href = '#';
                    logoLink.title = `${ownerLogoConfig.alt || ownerParam} logo`;
                    logoLink.style.cursor = 'default';
                    logoLink.onclick = (e) => e.preventDefault();
                    
                    console.log('🔗 Owner logo link disabled due to owner_link=false parameter');
                } else {
                    // Override logo link to navigate to owner's chat page
                    logoLink.href = `/chat?owner=${encodeURIComponent(ownerParam)}`;
                    logoLink.title = `View all documents for ${ownerLogoConfig.alt || ownerParam}`;
                    
                    // Remove target="_blank" to navigate in same window
                    logoLink.removeAttribute('target');
                    logoLink.removeAttribute('rel');
                    
                    console.log('🔗 Owner logo link set to navigate to owner page:', logoLink.href);
                }
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

// Load user avatar based on owner group
async function loadUserAvatar() {
    try {
        // Get JWT token from Supabase session
        const sessionKey = 'sb-mlxctdgnojvkgfqldaob-auth-token';
        const sessionData = localStorage.getItem(sessionKey);
        
        if (!sessionData) {
            return; // Not logged in, keep default icon
        }

        const session = JSON.parse(sessionData);
        const token = session?.access_token;

        if (!token) {
            return; // No token, keep default icon
        }

        // Fetch user permissions to get owner group info
        const response = await fetch(`${API_URL}/api/permissions`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            console.error('Failed to fetch user permissions');
            return;
        }

        const data = await response.json();
        const userAvatar = document.querySelector('.user-avatar');
        
        if (!userAvatar) return;

        // Check if user is super admin or has owner groups
        const isSuperAdmin = data.is_super_admin;
        const ownerGroups = data.owner_groups || [];

        if (isSuperAdmin) {
            // Super admin: keep the default user icon (already in HTML)
            console.log('Super admin: using default user icon');
            return;
        }

        // For ALL users with owner groups: use the first owner group's logo
        if (ownerGroups.length > 0) {
            const primaryOwner = ownerGroups[0];
            
            // Fetch accessible owners to get logo_url
            const ownerResponse = await fetch(`${API_URL}/api/permissions/accessible-owners`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (ownerResponse.ok) {
                const owners = await ownerResponse.json();
                const ownerData = owners.find(o => o.owner_id === primaryOwner.owner_id);
                
                if (ownerData && ownerData.logo_url) {
                    // Replace SVG icon with owner logo image
                    userAvatar.innerHTML = `<img src="${ownerData.logo_url}" alt="${ownerData.owner_name}" class="owner-logo" />`;
                    console.log(`Loaded owner logo for: ${ownerData.owner_name}`);
                }
            }
        }
    } catch (error) {
        console.error('Error loading user avatar:', error);
        // Keep default icon on error
    }
}

// User menu functionality
async function initializeUserMenu() {
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userMenuDropdown = document.getElementById('userMenuDropdown');
    const signOutBtn = document.getElementById('signOutBtn');

    if (!userMenuBtn || !userMenuDropdown) return;

    // Load user avatar/owner logo
    await loadUserAvatar();

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

                // Hide user menu and update mobile menu
                await updateUserMenuVisibility();

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
        // Handle multi-document URLs by parsing on + or space (URL decoding)
        const documentSlugs = docParam.split(/[\s+]+/).map(s => s.trim()).filter(s => s);

        console.log('🔒 Checking access to documents before init:', documentSlugs.join(', '));

        // Check access for each document individually
        const accessResults = await Promise.all(documentSlugs.map(slug => checkDocumentAccess(slug)));
        const hasAccess = accessResults.every(result => result === true);

        if (!hasAccess) {
            console.log('🚫 Access denied for one or more documents - aborting initialization');
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

    // Initialize mobile menu and update visibility
    await mobileMenu.updateVisibility();

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
async function updateUserMenuVisibility() {
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
                
                // Update mobile menu visibility
                await mobileMenu.updateVisibility();
                return;
            }
        }

        // User is not authenticated, hide user menu
        if (userMenuSection) {
            userMenuSection.style.display = 'none';
            console.log('👤 User menu hidden for unauthenticated user');
        }
        
        // Update mobile menu visibility
        await mobileMenu.updateVisibility();
    } catch (error) {
        console.error('Error checking authentication for user menu:', error);
        if (userMenuSection) userMenuSection.style.display = 'none';
    }
}
