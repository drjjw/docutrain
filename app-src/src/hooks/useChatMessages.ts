/**
 * useChatMessages - Hook for managing chat messages and streaming
 * Handles message state, sending messages, streaming responses, and loading states
 * Ported from ChatPage.tsx
 */

import { useState, useRef, useEffect } from 'react';
import type { DocumentConfig } from './useDocumentConfig';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isLoading?: boolean; // Flag for loading message with fun facts
  conversationId?: string; // Database conversation ID
  shareToken?: string; // Share token for this conversation
}

interface UseChatMessagesProps {
  documentSlug: string | null;
  sessionId: string | null;
  embeddingType: string;
  selectedModel: string;
  docConfig: DocumentConfig | null;
  passcode?: string | null;
}

export function useChatMessages({
  documentSlug,
  sessionId,
  embeddingType,
  selectedModel,
  passcode,
}: UseChatMessagesProps) {
  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Track if we're currently streaming (for CSS styling)
  const isStreamingRef = useRef(false);
  
  // Rate limiting state
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<number>(0);
  const messageTimestamps = useRef<number[]>([]);
  const countdownInterval = useRef<NodeJS.Timeout | null>(null);
  
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
  
  // Client-side rate limit check (mirrors backend logic)
  const checkRateLimit = (): { allowed: boolean; retryAfter: number; reason?: string } => {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const tenSecondsAgo = now - 10 * 1000;
    // Enable debug logging if explicitly enabled via env var, or in development mode
    const debugEnabled = (import.meta as any).env?.VITE_DEBUG === 'true' || (import.meta as any).env?.DEV;
    
    // Clean up old timestamps
    messageTimestamps.current = messageTimestamps.current.filter(ts => ts > oneMinuteAgo);
    
    const messagesInLastMinute = messageTimestamps.current.length;
    const messagesInLastTenSeconds = messageTimestamps.current.filter(ts => ts > tenSecondsAgo).length;
    
    // Debug logging (only if enabled)
    if (debugEnabled) {
      console.log('🔍 Frontend Rate Limit Check:');
      console.log(`   📊 Last minute: ${messagesInLastMinute}/10 messages`);
      console.log(`   ⚡ Last 10 sec: ${messagesInLastTenSeconds}/3 messages`);
      console.log(`   ✅ Status: ${messagesInLastMinute < 10 && messagesInLastTenSeconds < 3 ? 'WITHIN LIMITS' : 'APPROACHING/EXCEEDED'}`);
    }
    
    // Check 10-second burst limit (3 messages)
    if (messagesInLastTenSeconds >= 3) {
      const oldestInBurst = messageTimestamps.current.filter(ts => ts > tenSecondsAgo)[0];
      const retryAfter = Math.ceil((oldestInBurst + 10 * 1000 - now) / 1000);
      
      if (debugEnabled) {
        console.log(`   ❌ BURST LIMIT EXCEEDED: ${messagesInLastTenSeconds}/3 in 10 seconds`);
        console.log(`   ⏱️  Retry after: ${retryAfter} seconds`);
      }
      
      return { allowed: false, retryAfter: Math.max(retryAfter, 1), reason: 'burst' };
    }
    
    // Check per-minute limit (10 messages)
    if (messagesInLastMinute >= 10) {
      const oldestInMinute = messageTimestamps.current[0];
      const retryAfter = Math.ceil((oldestInMinute + 60 * 1000 - now) / 1000);
      
      if (debugEnabled) {
        console.log(`   ❌ RATE LIMIT EXCEEDED: ${messagesInLastMinute}/10 in 1 minute`);
        console.log(`   ⏱️  Retry after: ${retryAfter} seconds`);
      }
      
      return { allowed: false, retryAfter: Math.max(retryAfter, 1), reason: 'rate' };
    }
    
    if (debugEnabled) {
      console.log(`   ✅ Request ALLOWED - Will record timestamp`);
    }
    
    return { allowed: true, retryAfter: 0 };
  };
  
  // Send message (ported from vanilla JS chat.js)
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading || !sessionId) return;
    
    // Client-side rate limit check
    const rateLimitCheck = checkRateLimit();
    if (!rateLimitCheck.allowed) {
      const errorMsg = rateLimitCheck.reason === 'burst' 
        ? `Please slow down. Wait ${rateLimitCheck.retryAfter} seconds before sending another message.`
        : `Rate limit reached. Please wait ${rateLimitCheck.retryAfter} seconds before sending another message.`;
      
      setRateLimitError(errorMsg);
      setRetryAfter(rateLimitCheck.retryAfter);
      
      // Clear any existing countdown interval
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
      }
      
      // Update countdown every second
      let remainingSeconds = rateLimitCheck.retryAfter;
      countdownInterval.current = setInterval(() => {
        remainingSeconds--;
        if (remainingSeconds <= 0) {
          setRateLimitError(null);
          setRetryAfter(0);
          if (countdownInterval.current) {
            clearInterval(countdownInterval.current);
            countdownInterval.current = null;
          }
        } else {
          setRetryAfter(remainingSeconds);
        }
      }, 1000);
      
      return;
    }
    
    // Record this message timestamp
    const timestamp = Date.now();
    messageTimestamps.current.push(timestamp);
    
    const debugEnabled = (import.meta as any).env?.VITE_DEBUG === 'true' || (import.meta as any).env?.DEV;
    if (debugEnabled) {
      const messagesInLastMinute = messageTimestamps.current.filter(ts => ts > timestamp - 60 * 1000).length;
      const messagesInLastTenSeconds = messageTimestamps.current.filter(ts => ts > timestamp - 10 * 1000).length;
      console.log(`   📈 Timestamp recorded - New counts: ${messagesInLastMinute}/10 (minute), ${messagesInLastTenSeconds}/3 (10sec)`);
    }
    
    // Don't allow sending messages if no document is selected (owner mode)
    if (!documentSlug) {
      console.warn('Cannot send message: No document selected');
      return;
    }
    
    const userMessage = inputValue.trim();
    setInputValue('');
    
    // Add user message to UI
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    
    // Set loading state
    setIsLoading(true);
    isStreamingRef.current = false; // Reset streaming flag (will be set when first chunk arrives)

    // Add loading message with fun facts IMMEDIATELY (same as vanilla JS addLoading)
    const loadingMsgId = `loading-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: loadingMsgId,
      role: 'assistant',
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
      
      // Get passcode from localStorage as fallback
      const passcodeFromStorage = documentSlug ? localStorage.getItem(`passcode:${documentSlug}`) : null;
      const effectivePasscode = passcode || passcodeFromStorage;
      
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
      if (effectivePasscode) {
        requestBody.passcode = effectivePasscode;
      }
      
      const response = await fetch(`/api/chat/stream?embedding=${embeddingType}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });
      
      // Handle rate limit response (429)
      if (response.status === 429) {
        const errorData = await response.json();
        setRateLimitError(errorData.error || 'Rate limit exceeded');
        const retrySeconds = errorData.retryAfter || 30;
        setRetryAfter(retrySeconds);
        
        // Clear any existing countdown interval
        if (countdownInterval.current) {
          clearInterval(countdownInterval.current);
        }
        
        // Update countdown every second
        let remainingSeconds = retrySeconds;
        countdownInterval.current = setInterval(() => {
          remainingSeconds--;
          if (remainingSeconds <= 0) {
            setRateLimitError(null);
            setRetryAfter(0);
            if (countdownInterval.current) {
              clearInterval(countdownInterval.current);
              countdownInterval.current = null;
            }
          } else {
            setRetryAfter(remainingSeconds);
          }
        }, 1000);
        
        setIsLoading(false);
        setMessages(prev => prev.filter(msg => msg.id !== loadingMsgId));
        return;
      }
      
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
              }
              
              if (data.type === 'done') {
                isStreamingRef.current = false; // Mark streaming as complete
                // Log technical details: model used and RAG performance
                const actualModel = data.metadata?.model;
                const requestedModel = selectedModel;
                const expectedActual = requestedModel === 'grok' ? 'grok-4-fast-non-reasoning' :
                                     requestedModel === 'grok-reasoning' ? 'grok-4-fast-reasoning' :
                                     'gemini-2.5-flash';
                const wasOverridden = actualModel && expectedActual !== actualModel;

                // Log model override if detected
                if (wasOverridden && actualModel) {
                  console.warn('🔒 Model override detected:', {
                    requested: `${requestedModel} (${expectedActual})`,
                    actual: actualModel,
                    reason: 'Owner-configured safety mechanism'
                  });
                }

                // Log RAG performance metrics with model choice
                if (data.metadata && data.metadata.chunksUsed !== undefined) {
                  const performanceData: any = {
                    chunks: data.metadata.chunksUsed,
                    retrievalTime: data.metadata.retrievalTime,
                    totalTime: data.metadata.responseTime,
                    isMultiDocument: data.metadata.isMultiDocument,
                    documentSlugs: data.metadata.documentSlugs
                  };
                  
                  // Add model information to RAG performance log
                  if (actualModel) {
                    performanceData.model = actualModel;
                    performanceData.modelChoice = requestedModel;
                    if (wasOverridden) {
                      performanceData.modelOverride = true;
                    }
                  }
                  
                  console.log('📊 RAG Performance:', performanceData);
                }

                setIsLoading(false);
                isStreamingRef.current = false; // Mark streaming as complete
                // Convert loading message to final message with conversation ID and share token
                const conversationId = data.metadata?.conversationId;
                const shareToken = data.metadata?.shareToken;
                setMessages(prev => prev.map(msg => 
                  msg.id === loadingMsgId
                    ? { 
                        ...msg, 
                        content: assistantContent, 
                        id: `msg-${Date.now()}`, 
                        isLoading: false,
                        conversationId: conversationId,
                        shareToken: shareToken
                      }
                    : msg
                ));
              }
              
              if (data.type === 'error') {
                setIsLoading(false);
                isStreamingRef.current = false; // Reset streaming flag on error
                setMessages(prev => prev.filter(msg => msg.id !== loadingMsgId));
                
                // Handle rate limit errors from backend
                if (data.rateLimitExceeded) {
                  setRateLimitError(data.error || 'Rate limit exceeded');
                  const retrySeconds = data.retryAfter || 30;
                  setRetryAfter(retrySeconds);
                  
                  // Clear any existing countdown interval
                  if (countdownInterval.current) {
                    clearInterval(countdownInterval.current);
                  }
                  
                  // Update countdown every second
                  let remainingSeconds = retrySeconds;
                  countdownInterval.current = setInterval(() => {
                    remainingSeconds--;
                    if (remainingSeconds <= 0) {
                      setRateLimitError(null);
                      setRetryAfter(0);
                      if (countdownInterval.current) {
                        clearInterval(countdownInterval.current);
                        countdownInterval.current = null;
                      }
                    } else {
                      setRetryAfter(remainingSeconds);
                    }
                  }, 1000);
                  
                  return; // Don't throw error for rate limits
                }
                
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
  
  // Cleanup countdown interval on unmount
  useEffect(() => {
    return () => {
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
      }
    };
  }, []);
  
  return {
    messages,
    inputValue,
    setInputValue,
    isLoading,
    isStreamingRef,
    handleSendMessage,
    rateLimitError,
    retryAfter,
  };
}


