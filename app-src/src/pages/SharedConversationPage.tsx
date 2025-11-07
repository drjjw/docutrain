/**
 * SharedConversationPage - Displays a shared conversation with ability to continue chatting
 * Public access - no authentication required, but disclaimer may be needed
 */

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChatHeader } from '@/components/Chat/ChatHeader';
import { MessageContent } from '@/components/Chat/MessageContent';
import { ChatInput } from '@/components/Chat/ChatInput';
import { ChatModals } from '@/components/Chat/ChatModals';
import { CoverAndWelcome } from '@/components/Chat/CoverAndWelcome';
import { DownloadsAndKeywords } from '@/components/Chat/DownloadsAndKeywords';
import { LoadingMessage } from '@/components/Chat/LoadingMessage';
import { Spinner } from '@/components/UI/Spinner';
import { DocumentAccessProvider } from '@/contexts/DocumentAccessContext';
import { useDisclaimer } from '@/components/Auth/DisclaimerModal';
import { useDocumentConfig } from '@/hooks/useDocumentConfig';
import { useOwnerLogo } from '@/hooks/useOwnerLogo';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useSessionId } from '@/hooks/useSessionId';
import { useChatMessages } from '@/hooks/useChatMessages';
import { useChatUrlParams } from '@/hooks/useChatUrlParams';
import { useAutoScrollToMessage } from '@/hooks/useAutoScrollToMessage';
import '@/styles/messages.css';
import '@/styles/loading.css';
import '@/styles/send-button.css';
import '@/styles/cover-and-welcome.css';
import '@/styles/keywords.css';
import '@/styles/downloads.css';

interface SharedConversation {
  id: string;
  sessionId: string;
  question: string;
  response: string;
  model: string;
  createdAt: string;
  documentName: string;
  documentVersion: string | null;
  documentIds: string[] | null;
  metadata: {
    document_slugs?: string | string[];
    is_multi_document?: boolean;
    [key: string]: any;
  };
}

