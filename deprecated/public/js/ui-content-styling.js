// UI Content Styling - References, drug conversions, and content enhancement

// Detect and wrap drug conversion calculations in content
export function wrapDrugConversionContent(contentDiv) {
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

// Style references section in assistant messages
export function styleReferences(contentDiv) {
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

