// UI updates, messages, and loading states
import { getDocument, getOwnerLogoConfig, parseDocumentSlugs } from './config.js?v=20251019-02';
import { getRandomFact } from './facts.js?v=20251019-02';

// Track if document modal has been shown to prevent multiple displays
let documentModalShown = false;

// Update document UI based on selected document (now async with registry)
export async function updateDocumentUI(selectedDocument, forceRefresh = false) {
    // Get sendButton element for use throughout function
    let sendButton = document.getElementById('sendButton');

    // Handle case where no document is selected - show document selection modal
    if (!selectedDocument) {

        // Only show modal once to avoid annoying users
        if (!documentModalShown) {
            documentModalShown = true;

            // SweetAlert2 is loaded globally
            // Show modal explaining document selection is required
            Swal.fire({
                title: 'Document Required',
                html: `
                    <div style="text-align: left; line-height: 1.6;">
                        <p style="margin-bottom: 16px;">Please specify a document using the URL parameter:</p>
                        <div style="background: #f5f5f5; padding: 12px; border-radius: 6px; font-family: monospace; margin: 12px 0;">
                            ?doc=<strong>document-slug</strong>
                        </div>
                        <p style="margin-top: 16px; font-size: 14px; color: #666;">
                            Example: <code>?doc=smh</code> or <code>?doc=maker-foh</code>
                        </p>
                    </div>
                `,
                icon: 'info',
                confirmButtonText: 'Got it',
                confirmButtonColor: '#cc0000',
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
        const logoElement = document.querySelector('.logo img');
        const logoLink = document.querySelector('.logo a');
        if (logoElement && logoLink) {
            logoElement.style.display = 'none'; // Hide logo when no document
        }

        return;
    }

    // Handle multi-document case: selectedDocument can be "slug1+slug2" or just "slug"
    const documentSlugs = selectedDocument.includes('+') ? selectedDocument.split('+').map(s => s.trim()) : [selectedDocument];
    const isMultiDoc = documentSlugs.length > 1;
    
    // Fetch all document configs
    const configs = await Promise.all(
        documentSlugs.map(slug => getDocument(slug, forceRefresh))
    );
    
    // Filter out null configs
    const validConfigs = configs.filter(c => c !== null);
    
    if (validConfigs.length === 0) {
        console.error(`No documents found for: ${selectedDocument}`);
        return;
    }
    
    // Use first document as primary for most properties
    const config = validConfigs[0];
    
    // Build combined title
    const combinedTitle = validConfigs.map(c => c.title).join(' + ');
    document.getElementById('headerTitle').textContent = combinedTitle;

    // Build combined welcome message
    const combinedWelcome = validConfigs.map(c => c.welcomeMessage).join(' and ');
    document.getElementById('welcomeTitle').textContent = combinedWelcome;

    // Update subtitle - for multi-doc, show document count
    const subtitleElement = document.getElementById('headerSubtitle');
    if (isMultiDoc) {
        subtitleElement.textContent = `Multi-document search across ${validConfigs.length} documents`;
    } else {
        const metadata = config.metadata || {};
        const pmid = metadata.pmid || metadata.pubmed_id || metadata.PMID;
        
        if (pmid) {
            // Show only PMID link with magnifying glass icon
            subtitleElement.innerHTML = `<a href="https://pubmed.ncbi.nlm.nih.gov/${pmid}/" target="_blank" rel="noopener noreferrer" class="pmid-link"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px;"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>PMID: ${pmid}</a>`;
        } else {
            // No PMID, show subtitle text
            subtitleElement.textContent = config.subtitle;
        }
    }

    // Update back link (use first document's link)
    const backLink = document.querySelector('.back-link');
    if (backLink) {
        backLink.href = config.backLink;
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
    const logoConfig = getOwnerLogoConfig(config.owner);
    const logoElement = document.querySelector('.logo img');
    const logoLink = document.querySelector('.logo a');

    if (logoElement && logoLink) {
        if (logoConfig) {
            // Show logo for recognized owners
            logoElement.style.display = ''; // Show logo
            logoElement.src = logoConfig.logo;
            logoElement.alt = logoConfig.alt;
            logoLink.href = logoConfig.link;
            logoLink.title = logoConfig.alt;

            // Update accent colors if needed (currently using CSS variables for consistency)
            // The accent color is primarily handled in CSS with the --accent-color variable
            console.log(`🎨 Header logo updated for owner: ${config.owner} (${logoConfig.alt})`);
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
            console.log(`🎨 Submit button updated to default theme (red)`);
        }
    }

    console.log(`📄 Document set to: ${selectedDocument.toUpperCase()} - ${config.welcomeMessage}`);
}

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

// Detect and wrap drug conversion calculations in content
function wrapDrugConversionContent(contentDiv) {
    // Look for patterns that indicate actual conversion calculations
    // Pattern: "X mg × Y = Z mg" (the actual calculation)
    const conversionCalculationPattern = /\d+\s*(mg|mcg|units|iu)\s*[×x]\s*[\d.]+\s*=\s*\d+/i;
    
    // Get all paragraphs
    const paragraphs = contentDiv.querySelectorAll('p');
    let conversionElements = [];
    
    paragraphs.forEach((p) => {
        const text = p.textContent;
        
        // Only include paragraphs that contain the actual calculation pattern
        if (conversionCalculationPattern.test(text)) {
            conversionElements.push(p);
        }
    });
    
    // If we found conversion elements, wrap them
    if (conversionElements.length > 0) {
        const wrapper = document.createElement('div');
        wrapper.className = 'drug-conversion-response';
        
        // Insert wrapper before the first conversion element
        const firstElement = conversionElements[0];
        firstElement.parentNode.insertBefore(wrapper, firstElement);
        
        // Move all conversion elements into the wrapper
        conversionElements.forEach(el => {
            wrapper.appendChild(el);
        });
        
        console.log(`💊 Drug conversion detected: wrapped ${conversionElements.length} element(s)`);
        return true;
    }
    
    return false;
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

// Add loading indicator with rotating fun facts
export function addLoading(chatContainer) {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message assistant';
    loadingDiv.id = 'loading';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content loading-container';
    
    // Loading dots
    const dotsDiv = document.createElement('div');
    dotsDiv.className = 'loading-dots';
    dotsDiv.innerHTML = '<span></span><span></span><span></span>';
    
    // Fun fact display
    const factDiv = document.createElement('div');
    factDiv.className = 'fun-fact';
    factDiv.innerHTML = getRandomFact();
    
    contentDiv.appendChild(dotsDiv);
    contentDiv.appendChild(factDiv);
    loadingDiv.appendChild(contentDiv);
    chatContainer.appendChild(loadingDiv);
    
    // Scroll to show the loading indicator at the top
    loadingDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    // Start rotating facts every 5 seconds with fade animation
    startFactRotation();
}

// Rotate facts with fade effect
let factRotationInterval = null;

function startFactRotation() {
    // Clear any existing interval
    if (factRotationInterval) {
        clearInterval(factRotationInterval);
    }
    
    factRotationInterval = setInterval(() => {
        const factElement = document.querySelector('#loading .fun-fact');
        if (!factElement) {
            clearInterval(factRotationInterval);
            return;
        }
        
        // Fade out
        factElement.classList.add('fade-out');
        
        // Change text and fade in after fade out completes
        setTimeout(() => {
            factElement.innerHTML = getRandomFact();
            factElement.classList.remove('fade-out');
            factElement.classList.add('fade-in');
            
            // Remove fade-in class after animation
            setTimeout(() => {
                factElement.classList.remove('fade-in');
            }, 600);
        }, 600);
    }, 8000); // Change fact every 8 seconds
}

// Remove loading indicator
export function removeLoading() {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.remove();
    }
    
    // Clear the fact rotation interval
    if (factRotationInterval) {
        clearInterval(factRotationInterval);
        factRotationInterval = null;
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

    // Update model selector buttons in header
    const geminiBtn = document.getElementById('geminiBtn');
    const grokBtn = document.getElementById('grokBtn');

    if (newModel === 'grok') {
        grokBtn.classList.add('active');
        geminiBtn.classList.remove('active');
    } else {
        geminiBtn.classList.add('active');
        grokBtn.classList.remove('active');
    }

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

// Style references section in assistant messages
function styleReferences(contentDiv) {
    // First pass: wrap all inline citations [#] with styled spans in paragraphs AND list items
    const allParagraphs = contentDiv.querySelectorAll('p');
    const allListItems = contentDiv.querySelectorAll('li');
    
    // Process paragraphs
    allParagraphs.forEach(p => {
        // Only process paragraphs that aren't already marked as reference items
        if (!p.classList.contains('reference-item')) {
            const html = p.innerHTML;
            // Replace [#] with styled span, but only if not already wrapped
            const styledHtml = html.replace(/\[(\d+)\]/g, '<span class="reference-citation">[$1]</span>');
            if (html !== styledHtml) {
                p.innerHTML = styledHtml;
            }
        }
    });
    
    // Process list items
    allListItems.forEach(li => {
        const html = li.innerHTML;
        // Replace [#] with styled span, but only if not already wrapped
        const styledHtml = html.replace(/\[(\d+)\]/g, '<span class="reference-citation">[$1]</span>');
        if (html !== styledHtml) {
            li.innerHTML = styledHtml;
        }
    });

    // Second pass: organize the References section
    // Re-query paragraphs after first pass modifications
    const paragraphs = contentDiv.querySelectorAll('p');
    
    // Create a references container if we find references
    let referencesContainer = null;
    let inReferencesSection = false;
    let metadataParagraph = null;

    // Simply add classes to paragraphs that look like references
    paragraphs.forEach(p => {
        const text = p.textContent.trim();
        const hasReferencesHeading = text === 'References' || text === '**References**' ||
            (p.querySelector('strong') && p.querySelector('strong').textContent === 'References');
        const referenceMatches = text.match(/\[\d+\]/g) || [];
        const hasAnyReferences = referenceMatches.length >= 1;

        // Check if this is a metadata paragraph (Response time, RAG Mode, Full Doc Mode)
        if (text.includes('Response time:') || text.includes('🔍') || text.includes('📄')) {
            metadataParagraph = p;
            p.className = (p.className ? p.className + ' ' : '') + 'metadata-info';
            return; // Skip further processing for this paragraph
        }

        // Check if this paragraph contains "References" heading AND any references (needs splitting)
        if (hasReferencesHeading && hasAnyReferences) {
            inReferencesSection = true;
            // Create a references container if it doesn't exist
            if (!referencesContainer) {
                referencesContainer = document.createElement('div');
                referencesContainer.className = 'references-container';
                p.parentNode.insertBefore(referencesContainer, p);
                
                // Move metadata paragraph above references container if it exists
                if (metadataParagraph) {
                    referencesContainer.parentNode.insertBefore(metadataParagraph, referencesContainer);
                }
            }
            // Split references that are all in one paragraph
            splitMultipleReferences(p, referencesContainer);
        }
        // Check if this paragraph contains ONLY "References" heading (no references at all)
        else if (hasReferencesHeading && !hasAnyReferences) {
            p.className = (p.className ? p.className + ' ' : '') + 'references-heading';
            inReferencesSection = true;

            // Create a references container starting from this heading
            referencesContainer = document.createElement('div');
            referencesContainer.className = 'references-container';
            p.parentNode.insertBefore(referencesContainer, p);
            referencesContainer.appendChild(p);
            
            // Move metadata paragraph above references container if it exists
            if (metadataParagraph) {
                referencesContainer.parentNode.insertBefore(metadataParagraph, referencesContainer);
            }
        }
        // Check if this is a reference item (starts with [number])
        else if (text.match(/^\[\d+\]/)) {
            p.className = (p.className ? p.className + ' ' : '') + 'reference-item';
            if (referencesContainer && inReferencesSection) {
                referencesContainer.appendChild(p);
            }
        }
        // If we're in the references section and this doesn't match above, add it to container
        else if (inReferencesSection && referencesContainer && !text.match(/^\d+\./) && text.length > 0) {
            referencesContainer.appendChild(p);
        }
    });

    // Only style horizontal rules that come BEFORE the references container
    const hrs = contentDiv.querySelectorAll('hr');
    hrs.forEach(hr => {
        // Check if this HR is followed by a references container
        let nextElement = hr.nextElementSibling;
        if (nextElement && nextElement.classList && nextElement.classList.contains('references-container')) {
            hr.className = (hr.className ? hr.className + ' ' : '') + 'references-separator';
        }
    });

    // Make references collapsible (default collapsed)
    makeReferencesCollapsible(contentDiv);
}

// Make references section collapsible
function makeReferencesCollapsible(contentDiv) {
    const referencesContainers = contentDiv.querySelectorAll('.references-container');
    
    referencesContainers.forEach(container => {
        const heading = container.querySelector('.references-heading');
        if (!heading) return;

        // Create collapsible wrapper
        const collapseToggle = document.createElement('button');
        collapseToggle.className = 'references-toggle';
        collapseToggle.innerHTML = `
            <svg class="toggle-icon plus" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" fill="#008000" stroke="#008000" stroke-width="1.5"/>
                <line x1="12" y1="7" x2="12" y2="17" stroke="white" stroke-width="2" stroke-linecap="round"/>
                <line x1="7" y1="12" x2="17" y2="12" stroke="white" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <svg class="toggle-icon minus" viewBox="0 0 24 24" fill="none" style="display: none;">
                <circle cx="12" cy="12" r="10" fill="#cc0000" stroke="#cc0000" stroke-width="1.5"/>
                <line x1="7" y1="12" x2="17" y2="12" stroke="white" stroke-width="2" stroke-linecap="round"/>
            </svg>
        `;
        collapseToggle.setAttribute('aria-expanded', 'false');
        collapseToggle.setAttribute('aria-label', 'Toggle references');

        // Create wrapper for heading and toggle
        const headingWrapper = document.createElement('div');
        headingWrapper.className = 'references-heading-wrapper';
        
        // Replace heading with wrapper
        heading.parentNode.insertBefore(headingWrapper, heading);
        headingWrapper.appendChild(collapseToggle);
        headingWrapper.appendChild(heading);

        // Create content wrapper for all reference items
        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'references-content collapsed';
        
        // Move all reference items into the content wrapper
        const referenceItems = container.querySelectorAll('.reference-item');
        referenceItems.forEach(item => {
            contentWrapper.appendChild(item);
        });
        
        container.appendChild(contentWrapper);

        // Toggle functionality
        const toggleReferences = () => {
            const isExpanded = collapseToggle.getAttribute('aria-expanded') === 'true';
            const plusIcon = collapseToggle.querySelector('.plus');
            const minusIcon = collapseToggle.querySelector('.minus');
            
            collapseToggle.setAttribute('aria-expanded', !isExpanded);
            contentWrapper.classList.toggle('collapsed');
            contentWrapper.classList.toggle('expanded');
            
            // Toggle icon visibility
            if (isExpanded) {
                // Closing: show green plus
                plusIcon.style.display = '';
                minusIcon.style.display = 'none';
            } else {
                // Opening: show red minus
                plusIcon.style.display = 'none';
                minusIcon.style.display = '';
            }
        };

        // Make both heading and toggle clickable
        headingWrapper.style.cursor = 'pointer';
        headingWrapper.addEventListener('click', toggleReferences);
    });
}

// Split multiple references that are in one paragraph into separate elements
function splitMultipleReferences(paragraph, referencesContainer = null) {
    const text = paragraph.textContent;

    // Check if this paragraph contains both "References" heading and reference items
    const hasReferencesHeading = text.includes('References') || text.includes('**References**') ||
                                (paragraph.querySelector('strong') && paragraph.querySelector('strong').textContent === 'References');

    // Use regex to find all references like [1] text [2] text
    // The regex captures each [number] and all text until the next [number] or end of string
    // Updated to handle newlines in the text
    const referenceRegex = /\[(\d+)\]\s*([^\[]*?)(?=\[\d+\]|$)/gs;
    const references = [];
    let match;

    // Extract all references
    while ((match = referenceRegex.exec(text)) !== null) {
        const refNumber = match[1];
        const refText = match[2].trim();
        references.push({ number: refNumber, text: refText });
    }

    if (references.length >= 1) {
        // Create separate paragraph elements for each reference
        const parent = paragraph.parentNode;

        // Remove the original paragraph
        parent.removeChild(paragraph);

        // If this paragraph contained the References heading, add it back to the container
        if (hasReferencesHeading && referencesContainer) {
            const headingP = document.createElement('p');
            headingP.innerHTML = '<strong>References</strong>';
            headingP.className = 'references-heading';
            referencesContainer.appendChild(headingP);
        }

        // Create new paragraphs for each reference
        references.forEach(ref => {
            const newP = document.createElement('p');
            newP.textContent = `[${ref.number}] ${ref.text}`;
            newP.className = 'reference-item';
            if (referencesContainer) {
                referencesContainer.appendChild(newP);
            } else {
                parent.appendChild(newP);
            }
        });
    }
}

