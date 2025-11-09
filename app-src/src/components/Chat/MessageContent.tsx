/**
 * MessageContent - Renders markdown content with styling
 * Ports the vanilla JS message rendering and styling logic
 */

import { useEffect, useLayoutEffect, useRef, memo, useState } from 'react';
import { marked } from 'marked';
import { Copy, Check } from 'lucide-react';
import { styleReferences, wrapDrugConversionContent } from '@/utils/messageStyling';
import { ShareButton } from './ShareButton';

interface MessageContentProps {
  content: string;
  role: 'user' | 'assistant';
  isStreaming?: boolean; // Flag to skip expensive DOM manipulation during streaming
  showReferences?: boolean; // Controls visibility of references section (default true)
  conversationId?: string; // Database conversation ID for sharing
  shareToken?: string; // Share token for this conversation
}

// Configure marked (same as vanilla JS)
marked.setOptions({
  breaks: false, // Prevent awkward line breaks in lists
  gfm: true,
});

/**
 * Preprocess markdown to prevent false blockquote detection
 * Escapes ">" characters that appear after list markers but are actually comparison operators
 * Example: "- >50 kg: 1" should not be a blockquote, but "- If patient >50 kg" is fine
 */
function preprocessMarkdown(markdown: string): string {
  // Split into lines to process line by line
  return markdown.split('\n').map(line => {
    // Check if line starts with a list marker (bullet or numbered) followed immediately by " >"
    // This pattern is likely a false blockquote (e.g., "- >50 kg: 1" or "- > 50 kg: 1")
    // Pattern matches: optional indent, list marker, whitespace, ">", optional space, then number/letter
    const listMarkerPattern = /^(\s*)([-*+]|\d+\.)\s+>\s*(\d+|[A-Za-z])/;
    
    if (listMarkerPattern.test(line)) {
      // Escape the ">" by replacing it with HTML entity "&gt;"
      // This preserves the visual ">" but prevents markdown blockquote parsing
      // Only replace the first occurrence after the list marker
      return line.replace(/^(\s*)([-*+]|\d+\.)\s+>\s*/, '$1$2 &gt;');
    }
    
    return line;
  }).join('\n');
}

// Global state map to persist collapsed state across re-renders
// Key: content hash, Value: Map of container index -> expanded state
const globalCollapsedState = new Map<string, Map<number, boolean>>();

/**
 * Remove references from markdown content before parsing
 * This prevents references from appearing in the DOM at all when showReferences is false
 */
