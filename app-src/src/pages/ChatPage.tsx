import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MessageList } from '@/components/Chat/MessageList';
import { MessageInput } from '@/components/Chat/MessageInput';
import { LoadingIndicator } from '@/components/Chat/LoadingIndicator';
import { ChatHeader } from '@/components/Chat/ChatHeader';
import { WelcomeMessage } from '@/components/Chat/WelcomeMessage';
import { useChat, Message } from '@/hooks/useChat';
import { useDocument } from '@/hooks/useDocument';
import { useStreamingResponse } from '@/hooks/useStreamingResponse';
import { useAutoScroll } from '@/hooks/useAutoScroll';
import { sendChatMessage, submitRating, ChatMessage, ChatResponse } from '@/services/chatApi';
import { parseDocumentSlugs } from '@/services/config';
import { Alert } from '@/components/UI/Alert';
import '@/styles/chat.css';

export function ChatPage() {
  const [searchParams] = useSearchParams();
  const [selectedModel] = useState('grok');
  const [selectedDocument, setSelectedDocument] = useState<string | string[]>(() => {
    const slugs = parseDocumentSlugs();
    return slugs && slugs.length > 0 ? (slugs.length === 1 ? slugs[0] : slugs) : 'smh';
  });
  
  const { document, documents, loading: documentLoading } = useDocument({ 
    slug: selectedDocument 
  });
  
  const [streamingContent, setStreamingContent] = useState<string>('');
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  // Use ref to track streaming ID to avoid stale closures
  const streamingIdRef = useRef<string | null>(null);
  
  const { isLoading, error, sessionId } = useChat({
    selectedModel,
    selectedDocument,
  });
  
  // Local state for messages - manage everything locally to avoid sync conflicts
  // We don't use baseMessages anymore - everything is managed in local state
  const [messages, setMessages] = useState<Message[]>([]);
  
  const { shouldAutoScroll, resetAutoScroll, setUserHasScrolled } = useAutoScroll();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Update selected document when URL changes
  useEffect(() => {
    const docSlugs = parseDocumentSlugs();
    if (docSlugs) {
      const newDoc = docSlugs.length === 1 ? docSlugs[0] : docSlugs;
      if (newDoc !== selectedDocument) {
        setSelectedDocument(newDoc);
      }
    }
  }, [searchParams, selectedDocument]);
  
  const handleDocumentChange = useCallback((newDoc: string | string[]) => {
    setSelectedDocument(newDoc);
    // Clear messages when document changes
    setMessages([]);
  }, []);

  // Setup scroll detection on the scroll container
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleWheel = () => {
      setUserHasScrolled(true);
    };
    const handleTouchMove = () => {
      setUserHasScrolled(true);
    };
    const handleScroll = () => {
      // Check if user is near the bottom (within 100px)
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      
      if (isNearBottom) {
        // User scrolled back to bottom - resume auto-scrolling
        setUserHasScrolled(false);
      } else {
        // User scrolled up - pause auto-scrolling
        setUserHasScrolled(true);
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('scroll', handleScroll);
    };
  }, [setUserHasScrolled]);

  // Auto-scroll during streaming (when streamingContent updates)
  useEffect(() => {
    if (isStreaming && streamingContent && shouldAutoScroll()) {
      const container = scrollContainerRef.current;
      if (container) {
        // Small delay to ensure DOM has updated
        requestAnimationFrame(() => {
          if (shouldAutoScroll()) {
            container.scrollTop = container.scrollHeight;
          }
        });
      }
    }
  }, [streamingContent, isStreaming, shouldAutoScroll]);

  const handleStreamingChunk = useCallback((chunk: string) => {
    setStreamingContent(chunk);
  }, []);

  const handleStreamingComplete = useCallback((fullContent: string, metadata?: any) => {
    // Use ref to get current streaming ID (avoids stale closure)
    const currentStreamingId = streamingIdRef.current;
    console.log('🔄 handleStreamingComplete called:', { currentStreamingId, streamingMessageId, fullContent: fullContent?.substring(0, 50) });
    
    // Use the ID from ref (most reliable) or fallback to state
    const idToUse = currentStreamingId || streamingMessageId;
    
    if (idToUse && fullContent) {
      const completedMessage: Message = {
        id: idToUse,
        content: fullContent,
        role: 'assistant',
        model: selectedModel,
        conversationId: metadata?.conversationId || null
      };
      
      setMessages((prev) => {
        // Check if message already exists
        const exists = prev.some(m => m.id === idToUse);
        if (exists) {
          console.log('⚠️ Message already exists, updating it');
          return prev.map(m => m.id === idToUse ? completedMessage : m);
        }
        
        // Add the completed message
        const updated = [...prev, completedMessage];
        console.log('✅ Streaming complete, message added:', completedMessage.id, 'Total messages:', updated.length);
        return updated;
      });
    } else {
      console.warn('⚠️ Streaming complete but no ID or content:', { currentStreamingId, streamingMessageId, hasContent: !!fullContent });
    }
    
    // Clear streaming state
    setStreamingContent('');
    setStreamingMessageId(null);
    streamingIdRef.current = null;
    setIsStreaming(false);
  }, [streamingMessageId, selectedModel]);

  const handleStreamingError = useCallback((error: string) => {
    console.error('Streaming error:', error);
    setStreamingContent('');
    setStreamingMessageId(null);
    streamingIdRef.current = null;
    setIsStreaming(false);
    
    // Add error message to state
    const errorMessage: Message = {
      id: Date.now().toString(),
      content: `Error: ${error}`,
      role: 'assistant'
    };
    setMessages(prev => [...prev, errorMessage]);
  }, []);

  const { processStream } = useStreamingResponse({
    onChunk: handleStreamingChunk,
    onComplete: handleStreamingComplete,
    onError: handleStreamingError
  });

  const handleSendMessage = useCallback(async (messageText: string) => {
    resetAutoScroll();
    setStreamingContent('');
    streamingIdRef.current = null;
    
    // Add user message to local state immediately
    const userMessage: Message = {
      id: Date.now().toString(),
      content: messageText,
      role: 'user'
    };
    
    // Get current messages before adding the new one (to build history)
    let currentMessages: Message[] = [];
    setMessages(prev => {
      currentMessages = prev; // Capture current state
      console.log('➕ Adding user message:', userMessage.id, 'current messages:', prev.length);
      return [...prev, userMessage];
    });
    
    // Show loading indicator immediately (before API call)
    setIsStreaming(true);
    
    try {
      // Build conversation history from current messages (before the new user message)
      const conversationHistory: ChatMessage[] = currentMessages.map(m => ({ 
        role: m.role, 
        content: m.content 
      }));
      
      // Add current user message to history for API call
      conversationHistory.push({ role: 'user', content: messageText });
      
      console.log('📤 Sending message, conversation history length:', conversationHistory.length, 'existing messages:', currentMessages.length);
      
      const response = await sendChatMessage(
        messageText,
        conversationHistory,
        selectedModel,
        sessionId,
        selectedDocument
      );

      if (response instanceof Response) {
        // Streaming response
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('text/event-stream')) {
          const newStreamingId = (Date.now() + 1).toString();
          setStreamingMessageId(newStreamingId);
          streamingIdRef.current = newStreamingId; // Store in ref for reliable access
          console.log('🌊 Starting streaming, ID:', newStreamingId);
          
          await processStream(response);
        } else {
          // Response object but not streaming - parse as JSON
          const data = await response.json();
          
          // Add assistant response to local messages
          const assistantMessage: Message = {
            id: (Date.now() + 1).toString(),
            content: data.response || data.error || 'No response received',
            role: 'assistant',
            model: data.model || selectedModel,
            conversationId: data.conversationId || null
          };
          setMessages(prev => [...prev, assistantMessage]);
        }
      } else {
        // Non-streaming response (already parsed JSON)
        const data = response as ChatResponse;
        
        // Add assistant response to local messages
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: data.response || data.error || 'No response received',
          role: 'assistant',
          model: data.model || selectedModel,
          conversationId: data.conversationId || null
        };
        setMessages(prev => [...prev, assistantMessage]);
      }
    } catch (err: any) {
      console.error('Error sending message:', err);
      setStreamingContent('');
      setStreamingMessageId(null);
      streamingIdRef.current = null;
      setIsStreaming(false);
      
      // Add error message to state
      const errorMessage: Message = {
        id: Date.now().toString(),
        content: err.message || 'Failed to connect to server. Please try again.',
        role: 'assistant'
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  }, [selectedModel, selectedDocument, sessionId, processStream, resetAutoScroll]);

  const handleRate = useCallback(async (conversationId: string, rating: 'thumbs_up' | 'thumbs_down') => {
    try {
      await submitRating(conversationId, rating);
      // TODO: Update message UI to show rating was submitted
    } catch (err) {
      console.error('Error submitting rating:', err);
    }
  }, []);

  // Combine messages with streaming message (if currently streaming)
  const allMessages: Message[] = [...messages];
  // Show streaming message only when we have content (not while waiting for stream to start)
  if (streamingMessageId && streamingContent && isStreaming && streamingContent.length > 0) {
    // Check if we already have this streaming message in messages (shouldn't happen, but safety check)
    const hasStreamingMessage = messages.some(m => m.id === streamingMessageId);
    if (!hasStreamingMessage) {
      allMessages.push({
        id: streamingMessageId,
        content: streamingContent,
        role: 'assistant'
      });
    }
  }
  
  // Debug logging (disable in production)
  // console.log('📋 Rendering messages:', {
  //   messagesCount: messages.length,
  //   streamingId: streamingMessageId,
  //   streamingContent: streamingContent?.substring(0, 30),
  //   isStreaming,
  //   allMessagesCount: allMessages.length
  // });
  
  // Always show welcome message (cover + intro) when document is loaded
  const showWelcome = document && !documentLoading;

  const documentOwner = document?.ownerInfo?.slug || null;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f8f8f8', width: '100%', margin: 0, padding: 0 }}>
      <ChatHeader 
        document={document} 
        onDocumentChange={handleDocumentChange}
      />

      <div className="chat-container-wrapper" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', width: '100%', maxWidth: '100%' }}>
        {error && (
          <div style={{ margin: '16px' }}>
            <Alert variant="error">
              {error}
            </Alert>
          </div>
        )}
        
        {documentLoading && !document ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LoadingIndicator owner={null} />
          </div>
        ) : (
          <>
            <div 
              ref={scrollContainerRef}
              style={{ 
                flex: 1, 
                overflow: 'auto', 
                display: 'flex', 
                flexDirection: 'column',
                position: 'relative',
              }}
              className="chat-scroll-container"
            >
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {showWelcome && (
                  <div style={{ padding: '20px', paddingBottom: '0' }}>
                    <WelcomeMessage document={document} documents={documents} />
                  </div>
                )}
                <MessageList
                  messages={allMessages}
                  onRate={handleRate}
                  shouldAutoScroll={shouldAutoScroll}
                  scrollContainerRef={scrollContainerRef}
                  streamingMessageId={streamingMessageId}
                />
                {(isLoading || isStreaming) && (
                  <div style={{ padding: '20px', paddingTop: '0' }}>
                    <LoadingIndicator owner={documentOwner} />
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        <MessageInput
          onSend={handleSendMessage}
          disabled={isLoading || isStreaming || documentLoading}
        />
      </div>
    </div>
  );
}

