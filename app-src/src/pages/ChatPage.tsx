/**
 * ChatPage - React version of vanilla JS chat interface
 * Refactored into modular hooks for easier maintenance
 * 
 * Architecture:
 * - Custom hooks handle specific concerns (URL params, messages, modals, etc.)
 * - Main component orchestrates hooks and renders UI
 * - All functionality preserved from original implementation
 */

import { useRef, useEffect, useState } from 'react';
import { MessageContent } from '@/components/Chat/MessageContent';
import { ChatHeader } from '@/components/Chat/ChatHeader';
import { LoadingMessage } from '@/components/Chat/LoadingMessage';
import { CoverAndWelcome } from '@/components/Chat/CoverAndWelcome';
import { DownloadsAndKeywords } from '@/components/Chat/DownloadsAndKeywords';
import { PasscodeModal } from '@/components/Chat/PasscodeModal';
import { DocumentOwnerModal } from '@/components/Chat/DocumentOwnerModal';
import { DocumentSelector } from '@/components/Chat/DocumentSelector';
import { DocutrainFooter } from '@/components/Chat/DocutrainFooter';
import { DocumentMeta } from '@/components/Chat/DocumentMeta';
import { DisclaimerModal, useDisclaimer } from '@/components/Auth/DisclaimerModal';
import { SelectionPrompt } from '@/components/Chat/SelectionPrompt';
import { Spinner } from '@/components/UI/Spinner';
import { useDocumentConfig } from '@/hooks/useDocumentConfig';
import { useOwnerLogo } from '@/hooks/useOwnerLogo';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useSessionId } from '@/hooks/useSessionId';
import { useChatUrlParams } from '@/hooks/useChatUrlParams';
import { useRealtimeDocumentSync } from '@/hooks/useRealtimeDocumentSync';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useModalState } from '@/hooks/useModalState';
import { useChatMessages } from '@/hooks/useChatMessages';
import '@/styles/messages.css';
import '@/styles/loading.css';
import '@/styles/cover-and-welcome.css';
import '@/styles/keywords.css';
import '@/styles/downloads.css';
import '@/styles/inline-editor.css';
import '@/styles/send-button.css';