function removeReferencesFromMarkdown(markdown: string): string {
  const lines = markdown.split('\n');
  const cleanedLines: string[] = [];
  let inReferencesSection = false;
  
  for (let i = 0; i < lines.length; i++) {
    const originalLine = lines[i];
    const trimmed = originalLine.trim();
    
    // Check if this line starts a references section
    // Match: "References", "**References**", "# References", "## References", etc.
    if (trimmed.toLowerCase() === 'references' || 
        trimmed.toLowerCase() === '**references**' ||
        /^#+\s*references$/i.test(trimmed) ||
        /^\*\*references\*\*$/i.test(trimmed)) {
      inReferencesSection = true;
      continue; // Skip the references heading
    }
    
    // If we're in references section
    if (inReferencesSection) {
      // Check if this line is a reference item (starts with [number])
      if (/^\[\d+\]/.test(trimmed)) {
        continue; // Skip reference items
      }
      
      // Check if this is an empty line or whitespace
      if (!trimmed) {
        // Keep empty lines but they won't end the section yet
        // We'll continue until we find non-reference content
        continue;
      }
      
      // Check if this line looks like it's still part of references
      // (e.g., continuation lines, numbered lists that might be references)
      if (/^\d+\.\s*\[/.test(trimmed)) {
        continue; // Skip numbered list references
      }
      
      // If we get here and the line has substantial content, we've likely left the references section
      // Reset the flag and include this line (it's probably new content)
      if (trimmed.length > 20 && !trimmed.toLowerCase().includes('reference')) {
        inReferencesSection = false;
        // Include this line after removing inline citations
        cleanedLines.push(originalLine.replace(/\[\d+\]/g, ''));
      } else {
        // Still might be a reference, skip it
        continue;
      }
    } else {
      // Not in references section - include the line but remove inline citations
      cleanedLines.push(originalLine.replace(/\[\d+\]/g, ''));
    }
  }
  
  // Join and clean up excessive blank lines
  let result = cleanedLines.join('\n');
  // Remove more than 2 consecutive newlines
  result = result.replace(/\n{3,}/g, '\n\n');
  
  return result;
}

function MessageContentComponent({ content, role, isStreaming = false, showReferences = true, conversationId, shareToken }: MessageContentProps) {
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
    if (!stateMap) {
      return;
    }
    
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

  // Restore state after any render that might have replaced HTML (e.g., when isCopied changes)
  useLayoutEffect(() => {
    if (!contentRef.current || role !== 'assistant' || !content || isStreaming || !showReferences) return;
    
    // Check if containers exist - if not, useEffect will create them
    const containers = contentRef.current.querySelectorAll('.references-container');
    if (containers.length > 0) {
      // Containers exist - restore their state immediately
      restoreCollapsedState(containers);
    }
  }, [isCopied, content, role, isStreaming, showReferences]);

  useEffect(() => {
    if (!contentRef.current || role !== 'assistant' || !content) {
      return;
    }

    // During streaming, do minimal work: only ensure references containers stay collapsed
    // This is lightweight (just class manipulation on existing elements) and prevents
    // references from expanding during streaming updates
    if (isStreaming) {
      // Use requestAnimationFrame to batch DOM updates with React's render
      requestAnimationFrame(() => {
        if (showReferences) {
          ensureCollapsedDuringStreaming();
        }
        // When showReferences is false, references are already removed from markdown before parsing
        // so no need to hide anything during streaming
      });
      previousContentRef.current = content;
      return;
    }

    // FULL PROCESSING: Only when NOT streaming (after stream completes)
    // Use requestAnimationFrame to ensure DOM is updated before styling
    requestAnimationFrame(() => {
      if (!contentRef.current) {
        return;
      }
      
      const contentChanged = content !== previousContentRef.current;
      
      // CRITICAL: Check if references container already exists before processing
      // During streaming, React's dangerouslySetInnerHTML replaces HTML, but if containers
      // already exist (from previous styling), we need to skip to prevent nesting
      const existingContainer = contentRef.current.querySelector('.references-container');
      
      // If containers don't exist but should (showReferences is true), we need to create them
      // This handles the case where React replaced HTML (e.g., when isCopied changed)
      const needsContainerCreation = showReferences && !existingContainer;
      
      if (existingContainer && !contentChanged && !needsContainerCreation) {
        if (showReferences) {
          // Content hasn't changed and container exists - restore state immediately
          const containers = contentRef.current.querySelectorAll('.references-container');
          restoreCollapsedState(containers);
          // Only update citations for new content, don't reorganize
        }
        // When showReferences is false, references are already removed from markdown before parsing
        // so containers shouldn't exist, but if they do (from previous render), remove them
        if (!showReferences && existingContainer) {
          existingContainer.remove();
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
      // When showReferences is false, references are already removed from markdown before parsing
      if (showReferences) {
        styleReferences(contentRef.current);
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
  }, [content, role, isStreaming, showReferences, isCopied]);

  // Helper function to remove references from a cloned DOM element
  const removeReferencesFromClone = (element: HTMLElement): void => {
    // 1. Remove all reference containers (this removes everything inside them including .references-content, .reference-item, etc.)
    const referencesContainers = element.querySelectorAll('.references-container');
    referencesContainers.forEach(container => {
      container.remove();
    });
    
    // 2. Remove reference separator horizontal rules
    const referenceSeparators = element.querySelectorAll('.references-separator');
    referenceSeparators.forEach(hr => {
      hr.remove();
    });
    
    // 3. Remove any remaining reference items, headings, and wrappers that might exist outside containers
    const referenceItems = element.querySelectorAll('.reference-item, .references-heading, .references-heading-wrapper, .references-content');
    referenceItems.forEach(item => {
      item.remove();
    });
    
    // 4. Remove citation spans (inline citations like [1])
    const citationSpans = element.querySelectorAll('.reference-citation');
    citationSpans.forEach(span => {
      span.remove();
    });
    
    // 5. Remove any paragraphs/list items that look like references (but weren't styled yet)
    // Use Array.from to get a snapshot before iterating (since we're removing elements)
    const allElements = Array.from(element.querySelectorAll('p, li'));
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
      // Also check if it's mostly just a reference (contains [number] and is short)
      const startsWithReference = /^\[\d+\]/.test(text);
      const isReferenceLike = /^\[\d+\]/.test(text) && text.length < 200; // Reference items are usually short
      
      // Remove if it's a references heading or looks like a reference item
      if (isReferencesHeading || startsWithReference || isReferenceLike) {
        el.remove();
      }
    });
    
    // 6. Remove inline citations [1], [2], etc. from remaining HTML content
    // This must be done after removing citation spans, as they might contain the pattern
    const textElements = element.querySelectorAll('p, li, span, div, strong, em, h1, h2, h3, h4, h5, h6');
    textElements.forEach(el => {
      const html = el.innerHTML;
      if (html.includes('[')) {
        // Remove citation patterns like [1], [2], etc. but preserve other brackets
        // Match [ followed by one or more digits followed by ]
        const newHtml = html.replace(/\[\d+\]/g, '');
        if (newHtml !== html) {
          el.innerHTML = newHtml;
        }
      }
    });
    
    // 7. Clean up any empty paragraphs or list items that might remain
    const emptyElements = Array.from(element.querySelectorAll('p, li'));
    emptyElements.forEach(el => {
      const text = el.textContent?.trim() || '';
      const html = el.innerHTML.trim();
      // Remove if empty or only contains whitespace/line breaks
      if (!text && (!html || html === '<br>' || html === '<br/>')) {
        el.remove();
      }
    });
  };

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

  // Helper function to collapse all references containers
  const collapseAllReferences = () => {
    if (!contentRef.current) {
      return;
    }
    
    const containers = contentRef.current.querySelectorAll('.references-container');
    const contentHash = getContentHash();
    let stateMap = globalCollapsedState.get(contentHash);
    if (!stateMap) {
      stateMap = new Map();
      globalCollapsedState.set(contentHash, stateMap);
    }
    
    containers.forEach((container, index) => {
      const contentWrapper = container.querySelector('.references-content');
      const toggle = container.querySelector('.references-toggle');
      const plusIcon = toggle?.querySelector('.plus') as HTMLElement;
      const minusIcon = toggle?.querySelector('.minus') as HTMLElement;
      
      if (contentWrapper && toggle) {
        // Collapse the container
        contentWrapper.classList.remove('expanded');
        contentWrapper.classList.add('collapsed');
        toggle.setAttribute('aria-expanded', 'false');
        if (plusIcon) plusIcon.style.display = '';
        if (minusIcon) minusIcon.style.display = 'none';
        
        // Update global state to reflect collapsed state
        stateMap.set(index, false);
      }
    });
  };

  // Handle copy to clipboard
  const handleCopy = async () => {
    if (!contentRef.current) {
      return;
    }
    
    try {
      // Clone the element to avoid modifying the original DOM
      const clonedElement = contentRef.current.cloneNode(true) as HTMLElement;
      
      // If references are disabled, they should already be removed from markdown before parsing
      // But as a safety net, remove any references that might have slipped through
      if (!showReferences) {
        removeReferencesFromClone(clonedElement);
      }
      
      // Get the HTML content from the cloned element
      const htmlContent = clonedElement.innerHTML;
      
      // Convert HTML to formatted plain text
      const textContent = htmlToText(htmlContent);
      
      // Copy to clipboard
      await navigator.clipboard.writeText(textContent);
      
      // Collapse all references containers after copying
      collapseAllReferences();
      
      // Show success feedback
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      try {
        // Clone the element for fallback as well
        const clonedElement = contentRef.current.cloneNode(true) as HTMLElement;
        
        // If references are disabled, they should already be removed from markdown before parsing
        // But as a safety net, remove any references that might have slipped through
        if (!showReferences) {
          removeReferencesFromClone(clonedElement);
        }
        
        const textContent = htmlToText(clonedElement.innerHTML);
        const textArea = document.createElement('textarea');
        textArea.value = textContent;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        // Collapse all references containers after copying
        collapseAllReferences();
        
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      } catch (fallbackErr) {
        console.error('Failed to copy to clipboard:', fallbackErr);
      }
    }
  };

  // Render markdown for assistant messages, plain text for user (same as vanilla JS)
  if (role === 'assistant') {
    // Remove references from markdown before parsing if showReferences is false
    let contentToRender = showReferences ? content : removeReferencesFromMarkdown(content);
    // Preprocess to prevent false blockquote detection
    contentToRender = preprocessMarkdown(contentToRender);
    const html = marked.parse(contentToRender);
    return (
      <div className="message-content-wrapper">
        <div
          ref={contentRef}
          className="message-content"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <div className="message-actions">
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
          <ShareButton conversationId={conversationId} shareToken={shareToken} />
        </div>
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

