// UI Document - Document UI management and orchestration
import { getDocument, getOwnerLogoConfig, parseDocumentSlugs, getBackButtonURL, API_URL } from './config.js';
import { updateMetaTags, darkenColor, hexToRgba, equalizeContainerHeights, equalizeDownloadsKeywordsHeights } from './ui-utils.js';
import { addDownloadsToWelcome } from './ui-downloads.js';
import { addKeywordsDisplay } from './ui-keywords.js';

// Helper to safely use debugLog (fallback to console if not available yet)
const log = {
    verbose: (...args) => window.debugLog ? window.debugLog.verbose(...args) : log.verbose(...args),
    normal: (...args) => window.debugLog ? window.debugLog.normal(...args) : log.verbose(...args),
    quiet: (...args) => window.debugLog ? window.debugLog.quiet(...args) : log.verbose(...args),
    always: (...args) => log.verbose(...args),
    warn: (...args) => console.warn(...args),
    error: (...args) => console.error(...args)
};

// Track if document modal has been shown to prevent multiple displays
let documentModalShown = false;

// Update document UI based on selected document (now async with registry)
export async function updateDocumentUI(selectedDocument, forceRefresh = false) {
    const uiStart = performance.now();
    log.verbose('    ┌─ updateDocumentUI() started');
    log.verbose(`    │  → Document: ${selectedDocument || 'none'}`);
    log.verbose(`    │  → Force refresh: ${forceRefresh}`);

    // Get sendButton element for use throughout function
    const buttonStart = performance.now();
    let sendButton = document.getElementById('sendButton');
    log.verbose(`    │  → Send button found: ${!!sendButton} (${(performance.now() - buttonStart).toFixed(2)}ms)`);

    // Skip document modal for goodbye route
    const isGoodbyeRoute = window.location.pathname === '/goodbye';
    if (isGoodbyeRoute) {
        log.verbose('👋 Goodbye route detected - skipping document modal');
        return;
    }

    // Handle case where no document is selected - show document selection modal
    // But skip if owner parameter is present (document selector will be shown instead)
    const urlParams = new URLSearchParams(window.location.search);
    const hasOwnerParam = urlParams.has('owner');

    if (!selectedDocument && !hasOwnerParam) {

        // Only show modal once to avoid annoying users
        if (!documentModalShown) {
            documentModalShown = true;

            // SweetAlert2 is loaded globally
            // Show modal explaining document selection is required

            // First, fetch available owners for autocomplete
            let availableOwners = [];
            try {
                const response = await fetch(`${API_URL}/api/owners`);
                if (response.ok) {
                    const data = await response.json();
                    availableOwners = Object.keys(data.owners || {});
                }
            } catch (error) {
                console.warn('Failed to fetch owners for autocomplete:', error);
            }

            Swal.fire({
                title: 'Document or Owner Required',
                html: `
                    <style>
                        .doc-modal-row {
                            display: flex;
                            gap: 8px;
                        }
                        @media (max-width: 600px) {
                            .doc-modal-row {
                                flex-direction: column;
                            }
                        }
                    </style>
                    <div style="text-align: left; line-height: 1.6;">
                        <div style="margin-top: 20px;">
                            <label for="documentSlugInput" style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">Enter document slug:</label>
                            <div class="doc-modal-row">
                                <input
                                    id="documentSlugInput"
                                    type="text"
                                    placeholder="e.g., smh, maker-foh"
                                    style="flex: 1; padding: 12px; border: 2px solid #ddd; border-radius: 6px; font-size: 16px; box-sizing: border-box;"
                                    autofocus
                                >
                                <button
                                    id="loadDocumentBtn"
                                    style="flex: 1; padding: 12px; background: #007bff; color: white; border: none; border-radius: 6px; font-size: 16px; font-weight: 600; cursor: pointer; white-space: nowrap;"
                                    onmouseover="this.style.background='#0056b3'"
                                    onmouseout="this.style.background='#007bff'"
                                >
                                    Load Document
                                </button>
                            </div>
                        </div>
                        <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #eee;">
                            <label for="ownerSlugInput" style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">Or enter owner group:</label>
                            <div class="doc-modal-row">
                                <input
                                    id="ownerSlugInput"
                                    type="text"
                                    placeholder="e.g., ukidney, maker"
                                    style="flex: 1; padding: 12px; border: 2px solid #ddd; border-radius: 6px; font-size: 16px; box-sizing: border-box;"
                                >
                                <button
                                    id="loadOwnerBtn"
                                    style="flex: 1; padding: 12px; background: #28a745; color: white; border: none; border-radius: 6px; font-size: 16px; font-weight: 600; cursor: pointer; white-space: nowrap;"
                                    onmouseover="this.style.background='#218838'"
                                    onmouseout="this.style.background='#28a745'"
                                >
                                    Load Owner
                                </button>
                            </div>
                        </div>
                    </div>
                `,
                imageUrl: '/app/assets/docutrain-icon-BAjKzxZF.png',
                imageWidth: 100,
                imageAlt: 'DocuTrain',
                showConfirmButton: false,
                allowOutsideClick: false,
                allowEscapeKey: false,
                customClass: {
                    popup: 'document-modal'
                },
                didOpen: () => {
                    const slugInput = document.getElementById('documentSlugInput');
                    const ownerInput = document.getElementById('ownerSlugInput');
                    
                    // Clear owner input when typing in document input
                    slugInput.addEventListener('input', () => {
                        if (slugInput.value.trim()) {
                            ownerInput.value = '';
                        }
                    });
                    
                    // Clear document input when typing in owner input
                    ownerInput.addEventListener('input', () => {
                        if (ownerInput.value.trim()) {
                            slugInput.value = '';
                        }
                    });
                    
                    // Handle Load Document button
                    document.getElementById('loadDocumentBtn').addEventListener('click', () => {
                        const slug = slugInput.value.trim();
                        
                        if (!slug) {
                            Swal.showValidationMessage('Please enter a document slug');
                            return;
                        }
                        
                        window.location.href = `/chat?doc=${encodeURIComponent(slug)}`;
                    });
                    
                    // Handle Load Owner button
                    document.getElementById('loadOwnerBtn').addEventListener('click', () => {
                        const owner = ownerInput.value.trim();
                        
                        if (!owner) {
                            Swal.showValidationMessage('Please enter an owner group');
                            return;
                        }
                        
                        window.location.href = `/chat?owner=${encodeURIComponent(owner)}`;
                    });
                    
                    // Allow Enter key in document input to trigger Load Document
                    slugInput.addEventListener('keypress', (e) => {
                        if (e.key === 'Enter') {
                            document.getElementById('loadDocumentBtn').click();
                        }
                    });
                    
                    // Allow Enter key in owner input to trigger Load Owner
                    ownerInput.addEventListener('keypress', (e) => {
                        if (e.key === 'Enter') {
                            document.getElementById('loadOwnerBtn').click();
                        }
                    });
                }
            });
        }

        // Set minimal generic interface
        const headerTitle = document.getElementById('headerTitle');
        const welcomeTitle = document.getElementById('welcomeTitle');
        
        if (headerTitle) headerTitle.textContent = 'Document Assistant';
        if (welcomeTitle) welcomeTitle.textContent = 'Document Required';
        
        // Reset meta tags to defaults
        updateMetaTags('AI Document Assistant', 'AI-powered document assistant for medical guidelines and research papers');

        // Hide interface elements that require a document
        const subtitleElement = document.getElementById('headerSubtitle');
        if (subtitleElement) subtitleElement.textContent = 'Please specify a document';

        const backLink = document.querySelector('.back-link');
        if (backLink) {
            backLink.style.display = 'none';
        }

        // Disable input and send button
        const messageInput = document.getElementById('messageInput');
        if (messageInput) messageInput.disabled = true;
        if (sendButton) sendButton.disabled = true;

        // Clear about tooltip
        const documentNameElement = document.getElementById('documentName');
        if (documentNameElement) {
            documentNameElement.textContent = 'Document Assistant';
        }

        // Reset logo to generic
        const logoElement = document.querySelector('.header-logo img');
        const logoLink = document.getElementById('logoLink');
        if (logoElement && logoLink) {
            logoElement.style.display = 'none'; // Hide logo when no document
        }

        // Hide cover image layout and regular welcome when no document selected
        const coverContainer = document.getElementById('documentCoverContainer');
        const regularWelcome = document.getElementById('regularWelcomeMessage');
        if (coverContainer) {
            coverContainer.style.display = 'none';
        }
        if (regularWelcome) {
            regularWelcome.style.display = 'none'; // Hide when no document
        }

        return;
    }

    // Handle multi-document case: selectedDocument can be "slug1+slug2" or just "slug"
    const parseStart = performance.now();
    const documentSlugs = selectedDocument && selectedDocument.includes('+') ? selectedDocument.split('+').map(s => s.trim()) : selectedDocument ? [selectedDocument] : [];
    const isMultiDoc = documentSlugs.length > 1;
    log.verbose(`    │  → Parsed ${documentSlugs.length} slug(s): ${documentSlugs.join(', ')} (${(performance.now() - parseStart).toFixed(2)}ms)`);
    
    // Fetch all document configs
    const fetchStart = performance.now();
    log.verbose('    │  → Fetching document configs...');
    const configs = await Promise.all(
        documentSlugs.map(slug => getDocument(slug, forceRefresh))
    );
    log.verbose(`    │     Configs fetched (${(performance.now() - fetchStart).toFixed(2)}ms)`);
    
    // Filter out null configs
    const validConfigs = configs.filter(c => c !== null);
    log.verbose(`    │  → Valid configs: ${validConfigs.length}/${configs.length}`);
    
    if (validConfigs.length === 0 && !isMultiDoc) {
        console.error(`    │  ❌ No documents found for: ${selectedDocument || 'null'}`);
        log.verbose(`    └─ updateDocumentUI() aborted in ${(performance.now() - uiStart).toFixed(2)}ms`);
        return;
    }
    
    // Use first document as primary for most properties
    const config = validConfigs[0];
    log.verbose(`    │  → Primary config: ${config.slug} - ${config.title}`);
    
    // Build combined title
    const combinedTitle = validConfigs.map(c => c.title).join(' + ');
    document.getElementById('headerTitle').textContent = combinedTitle;

    // Build combined welcome message (always needed)
    const combinedWelcome = validConfigs.map(c => c.welcomeMessage).join(' and ');
    
    // Build description for meta tags
    const metaDescription = isMultiDoc 
        ? `Multi-document search across ${validConfigs.length} documents: ${combinedTitle}`
        : (config.subtitle || config.welcomeMessage || 'AI-powered document assistant');
    
    // Update page meta tags with document information
    updateMetaTags(combinedTitle, metaDescription);

    // Store current PMID for PubMed popup functionality
    const metadata = config.metadata || {};
    const currentPMID = metadata.pmid || metadata.pubmed_id || metadata.PMID;

    // Update question mark icon visibility based on PMID availability
    const aboutIcon = document.getElementById('aboutIcon');
    if (currentPMID) {
        aboutIcon.style.display = 'flex';
        // Store PMID on the icon for PubMed popup functionality
        aboutIcon.dataset.pmid = currentPMID;
    } else {
        aboutIcon.style.display = 'none';
        delete aboutIcon.dataset.pmid;
    }

    // Update subtitle - for multi-doc, show document count (if element exists)
    const subtitleElement = document.getElementById('headerSubtitle');
    if (subtitleElement) {
        if (isMultiDoc) {
            subtitleElement.textContent = `Multi-document search across ${validConfigs.length} documents`;
        } else {
            // Build subtitle with Category | Year format with icons
            log.verbose('🏷️ Document config for subtitle:', { category: config.category, year: config.year });
            const subtitleParts = [];
            
            if (config.category) {
                // Add category with folder icon
                subtitleParts.push(`<svg class="subtitle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>${config.category}`);
            }
            if (config.year) {
                // Add year with calendar icon
                subtitleParts.push(`<svg class="subtitle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>${config.year}`);
            }
            
            // If we have category or year, show them separated by pipe with HTML
            if (subtitleParts.length > 0) {
                subtitleElement.innerHTML = subtitleParts.join(' <span class="subtitle-separator">|</span> ');
                log.verbose('🏷️ Subtitle set to:', subtitleParts.join(' | '));
            } else {
                // Fallback to original subtitle if no category/year
                subtitleElement.textContent = config.subtitle || '';
                log.verbose('🏷️ Using fallback subtitle:', config.subtitle);
            }
        }
    }

    // Update back link based on URL parameter
    const backLink = document.querySelector('.back-link');
    if (backLink) {
        const backButtonURL = getBackButtonURL();
        
        if (backButtonURL) {
            // Show back button with URL from parameter
            backLink.href = backButtonURL;
            backLink.style.display = '';
        } else {
            // Hide back button if no URL parameter provided
            backLink.style.display = 'none';
        }
    }

    // Update about tooltip document name
    const documentNameElement = document.getElementById('documentName');
    if (documentNameElement) {
        documentNameElement.textContent = combinedWelcome;
    }

    // Enable input and send button when document is selected
    const messageInput = document.getElementById('messageInput');
    if (messageInput) messageInput.disabled = false;
    if (sendButton) sendButton.disabled = false;

    // Update header logo based on document owner
    const logoStart = performance.now();
    const ownerSlug = config.ownerInfo?.slug || config.owner;
    log.verbose(`    │  → Updating logo for owner: ${ownerSlug}`);
    
    const logoConfigStart = performance.now();
    const logoConfig = await getOwnerLogoConfig(ownerSlug);
    log.verbose(`    │     Logo config retrieved (${(performance.now() - logoConfigStart).toFixed(2)}ms):`, logoConfig);

    const logoElement = document.querySelector('.header-logo img');
    const logoLink = document.getElementById('logoLink');
    log.verbose(`    │     Logo elements found: img=${!!logoElement}, link=${!!logoLink}`);

    if (logoElement && logoLink) {
        if (logoConfig) {
            // Show logo for recognized owners
            logoElement.style.display = ''; // Show logo
            logoElement.src = logoConfig.logo;
            logoElement.alt = logoConfig.alt;
            
            // Check if owner_link=false parameter is present to disable logo link
            const urlParams = new URLSearchParams(window.location.search);
            const ownerLinkDisabled = urlParams.get('owner_link') === 'false';
            
            if (ownerLinkDisabled) {
                // Disable logo link functionality
                logoLink.href = '#';
                logoLink.title = `${logoConfig.alt} logo`;
                logoLink.style.cursor = 'default';
                logoLink.onclick = (e) => e.preventDefault();
                
                log.verbose('🔗 Owner logo link disabled due to owner_link=false parameter');
            } else {
                // Override logo link to navigate to owner's chat page
                logoLink.href = `/chat?owner=${encodeURIComponent(ownerSlug)}`;
                logoLink.title = `View all documents for ${logoConfig.alt}`;
                
                // Remove target="_blank" to navigate in same window
                logoLink.removeAttribute('target');
                logoLink.removeAttribute('rel');
                
                log.verbose('🔗 Owner logo link set to navigate to owner page:', logoLink.href);
            }

            log.verbose(`🎨 Logo set: src=${logoConfig.logo}, alt=${logoConfig.alt}`);

            // Update accent colors dynamically using CSS variables
            if (logoConfig.accentColor) {
                const root = document.documentElement;
                root.style.setProperty('--accent-color', logoConfig.accentColor);

                // Generate RGB values for use in rgba() functions
                const hex = logoConfig.accentColor.replace('#', '');
                const r = parseInt(hex.substr(0, 2), 16);
                const g = parseInt(hex.substr(2, 2), 16);
                const b = parseInt(hex.substr(4, 2), 16);
                root.style.setProperty('--accent-color-rgb', `${r}, ${g}, ${b}`);

                // Generate hover color (darker version)
                const hoverColor = darkenColor(logoConfig.accentColor, 0.15);
                root.style.setProperty('--accent-color-hover', hoverColor);

                // Generate shadow color (semi-transparent version)
                const shadowColor = hexToRgba(logoConfig.accentColor, 0.2);
                root.style.setProperty('--accent-color-shadow', shadowColor);

                log.verbose(`🎨 Header logo and accent color updated for owner: ${ownerSlug} (${logoConfig.alt}) - ${logoConfig.accentColor}`);
            }
        } else {
            // Hide logo for unrecognized owners (multi-tenant behavior)
            logoElement.style.display = 'none';
            log.verbose(`🎨 Header logo hidden for owner: ${ownerSlug} (no logo configured)`);
        }
    }

    // Update submit button theme based on document owner
    if (sendButton) {
        if (ownerSlug === 'maker') {
            sendButton.classList.add('maker-theme');
            log.verbose(`🎨 Submit button updated to maker theme (yellow)`);
        } else {
            sendButton.classList.remove('maker-theme');
            log.verbose(`🎨 Submit button updated to dynamic accent theme`);
        }
    }

    log.verbose(`    │     Logo processing complete (${(performance.now() - logoStart).toFixed(2)}ms)`);

    // Update document cover and welcome message display
    const coverStart = performance.now();
    log.verbose('    │  → Processing document cover and welcome message...');
    let coverContainer = document.getElementById('documentCoverContainer');
    const regularWelcome = document.getElementById('regularWelcomeMessage');
    const chatContainer = document.getElementById('chatContainer');

    if (chatContainer && regularWelcome) {
        // Build combined welcome message
        const combinedWelcome = validConfigs.map(c => c.welcomeMessage).join(' and ');

        // Determine intro message for display
        // For multi-doc: check if all have same owner and intro, otherwise show nothing
        let introMessage = null;
        if (isMultiDoc) {
            const introMessages = validConfigs.map(c => c.introMessage).filter(m => m);
            const uniqueIntros = [...new Set(introMessages)];
            // Only show intro if all documents have the same intro message
            if (uniqueIntros.length === 1) {
                introMessage = uniqueIntros[0];
            }
        } else {
            // Single document - use its intro message if available
            introMessage = config.introMessage || null;
        }

        // Check if cover exists and is not empty/whitespace
        const hasValidCover = config.cover && typeof config.cover === 'string' && config.cover.trim().length > 0;

        // Always show cover section for single documents, using placeholder if no cover available
        if (!isMultiDoc) {
            // Create cover container if it doesn't exist
            if (!coverContainer) {
                coverContainer = document.createElement('div');
                coverContainer.id = 'documentCoverContainer';
                coverContainer.className = 'document-cover-and-welcome';
                coverContainer.innerHTML = `
                    <div class="document-cover-section">
                        <img id="documentCoverImage" class="document-cover-image" alt="" loading="lazy">
                        <div class="document-cover-overlay">
                            <div class="document-cover-title">${config.title}</div>
                            <div class="document-cover-meta" id="documentCoverMeta"></div>
                        </div>
                    </div>
                    <div class="welcome-message-section">
                        <div class="message assistant" id="welcomeMessage">
                            <div class="message-content">
                                <strong id="welcomeTitle" class="loading-text">${combinedWelcome}</strong>
                                <div id="welcomeIntroContent"></div>
                            </div>
                        </div>
                    </div>
                `;
                // Insert before regular welcome message
                chatContainer.insertBefore(coverContainer, regularWelcome);
            } else {
                // Update existing welcome title
                const welcomeTitleElement = coverContainer.querySelector('#welcomeTitle');
                if (welcomeTitleElement) {
                    welcomeTitleElement.innerHTML = combinedWelcome;
                }
            }

            // Update intro content with HTML
            const welcomeIntroContent = coverContainer.querySelector('#welcomeIntroContent');
            const messageContent = coverContainer.querySelector('.message-content');
            
            // Display intro message from database, but filter out any keyword HTML that shouldn't be there
            if (welcomeIntroContent && introMessage) {
                // Use DOM to safely remove keyword elements if they exist in the intro message
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = introMessage;
                
                // Remove any keyword-related elements (these should only be in downloads/keywords container)
                const keywordElements = tempDiv.querySelectorAll('.document-keywords, .keywords-header, .keywords-wordcloud');
                keywordElements.forEach(el => el.remove());
                
                welcomeIntroContent.innerHTML = tempDiv.innerHTML;
            } else if (welcomeIntroContent) {
                welcomeIntroContent.innerHTML = '';
            }
            
            // Create downloads/keywords container below cover+welcome section
            let downloadsKeywordsContainer = document.getElementById('downloadsKeywordsContainer');
            if (!downloadsKeywordsContainer) {
                downloadsKeywordsContainer = document.createElement('div');
                downloadsKeywordsContainer.id = 'downloadsKeywordsContainer';
                downloadsKeywordsContainer.className = 'downloads-keywords-container';
                // Insert after cover container
                if (coverContainer && coverContainer.nextSibling) {
                    chatContainer.insertBefore(downloadsKeywordsContainer, coverContainer.nextSibling);
                } else {
                    chatContainer.appendChild(downloadsKeywordsContainer);
                }
            } else {
                // Clear existing content
                downloadsKeywordsContainer.innerHTML = '';
            }
            
            // Add keywords display first (left side, 3/5 width) - append to new container
            // IMPORTANT: Do this AFTER setting intro content to ensure clean separation
            console.log('🔑 Keywords check:', { 
                hasKeywords: !!config.keywords, 
                keywordsCount: config.keywords?.length || 0,
                keywords: config.keywords 
            });
            addKeywordsDisplay(downloadsKeywordsContainer, config.keywords);
            
            // Add downloads section to new container (right side, 2/5 width)
            addDownloadsToWelcome(downloadsKeywordsContainer, validConfigs);
            
            
            // Show/hide container based on content
            const hasDownloads = downloadsKeywordsContainer.querySelector('.downloads-section');
            const hasKeywords = downloadsKeywordsContainer.querySelector('.document-keywords');
            if (hasDownloads || hasKeywords) {
                downloadsKeywordsContainer.style.display = 'flex';
                // Equalize heights after a brief delay to ensure DOM is fully rendered
                setTimeout(() => {
                    equalizeDownloadsKeywordsHeights();
                }, 100);
            } else {
                downloadsKeywordsContainer.style.display = 'none';
            }
            
            // Clean up any downloads/keywords that might have been left in welcome message (legacy cleanup)
            const existingDownloadsInWelcome = messageContent?.querySelector('.downloads-section');
            const existingKeywordsInWelcome = messageContent?.querySelector('.document-keywords');
            if (existingDownloadsInWelcome) existingDownloadsInWelcome.remove();
            if (existingKeywordsInWelcome) existingKeywordsInWelcome.remove();

            // Show cover image layout and hide regular welcome
            const coverImage = coverContainer.querySelector('#documentCoverImage');
            if (coverImage) {
                // Use document cover if available, otherwise use placeholder
                const imageSrc = hasValidCover ? config.cover.trim() : '/chat-cover-place.png';
                const imageLoadStart = performance.now();
                log.verbose(`    │     Loading cover image: ${imageSrc}`);
                
                coverImage.src = imageSrc;
                coverImage.alt = hasValidCover ? `${config.title} - Title Slide` : `${config.title} - Cover Placeholder`;

                // Handle height adjustments after image loads
                coverImage.onload = () => {
                    const imageLoadTime = performance.now() - imageLoadStart;
                    log.verbose(`    │     ✓ Cover image loaded (${imageLoadTime.toFixed(2)}ms)`);
                    
                    // On mobile, the height is now responsive to aspect ratio
                    // On desktop, equalize container heights
                    const equalizeStart = performance.now();
                    equalizeContainerHeights();
                    log.verbose(`    │     Container heights equalized (${(performance.now() - equalizeStart).toFixed(2)}ms)`);
                };
                
                coverImage.onerror = () => {
                    const imageLoadTime = performance.now() - imageLoadStart;
                    console.error(`    │     ❌ Cover image failed to load (${imageLoadTime.toFixed(2)}ms): ${imageSrc}`);
                };
            }

            // Add category and year to cover overlay
            const coverMetaElement = coverContainer.querySelector('#documentCoverMeta');
            if (coverMetaElement) {
                const metaParts = [];

                if (config.category) {
                    metaParts.push(config.category);
                }
                if (config.year) {
                    metaParts.push(config.year);
                }

                // Join with pipe separator if we have both category and year
                if (metaParts.length > 0) {
                    coverMetaElement.textContent = metaParts.join(' | ');
                    log.verbose('🏷️ Cover meta set to:', metaParts.join(' | '));
                } else {
                    coverMetaElement.textContent = '';
                }
            }
            coverContainer.style.display = 'flex';
            regularWelcome.style.display = 'none';
            log.verbose(`    │     Cover image layout displayed: ${config.cover}`);
        } else {
            // Multi-document search - create a grid of document covers
            log.verbose(`    │     Creating multi-document cover grid for ${validConfigs.length} documents`);

            // Remove existing cover container if it exists
            if (coverContainer) {
                coverContainer.remove();
            }

            // Create multi-document cover grid container
            const multiDocContainer = document.createElement('div');
            multiDocContainer.id = 'multiDocumentCoverContainer';
            multiDocContainer.className = 'multi-document-cover-grid';

            // Build HTML string step by step to avoid template literal issues
            let html = `
                <div class="multi-doc-covers-header">
                    <h3>Multi-Document Search</h3>
                    <p>Searching across ${validConfigs.length} documents</p>
                </div>
                <div class="multi-doc-covers-grid">`;

            // Add each document cover
            if (validConfigs.length > 0) {
                validConfigs.forEach((docConfig, index) => {
                    const hasValidCover = docConfig.cover && typeof docConfig.cover === 'string' && docConfig.cover.trim().length > 0;
                    const imageSrc = hasValidCover ? docConfig.cover.trim() : '/chat-cover-place.png';
                    const metaParts = [];
                    if (docConfig.category) metaParts.push(docConfig.category);
                    if (docConfig.year) metaParts.push(docConfig.year);
                    const metaText = metaParts.length > 0 ? metaParts.join(' | ') : '';
                    const altText = `${docConfig.title} - ${hasValidCover ? 'Title Slide' : 'Cover Placeholder'}`;

                    html += `
                        <div class="multi-doc-cover-item" data-doc-slug="${docConfig.slug}">
                            <div class="multi-doc-cover-image-container">
                                <img src="${imageSrc}" alt="${altText}" class="multi-doc-cover-image" loading="lazy">
                                <div class="multi-doc-cover-overlay">
                                    <div class="multi-doc-cover-title">${docConfig.title}</div>
                                    <div class="multi-doc-cover-meta">${metaText}</div>
                                </div>
                            </div>
                        </div>`;
                });
            } else {
                // Show placeholder for missing documents
                html += `
                    <div class="multi-doc-cover-item">
                        <div class="multi-doc-cover-image-container">
                            <img src="/chat-cover-place.png" alt="Document not found" class="multi-doc-cover-image" loading="lazy">
                            <div class="multi-doc-cover-overlay">
                                <div class="multi-doc-cover-title">Document Not Found</div>
                                <div class="multi-doc-cover-meta">Please check document slug</div>
                            </div>
                        </div>
                    </div>`;
            }

            html += `
                </div>
                <div class="multi-doc-welcome-section">
                    <div class="message assistant">
                        <div class="message-content">
                            <strong>${combinedWelcome}</strong>`;

            if (introMessage) {
                html += `<div class="multi-doc-intro-content">${introMessage}</div>`;
            }

            html += `
                        </div>
                    </div>
                </div>`;

            multiDocContainer.innerHTML = html;

            // Insert before regular welcome message
            if (chatContainer && regularWelcome && multiDocContainer) {
                chatContainer.insertBefore(multiDocContainer, regularWelcome);
                log.verbose(`    │     Multi-document container inserted successfully`);
            } else {
                log.error(`    │     ❌ Failed to insert multi-document container - chatContainer: ${!!chatContainer}, regularWelcome: ${!!regularWelcome}, multiDocContainer: ${!!multiDocContainer}`);
            }

            // Create downloads/keywords container below multi-doc section
            let downloadsKeywordsContainer = document.getElementById('downloadsKeywordsContainer');
            if (!downloadsKeywordsContainer) {
                downloadsKeywordsContainer = document.createElement('div');
                downloadsKeywordsContainer.id = 'downloadsKeywordsContainer';
                downloadsKeywordsContainer.className = 'downloads-keywords-container';
                // Insert after multi-doc container
                if (multiDocContainer && multiDocContainer.nextSibling) {
                    chatContainer.insertBefore(downloadsKeywordsContainer, multiDocContainer.nextSibling);
                } else {
                    chatContainer.appendChild(downloadsKeywordsContainer);
                }
            } else {
                // Clear existing content
                downloadsKeywordsContainer.innerHTML = '';
            }
            
            // Add keywords from first document if available (left side, 3/5 width)
            // For multi-doc, show first doc's keywords
            if (validConfigs.length > 0 && validConfigs[0].keywords) {
                addKeywordsDisplay(downloadsKeywordsContainer, validConfigs[0].keywords);
            }
            
            // Add downloads section to new container (right side, 2/5 width)
            addDownloadsToWelcome(downloadsKeywordsContainer, validConfigs);
            
            // Show/hide container based on content
            const hasDownloads = downloadsKeywordsContainer.querySelector('.downloads-section');
            const hasKeywords = downloadsKeywordsContainer.querySelector('.document-keywords');
            if (hasDownloads || hasKeywords) {
                downloadsKeywordsContainer.style.display = 'flex';
                // Equalize heights after a brief delay to ensure DOM is fully rendered
                setTimeout(() => {
                    equalizeDownloadsKeywordsHeights();
                }, 100);
            } else {
                downloadsKeywordsContainer.style.display = 'none';
            }
            
            // Clean up any downloads/keywords that might have been left in welcome message (legacy cleanup)
            const welcomeContent = multiDocContainer.querySelector('.message-content');
            if (welcomeContent) {
                const existingDownloadsInWelcome = welcomeContent.querySelector('.downloads-section');
                const existingKeywordsInWelcome = welcomeContent.querySelector('.document-keywords');
                if (existingDownloadsInWelcome) existingDownloadsInWelcome.remove();
                if (existingKeywordsInWelcome) existingKeywordsInWelcome.remove();
            }

            // Hide regular welcome since we're showing multi-doc covers
            regularWelcome.style.display = 'none';

            log.verbose(`    │     Multi-document cover grid displayed with ${validConfigs.length} covers`);
        }
        log.verbose(`    │     Cover/welcome processing complete (${(performance.now() - coverStart).toFixed(2)}ms)`);
    }

    log.verbose(`    │  ✓ Document set to: ${selectedDocument ? selectedDocument.toUpperCase() : 'NONE'} - ${config.welcomeMessage}`);
    
    // Initialize inline editors if user has edit permissions (single document only)
    console.log(`🔧 [INLINE EDITOR] Checking conditions: isMultiDoc=${isMultiDoc}, validConfigs.length=${validConfigs.length}`);
    log.verbose(`    │  → Checking if inline editors should be initialized: isMultiDoc=${isMultiDoc}, validConfigs.length=${validConfigs.length}`);
    if (!isMultiDoc && validConfigs.length === 1) {
        console.log(`🔧 [INLINE EDITOR] Conditions met - initializing for ${config.slug}`);
        log.verbose(`    │  → Conditions met - calling initializeInlineEditors for ${config.slug}`);
        await initializeInlineEditors(config.slug, config);
    } else {
        console.log(`🔧 [INLINE EDITOR] Skipping - isMultiDoc: ${isMultiDoc}, validConfigs.length: ${validConfigs.length}`);
        log.verbose(`    │  → Skipping inline editors - isMultiDoc: ${isMultiDoc}, validConfigs.length: ${validConfigs.length}`);
    }
    
    log.verbose(`    └─ updateDocumentUI() completed in ${(performance.now() - uiStart).toFixed(2)}ms`);
}

