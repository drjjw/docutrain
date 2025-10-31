import React, { useEffect, useRef } from 'react';
import { marked } from 'marked';

// Configure marked
marked.setOptions({
  breaks: false,
  gfm: true
});

interface MessageProps {
  content: string;
  role: 'user' | 'assistant';
  model?: string | null;
  conversationId?: string | null;
  userMessage?: string | null;
  isStreaming?: boolean;
  onRate?: (conversationId: string, rating: 'thumbs_up' | 'thumbs_down') => void;
  onModelSwitch?: (message: string, currentModel: string) => void;
}

export function Message({
  content,
  role,
  model = null,
  conversationId = null,
  userMessage = null,
  isStreaming = false,
  onRate,
  onModelSwitch
}: MessageProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const stylingAppliedRef = useRef(false);

  useEffect(() => {
    if (contentRef.current && role === 'assistant') {
      // Apply styling to references and drug conversions after rendering
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        applyMessageStyling(contentRef.current!);
      });
    }
  }, [content, role]);

  const applyMessageStyling = (contentDiv: HTMLDivElement) => {

    // Wrap tables in scrollable container
    const tables = contentDiv.querySelectorAll('table');
    tables.forEach(table => {
      if (!table.parentElement?.classList.contains('table-wrapper')) {
        const wrapper = document.createElement('div');
        wrapper.className = 'table-wrapper';
        table.parentNode?.insertBefore(wrapper, table);
        wrapper.appendChild(table);
      }
    });

    // Style references (similar to ui-content-styling.js)
    styleReferences(contentDiv);

    // Wrap drug conversion content
    wrapDrugConversionContent(contentDiv);

    // Make references collapsible (like vanilla JS - always call, but it checks if already set up)
    makeReferencesCollapsible(contentDiv);
  };

  const styleReferences = (contentDiv: HTMLDivElement) => {
    // Wrap inline citations [#] with styled spans
    const allParagraphs = contentDiv.querySelectorAll('p');
    const allListItems = contentDiv.querySelectorAll('li');
    
    allParagraphs.forEach(p => {
      if (!p.classList.contains('reference-item')) {
        const html = p.innerHTML;
        const styledHtml = html.replace(/\[(\d+)\]/g, '<span class="reference-citation">[$1]</span>');
        if (html !== styledHtml) {
          p.innerHTML = styledHtml;
        }
      }
    });
    
    allListItems.forEach(li => {
      const html = li.innerHTML;
      const styledHtml = html.replace(/\[(\d+)\]/g, '<span class="reference-citation">[$1]</span>');
      if (html !== styledHtml) {
        li.innerHTML = styledHtml;
      }
    });

    // Organize References section
    const paragraphs = contentDiv.querySelectorAll('p');
    let referencesContainer: HTMLDivElement | null = null;
    let inReferencesSection = false;
    let metadataParagraph: HTMLParagraphElement | null = null;

    paragraphs.forEach(p => {
      const text = p.textContent?.trim() || '';
      const hasReferencesHeading = text === 'References' || text === '**References**' ||
        (p.querySelector('strong')?.textContent === 'References');
      const referenceMatches = text.match(/\[\d+\]/g) || [];
      const hasAnyReferences = referenceMatches.length >= 1;

      if (text.includes('Response time:') || text.includes('🔍') || text.includes('📄')) {
        metadataParagraph = p;
        p.className = (p.className ? p.className + ' ' : '') + 'metadata-info';
        return;
      }

      if (hasReferencesHeading && hasAnyReferences) {
        inReferencesSection = true;
        if (!referencesContainer) {
          referencesContainer = document.createElement('div');
          referencesContainer.className = 'references-container';
          p.parentNode?.insertBefore(referencesContainer, p);
          if (metadataParagraph) {
            referencesContainer.parentNode?.insertBefore(metadataParagraph, referencesContainer);
          }
        }
        splitMultipleReferences(p, referencesContainer);
      } else if (hasReferencesHeading && !hasAnyReferences) {
        p.className = (p.className ? p.className + ' ' : '') + 'references-heading';
        inReferencesSection = true;
        referencesContainer = document.createElement('div');
        referencesContainer.className = 'references-container';
        p.parentNode?.insertBefore(referencesContainer, p);
        referencesContainer.appendChild(p);
        if (metadataParagraph) {
          referencesContainer.parentNode?.insertBefore(metadataParagraph, referencesContainer);
        }
      } else if (text.match(/^\[\d+\]/)) {
        p.className = (p.className ? p.className + ' ' : '') + 'reference-item';
        if (referencesContainer && inReferencesSection) {
          referencesContainer.appendChild(p);
        }
      } else if (inReferencesSection && referencesContainer && !text.match(/^\d+\./) && text.length > 0) {
        referencesContainer.appendChild(p);
      }
    });

    // Style horizontal rules before references
    const hrs = contentDiv.querySelectorAll('hr');
    hrs.forEach(hr => {
      const nextElement = hr.nextElementSibling;
      if (nextElement?.classList?.contains('references-container')) {
        hr.className = (hr.className ? hr.className + ' ' : '') + 'references-separator';
      }
    });

    // Make references collapsible
    makeReferencesCollapsible(contentDiv);
  };

  const makeReferencesCollapsible = (contentDiv: HTMLDivElement) => {
    const referencesContainers = contentDiv.querySelectorAll('.references-container');

    referencesContainers.forEach(container => {
      const heading = container.querySelector('.references-heading');
      if (!heading) return;

      // Check if already set up (like vanilla JS - check if heading is already in wrapper)
      // If heading is inside a wrapper, toggle already exists
      if (heading.parentElement?.classList.contains('references-heading-wrapper')) {
        // Already set up - ensure collapsed state if user didn't expand
        const existingToggle = container.querySelector('.references-toggle') as HTMLElement;
        const existingWrapper = container.querySelector('.references-content') as HTMLElement;
        if (existingToggle && existingWrapper) {
          const wasUserExpanded = existingToggle.getAttribute('data-user-expanded') === 'true';
          if (!wasUserExpanded) {
            // User never expanded - ALWAYS force collapsed state (like vanilla JS default)
            existingWrapper.classList.remove('expanded');
            existingWrapper.classList.add('collapsed');
            existingWrapper.style.setProperty('max-height', '0', 'important');
            existingWrapper.style.setProperty('opacity', '0', 'important');
            existingWrapper.style.setProperty('margin', '0', 'important');
            existingWrapper.style.setProperty('padding', '0', 'important');
            existingWrapper.style.setProperty('overflow', 'hidden', 'important');
            existingWrapper.style.setProperty('display', 'block', 'important');
            existingToggle.setAttribute('aria-expanded', 'false');
            existingToggle.setAttribute('data-user-expanded', 'false');
            
            const plusIcon = existingToggle.querySelector('.plus') as HTMLElement;
            const minusIcon = existingToggle.querySelector('.minus') as HTMLElement;
            if (plusIcon && minusIcon) {
              plusIcon.style.display = 'block';
              minusIcon.style.display = 'none';
            }
          }
        }
        return; // Already set up, skip creation
      }
      
      // Create heading wrapper (heading is NOT in a wrapper yet)
      const headingWrapper = document.createElement('div');
      headingWrapper.className = 'references-heading-wrapper';
      heading.parentNode?.insertBefore(headingWrapper, heading);
      headingWrapper.appendChild(heading);
      
      // Create toggle button
      const collapseToggle = document.createElement('button');
      collapseToggle.className = 'references-toggle';
      collapseToggle.setAttribute('aria-expanded', 'false');
      collapseToggle.setAttribute('aria-label', 'Toggle references');
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
      // Add toggle button to wrapper (before heading)
      headingWrapper.insertBefore(collapseToggle, headingWrapper.firstChild);
      
      // Create or get content wrapper - ALWAYS start collapsed when creating new
      let contentWrapper = container.querySelector('.references-content') as HTMLDivElement;
      if (!contentWrapper) {
        contentWrapper = document.createElement('div');
        contentWrapper.className = 'references-content collapsed';
        container.appendChild(contentWrapper);
        
        // Move all reference items into the content wrapper
        const referenceItems = container.querySelectorAll('.reference-item');
        referenceItems.forEach(item => {
          contentWrapper.appendChild(item);
        });
      }
      
      // Since we're creating a NEW toggle/wrapper setup, ALWAYS enforce collapsed state
      // (If toggle/wrapper already existed, we would have returned earlier)
      contentWrapper.classList.remove('expanded');
      contentWrapper.classList.add('collapsed');
      
      // Force collapsed style via inline styles with !important to prevent auto-expansion
      contentWrapper.style.setProperty('max-height', '0', 'important');
      contentWrapper.style.setProperty('opacity', '0', 'important');
      contentWrapper.style.setProperty('margin', '0', 'important');
      contentWrapper.style.setProperty('padding', '0', 'important');
      contentWrapper.style.setProperty('overflow', 'hidden', 'important');
      contentWrapper.style.setProperty('display', 'block', 'important');
      
      collapseToggle.setAttribute('aria-expanded', 'false');
      collapseToggle.setAttribute('data-user-expanded', 'false');
      
      // Ensure correct icon display - plus icon visible (like vanilla JS)
      const plusIcon = collapseToggle.querySelector('.plus') as HTMLElement;
      const minusIcon = collapseToggle.querySelector('.minus') as HTMLElement;
      if (plusIcon && minusIcon) {
        plusIcon.style.display = 'block';
        minusIcon.style.display = 'none';
      }

      // Ensure toggle is set to collapsed state initially
      collapseToggle.setAttribute('aria-expanded', 'false');
      if (!collapseToggle.getAttribute('data-user-expanded')) {
        collapseToggle.setAttribute('data-user-expanded', 'false');
      }
      
      // Toggle functionality (like vanilla JS)
      const toggleReferences = () => {
        const isExpanded = collapseToggle.getAttribute('aria-expanded') === 'true';
        const plusIcon = collapseToggle.querySelector('.plus') as HTMLElement;
        const minusIcon = collapseToggle.querySelector('.minus') as HTMLElement;
        
        // Toggle state (like vanilla JS)
        collapseToggle.setAttribute('aria-expanded', isExpanded ? 'false' : 'true');
        contentWrapper.classList.toggle('collapsed');
        contentWrapper.classList.toggle('expanded');
        
        if (isExpanded) {
          // Collapsing - mark as not user-expanded
          collapseToggle.setAttribute('data-user-expanded', 'false');
          // Force collapsed styles with !important
          contentWrapper.style.setProperty('max-height', '0', 'important');
          contentWrapper.style.setProperty('opacity', '0', 'important');
          contentWrapper.style.setProperty('margin', '0', 'important');
          contentWrapper.style.setProperty('padding', '0', 'important');
          contentWrapper.style.setProperty('overflow', 'hidden', 'important');
          // Show green plus icon (like vanilla JS)
          if (plusIcon && minusIcon) {
            plusIcon.style.display = 'block';
            minusIcon.style.display = 'none';
          }
        } else {
          // Expanding - mark as user-expanded
          collapseToggle.setAttribute('data-user-expanded', 'true');
          // Clear inline styles to let CSS handle expansion
          contentWrapper.style.removeProperty('max-height');
          contentWrapper.style.removeProperty('opacity');
          contentWrapper.style.removeProperty('margin');
          contentWrapper.style.removeProperty('padding');
          contentWrapper.style.removeProperty('overflow');
          // Show red minus icon (like vanilla JS)
          if (plusIcon && minusIcon) {
            plusIcon.style.display = 'none';
            minusIcon.style.display = 'block';
          }
        }
      };

      // Make both heading and toggle clickable (like vanilla JS)
      headingWrapper.style.cursor = 'pointer';
      headingWrapper.addEventListener('click', toggleReferences);
    });
  };

  const splitMultipleReferences = (paragraph: HTMLParagraphElement, referencesContainer: HTMLDivElement | null) => {
    const text = paragraph.textContent || '';
    const hasReferencesHeading = text.includes('References') || text.includes('**References**') ||
      (paragraph.querySelector('strong')?.textContent === 'References');
    const referenceRegex = /\[(\d+)\]\s*([^\[]*?)(?=\[\d+\]|$)/gs;
    const references: { number: string; text: string }[] = [];
    let match;

    while ((match = referenceRegex.exec(text)) !== null) {
      references.push({ number: match[1], text: match[2].trim() });
    }

    if (references.length >= 1) {
      const parent = paragraph.parentNode;
      parent?.removeChild(paragraph);

      if (hasReferencesHeading && referencesContainer) {
        const headingP = document.createElement('p');
        headingP.innerHTML = '<strong>References</strong>';
        headingP.className = 'references-heading';
        referencesContainer.appendChild(headingP);
      }

      references.forEach(ref => {
        const newP = document.createElement('p');
        newP.textContent = `[${ref.number}] ${ref.text}`;
        newP.className = 'reference-item';
        if (referencesContainer) {
          referencesContainer.appendChild(newP);
        } else {
          parent?.appendChild(newP);
        }
      });
    }
  };

  const wrapDrugConversionContent = (contentDiv: HTMLDivElement) => {
    const conversionCalculationPattern = /\d+\s*(mg|mcg|units|iu)\s*[×x]\s*[\d.]+\s*=\s*\d+/i;
    const paragraphs = contentDiv.querySelectorAll('p');
    const conversionElements: HTMLParagraphElement[] = [];
    
    paragraphs.forEach((p) => {
      const text = p.textContent || '';
      if (conversionCalculationPattern.test(text)) {
        conversionElements.push(p);
      }
    });
    
    if (conversionElements.length > 0) {
      const wrapper = document.createElement('div');
      wrapper.className = 'drug-conversion-response';
      
      const firstElement = conversionElements[0];
      firstElement.parentNode?.insertBefore(wrapper, firstElement);
      
      conversionElements.forEach(el => {
        wrapper.appendChild(el);
      });
    }
  };

  const handleRating = (rating: 'thumbs_up' | 'thumbs_down') => {
    if (conversationId && onRate) {
      onRate(conversationId, rating);
    }
  };

  // Configure marked options
  marked.setOptions({
    breaks: false,
    gfm: true
  });

  return (
    <div className={`message ${role}`}>
      <div className="message-content" ref={contentRef}>
        {role === 'assistant' ? (
          <div dangerouslySetInnerHTML={{ __html: marked.parse(content) }} />
        ) : (
          <div>{content}</div>
        )}
        
        {role === 'assistant' && conversationId && (
          <div className="rating-container">
            <div className="rating-question">Do you like this response?</div>
            <div className="rating-buttons">
              <button
                className="rating-btn thumbs-up"
                title="Rate this response as helpful"
                onClick={() => handleRating('thumbs_up')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                  <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 11H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h3z"/>
                </svg>
              </button>
              <button
                className="rating-btn thumbs-down"
                title="Rate this response as not helpful"
                onClick={() => handleRating('thumbs_down')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                  <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zM17 13h3a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-3z"/>
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

