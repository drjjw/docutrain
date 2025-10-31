import { useEffect, useRef } from 'react';
import { Message } from './Message';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  model?: string | null;
  conversationId?: string | null;
  userMessage?: string | null;
}

interface MessageListProps {
  messages: Message[];
  onRate?: (conversationId: string, rating: 'thumbs_up' | 'thumbs_down') => void;
  onModelSwitch?: (message: string, currentModel: string) => void;
  shouldAutoScroll?: () => boolean;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
  streamingMessageId?: string | null;
}

export function MessageList({
  messages,
  onRate,
  onModelSwitch,
  shouldAutoScroll = () => true,
  scrollContainerRef,
  streamingMessageId
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (shouldAutoScroll() && messagesEndRef.current && messages.length > 0) {
      // Use the scroll container if provided, otherwise use the message container
      const scrollContainer = scrollContainerRef?.current || containerRef.current;
      if (scrollContainer) {
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
          // Also manually scroll to bottom if scrollIntoView doesn't work well
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }, 100);
      }
    }
  }, [messages, shouldAutoScroll, scrollContainerRef]);

  return (
    <div 
      ref={containerRef}
      id="chatContainer" 
      className="chat-container"
      data-scroll-detection-setup="true"
    >
      {messages.map((message) => (
        <Message
          key={message.id}
          content={message.content}
          role={message.role}
          model={message.model}
          conversationId={message.conversationId}
          userMessage={message.userMessage}
          isStreaming={message.id === streamingMessageId}
          onRate={onRate}
          onModelSwitch={onModelSwitch}
        />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}

