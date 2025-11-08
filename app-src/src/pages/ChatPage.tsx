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
import { useNavigate } from 'react-router-dom';
import { MessageContent } from '@/components/Chat/MessageContent';
import { ChatHeader } from '@/components/Chat/ChatHeader';
import { LoadingMessage } from '@/components/Chat/LoadingMessage';
import { CoverAndWelcome } from '@/components/Chat/CoverAndWelcome';
import { DownloadsAndKeywords } from '@/components/Chat/DownloadsAndKeywords';
import { DocumentMeta } from '@/components/Chat/DocumentMeta';
import { useDisclaimer } from '@/components/Auth/DisclaimerModal';
import { SelectionPrompt } from '@/components/Chat/SelectionPrompt';
import { Spinner } from '@/components/UI/Spinner';
import { ChatModals } from '@/components/Chat/ChatModals';
import { ChatInput } from '@/components/Chat/ChatInput';
import { DocumentAccessProvider } from '@/contexts/DocumentAccessContext';
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
import { useTextSelection } from '@/hooks/useTextSelection';
import { useAutoScrollToMessage } from '@/hooks/useAutoScrollToMessage';
import { debugLog } from '@/utils/debug';
import '@/styles/messages.css';
import '@/styles/loading.css';
import '@/styles/cover-and-welcome.css';
import '@/styles/keywords.css';
import '@/styles/downloads.css';
import '@/styles/inline-editor.css';
import '@/styles/send-button.css';

export function ChatPage() {
  // ============================================================================
  // SECTION 1: URL Parameters (needed for provider)
  // ============================================================================
  const {
    documentSlug,
    embeddingType,
    selectedModel,
    shouldShowFooter,
    ownerParam,
  } = useChatUrlParams();
  
  // Wrap everything in DocumentAccessProvider
  return (
    <DocumentAccessProvider documentSlug={documentSlug}>
      <ChatPageContent
        documentSlug={documentSlug}
        embeddingType={embeddingType}
        selectedModel={selectedModel}
        shouldShowFooter={shouldShowFooter}
        ownerParam={ownerParam}
      />
    </DocumentAccessProvider>
  );
}

