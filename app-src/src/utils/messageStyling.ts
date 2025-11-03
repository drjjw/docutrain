/**
 * Message Styling Utilities
 * Ported from vanilla JS ui-content-styling.js
 * Applies styling to references and drug conversions in message content
 */

/**
 * Detect and wrap drug conversion calculations in content
 * Ported from ui-content-styling.js
 * IMPORTANT: This function must be idempotent - safe to call multiple times
 */
export function wrapDrugConversionContent(contentDiv: HTMLElement): boolean {
  // CHECK: If wrapper already exists, don't reprocess
  if (contentDiv.querySelector('.drug-conversion-response')) {
    return false;
  }

  // Look for patterns that indicate actual conversion calculations
  // Pattern: "X mg × Y = Z mg" (the actual calculation)
  const conversionCalculationPattern = /\d+\s*(mg|mcg|units|iu)\s*[×x]\s*[\d.]+\s*=\s*\d+/i;
  
  // Get all paragraphs that aren't already inside a drug conversion wrapper
  const paragraphs = Array.from(contentDiv.querySelectorAll('p')).filter(
    p => !p.closest('.drug-conversion-response')
  ) as HTMLElement[];
  
  const conversionElements: HTMLElement[] = [];
  
  paragraphs.forEach((p) => {
    const text = p.textContent || '';
    
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
    if (firstElement.parentNode) {
      firstElement.parentNode.insertBefore(wrapper, firstElement);
      
      // Move all conversion elements into the wrapper
      conversionElements.forEach(el => {
        wrapper.appendChild(el);
      });
      
      console.log(`💊 Drug conversion detected: wrapped ${conversionElements.length} element(s)`);
      return true;
    }
  }
  
  return false;
}

/**
 * Style references section in assistant messages
 * Ported from ui-content-styling.js
 * IMPORTANT: This function must be idempotent - safe to call multiple times
 * 
 * NOTE: During streaming, React's dangerouslySetInnerHTML replaces all HTML,
 * so we need to detect already-processed content by checking for specific classes
 */
export function styleReferences(contentDiv: HTMLElement): void {
  // CHECK: If references container already exists OR reference items are already styled, don't reprocess
  // This prevents nested containers during streaming updates
  const existingContainer = contentDiv.querySelector('.references-container');
  const existingReferenceItems = contentDiv.querySelectorAll('.reference-item');
  
  if (existingContainer || existingReferenceItems.length > 0) {
    // Only update citations for NEW content, don't reorganize structure
    updateCitationStyles(contentDiv);
    
    // If container exists but has new unstyled reference items, add them to the container
    if (existingContainer && existingReferenceItems.length > 0) {
      const contentWrapper = existingContainer.querySelector('.references-content');
      if (contentWrapper) {
        // Check for reference items not yet in the content wrapper
        existingReferenceItems.forEach(item => {
          if (!contentWrapper.contains(item) && !item.closest('.references-container')) {
            contentWrapper.appendChild(item);
          }
        });
      }
    }
    
    return;
  }

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
  // Re-query paragraphs after first pass modifications, EXCLUDING ones already in containers
  const paragraphs = Array.from(contentDiv.querySelectorAll('p')).filter(
    p => !p.closest('.references-container')
  ) as HTMLElement[];
  
  // Find existing container or create a new one
  let referencesContainer: HTMLElement | null = contentDiv.querySelector('.references-container');
  let inReferencesSection = false;
  let metadataParagraph: HTMLElement | null = null;

  // Simply add classes to paragraphs that look like references
  paragraphs.forEach(p => {
    const text = p.textContent?.trim() || '';
    const strong = p.querySelector('strong');
    const hasReferencesHeading = text === 'References' || text === '**References**' ||
        (strong && strong.textContent === 'References');
    const referenceMatches = text.match(/\[\d+\]/g) || [];
    const hasAnyReferences = referenceMatches.length >= 1;

    // Check if this is a metadata paragraph (Response time, RAG Mode, Full Doc Mode)
    if (text.includes('Response time:') || text.includes('🔍') || text.includes('📄')) {
      metadataParagraph = p as HTMLElement;
      p.className = (p.className ? p.className + ' ' : '') + 'metadata-info';
      return; // Skip further processing for this paragraph
    }

    // Check if this paragraph contains "References" heading AND any references (needs splitting)
    if (hasReferencesHeading && hasAnyReferences) {
      // CRITICAL: Skip if paragraph is already inside a references container (prevents nesting)
      if (p.closest('.references-container')) {
        return; // Skip this paragraph in forEach
      }
      
      inReferencesSection = true;
      // Create a references container if it doesn't exist
      if (!referencesContainer && p.parentNode) {
        referencesContainer = document.createElement('div');
        referencesContainer.className = 'references-container';
        p.parentNode.insertBefore(referencesContainer, p);
        
        // Move metadata paragraph above references container if it exists
        if (metadataParagraph && referencesContainer.parentNode) {
          referencesContainer.parentNode.insertBefore(metadataParagraph, referencesContainer);
        }
      }
      // Split references that are all in one paragraph
      splitMultipleReferences(p as HTMLElement, referencesContainer);
    }
    // Check if this paragraph contains ONLY "References" heading (no references at all)
    else if (hasReferencesHeading && !hasAnyReferences) {
      // CRITICAL: Skip if paragraph is already inside a references container (prevents nesting)
      if (p.closest('.references-container')) {
        return; // Skip this paragraph in forEach
      }
      
      p.className = (p.className ? p.className + ' ' : '') + 'references-heading';
      inReferencesSection = true;

      // Create a references container starting from this heading
      if (p.parentNode) {
        referencesContainer = document.createElement('div');
        referencesContainer.className = 'references-container';
        p.parentNode.insertBefore(referencesContainer, p);
        referencesContainer.appendChild(p);
        
        // Move metadata paragraph above references container if it exists
        if (metadataParagraph && referencesContainer.parentNode) {
          referencesContainer.parentNode.insertBefore(metadataParagraph, referencesContainer);
        }
      }
    }
    // Check if this is a reference item (starts with [number])
    else if (text.match(/^\[\d+\]/)) {
      // CRITICAL: Skip if paragraph is already inside a references container (prevents nesting)
      if (p.closest('.references-container')) {
        return; // Skip this paragraph in forEach
      }
      
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

/**
 * Update citation styles only (used when container already exists)
 * This prevents nested containers during streaming
 */
export function updateCitationStyles(contentDiv: HTMLElement): void {
  // Only update citations that aren't already styled
  const allParagraphs = contentDiv.querySelectorAll('p:not(.reference-item)');
  const allListItems = contentDiv.querySelectorAll('li');
  
  allParagraphs.forEach(p => {
    if (!p.querySelector('.reference-citation')) {
      const html = p.innerHTML;
      const styledHtml = html.replace(/\[(\d+)\]/g, '<span class="reference-citation">[$1]</span>');
      if (html !== styledHtml) {
        p.innerHTML = styledHtml;
      }
    }
  });
  
  allListItems.forEach(li => {
    if (!li.querySelector('.reference-citation')) {
      const html = li.innerHTML;
      const styledHtml = html.replace(/\[(\d+)\]/g, '<span class="reference-citation">[$1]</span>');
      if (html !== styledHtml) {
        li.innerHTML = styledHtml;
      }
    }
  });
}

/**
 * Make references section collapsible
 */
function makeReferencesCollapsible(contentDiv: HTMLElement): void {
  const referencesContainers = contentDiv.querySelectorAll('.references-container');
  
  referencesContainers.forEach(container => {
    // CHECK: If toggle already exists, skip this container to prevent duplicates
    if (container.querySelector('.references-toggle')) {
      return;
    }
    
    const heading = container.querySelector('.references-heading');
    if (!heading || !heading.parentNode) return;

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
      const plusIcon = collapseToggle.querySelector('.plus') as HTMLElement;
      const minusIcon = collapseToggle.querySelector('.minus') as HTMLElement;
      
      collapseToggle.setAttribute('aria-expanded', !isExpanded ? 'true' : 'false');
      contentWrapper.classList.toggle('collapsed');
      contentWrapper.classList.toggle('expanded');
      
      // Toggle icon visibility
      if (isExpanded) {
        // Closing: show green plus
        if (plusIcon) plusIcon.style.display = '';
        if (minusIcon) minusIcon.style.display = 'none';
      } else {
        // Opening: show red minus
        if (plusIcon) plusIcon.style.display = 'none';
        if (minusIcon) minusIcon.style.display = '';
      }
    };

    // Make both heading and toggle clickable
    headingWrapper.style.cursor = 'pointer';
    headingWrapper.addEventListener('click', toggleReferences);
  });
}

/**
 * Split multiple references that are in one paragraph into separate elements
 */
function splitMultipleReferences(paragraph: HTMLElement, referencesContainer: HTMLElement | null): void {
  const text = paragraph.textContent || '';

  // Check if this paragraph contains both "References" heading and reference items
  const strong = paragraph.querySelector('strong');
  const hasReferencesHeading = text.includes('References') || text.includes('**References**') ||
                              (strong && strong.textContent === 'References');

  // Use regex to find all references like [1] text [2] text
  const referenceRegex = /\[(\d+)\]\s*([^\[]*?)(?=\[\d+\]|$)/gs;
  const references: Array<{ number: string; text: string }> = [];
  let match;

  // Extract all references
  while ((match = referenceRegex.exec(text)) !== null) {
    const refNumber = match[1];
    const refText = match[2].trim();
    references.push({ number: refNumber, text: refText });
  }

  if (references.length >= 1 && paragraph.parentNode) {
    // Create separate paragraph elements for each reference
    const parent = paragraph.parentNode;

    // Remove the original paragraph
    parent.removeChild(paragraph);

    // If this paragraph contained the References heading, add it back to the container
    // BUT only if a heading doesn't already exist
    if (hasReferencesHeading && referencesContainer && !referencesContainer.querySelector('.references-heading')) {
      const headingP = document.createElement('p');
      headingP.innerHTML = '<strong>References</strong>';
      headingP.className = 'references-heading';
      // Insert heading at the beginning of container
      const firstChild = referencesContainer.firstChild;
      if (firstChild) {
        referencesContainer.insertBefore(headingP, firstChild);
      } else {
        referencesContainer.appendChild(headingP);
      }
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

