/**
 * useAutoScrollToMessage Hook
 * 
 * Automatically scrolls to position the last user message just below the header
 * when streaming starts (loading message appears after user message).
 */

import { useEffect, useRef, RefObject } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isLoading?: boolean;
}

interface UseAutoScrollToMessageProps {
  messages: Message[];
  chatContainerRef: RefObject<HTMLDivElement | null>;
}

export function useAutoScrollToMessage({
  messages,
  chatContainerRef,
}: UseAutoScrollToMessageProps): void {
  const lastUserMessageRef = useRef<string | null>(null);

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
  }, [messages, chatContainerRef]);
}