function ChatPageContent({
  documentSlug,
  embeddingType,
  selectedModel,
  shouldShowFooter,
  ownerParam,
}: {
  documentSlug: string | null;
  embeddingType: string;
  selectedModel: string;
  shouldShowFooter: boolean;
  ownerParam: string | null;
}) {
  // ============================================================================
  // SECTION 1: Core Hooks (Auth & Permissions)
  // ============================================================================
  const { user, loading: authLoading } = useAuth();
  const permissions = usePermissions();
  const navigate = useNavigate();
  const [checkingOwnerAccess, setCheckingOwnerAccess] = useState(false);
  
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
  // SECTION 5.5: Early Owner Access Check (Before Any Rendering)
  // ============================================================================
  // If user is not authenticated and we're in owner mode, check for public docs
  // This prevents any UI flash before redirect
  useEffect(() => {
    // Only check if we're in owner mode, auth has finished loading, user is not authenticated, and no document is selected
    if (!ownerParam || authLoading || user || documentSlug) {
      setCheckingOwnerAccess(false);
      return;
    }

    // User is not authenticated and we're in owner mode without a document - check if public docs exist
    async function checkOwnerAccess() {
      setCheckingOwnerAccess(true);
      try {
        const apiUrl = `/api/documents?owner=${encodeURIComponent(ownerParam)}`;
        const { getAuthHeaders } = await import('@/lib/api/authService');
        const headers = getAuthHeaders();
        
        const response = await fetch(apiUrl, { headers });
        
        if (response.status === 403) {
          // Try to parse error response
          let errorData;
          try {
            errorData = await response.json();
          } catch (e) {
            errorData = { error_type: 'access_denied' };
          }
          
          // If requires_auth is true, redirect immediately
          if (errorData.requires_auth === true) {
            // Store owner info in sessionStorage if available (for showing owner logo on login page)
            if (errorData.owner_info) {
              try {
                sessionStorage.setItem('auth_owner_info', JSON.stringify({
                  id: errorData.owner_info.id,
                  name: errorData.owner_info.name,
                  slug: errorData.owner_info.slug,
                  logo_url: errorData.owner_info.logo_url
                }));
              } catch (error) {
                console.error('Failed to store owner info in sessionStorage:', error);
              }
            }
            
            // Capture the full URL including pathname and search params
            // Remove /app prefix since router basename is /app
            const currentPath = window.location.pathname.replace(/^\/app/, '') || '/';
            const currentSearch = window.location.search;
            const currentUrl = currentPath + currentSearch;
            const returnUrl = encodeURIComponent(currentUrl);
            // Use window.location.href instead of navigate to ensure URL params are preserved
            window.location.href = `/app/login?returnUrl=${returnUrl}`;
            return;
          }
        }
        
        // If we got here, either there are public docs or it's a different error
        // Let the normal flow handle it
        setCheckingOwnerAccess(false);
      } catch (error) {
        // On error, let the normal flow handle it
        console.error('[ChatPage] Early owner access check error:', error);
        setCheckingOwnerAccess(false);
      }
    }

    checkOwnerAccess();
  }, [ownerParam, authLoading, user, documentSlug]);

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
    rateLimitError,
    retryAfter,
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
  // SECTION 9: Refs & UI State
  // ============================================================================
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 768);
  const [hasHeaderSubtitle, setHasHeaderSubtitle] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth > 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // ============================================================================
  // SECTION 9.5: Text Selection Hook
  // ============================================================================
  const { selectionPrompt, handleSelectionConfirm, handleSelectionCancel } = useTextSelection({
    chatContainerRef,
    inputRef,
    setInputValue,
  });

  // ============================================================================
  // SECTION 9.6: Auto-scroll Hook
  // ============================================================================
  useAutoScrollToMessage({
    messages,
    chatContainerRef,
  });
  
  // ============================================================================
  // SECTION 10: Derived State & Conditions
  // ============================================================================
  // Show loading spinner while auth is loading OR while checking document access
  // This prevents flash of content when redirecting to login for restricted documents
  // Don't show loading if we already have an error (access denied, not found, etc.)
  const isCheckingAccess = documentSlug && !user && configLoading && !errorDetails;
  
  // Check if we should show cover and welcome (single document, not multi-doc)
  const shouldShowCoverAndWelcome = documentSlug && docConfig;

  // Determine if we should use maker theme (special case for maker owner)
  const isMakerTheme = documentOwnerSlug === 'maker';
  
  // ============================================================================
  // SECTION 11: Early Returns (Loading States)
  // ============================================================================
  if (authLoading || isCheckingAccess || checkingOwnerAccess) {
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
      
      {/* All Modals - Disclaimer, Passcode, Document Owner, Document Selector */}
      <ChatModals
        needsDisclaimer={needsDisclaimer}
        disclaimerAccepted={disclaimerAccepted}
        disclaimerText={docConfig?.disclaimerText}
        onDisclaimerAccept={handleDisclaimerAccept}
        onDisclaimerDecline={handleDisclaimerDecline}
        shouldShowPasscodeModal={shouldShowPasscodeModal}
        documentSlug={documentSlug}
        errorDetails={errorDetails}
        shouldShowDocumentOwnerModal={shouldShowDocumentOwnerModal}
        isDocumentNotFound={isDocumentNotFound}
        shouldShowDocumentSelectorModal={shouldShowDocumentSelectorModal}
        hasAuthError={hasAuthError}
      />
      
      {/* Header - Fixed position */}
      <ChatHeader 
        documentSlug={documentSlug} 
        hasAuthError={hasAuthError}
        onSubtitlePresence={setHasHeaderSubtitle}
      />
      
      {/* Messages container - port from vanilla JS */}
      <div 
        ref={chatContainerRef}
        className={`flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 space-y-4 chat-main-container ${
          isStreamingRef.current ? 'chat-container-streaming' : ''
        } ${hasHeaderSubtitle ? 'has-subtitle-offset' : ''}`}
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
                  debugLog('[ChatPage] 🔍 DEBUG - Keywords being passed to DownloadsAndKeywords:', {
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
              <MessageContent 
                content={msg.content} 
                role={msg.role} 
                isStreaming={isStreaming}
                showReferences={docConfig?.showReferences !== false}
                conversationId={msg.conversationId}
                shareToken={msg.shareToken}
              />
            </div>
          );
        })}
      </div>
      
      {/* Input - Chat input form with rate limiting, hints, and footer */}
      <ChatInput
        inputRef={inputRef}
        inputValue={inputValue}
        onInputChange={setInputValue}
        onSubmit={handleSendMessage}
        isLoading={isLoading}
        documentSlug={documentSlug}
        rateLimitError={rateLimitError}
        retryAfter={retryAfter}
        shouldShowFooter={shouldShowFooter}
        isMakerTheme={isMakerTheme}
        isDesktop={isDesktop}
      />

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

