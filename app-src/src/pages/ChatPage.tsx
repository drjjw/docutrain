/**
 * ChatPage - React version of vanilla JS chat interface
 * 
 * Migration strategy:
 * 1. Start with basic structure matching vanilla JS
 * 2. Port features component-by-component
 * 3. Use same API calls as vanilla JS version
 * 4. Test side-by-side with vanilla JS version
 */

import { useEffect, useLayoutEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MessageContent } from '@/components/Chat/MessageContent';
import { ChatHeader } from '@/components/Chat/ChatHeader';
import { LoadingMessage } from '@/components/Chat/LoadingMessage';
import { CoverAndWelcome } from '@/components/Chat/CoverAndWelcome';
import { DownloadsAndKeywords } from '@/components/Chat/DownloadsAndKeywords';
import { useDocumentConfig } from '@/hooks/useDocumentConfig';
import { useOwnerLogo } from '@/hooks/useOwnerLogo';
import { setAccentColorVariables, setDefaultAccentColors } from '@/utils/accentColor';
import '@/styles/messages.css';
import '@/styles/loading.css';
import '@/styles/cover-and-welcome.css';
import '@/styles/keywords.css';
import '@/styles/downloads.css';
import '@/styles/inline-editor.css';
import '@/styles/send-button.css';

