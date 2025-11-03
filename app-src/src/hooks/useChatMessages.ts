/**
 * useChatMessages - Hook for managing chat messages and streaming
 * Handles message state, sending messages, streaming responses, and loading states
 * Ported from ChatPage.tsx
 */

import { useState, useRef } from 'react';
import type { DocumentConfig } from './useDocumentConfig';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isLoading?: boolean; // Flag for loading message with fun facts
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
  
  return {
    messages,
    inputValue,
    setInputValue,
    isLoading,
    isStreamingRef,
    handleSendMessage,
  };
}

