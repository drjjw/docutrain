// UI Document - Document UI management and orchestration
import { getDocument, getOwnerLogoConfig, parseDocumentSlugs, getBackButtonURL } from './config.js';
import { updateMetaTags, darkenColor, hexToRgba, equalizeContainerHeights } from './ui-utils.js';
import { addDownloadsToWelcome } from './ui-downloads.js';

// Track if document modal has been shown to prevent multiple displays
let documentModalShown = false;

// Update document UI based on selected document (now async with registry)
export async function updateDocumentUI(selectedDocument, forceRefresh = false) {
    console.log(`🚀 updateDocumentUI called with: ${selectedDocument}`);

    // Get sendButton element for use throughout function
    let sendButton = document.getElementById('sendButton');

    // Skip document modal for goodbye route
    const isGoodbyeRoute = window.location.pathname === '/goodbye';
    if (isGoodbyeRoute) {
        console.log('👋 Goodbye route detected - skipping document modal');
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
            Swal.fire({
                title: 'Document Required',
                html: `
                    <div style="text-align: left; line-height: 1.6;">
                        <p style="margin-bottom: 16px; color: #333;">Please specify a document using the URL parameter:</p>
                        <div style="background: #f5f5f5; padding: 12px; border-radius: 6px; font-family: monospace; margin: 12px 0; color: #333;">
                            ?doc=<strong>document-slug</strong>
                        </div>
                        <p style="margin-top: 16px; font-size: 14px; color: #333;">
                            Example: <code>?doc=smh</code> or <code>?doc=maker-foh</code>
                        </p>
                    </div>
                `,
                icon: 'info',
                showConfirmButton: false,
                allowOutsideClick: false,
                allowEscapeKey: false,
                customClass: {
                    popup: 'document-modal'
                }
            });
        }

        // Set minimal generic interface
        document.getElementById('headerTitle').textContent = 'Document Assistant';
        document.getElementById('welcomeTitle').textContent = 'Document Required';
        
        // Reset meta tags to defaults
        updateMetaTags('AI Document Assistant', 'AI-powered document assistant for medical guidelines and research papers');

        // Hide interface elements that require a document
        const subtitleElement = document.getElementById('headerSubtitle');
        subtitleElement.textContent = 'Please specify a document';

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
    const documentSlugs = selectedDocument && selectedDocument.includes('+') ? selectedDocument.split('+').map(s => s.trim()) : selectedDocument ? [selectedDocument] : [];
    const isMultiDoc = documentSlugs.length > 1;
    
    // Fetch all document configs
    const configs = await Promise.all(
        documentSlugs.map(slug => getDocument(slug, forceRefresh))
    );
    
    // Filter out null configs
    const validConfigs = configs.filter(c => c !== null);
    
    if (validConfigs.length === 0) {
        console.error(`No documents found for: ${selectedDocument || 'null'}`);
        return;
    }
    
    // Use first document as primary for most properties
    const config = validConfigs[0];
    
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
            console.log('🏷️ Document config for subtitle:', { category: config.category, year: config.year });
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
                console.log('🏷️ Subtitle set to:', subtitleParts.join(' | '));
            } else {
                // Fallback to original subtitle if no category/year
                subtitleElement.textContent = config.subtitle || '';
                console.log('🏷️ Using fallback subtitle:', config.subtitle);
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
    console.log(`🎨 Updating logo for owner: ${config.owner}`);
    const logoConfig = await getOwnerLogoConfig(config.owner);
    console.log(`🎨 Logo config retrieved:`, logoConfig);

    const logoElement = document.querySelector('.header-logo img');
    const logoLink = document.getElementById('logoLink');

    console.log(`🎨 Logo elements found:`, !!logoElement, !!logoLink);

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
                
                console.log('🔗 Owner logo link disabled due to owner_link=false parameter');
            } else {
                // Override logo link to navigate to owner's chat page
                logoLink.href = `/chat?owner=${encodeURIComponent(config.owner)}`;
                logoLink.title = `View all documents for ${logoConfig.alt}`;
                
                // Remove target="_blank" to navigate in same window
                logoLink.removeAttribute('target');
                logoLink.removeAttribute('rel');
                
                console.log('🔗 Owner logo link set to navigate to owner page:', logoLink.href);
            }

            console.log(`🎨 Logo set: src=${logoConfig.logo}, alt=${logoConfig.alt}`);

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

                console.log(`🎨 Header logo and accent color updated for owner: ${config.owner} (${logoConfig.alt}) - ${logoConfig.accentColor}`);
            }
        } else {
            // Hide logo for unrecognized owners (multi-tenant behavior)
            logoElement.style.display = 'none';
            console.log(`🎨 Header logo hidden for owner: ${config.owner} (no logo configured)`);
        }
    }

    // Update submit button theme based on document owner
    if (sendButton) {
        if (config.owner === 'maker') {
            sendButton.classList.add('maker-theme');
            console.log(`🎨 Submit button updated to maker theme (yellow)`);
        } else {
            sendButton.classList.remove('maker-theme');
            console.log(`🎨 Submit button updated to dynamic accent theme`);
        }
    }

    // Update document cover and welcome message display
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

        if (hasValidCover && !isMultiDoc) {
            // Create cover container if it doesn't exist
            if (!coverContainer) {
                coverContainer = document.createElement('div');
                coverContainer.id = 'documentCoverContainer';
                coverContainer.className = 'document-cover-and-welcome';
                coverContainer.innerHTML = `
                    <div class="document-cover-section">
                        <img id="documentCoverImage" class="document-cover-image" alt="" loading="lazy">
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
            if (welcomeIntroContent && introMessage) {
                welcomeIntroContent.innerHTML = introMessage;
            } else if (welcomeIntroContent) {
                welcomeIntroContent.innerHTML = '';
            }
            
            // Add downloads section to welcome message
            addDownloadsToWelcome(welcomeIntroContent || coverContainer.querySelector('.message-content'), validConfigs);

            // Show cover image layout and hide regular welcome
            const coverImage = coverContainer.querySelector('#documentCoverImage');
            if (coverImage) {
                coverImage.src = config.cover.trim();
                coverImage.alt = `${config.title} - Title Slide`;
                
                // Equalize heights after image loads
                coverImage.onload = () => {
                    equalizeContainerHeights();
                };
            }
            coverContainer.style.display = 'flex';
            regularWelcome.style.display = 'none';
            console.log(`🖼️  Cover image layout displayed: ${config.cover}`);
        } else {
            // Remove cover container if it exists
            if (coverContainer) {
                coverContainer.remove();
            }
            
            // Show regular welcome only if there's an intro message
            if (introMessage) {
                const regularWelcomeTitleElement = document.getElementById('regularWelcomeTitle');
                const regularWelcomeContent = document.getElementById('regularWelcomeContent');
                
                if (regularWelcomeTitleElement) {
                    regularWelcomeTitleElement.innerHTML = combinedWelcome;
                }
                if (regularWelcomeContent) {
                    regularWelcomeContent.innerHTML = introMessage;
                    // Add downloads section to regular welcome
                    addDownloadsToWelcome(regularWelcomeContent, validConfigs);
                }
                
                regularWelcome.style.display = 'block';
                console.log(`📝 Regular welcome displayed with intro message`);
            } else {
                // No intro message - hide welcome entirely
                regularWelcome.style.display = 'none';
                console.log(`🖼️  No intro message - welcome hidden. Cover: "${config.cover}", isMultiDoc: ${isMultiDoc}`);
            }
        }
    }

    console.log(`📄 Document set to: ${selectedDocument ? selectedDocument.toUpperCase() : 'NONE'} - ${config.welcomeMessage}`);
}

