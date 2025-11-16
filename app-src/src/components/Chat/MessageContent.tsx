/**
 * MessageContent - Renders markdown content with styling
 * Ports the vanilla JS message rendering and styling logic
 */

import { useEffect, useLayoutEffect, useRef, memo } from 'react';
import { marked } from 'marked';
import { Copy, Check, RotateCcw } from 'lucide-react';
import { styleReferences, wrapDrugConversionContent } from '@/utils/messageStyling';
import { preprocessMarkdown, removeReferencesFromMarkdown } from '@/utils/markdownUtils';
import { useReferenceState } from '@/hooks/useReferenceState';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { ShareButton } from './ShareButton';
import { ReactionButtons } from './ReactionButtons';
import { Tooltip } from '@/components/UI/Tooltip';

interface MessageContentProps {
  content: string;
  role: 'user' | 'assistant';
  isStreaming?: boolean; // Flag to skip expensive DOM manipulation during streaming
  showReferences?: boolean; // Controls visibility of references section (default true)
  conversationId?: string; // Database conversation ID for sharing
  shareToken?: string; // Share token for this conversation
  question?: string; // Original question text for assistant messages (for "Try Again" button)
  onTryAgain?: (question: string) => void; // Callback to handle "Try Again" action
  messageId?: string; // Unique message ID for state persistence
}

// Configure marked (same as vanilla JS)
marked.setOptions({
  breaks: false, // Prevent awkward line breaks in lists
  gfm: true,
});

function MessageContentComponent({ content, role, isStreaming = false, showReferences = true, conversationId, shareToken, question, onTryAgain, messageId }: MessageContentProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const previousContentRef = useRef<string>('');
  const htmlSetRef = useRef<boolean>(false); // Track if we've set innerHTML manually
  
  // Use hooks for state management
  const { getStateKey, restoreCollapsedState, collapseAllReferences, ensureCollapsedDuringStreaming, saveCollapsedState } = useReferenceState();
  const { isCopied, handleCopy: handleCopyToClipboard } = useCopyToClipboard();
  
  // Wrapper for handleCopy that includes collapsing references
  const handleCopy = async () => {
    const stateKey = getStateKey(messageId, content);
    
    await handleCopyToClipboard(
      contentRef,
      showReferences,
      () => {
        // Collapse all references after copying
        if (contentRef.current) {
          const containers = contentRef.current.querySelectorAll('.references-container');
          if (containers.length > 0) {
            collapseAllReferences(containers, stateKey);
          }
        }
      }
    );
  };

  // Save state immediately whenever the DOM might change
  // This effect runs after every render and saves the current state
  useLayoutEffect(() => {
    if (!contentRef.current || role !== 'assistant' || !content || isStreaming) return;
    
    const containers = contentRef.current.querySelectorAll('.references-container');
    if (containers.length === 0) return;
    
    const stateKey = getStateKey(messageId, content);
    saveCollapsedState(containers, stateKey);
  }); // NO dependencies - runs after EVERY render to keep state fresh

  // Restore state after any render that might have replaced HTML (e.g., when isCopied changes)
  useLayoutEffect(() => {
    if (!contentRef.current || role !== 'assistant' || !content || isStreaming || !showReferences) return;
    
    // Check if containers exist - if not, useEffect will create them
    const containers = contentRef.current.querySelectorAll('.references-container');
    if (containers.length > 0) {
      // Containers exist - restore their state immediately
      const stateKey = getStateKey(messageId, content);
      restoreCollapsedState(containers, stateKey);
    }
  }, [isCopied, content, role, isStreaming, showReferences, messageId, getStateKey, restoreCollapsedState]);

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
        if (showReferences && contentRef.current) {
          const containers = contentRef.current.querySelectorAll('.references-container');
          ensureCollapsedDuringStreaming(containers);
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
          const stateKey = getStateKey(messageId, content);
          restoreCollapsedState(containers, stateKey);
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
          const stateKey = getStateKey(messageId, content);
          restoreCollapsedState(containers, stateKey);
        }
      }
      
      // Update previous content ref after processing
      previousContentRef.current = content;
    });
  }, [content, role, isStreaming, showReferences, isCopied, messageId, getStateKey, restoreCollapsedState, ensureCollapsedDuringStreaming]);

  // Render markdown for assistant messages, plain text for user (same as vanilla JS)
  if (role === 'assistant') {
    // Remove references from markdown before parsing if showReferences is false
    let contentToRender = showReferences ? content : removeReferencesFromMarkdown(content);
    // Preprocess to prevent false blockquote detection and remove strikethrough
    contentToRender = preprocessMarkdown(contentToRender);
    let html = marked.parse(contentToRender) as string; // marked.parse returns string in sync mode
    
    // Post-process HTML to remove any <del> tags that might have slipped through
    // This is a safety measure in case strikethrough markdown wasn't fully removed
    html = html.replace(/<del[^>]*>([\s\S]*?)<\/del>/gi, '$1'); // Remove <del> tags but keep content
    
    // Ref callback to set innerHTML only when content changes
    // This prevents React from destroying our styled references containers
    const setContentRef = (node: HTMLDivElement | null) => {
      if (node) {
        contentRef.current = node;
        // Only set innerHTML if content has changed
        if (content !== previousContentRef.current) {
          node.innerHTML = html as string;
          htmlSetRef.current = true;
        } else if (!htmlSetRef.current) {
          // First render - set innerHTML
          node.innerHTML = html as string;
          htmlSetRef.current = true;
        }
        // Otherwise skip - content unchanged, preserve DOM
      }
    };
    
    return (
      <div className="message-content-wrapper">
        <div
          ref={setContentRef}
          className="message-content"
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
          {question && onTryAgain && (
            <Tooltip 
              content="Sometimes asking the assistant again can refine the response"
              position="top"
              delay={0}
            >
              <button
                type="button"
                className="message-try-again-button"
                onClick={() => onTryAgain(question)}
                aria-label="Try asking this question again"
              >
                <span className="try-again-button-text">Try Again</span>
                <RotateCcw size={16} />
              </button>
            </Tooltip>
          )}
          <ShareButton conversationId={conversationId} shareToken={shareToken} />
          <ReactionButtons conversationId={conversationId} />
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