export function ChatPage() {
  // ============================================================================
  // SECTION 1: Core Hooks (Auth & Permissions)
  // ============================================================================
  const { user, loading: authLoading } = useAuth();
  const permissions = usePermissions();
  
  // ============================================================================
  // SECTION 2: URL Parameters
  // ============================================================================
  const {
    documentSlug,
    embeddingType,
    selectedModel,
    shouldShowFooter,
    ownerParam,
  } = useChatUrlParams();
  
  // ============================================================================
  // SECTION 3: Session Management
  // ============================================================================
  const { sessionId } = useSessionId();
  
  // ============================================================================
  // SECTION 4: Document Configuration
  // ============================================================================
  // Get document config (includes cover, introMessage, etc.)
  // Only fetch if we have a document slug - don't fetch when null (shows modal instead)
  const { config: docConfig, errorDetails, loading: configLoading } = useDocumentConfig(documentSlug);
  
  // ============================================================================
  // SECTION 5: Owner Logo & Accent Color
  // ============================================================================
  // Get document owner for accent color (must be called before early return)
  const documentOwnerSlug = docConfig?.ownerInfo?.slug || docConfig?.owner || null;
  const { config: ownerLogoConfig } = useOwnerLogo(documentOwnerSlug);
  
  // Set accent color CSS variables based on document owner
  useAccentColor(ownerLogoConfig?.accentColor);
  
  // ============================================================================
  // SECTION 6: Realtime Document Sync
  // ============================================================================
  // CENTRALIZED Realtime subscription for document updates
  // This is the ONLY place we subscribe to avoid duplicate subscriptions
  useRealtimeDocumentSync(documentSlug, authLoading, permissions.loading);
  
  // ============================================================================
  // SECTION 6.5: Disclaimer Management
  // ============================================================================
  // Check if document(s) require disclaimer (e.g., ukidney medical documents)
  // Supports multi-document scenarios - if ANY document requires disclaimer, show it
  // Skip if we already have an auth error (passcode required, access denied, etc.)
  const hasAuthError = !!errorDetails && (
    errorDetails.type === 'passcode_required' || 
    errorDetails.type === 'access_denied'
  );
  
  const {
    needsDisclaimer,
    disclaimerAccepted,
    isChecking: isCheckingDisclaimer,
    handleAccept: handleDisclaimerAccept,
    handleDecline: handleDisclaimerDecline,
  } = useDisclaimer({ documentSlug, hasAuthError });
  
  // ============================================================================
  // SECTION 7: Chat Messages
  // ============================================================================
  // Get passcode from URL or localStorage
  const passcodeFromStorage = documentSlug ? localStorage.getItem(`passcode:${documentSlug}`) : null;
  
  const {
    messages,
    inputValue,
    setInputValue,
    isLoading,
    isStreamingRef,
    handleSendMessage,
  } = useChatMessages({
    documentSlug,
    sessionId,
    embeddingType,
    selectedModel,
    docConfig,
    passcode: passcodeFromStorage,
  });
  
  // ============================================================================
  // SECTION 8: Modal State
  // ============================================================================
  const {
    shouldShowPasscodeModal,
    shouldShowDocumentOwnerModal,
    shouldShowDocumentSelectorModal,
    isDocumentNotFound,
  } = useModalState(errorDetails, documentSlug, ownerParam);
  
  // ============================================================================
  // SECTION 9: Refs
  // ============================================================================
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastUserMessageRef = useRef<string | null>(null);
  
  // ============================================================================
  // SECTION 9.25: Text Selection Prompt
  // ============================================================================
  const [selectionPrompt, setSelectionPrompt] = useState<{
    text: string;
    position: { top: number; left: number };
  } | null>(null);
  const lastMouseDownRef = useRef<number>(0);
  const selectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSelectingRef = useRef<boolean>(false);
  
  // ============================================================================
  // SECTION 9.3: Text Selection Detection
  // ============================================================================
  // Detect text selection in chat messages (especially keyboard-based selections)
  useEffect(() => {
    const handleMouseDown = () => {
      // Track when mouse is pressed to differentiate keyboard vs mouse selection
      lastMouseDownRef.current = Date.now();
      isSelectingRef.current = true;
    };

    const handleMouseUp = () => {
      isSelectingRef.current = false;
      
      // After mouse up, check if there's a selection (but wait a bit for selection to settle)
      setTimeout(() => {
        checkSelection();
      }, 50);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Track keyboard selection (Shift + Arrow keys)
      if (e.shiftKey && (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End')) {
        isSelectingRef.current = true;
        // Clear any existing timeout when user starts selecting again
        if (selectionTimeoutRef.current) {
          clearTimeout(selectionTimeoutRef.current);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // When arrow keys or Shift are released, selection might be complete
      if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End' || e.key === 'Shift') {
        // Wait a bit to see if user continues selecting
        setTimeout(() => {
          // Check if shift is still pressed by checking current keyboard state
          // We can't rely on e.shiftKey after the event, so we check after a delay
          isSelectingRef.current = false;
          checkSelection();
        }, 150);
      }
    };

    const checkSelection = () => {
      // Clear any existing timeout
      if (selectionTimeoutRef.current) {
        clearTimeout(selectionTimeoutRef.current);
      }

      // Check if there's a selection
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        setSelectionPrompt(null);
        return;
      }

      // Clone the range to avoid interfering with the actual selection
      const range = selection.getRangeAt(0).cloneRange();
      const selectedText = range.toString().trim();

      // Only show prompt if there's actual text selected
      if (!selectedText || selectedText.length === 0) {
        setSelectionPrompt(null);
        return;
      }

      // Check if selection is within chat container
      if (!chatContainerRef.current) {
        setSelectionPrompt(null);
        return;
      }

      const selectionNode = range.commonAncestorContainer;
      const isWithinChatContainer = chatContainerRef.current.contains(
        selectionNode.nodeType === Node.TEXT_NODE
          ? selectionNode.parentElement
          : (selectionNode as Element)
      );

      if (!isWithinChatContainer) {
        setSelectionPrompt(null);
        return;
      }

      // Check if selection is within input field (don't show prompt for input selections)
      if (inputRef.current && inputRef.current.contains(selectionNode.nodeType === Node.TEXT_NODE ? selectionNode.parentElement : (selectionNode as Element))) {
        setSelectionPrompt(null);
        return;
      }

      // Only show prompt after selection is complete (not while actively selecting)
      if (isSelectingRef.current) {
        // User is still selecting, wait until they're done
        selectionTimeoutRef.current = setTimeout(() => {
          checkSelection();
        }, 150);
        return;
      }

      // Selection is complete, show prompt
      // Use requestAnimationFrame to ensure DOM is ready before getting bounds
      requestAnimationFrame(() => {
        // Get fresh selection in case it changed
        const freshSelection = window.getSelection();
        if (!freshSelection || freshSelection.rangeCount === 0) {
          setSelectionPrompt(null);
          return;
        }

        // Clone the range to avoid any interference with the actual selection
        const freshRange = freshSelection.getRangeAt(0).cloneRange();
        const freshText = freshRange.toString().trim();
        
        if (!freshText || freshText.length === 0) {
          setSelectionPrompt(null);
          return;
        }

        // Get bounding rect from the cloned range (doesn't interfere with selection)
        const rect = freshRange.getBoundingClientRect();
        setSelectionPrompt({
          text: freshText,
          position: {
            top: rect.bottom,
            left: rect.left + rect.width / 2,
          },
        });
      });
    };

    // Track mouse events
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
    
    // Track keyboard events for selection
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    // Also listen for selection changes, but only to clear prompt when selection is cleared
    // This won't interfere with selection since we're only reading, not modifying
    const handleSelectionChange = () => {
      // Only clear prompt if selection is actually cleared (not while selecting)
      if (!isSelectingRef.current) {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.toString().trim().length === 0) {
          setSelectionPrompt(null);
        }
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('selectionchange', handleSelectionChange);
      if (selectionTimeoutRef.current) {
        clearTimeout(selectionTimeoutRef.current);
      }
    };
  }, []);

  // Handle selection prompt confirm
  const handleSelectionConfirm = () => {
    if (selectionPrompt) {
      setInputValue(`Tell me about ${selectionPrompt.text}`);
      // Clear selection
      window.getSelection()?.removeAllRanges();
      setSelectionPrompt(null);
      // Focus input after state update
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  };

  // Handle selection prompt cancel
  const handleSelectionCancel = () => {
    setSelectionPrompt(null);
  };

  // ============================================================================
  // SECTION 9.5: Auto-scroll to user message when streaming starts
  // ============================================================================
  // Scroll to position user message just below header when streaming begins
  useEffect(() => {
    // Find the last user message (should be the one that triggered streaming)
    const lastUserMessage = messages.filter(m => m.role === 'user').slice(-1)[0];
    
    if (!lastUserMessage || !chatContainerRef.current) return;
    
    // Check if this is a new user message (not the one we already scrolled to)
    if (lastUserMessage.id === lastUserMessageRef.current) return;
    
    // Check if streaming is about to start (loading message exists right after user message)
    const hasLoadingMessage = messages.some(m => m.isLoading);
    
    // Find the index of the last user message
    const lastUserIndex = messages.findIndex(m => m.id === lastUserMessage.id);
    // Check if there's a loading message right after it (streaming started)
    const nextMessage = messages[lastUserIndex + 1];
    const isStreamStarting = nextMessage?.isLoading === true || hasLoadingMessage;
    
    if (isStreamStarting) {
      // Mark this message as handled
      lastUserMessageRef.current = lastUserMessage.id;
      
      // Use setTimeout with requestAnimationFrame to ensure DOM is fully updated
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (!chatContainerRef.current) return;
          
          // Find the user message element in the DOM
          // Messages are rendered in order, so we can find it by index
          const messageElements = chatContainerRef.current.querySelectorAll('.message.user');
          const userMessages = messages.filter(m => m.role === 'user');
          const lastUserMsgIndex = userMessages.length - 1;
          
          if (messageElements[lastUserMsgIndex]) {
            const userMessageElement = messageElements[lastUserMsgIndex] as HTMLElement;
            
            // Get header height (matches paddingTop in chat container)
            // Mobile header is two rows (~145px), desktop is ~135px
            const headerHeight = window.innerWidth < 768 ? 145 : 135;
            
            // Calculate scroll position: position message top at header height + small buffer
            const containerRect = chatContainerRef.current.getBoundingClientRect();
            const messageRect = userMessageElement.getBoundingClientRect();
            
            // Calculate how much we need to scroll
            const messageTopRelativeToContainer = messageRect.top - containerRect.top;
            const scrollOffset = messageTopRelativeToContainer - headerHeight - 10; // 10px buffer
            const newScrollTop = chatContainerRef.current.scrollTop + scrollOffset;
            
            chatContainerRef.current.scrollTo({
              top: Math.max(0, newScrollTop),
              behavior: 'smooth'
            });
          }
        }, 50); // Small delay to ensure DOM is updated
      });
    }
  }, [messages]);
  
  // ============================================================================
  // SECTION 10: Derived State & Conditions
  // ============================================================================
  // Show loading spinner while auth is loading OR while checking document access
  // This prevents flash of content when redirecting to login for restricted documents
  const isCheckingAccess = documentSlug && !user && (configLoading || (!docConfig && !errorDetails));
  
  // Check if we should show cover and welcome (single document, not multi-doc)
  const shouldShowCoverAndWelcome = documentSlug && docConfig;

  // Determine if we should use maker theme (special case for maker owner)
  const isMakerTheme = documentOwnerSlug === 'maker';
  
  // ============================================================================
  // SECTION 11: Early Returns (Loading States)
  // ============================================================================
  if (authLoading || isCheckingAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }
  
  // ============================================================================
  // SECTION 12: Render
  // ============================================================================
  return (
    <div className="flex flex-col h-screen overflow-x-hidden">
      {/* Document Meta Tags - updates title and meta tags dynamically */}
      <DocumentMeta documentSlug={documentSlug} />
      
      {/* Disclaimer Modal - shown for medical/educational documents (e.g., ukidney) */}
      <DisclaimerModal
        shouldShow={needsDisclaimer && !disclaimerAccepted}
        onAccept={handleDisclaimerAccept}
        onDecline={handleDisclaimerDecline}
      />
      
      {/* Passcode Modal - shown when passcode is required */}
      {shouldShowPasscodeModal && (
        <PasscodeModal
          isOpen={true}
          documentSlug={documentSlug!}
          documentTitle={errorDetails?.documentInfo?.title || documentSlug!}
        />
      )}
      
      {/* Document/Owner Selection Modal - shown when no document is selected and no owner param */}
      {/* Also shown when document is not found (404) */}
      <DocumentOwnerModal 
        isOpen={shouldShowDocumentOwnerModal}
        customMessage={isDocumentNotFound ? errorDetails?.message : undefined}
        attemptedSlug={isDocumentNotFound ? documentSlug || undefined : undefined}
      />
      
      {/* Document Selector Modal - shown when owner param is present but no doc is selected */}
      {/* DocumentSelector renders its own modal via portal when in modal mode */}
      {shouldShowDocumentSelectorModal && (
        <DocumentSelector currentDocSlug={null} hasAuthError={hasAuthError} />
      )}
      
      {/* Header - Fixed position */}
      <ChatHeader documentSlug={documentSlug} hasAuthError={hasAuthError} />
      
      {/* Messages container - port from vanilla JS */}
      <div 
        ref={chatContainerRef}
        className={`flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 space-y-4 chat-main-container ${
          isStreamingRef.current ? 'chat-container-streaming' : ''
        }`}
        style={{ paddingBottom: shouldShowFooter ? '160px' : '100px' }}
      >
        {/* Cover and Welcome Message - shown for single documents */}
        {shouldShowCoverAndWelcome && docConfig && (
          <>
            <CoverAndWelcome
              cover={docConfig.cover}
              title={docConfig.title}
              category={docConfig.category}
              year={docConfig.year}
              welcomeMessage={docConfig.welcomeMessage || `Welcome to ${docConfig.title}`}
              introMessage={docConfig.introMessage || null}
              documentSlug={documentSlug}
            />
            {/* Downloads and Keywords - shown below cover and welcome */}
            {/* Only show if at least one of keywords or downloads should be displayed */}
            {/* Hide only if both are explicitly set to false */}
            {(docConfig.showKeywords !== false || docConfig.showDownloads !== false) && (
              <DownloadsAndKeywords
                keywords={(() => {
                  const keywordsToPass = docConfig.showKeywords !== false ? docConfig.keywords : undefined;
                  console.log('[ChatPage] 🔍 DEBUG - Keywords being passed to DownloadsAndKeywords:', {
                    showKeywords: docConfig.showKeywords,
                    keywordsRaw: docConfig.keywords,
                    keywordsType: typeof docConfig.keywords,
                    isArray: Array.isArray(docConfig.keywords),
                    keywordsLength: Array.isArray(docConfig.keywords) ? docConfig.keywords.length : 'N/A',
                    keywordsToPass,
                    keywordsToPassType: typeof keywordsToPass,
                    keywordsToPassIsArray: Array.isArray(keywordsToPass),
                    keywordsToPassLength: Array.isArray(keywordsToPass) ? keywordsToPass.length : 'N/A',
                    fullDocConfig: docConfig
                  });
                  return keywordsToPass;
                })()}
                downloads={docConfig.showDownloads !== false ? docConfig.downloads : undefined}
                isMultiDoc={false}
                inputRef={inputRef}
                onKeywordClick={(term) => {
                  setInputValue(`Tell me about ${term}`);
                  // Focus the input after state update
                  setTimeout(() => {
                    inputRef.current?.focus();
                  }, 0);
                }}
              />
            )}
          </>
        )}

        {/* Chat Messages */}
        {messages.map(msg => {
          // Render loading message with fun facts if isLoading flag is set
          if (msg.isLoading && msg.role === 'assistant') {
            // Get current document owner (may have changed since message was created)
            const currentOwner = docConfig?.ownerInfo?.slug || docConfig?.owner || null;
            return <LoadingMessage key={msg.id} owner={currentOwner} />;
          }
          
          const isLastMessage = msg.id === messages[messages.length - 1]?.id;
          const isStreaming = isStreamingRef.current && msg.role === 'assistant' && isLastMessage;
          
          return (
            <div
              key={msg.id}
              className={`message ${msg.role} ${isStreaming ? 'streaming' : ''}`}
            >
              <MessageContent content={msg.content} role={msg.role} isStreaming={isStreaming} />
            </div>
          );
        })}
      </div>
      
      {/* Input - port from vanilla JS */}
      <div 
        className="fixed bottom-0 left-0 right-0 z-[100]"
      >
        {/* Chat input form */}
        <div 
          className="border-t border-gray-200 p-4"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)'
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex gap-3 max-w-4xl mx-auto"
          >
            <input
              ref={inputRef}
              id="messageInput"
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={documentSlug ? "Ask a question..." : "Select a document to start chatting..."}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-200 transition-all shadow-sm hover:shadow-md focus:shadow-md"
              disabled={isLoading || !documentSlug}
            />
            <button
              type="submit"
              id="sendButton"
              disabled={isLoading || !inputValue.trim() || !documentSlug}
              className={isMakerTheme ? 'maker-theme' : ''}
            >
              <span className="send-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </span>
              Send
            </button>
          </form>
        </div>
        
        {/* Footer - subtle indication this is a Docutrain article */}
        {/* Positioned below the input field */}
        {shouldShowFooter && <DocutrainFooter />}
      </div>

      {/* Selection Prompt - shown when text is selected */}
      {selectionPrompt && (
        <SelectionPrompt
          selectedText={selectionPrompt.text}
          position={selectionPrompt.position}
          onConfirm={handleSelectionConfirm}
          onCancel={handleSelectionCancel}
        />
      )}
    </div>
  );
}

