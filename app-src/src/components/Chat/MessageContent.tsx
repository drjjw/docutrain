/**
 * MessageContent - Renders markdown content with styling
 * Ports the vanilla JS message rendering and styling logic
 */

import { useEffect, useLayoutEffect, useRef, memo, useState } from 'react';
import { marked } from 'marked';
import { Copy, Check } from 'lucide-react';
import { styleReferences, wrapDrugConversionContent, updateCitationStyles } from '@/utils/messageStyling';

interface MessageContentProps {
  content: string;
  role: 'user' | 'assistant';
  isStreaming?: boolean; // Flag to skip expensive DOM manipulation during streaming
  showReferences?: boolean; // Controls visibility of references section (default true)
}

// Configure marked (same as vanilla JS)
marked.setOptions({
  breaks: false, // Prevent awkward line breaks in lists
  gfm: true,
});

// Global state map to persist collapsed state across re-renders
// Key: content hash, Value: Map of container index -> expanded state
const globalCollapsedState = new Map<string, Map<number, boolean>>();

function MessageContentComponent({ content, role, isStreaming = false, showReferences = true }: MessageContentProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const previousContentRef = useRef<string>('');
  const [isCopied, setIsCopied] = useState(false);
  
  // Compute content hash synchronously
  const getContentHash = () => {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  };

  // Helper to restore collapsed state
  const restoreCollapsedState = (containers: NodeListOf<Element> | Element[]) => {
    const contentHash = getContentHash();
    const stateMap = globalCollapsedState.get(contentHash);
    if (!stateMap) return;
    
    Array.from(containers).forEach((container, index) => {
      const savedState = stateMap.get(index);
      if (savedState !== undefined) {
        const contentWrapper = container.querySelector('.references-content');
        const toggle = container.querySelector('.references-toggle');
        const plusIcon = toggle?.querySelector('.plus') as HTMLElement;
        const minusIcon = toggle?.querySelector('.minus') as HTMLElement;
        
        if (contentWrapper && toggle) {
          if (savedState) {
            // Was expanded - restore expanded state
            contentWrapper.classList.remove('collapsed');
            contentWrapper.classList.add('expanded');
            toggle.setAttribute('aria-expanded', 'true');
            if (plusIcon) plusIcon.style.display = 'none';
            if (minusIcon) minusIcon.style.display = '';
          } else {
            // Was collapsed - ensure collapsed state
            contentWrapper.classList.remove('expanded');
            contentWrapper.classList.add('collapsed');
            toggle.setAttribute('aria-expanded', 'false');
            if (plusIcon) plusIcon.style.display = '';
            if (minusIcon) minusIcon.style.display = 'none';
          }
        }
      }
    });
  };

  // Lightweight helper to ensure references containers stay collapsed during streaming
  // Only does minimal DOM manipulation - just ensures existing containers are collapsed
  const ensureCollapsedDuringStreaming = () => {
    if (!contentRef.current) return;
    
    const containers = contentRef.current.querySelectorAll('.references-container');
    if (containers.length === 0) return; // No containers yet, nothing to do
    
    // For each existing container, ensure it's collapsed
    containers.forEach((container) => {
      const contentWrapper = container.querySelector('.references-content');
      const toggle = container.querySelector('.references-toggle');
      const plusIcon = toggle?.querySelector('.plus') as HTMLElement;
      const minusIcon = toggle?.querySelector('.minus') as HTMLElement;
      
      if (contentWrapper && toggle) {
        // Ensure collapsed state (lightweight - just class manipulation)
        contentWrapper.classList.remove('expanded');
        contentWrapper.classList.add('collapsed');
        toggle.setAttribute('aria-expanded', 'false');
        if (plusIcon) plusIcon.style.display = '';
        if (minusIcon) minusIcon.style.display = 'none';
      }
    });
  };

  // Preserve collapsed state before React replaces HTML
  useLayoutEffect(() => {
    if (!contentRef.current || role !== 'assistant' || !content || isStreaming) return;
    
    // Cleanup: preserve state before React replaces HTML (runs before next render)
    // Only run if we're NOT streaming (containers won't exist during streaming anyway)
    return () => {
      if (!contentRef.current || role !== 'assistant') return;
      
      // Preserve collapsed state before React replaces HTML in next render
      const containers = contentRef.current.querySelectorAll('.references-container');
      if (containers.length > 0) {
        const contentHash = getContentHash();
        let stateMap = globalCollapsedState.get(contentHash);
        if (!stateMap) {
          stateMap = new Map();
          globalCollapsedState.set(contentHash, stateMap);
        }
        
        containers.forEach((container, index) => {
          const contentWrapper = container.querySelector('.references-content');
          const toggle = container.querySelector('.references-toggle');
          if (contentWrapper && toggle) {
            const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
            stateMap.set(index, isExpanded);
          }
        });
      }
    };
  }, [content, role, isStreaming]);

  useEffect(() => {
    if (!contentRef.current || role !== 'assistant' || !content) return;

    // During streaming, do minimal work: only ensure references containers stay collapsed
    // This is lightweight (just class manipulation on existing elements) and prevents
    // references from expanding during streaming updates
    if (isStreaming) {
      // Use requestAnimationFrame to batch DOM updates with React's render
      requestAnimationFrame(() => {
        if (showReferences) {
          ensureCollapsedDuringStreaming();
        } else {
          // Hide references during streaming if disabled
          const containers = contentRef.current?.querySelectorAll('.references-container');
          containers?.forEach(container => {
            (container as HTMLElement).style.display = 'none';
          });
          
          // Hide reference paragraphs and list items
          const allElements = contentRef.current?.querySelectorAll('p, li, div');
          allElements?.forEach(el => {
            const text = el.textContent?.trim() || '';
            const html = el.innerHTML.toLowerCase();
            const hasStrong = el.querySelector('strong');
            const strongText = hasStrong?.textContent?.trim().toLowerCase() || '';
            
            const isReferencesHeading = text === 'References' || 
                                        text === '**References**' ||
                                        strongText === 'references' ||
                                        html.includes('<strong>references</strong>') ||
                                        html.includes('**references**');
            
            const startsWithReference = text.match(/^\[\d+\]/);
            const isInReferencesContainer = el.closest('.references-container');
            
            if (isReferencesHeading || startsWithReference || isInReferencesContainer) {
              (el as HTMLElement).style.display = 'none';
            }
          });
          
          // Remove inline citations from HTML completely
          const textElements = contentRef.current?.querySelectorAll('p, li, span, div, strong, em');
          textElements?.forEach(el => {
            const html = el.innerHTML;
            if (html.includes('[')) {
              const newHtml = html.replace(/\[\d+\]/g, '');
              if (newHtml !== html) {
                el.innerHTML = newHtml;
              }
            }
          });
          
          // Hide any citation spans that were already styled
          const citationSpans = contentRef.current?.querySelectorAll('.reference-citation');
          citationSpans?.forEach(span => {
            (span as HTMLElement).style.display = 'none';
          });
          
          // Hide reference items and headings
          const referenceItems = contentRef.current?.querySelectorAll('.reference-item, .references-heading, .references-heading-wrapper');
          referenceItems?.forEach(item => {
            (item as HTMLElement).style.display = 'none';
          });
        }
      });
      previousContentRef.current = content;
      return;
    }

    // FULL PROCESSING: Only when NOT streaming (after stream completes)
    // Use requestAnimationFrame to ensure DOM is updated before styling
    requestAnimationFrame(() => {
      if (!contentRef.current) return;
      
      const contentChanged = content !== previousContentRef.current;
      
      // CRITICAL: Check if references container already exists before processing
      // During streaming, React's dangerouslySetInnerHTML replaces HTML, but if containers
      // already exist (from previous styling), we need to skip to prevent nesting
      const existingContainer = contentRef.current.querySelector('.references-container');
      if (existingContainer && !contentChanged) {
        if (showReferences) {
          // Content hasn't changed and container exists - restore state immediately
          restoreCollapsedState(contentRef.current.querySelectorAll('.references-container'));
          // Only update citations for new content, don't reorganize
        } else {
          // Hide references if disabled - hide container and remove citations
          existingContainer.style.display = 'none';
          
          // Hide all reference paragraphs and list items
          const allElements = contentRef.current.querySelectorAll('p, li, div');
          allElements.forEach(el => {
            const text = el.textContent?.trim() || '';
            const html = el.innerHTML.toLowerCase();
            const hasStrong = el.querySelector('strong');
            const strongText = hasStrong?.textContent?.trim().toLowerCase() || '';
            
            const isReferencesHeading = text === 'References' || 
                                        text === '**References**' ||
                                        strongText === 'references' ||
                                        html.includes('<strong>references</strong>') ||
                                        html.includes('**references**');
            
            const startsWithReference = text.match(/^\[\d+\]/);
            const isInReferencesContainer = el.closest('.references-container');
            
            if (isReferencesHeading || startsWithReference || isInReferencesContainer) {
              (el as HTMLElement).style.display = 'none';
            }
          });
          
          // Remove inline citations from the content
          const textElements = contentRef.current.querySelectorAll('p, li, span, div, strong, em');
          textElements.forEach(el => {
            const html = el.innerHTML;
            if (html.includes('[')) {
              const newHtml = html.replace(/\[\d+\]/g, '');
              if (newHtml !== html) {
                el.innerHTML = newHtml;
              }
            }
          });
          
          // Hide citation spans
          const citationSpans = contentRef.current.querySelectorAll('.reference-citation');
          citationSpans.forEach(span => {
            (span as HTMLElement).style.display = 'none';
          });
        }
        return;
      }

      // Wrap all tables in a scrollable container for mobile responsiveness
      const tables = contentRef.current.querySelectorAll('table');
      tables.forEach(table => {
        if (!table.parentElement?.classList.contains('table-wrapper')) {
          const wrapper = document.createElement('div');
          wrapper.className = 'table-wrapper';
          table.parentNode?.insertBefore(wrapper, table);
          wrapper.appendChild(table);
        }
      });

      // Detect and wrap drug conversion calculations (after tables but before references)
      wrapDrugConversionContent(contentRef.current);

      // Style references section (only if showReferences is enabled)
      if (showReferences) {
        styleReferences(contentRef.current);
      } else {
        // COMPLETELY REMOVE references if disabled
        
        // 1. Hide/remove reference containers
        const referencesContainers = contentRef.current.querySelectorAll('.references-container');
        referencesContainers.forEach(container => {
          (container as HTMLElement).style.display = 'none';
        });
        
        // 2. Hide reference paragraphs (References heading, [1] text, etc.)
        // Also check list items and other elements that might contain references
        const allElements = contentRef.current.querySelectorAll('p, li, div');
        allElements.forEach(el => {
          const text = el.textContent?.trim() || '';
          const html = el.innerHTML.toLowerCase();
          const hasStrong = el.querySelector('strong');
          const strongText = hasStrong?.textContent?.trim().toLowerCase() || '';
          
          // Check if element contains "References" heading (various formats)
          const isReferencesHeading = text === 'References' || 
                                      text === '**References**' ||
                                      strongText === 'references' ||
                                      html.includes('<strong>references</strong>') ||
                                      html.includes('**references**');
          
          // Check if element starts with [number] pattern (reference item)
          // This is the most reliable indicator of a reference item
          const startsWithReference = text.match(/^\[\d+\]/);
          
          // Check if inside a references container (should already be hidden, but double-check)
          const isInReferencesContainer = el.closest('.references-container');
          
          // Hide if it's a references heading, starts with [number], or is in a references container
          if (isReferencesHeading || startsWithReference || isInReferencesContainer) {
            (el as HTMLElement).style.display = 'none';
          }
        });
        
        // 3. Remove inline citations [1], [2], etc. from HTML completely
        // Process all text-containing elements
        const textElements = contentRef.current.querySelectorAll('p, li, span, div, strong, em');
        textElements.forEach(el => {
          const html = el.innerHTML;
          // Remove [number] patterns from HTML
          if (html.includes('[')) {
            const newHtml = html.replace(/\[\d+\]/g, '');
            if (newHtml !== html) {
              el.innerHTML = newHtml;
            }
          }
        });
        
        // 4. Hide any citation spans that were already styled
        const citationSpans = contentRef.current.querySelectorAll('.reference-citation');
        citationSpans.forEach(span => {
          (span as HTMLElement).style.display = 'none';
        });
        
        // 5. Hide reference items and headings
        const referenceItems = contentRef.current.querySelectorAll('.reference-item, .references-heading, .references-heading-wrapper');
        referenceItems.forEach(item => {
          (item as HTMLElement).style.display = 'none';
        });
      }
      
      // Always restore state after styleReferences runs (for both new and existing content)
      // This handles the case where React replaced HTML and styleReferences just recreated containers
      if (showReferences) {
        const containers = contentRef.current.querySelectorAll('.references-container');
        if (containers.length > 0) {
          restoreCollapsedState(containers);
        }
      }
      
      // Update previous content ref after processing
      previousContentRef.current = content;
    });
  }, [content, role, isStreaming, showReferences]);

  // Helper function to convert HTML to formatted plain text
  const htmlToText = (html: string): string => {
    // Create a temporary div to parse HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // Function to recursively process nodes and preserve formatting
    const processNode = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent || '';
      }
      
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element;
        const tagName = element.tagName.toLowerCase();
        const children = Array.from(element.childNodes)
          .map(processNode)
          .join('');
        
        // Handle different HTML elements
        switch (tagName) {
          case 'h1':
          case 'h2':
          case 'h3':
          case 'h4':
          case 'h5':
          case 'h6':
            return `\n${children}\n`;
          case 'p':
            return `${children}\n\n`;
          case 'br':
            return '\n';
          case 'li':
            return `• ${children}\n`;
          case 'strong':
          case 'b':
            return `**${children}**`;
          case 'em':
          case 'i':
            return `*${children}*`;
          case 'code':
            return `\`${children}\``;
          case 'pre':
            return `\n${children}\n`;
          case 'blockquote':
            return `> ${children}\n`;
          case 'hr':
            return '\n---\n';
          case 'table':
            // Extract table content
            const rows: string[] = [];
            const tableRows = element.querySelectorAll('tr');
            tableRows.forEach(row => {
              const cells = Array.from(row.querySelectorAll('td, th'))
                .map(cell => processNode(cell).trim())
                .join(' | ');
              rows.push(`| ${cells} |`);
            });
            return `\n${rows.join('\n')}\n`;
          case 'a':
            const href = element.getAttribute('href');
            return href ? `[${children}](${href})` : children;
          default:
            return children;
        }
      }
      
      return '';
    };
    
    // Process all nodes and clean up extra whitespace
    let text = processNode(tempDiv);
    
    // Clean up excessive newlines (more than 2 consecutive)
    text = text.replace(/\n{3,}/g, '\n\n');
    
    // Trim leading/trailing whitespace
    return text.trim();
  };

  // Handle copy to clipboard
  const handleCopy = async () => {
    if (!contentRef.current) return;
    
    try {
      // Get the HTML content from the rendered element
      const htmlContent = contentRef.current.innerHTML;
      
      // Convert HTML to formatted plain text
      const textContent = htmlToText(htmlContent);
      
      // Copy to clipboard
      await navigator.clipboard.writeText(textContent);
      
      // Show success feedback
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      try {
        const textContent = htmlToText(contentRef.current.innerHTML);
        const textArea = document.createElement('textarea');
        textArea.value = textContent;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      } catch (fallbackErr) {
        console.error('Failed to copy to clipboard:', fallbackErr);
      }
    }
  };

  // Render markdown for assistant messages, plain text for user (same as vanilla JS)
  if (role === 'assistant') {
    const html = marked.parse(content);
    // Add class to hide references if disabled
    const contentClassName = `message-content${!showReferences ? ' no-references' : ''}`;
    return (
      <div className="message-content-wrapper">
        <div
          ref={contentRef}
          className={contentClassName}
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <button
          type="button"
          className="message-copy-button"
          onClick={handleCopy}
          title={isCopied ? 'Copied!' : 'Copy response'}
          aria-label={isCopied ? 'Copied!' : 'Copy response to clipboard'}
        >
          {isCopied ? (
            <>
              <span className="copy-button-text">Copied</span>
              <Check size={16} />
            </>
          ) : (
            <>
              <span className="copy-button-text">Copy</span>
              <Copy size={16} />
            </>
          )}
        </button>
      </div>
    );
  }

  // User messages are plain text
  return (
    <div className="message-content">
      {content}
    </div>
  );
}

// Memoize component to prevent unnecessary re-renders when props haven't changed
export const MessageContent = memo(MessageContentComponent);

