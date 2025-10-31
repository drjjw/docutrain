import { useState, useCallback, useRef } from 'react';
import { sendChatMessage, ChatMessage, ChatResponse } from '@/services/chatApi';
import { generateSessionId } from '@/services/config';

export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  model?: string | null;
  conversationId?: string | null;
  userMessage?: string | null;
}

interface UseChatOptions {
  selectedModel: string;
  selectedDocument: string | string[];
  sessionId?: string;
}

interface UseChatReturn {
  messages: Message[];
  isLoading: boolean;
  sendMessage: (message: string) => Promise<void>;
  clearMessages: () => void;
  error: string | null;
  sessionId: string;
}

export function useChat({ selectedModel, selectedDocument, sessionId }: UseChatOptions): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<ChatMessage[]>([]);
  const currentSessionIdRef = useRef<string>(sessionId || generateSessionId());
  
  // Expose session ID via return value
  const getSessionId = () => currentSessionIdRef.current;

  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim() || isLoading) return;

    setError(null);
    setIsLoading(true);

    // Add user message
    const userMessageObj: Message = {
      id: Date.now().toString(),
      content: message,
      role: 'user'
    };

    setMessages(prev => [...prev, userMessageObj]);
    setConversationHistory(prev => [...prev, { role: 'user', content: message }]);

    try {
      // Check if streaming
      const response = await sendChatMessage(
        message,
        [...conversationHistory, { role: 'user', content: message }],
        selectedModel,
        currentSessionIdRef.current,
        selectedDocument
      );

      // Check if it's a streaming response (Response object) or regular response (JSON)
      if (response instanceof Response) {
        // Streaming - will be handled by useStreamingResponse hook
        // For now, we'll handle it here
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('text/event-stream')) {
          // Streaming response - return response object for useStreamingResponse to handle
          // We'll add the message after streaming completes
          return; // Streaming handler will manage adding the message
        }
      } else {
        // Non-streaming response
        const data = response as ChatResponse;
        
        if (data.error) {
          throw new Error(data.error);
        }

        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: data.response,
          role: 'assistant',
          model: data.model,
          conversationId: data.conversationId || null
        };

        setMessages(prev => [...prev, assistantMessage]);
        setConversationHistory(prev => [...prev, { role: 'assistant', content: data.response }]);
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to connect to server. Please try again.';
      setError(errorMessage);
      
      const errorMessageObj: Message = {
        id: (Date.now() + 1).toString(),
        content: errorMessage,
        role: 'assistant'
      };
      
      setMessages(prev => [...prev, errorMessageObj]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, selectedModel, selectedDocument, conversationHistory]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setConversationHistory([]);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    clearMessages,
    error,
    sessionId: currentSessionIdRef.current
  };
}