export function ChatPage() {
  const [searchParams] = useSearchParams();
  
  // Check for owner parameter first (same as vanilla JS document-init.js)
  const ownerParam = searchParams.get('owner');
  
  // Get document parameter (same as vanilla JS)
  // In owner mode without doc param, don't default to 'smh' - let user select
  const docParam = searchParams.get('doc');
  const [documentSlug, setDocumentSlug] = useState(docParam || (ownerParam ? null : 'smh'));
  
  // Get embedding type from URL parameter (same as vanilla JS)
  // Default: 'openai' for most docs, 'local' for ckd-dc-2025
  const getEmbeddingType = () => {
    const embeddingParam = searchParams.get('embedding');
    if (embeddingParam === 'local' || embeddingParam === 'openai') {
      return embeddingParam;
    }
    // Default to 'local' for ckd-dc-2025, 'openai' for others
    if (docParam?.includes('ckd-dc-2025')) {
      return 'local';
    }
    return 'openai';
  };
  const [embeddingType, setEmbeddingType] = useState(getEmbeddingType());

  // Get model from URL parameter (same as vanilla JS)
  // Default: 'grok' (same as vanilla JS main.js)
  const getModel = () => {
    const modelParam = searchParams.get('model');
    if (modelParam && (modelParam === 'gemini' || modelParam === 'grok' || modelParam === 'grok-reasoning')) {
      return modelParam;
    }
    return 'grok'; // Default to 'grok' (same as vanilla JS)
  };
  const [selectedModel, setSelectedModel] = useState(getModel());
  
  // Chat state
  const [messages, setMessages] = useState<Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    isLoading?: boolean; // Flag for loading message with fun facts
  }>>([]);
  
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Scroll management (ported from vanilla JS chat.js)
  const userHasScrolledRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollAnimationFrameRef = useRef<number | null>(null);
  const isStreamingRef = useRef(false); // Track if we're currently streaming
  
  // Initialize session ID (same as vanilla JS)
  useEffect(() => {
    const generateSessionId = () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    };
    
    const storedSessionId = localStorage.getItem('chat-session-id');
    if (storedSessionId) {
      setSessionId(storedSessionId);
    } else {
      const newSessionId = generateSessionId();
      localStorage.setItem('chat-session-id', newSessionId);
      setSessionId(newSessionId);
    }
  }, []);
  
  // Setup scroll interrupt detection (ported from vanilla JS)
  useEffect(() => {
    const chatContainer = chatContainerRef.current;
    if (!chatContainer) return;
    
    // Detect user scroll via wheel/trackpad
    const handleWheel = () => {
      userHasScrolledRef.current = true;
    };
    
    // Detect user scroll via touch (mobile/trackpad gestures)
    const handleTouchMove = () => {
      userHasScrolledRef.current = true;
    };
    
    // Detect manual scrollbar dragging or keyboard scrolling
    const handleScroll = () => {
      // Clear any existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      
      // Set a timeout to detect if this was user-initiated
      // (auto-scroll happens immediately, user scroll has momentum/continuation)
      scrollTimeoutRef.current = setTimeout(() => {
        if (!chatContainer) return;
        const isAtBottom = Math.abs(
          chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight
        ) < 50; // 50px threshold
        
        if (!isAtBottom && !userHasScrolledRef.current) {
          userHasScrolledRef.current = true;
        }
      }, 100);
    };
    
    chatContainer.addEventListener('wheel', handleWheel, { passive: true });
    chatContainer.addEventListener('touchmove', handleTouchMove, { passive: true });
    chatContainer.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      chatContainer.removeEventListener('wheel', handleWheel);
      chatContainer.removeEventListener('touchmove', handleTouchMove);
      chatContainer.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);
  
  // Helper to check if we should auto-scroll
  const shouldAutoScroll = () => {
    return !userHasScrolledRef.current;
  };
  
  // Reset auto-scroll for new response
  const resetAutoScroll = () => {
    userHasScrolledRef.current = false;
  };
  
  // Update document slug, embedding type, and model when URL param changes
  useEffect(() => {
    const owner = searchParams.get('owner');
    const doc = searchParams.get('doc');
    // In owner mode without doc param, don't default to 'smh' - let user select
    setDocumentSlug(doc || (owner ? null : 'smh'));
    setEmbeddingType(getEmbeddingType());
    setSelectedModel(getModel());
  }, [searchParams]);
  
  // Get document config (includes cover, introMessage, etc.)
  // Only fetch if we have a document slug (not in owner mode without doc selected)
  const { config: docConfig } = useDocumentConfig(documentSlug || '');

  // Get document owner for accent color
  const documentOwnerSlug = docConfig?.ownerInfo?.slug || docConfig?.owner || null;
  const { config: ownerLogoConfig } = useOwnerLogo(documentOwnerSlug);

  // Set accent color CSS variables based on document owner (ported from vanilla JS)
  useEffect(() => {
    // Set default colors first to prevent flashing
    setDefaultAccentColors();

    // Update accent colors if owner logo config has accent color
    if (ownerLogoConfig?.accentColor) {
      setAccentColorVariables(ownerLogoConfig.accentColor);
    }
  }, [ownerLogoConfig?.accentColor]);

  // Check if we should show cover and welcome (single document, not multi-doc)
  // Vanilla JS always shows cover section for single documents, using placeholder if no cover
  // Don't show cover/welcome if in owner mode without a document selected
  const shouldShowCoverAndWelcome = documentSlug && docConfig && !docConfig.showDocumentSelector;

  // Determine if we should use maker theme (special case for maker owner)
  const isMakerTheme = documentOwnerSlug === 'maker';

  // Send message (ported from vanilla JS chat.js)
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading || !sessionId) return;
    
    // Don't allow sending messages if no document is selected (owner mode)
    if (!documentSlug) {
      console.warn('Cannot send message: No document selected');
      return;
    }
    
    const userMessage = inputValue.trim();
    setInputValue('');
    
    // Add user message to UI
    const userMsg = {
      id: Date.now().toString(),
      role: 'user' as const,
      content: userMessage,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    
    // Set loading state
    setIsLoading(true);
    isStreamingRef.current = false; // Reset streaming flag (will be set when first chunk arrives)

    // Reset auto-scroll for new response (same as vanilla JS)
    resetAutoScroll();

    // Add loading message with fun facts IMMEDIATELY (same as vanilla JS addLoading)
    const loadingMsgId = `loading-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: loadingMsgId,
      role: 'assistant' as const,
      content: '',
      timestamp: new Date(),
      isLoading: true, // Flag to render LoadingMessage component
    }]);

    try {
      // Call streaming API with embedding type (same as vanilla JS)
      const authHeaders = getAuthHeaders();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(authHeaders.Authorization ? { Authorization: authHeaders.Authorization } : {}),
      };
      
      // Get passcode from URL if present (same as vanilla JS)
      const passcode = searchParams.get('passcode');
      
      const requestBody: any = {
        message: userMessage,
        history: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        model: selectedModel, // Include model parameter (defaults to 'grok' same as vanilla JS)
        doc: documentSlug,
        sessionId: sessionId,
      };
      
      // Add passcode if present (same as vanilla JS)
      if (passcode) {
        requestBody.passcode = passcode;
        console.log('🔐 Including passcode in chat API request');
      }
      
      const response = await fetch(`/api/chat/stream?embedding=${embeddingType}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Handle streaming response (ported from vanilla JS)
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'content' && data.chunk) {
                assistantContent += data.chunk;
                isStreamingRef.current = true; // Mark as streaming
                
                // Replace loading message with accumulated content
                setMessages(prev => prev.map(msg => 
                  msg.id === loadingMsgId
                    ? { ...msg, content: assistantContent, isLoading: false }
                    : msg
                ));
                
                // Auto-scroll to show new content (only if user hasn't scrolled)
                // Scroll immediately with single RAF for better sync with content updates
                // This matches vanilla JS behavior more closely (immediate scroll after DOM update)
                if (shouldAutoScroll() && chatContainerRef.current) {
                  // Cancel pending scroll and schedule new one immediately
                  // This allows scroll to keep up with rapid content updates
                  if (scrollAnimationFrameRef.current !== null) {
                    cancelAnimationFrame(scrollAnimationFrameRef.current);
                  }
                  
                  // Single RAF - React batches updates, so one frame is usually enough
                  // This keeps scroll in sync with content updates
                  scrollAnimationFrameRef.current = requestAnimationFrame(() => {
                    if (chatContainerRef.current && shouldAutoScroll()) {
                      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
                    }
                    scrollAnimationFrameRef.current = null;
                  });
                }
              }
              
              if (data.type === 'done') {
                console.log('✅ Streaming completed');

                // Log the actual model being used and detect overrides
                if (data.metadata && data.metadata.model) {
                  const actualModel = data.metadata.model;
                  const requestedModel = selectedModel;

                  const expectedActual = requestedModel === 'grok' ? 'grok-4-fast-non-reasoning' :
                                       requestedModel === 'grok-reasoning' ? 'grok-4-fast-reasoning' :
                                       'gemini-2.5-flash';

                  const wasOverridden = expectedActual !== actualModel;

                  if (wasOverridden) {
                    console.log('\n🔒 MODEL OVERRIDE DETECTED:');
                    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                    console.log(`  Requested:  ${requestedModel} (${expectedActual})`);
                    console.log(`  Actually used: ${actualModel}`);
                    console.log(`  Reason: Owner-configured safety mechanism`);
                    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
                  } else {
                    console.log(`🤖 Response generated using: ${actualModel}`);
                  }
                }

                // Log metadata
                console.log(`📊 Metadata:`, data.metadata);

                // Log RAG performance if chunksUsed is present
                if (data.metadata && data.metadata.chunksUsed) {
                  console.log('📊 RAG Performance:', {
                    chunks: data.metadata.chunksUsed,
                    retrievalTime: data.metadata.retrievalTime,
                    totalTime: data.metadata.responseTime,
                    isMultiDocument: data.metadata.isMultiDocument,
                    documentSlugs: data.metadata.documentSlugs,
                    similarities: data.metadata.chunkSimilarities
                  });
                }

                setIsLoading(false);
                isStreamingRef.current = false; // Mark streaming as complete
                // Convert loading message to final message
                setMessages(prev => prev.map(msg => 
                  msg.id === loadingMsgId
                    ? { ...msg, content: assistantContent, id: `msg-${Date.now()}`, isLoading: false }
                    : msg
                ));
              }
              
              if (data.type === 'error') {
                setIsLoading(false);
                isStreamingRef.current = false; // Reset streaming flag on error
                setMessages(prev => prev.filter(msg => msg.id !== loadingMsgId));
                throw new Error(data.error || 'Unknown error');
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setIsLoading(false);
      isStreamingRef.current = false; // Reset streaming flag on error
      // Remove loading message if it exists
      setMessages(prev => {
        const loadingMsg = prev.find(msg => msg.isLoading);
        if (loadingMsg) {
          return prev.filter(msg => msg.id !== loadingMsg.id);
        }
        return prev;
      });
      
      // Add error message
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to get response'}`,
        timestamp: new Date(),
      }]);
    }
  };
  
  // Get auth headers (same logic as vanilla JS)
  const getAuthHeaders = () => {
    try {
      const sessionKey = 'sb-mlxctdgnojvkgfqldaob-auth-token';
      const sessionData = localStorage.getItem(sessionKey);
      if (sessionData) {
        const session = JSON.parse(sessionData);
        if (session?.access_token) {
          return { 'Authorization': `Bearer ${session.access_token}` };
        }
      }
    } catch (e) {
      // Ignore
    }
    return {};
  };
  
  // Auto-scroll to bottom (ported from vanilla JS)
  // Use useLayoutEffect for synchronous scroll after DOM updates (better sync with content)
  useLayoutEffect(() => {
    // During streaming, let streaming handler manage scroll to avoid conflicts
    // But allow scroll for initial loading message and final message updates
    if (isStreamingRef.current && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      // Skip if actively streaming (has content and not in loading state)
      if (lastMsg && lastMsg.role === 'assistant' && !lastMsg.isLoading && lastMsg.content) {
        return;
      }
    }
    
    // Cancel any pending scroll from streaming handler
    if (scrollAnimationFrameRef.current !== null) {
      cancelAnimationFrame(scrollAnimationFrameRef.current);
      scrollAnimationFrameRef.current = null;
    }
    
    // Scroll immediately - useLayoutEffect runs synchronously after DOM mutations
    // This keeps scroll in sync with React's DOM updates
    if (chatContainerRef.current && shouldAutoScroll()) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);
  
  return (
    <div className="flex flex-col h-screen overflow-x-hidden">
      {/* Header */}
      <ChatHeader documentSlug={documentSlug || ''} />
      
      {/* Messages container - port from vanilla JS */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4"
      >
        {/* Cover and Welcome Message - shown for single documents */}
        {shouldShowCoverAndWelcome && (
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
            <DownloadsAndKeywords
              keywords={docConfig.keywords}
              downloads={docConfig.downloads}
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
          
          return (
            <div
              key={msg.id}
              className={`message ${msg.role}`}
            >
              <MessageContent content={msg.content} role={msg.role} />
            </div>
          );
        })}
      </div>
      
      {/* Input - port from vanilla JS */}
      <div className="border-t p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex gap-2"
        >
          <input
            ref={inputRef}
            id="messageInput"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={documentSlug ? "Ask a question..." : "Select a document to start chatting..."}
            className="flex-1 px-4 py-2 border rounded-lg"
            disabled={isLoading || !documentSlug}
          />
          <button
            type="submit"
            id="sendButton"
            disabled={isLoading || !inputValue.trim() || !documentSlug}
            className={isMakerTheme ? 'maker-theme' : ''}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