/**
 * Initialize inline editors for document fields
 * Only shows edit controls if user has edit permissions
 */
async function initializeInlineEditors(documentSlug, documentConfig) {
    console.log(`🔧 [INLINE EDITOR] Starting initialization for ${documentSlug}`);
    log.verbose(`    │  → Starting inline editor initialization for ${documentSlug}`);
    try {
        // Dynamic import to avoid circular dependencies
        console.log(`🔧 [INLINE EDITOR] Importing modules...`);
        log.verbose(`    │  → Importing document-ownership.js...`);
        const { canEditDocument } = await import('./document-ownership.js');
        console.log(`🔧 [INLINE EDITOR] document-ownership imported`);
        log.verbose(`    │  → Importing inline-editor.js...`);
        const { initInlineEditor } = await import('./inline-editor.js');
        console.log(`🔧 [INLINE EDITOR] inline-editor imported`);
        
        // Check if user can edit this document
        console.log(`🔧 [INLINE EDITOR] Checking permissions for ${documentSlug}...`);
        log.verbose(`    │  → Checking edit permissions for ${documentSlug}...`);
        const canEdit = await canEditDocument(documentSlug);
        
        console.log(`🔧 [INLINE EDITOR] Permission result: ${canEdit}`);
        log.verbose(`    │  → Edit permission result: ${canEdit}`);
        
        if (!canEdit) {
            log.verbose('    │  → User does not have edit permissions - skipping inline editors');
            return;
        }
        
        log.verbose(`    │  → Initializing inline editors for ${documentSlug}`);
        
        // Initialize editors for different fields
        const headerTitle = document.getElementById('headerTitle');
        if (headerTitle) {
            initInlineEditor(headerTitle, {
                field: 'title',
                documentSlug: documentSlug,
                type: 'text',
                originalValue: documentConfig.title
            });
        }
        
        const headerSubtitle = document.getElementById('headerSubtitle');
        if (headerSubtitle) {
            // For subtitle, we need to extract text content (ignore HTML icons)
            const subtitleText = headerSubtitle.textContent || documentConfig.subtitle || '';
            initInlineEditor(headerSubtitle, {
                field: 'subtitle',
                documentSlug: documentSlug,
                type: 'text',
                originalValue: subtitleText
            });
        }
        
        // Welcome message editor
        const welcomeTitle = document.getElementById('welcomeTitle');
        if (welcomeTitle) {
            // Extract text content since welcomeTitle might contain HTML
            const welcomeText = welcomeTitle.textContent || welcomeTitle.innerText || documentConfig.welcomeMessage || '';
            initInlineEditor(welcomeTitle, {
                field: 'welcome_message',
                documentSlug: documentSlug,
                type: 'text',
                originalValue: welcomeText
            });
        }
        
        // Intro message editor
        const welcomeIntroContent = document.getElementById('welcomeIntroContent');
        if (welcomeIntroContent) {
            initInlineEditor(welcomeIntroContent, {
                field: 'intro_message',
                documentSlug: documentSlug,
                type: 'wysiwyg',
                originalValue: documentConfig.introMessage || ''
            });
        }
        
        // Also check for cover overlay title (if exists)
        const coverTitle = document.querySelector('.document-cover-title');
        if (coverTitle) {
            initInlineEditor(coverTitle, {
                field: 'title',
                documentSlug: documentSlug,
                type: 'text',
                originalValue: documentConfig.title
            });
        }
        
        log.verbose(`    │  ✓ Inline editors initialized`);
        
    } catch (error) {
        console.error('❌ Failed to initialize inline editors:', error);
        log.error(`    │  ❌ Error initializing inline editors: ${error.message}`);
        log.error(`    │  ❌ Stack: ${error.stack}`);
        // Don't block document UI if editor initialization fails
    }
}