export function SharedConversationPage() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const navigate = useNavigate();
  const [conversation, setConversation] = useState<SharedConversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documentSlug, setDocumentSlug] = useState<string | null>(null);
  
  // Fetch shared conversation
  useEffect(() => {
    if (!shareToken) {
      setError('Invalid share token');
      setLoading(false);
      return;
    }

    const fetchConversation = async () => {
      try {
        const response = await fetch(`/api/shared/${shareToken}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('Conversation not found');
          } else {
            setError('Failed to load conversation');
          }
          setLoading(false);
          return;
        }

        const data = await response.json();
        setConversation(data.conversation);

        // Extract document slug(s) from metadata
        const metadata = data.conversation.metadata || {};
        let slugs: string | null = null;
        
        if (metadata.is_multi_document && Array.isArray(metadata.document_slugs)) {
          // Multi-document: join with +
          slugs = metadata.document_slugs.join('+');
        } else if (metadata.document_slugs) {
          // Single document or array
          slugs = Array.isArray(metadata.document_slugs) 
            ? metadata.document_slugs[0] 
            : metadata.document_slugs;
        } else if (metadata.document_type) {
          // Fallback to document_type
          slugs = Array.isArray(metadata.document_type)
            ? metadata.document_type.join('+')
            : metadata.document_type;
        }

        setDocumentSlug(slugs);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching shared conversation:', err);
        setError('Failed to load conversation');
        setLoading(false);
      }
    };

    fetchConversation();
  }, [shareToken]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-gray-600">Loading conversation...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !conversation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto px-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Conversation Not Found</h1>
          <p className="text-gray-600 mb-6">{error || 'The shared conversation could not be loaded.'}</p>
          <button
            onClick={() => navigate('/app/chat')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Chat
          </button>
        </div>
      </div>
    );
  }

  // Wrap in DocumentAccessProvider before using hooks that depend on it
  return (
    <DocumentAccessProvider documentSlug={documentSlug}>
      <SharedConversationContent 
        conversation={conversation}
        documentSlug={documentSlug}
      />
    </DocumentAccessProvider>
  );
}

function SharedConversationContent({ 
  conversation, 
  documentSlug 
}: { 
  conversation: SharedConversation;
  documentSlug: string | null;
}) {
  const navigate = useNavigate();
  const [hasHeaderSubtitle, setHasHeaderSubtitle] = useState(false);
  
  // Get URL params for chat continuation
  const { embeddingType, selectedModel, shouldShowFooter } = useChatUrlParams();
  const { sessionId } = useSessionId();

  // Get document config for disclaimer check (now inside provider)
  const { config: docConfig } = useDocumentConfig(documentSlug);
  
  // Get document owner for accent color
  const documentOwnerSlug = docConfig?.ownerInfo?.slug || docConfig?.owner || null;
  const { config: ownerLogoConfig } = useOwnerLogo(documentOwnerSlug);
  
  // Set accent color CSS variables based on document owner
  useAccentColor(ownerLogoConfig?.accentColor);
  
  // Check if disclaimer is needed
  const disclaimerHook = useDisclaimer(documentSlug);
  const {
    needsDisclaimer,
    disclaimerAccepted,
    handleAccept: handleDisclaimerAccept,
    handleDecline: handleDisclaimerDecline,
  } = disclaimerHook;

  // Chat messages hook for continuing conversation
  const inputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatMessages = useChatMessages({
    documentSlug,
    sessionId,
    embeddingType: embeddingType || 'openai',
    selectedModel: selectedModel || 'gemini',
    docConfig: docConfig || null,
    passcode: null,
  });

  // Auto-scroll hook to scroll to loading message when new message is submitted
  useAutoScrollToMessage({
    messages: chatMessages.messages,
    chatContainerRef,
  });

  // Check if we should show cover and welcome (single document, not multi-doc)
  const shouldShowCoverAndWelcome = documentSlug && docConfig;

  // Show disclaimer modal if needed
  if (needsDisclaimer && !disclaimerAccepted) {
    return (
      <div className="flex flex-col h-screen overflow-x-hidden">
        <ChatHeader documentSlug={documentSlug} hasAuthError={false} />
        <ChatModals
          needsDisclaimer={needsDisclaimer}
          disclaimerAccepted={disclaimerAccepted}
          disclaimerText={docConfig?.disclaimerText}
          onDisclaimerAccept={handleDisclaimerAccept}
          onDisclaimerDecline={handleDisclaimerDecline}
          shouldShowPasscodeModal={false}
          documentSlug={documentSlug}
          errorDetails={null}
          shouldShowDocumentOwnerModal={false}
          isDocumentNotFound={false}
          shouldShowDocumentSelectorModal={false}
          hasAuthError={false}
        />
      </div>
    );
  }

  // Render shared conversation with ability to continue
  return (
    <div className="flex flex-col h-screen overflow-x-hidden">
      <ChatHeader 
        documentSlug={documentSlug} 
        hasAuthError={false}
        onSubtitlePresence={setHasHeaderSubtitle}
      />
      
      {/* Messages container */}
      <div 
        ref={chatContainerRef}
        className={`flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 md:px-6 lg:px-8 space-y-4 chat-main-container ${
          chatMessages.isStreamingRef.current ? 'chat-container-streaming' : ''
        } ${hasHeaderSubtitle ? 'has-subtitle-offset' : ''}`}
        style={{ 
          paddingBottom: shouldShowFooter ? '160px' : '100px'
        }}
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
            {(docConfig.showKeywords !== false || docConfig.showDownloads !== false) && (
              <DownloadsAndKeywords
                keywords={docConfig.showKeywords !== false ? docConfig.keywords : undefined}
                downloads={docConfig.showDownloads !== false ? docConfig.downloads : undefined}
                isMultiDoc={false}
                inputRef={inputRef}
                onKeywordClick={(term) => {
                  chatMessages.setInputValue(`Tell me about ${term}`);
                  // Focus the input after state update
                  setTimeout(() => {
                    inputRef.current?.focus();
                  }, 0);
                }}
              />
            )}
          </>
        )}

        {/* Shared conversation messages */}
        <div className="message user">
          <div className="message-content">
            {conversation.question}
          </div>
        </div>
        
        <div className="message assistant">
          <MessageContent
            content={conversation.response}
            role="assistant"
            showReferences={docConfig?.showReferences !== false}
          />
        </div>

        {/* Continue conversation messages */}
        {chatMessages.messages.map(msg => {
          // Render loading message with fun facts if isLoading flag is set
          if (msg.isLoading && msg.role === 'assistant') {
            // Get current document owner (may have changed since message was created)
            const currentOwner = docConfig?.ownerInfo?.slug || docConfig?.owner || null;
            return <LoadingMessage key={msg.id} owner={currentOwner} />;
          }
          
          const isLastMessage = msg.id === chatMessages.messages[chatMessages.messages.length - 1]?.id;
          const isStreaming = chatMessages.isStreamingRef.current && msg.role === 'assistant' && isLastMessage;
          
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

      {/* Chat input for continuing conversation */}
      <ChatInput
        inputRef={inputRef}
        inputValue={chatMessages.inputValue}
        onInputChange={chatMessages.setInputValue}
        onSubmit={chatMessages.handleSendMessage}
        isLoading={chatMessages.isLoading}
        documentSlug={documentSlug}
        rateLimitError={chatMessages.rateLimitError}
        retryAfter={chatMessages.retryAfter}
        shouldShowFooter={shouldShowFooter}
        isMakerTheme={docConfig?.ownerInfo?.slug === 'maker'}
        isDesktop={window.innerWidth >= 768}
      />
    </div>
  );
}

