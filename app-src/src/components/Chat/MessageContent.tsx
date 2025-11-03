/**
 * MessageContent - Renders markdown content with styling
 * Ports the vanilla JS message rendering and styling logic
 */

import { useEffect, useLayoutEffect, useRef, memo } from 'react';
import { marked } from 'marked';
import { styleReferences, wrapDrugConversionContent, updateCitationStyles } from '@/utils/messageStyling';

interface MessageContentProps {
  content: string;
  role: 'user' | 'assistant';
  isStreaming?: boolean; // Flag to skip expensive DOM manipulation during streaming
}

// Configure marked (same as vanilla JS)
marked.setOptions({
  breaks: false, // Prevent awkward line breaks in lists
  gfm: true,
});

// Global state map to persist collapsed state across re-renders
// Key: content hash, Value: Map of container index -> expanded state
const globalCollapsedState = new Map<string, Map<number, boolean>>();

function MessageContentComponent({ content, role, isStreaming = false }: MessageContentProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const previousContentRef = useRef<string>('');
  
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
        ensureCollapsedDuringStreaming();
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
        // Content hasn't changed and container exists - restore state immediately
        restoreCollapsedState(contentRef.current.querySelectorAll('.references-container'));
        // Only update citations for new content, don't reorganize
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

      // Style references section
      styleReferences(contentRef.current);
      
      // Always restore state after styleReferences runs (for both new and existing content)
      // This handles the case where React replaced HTML and styleReferences just recreated containers
      const containers = contentRef.current.querySelectorAll('.references-container');
      if (containers.length > 0) {
        restoreCollapsedState(containers);
      }
      
      // Update previous content ref after processing
      previousContentRef.current = content;
    });
  }, [content, role, isStreaming]);

  // Render markdown for assistant messages, plain text for user (same as vanilla JS)
  if (role === 'assistant') {
    const html = marked.parse(content);
    return (
      <div
        ref={contentRef}
        className="message-content"
        dangerouslySetInnerHTML={{ __html: html }}
      />
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

