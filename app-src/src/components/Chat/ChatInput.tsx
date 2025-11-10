/**
 * ChatInput Component
 * 
 * Renders the chat input form with:
 * - Text input field
 * - Send button
 * - Rate limit error message
 * - Text selection hint (desktop only)
 * - Docutrain footer (optional)
 */

import { RefObject, FormEvent } from 'react';
import { DocutrainFooter } from '@/components/Chat/DocutrainFooter';

const MAX_INPUT_LENGTH = 1500;

interface ChatInputProps {
  // Input state
  inputRef: RefObject<HTMLInputElement | null>;
  inputValue: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  
  // Loading & document state
  isLoading: boolean;
  documentSlug: string | null;
  
  // Rate limiting
  rateLimitError: string | null;
  retryAfter: number;
  
  // Conversation limit
  conversationLimitError: string | null;
  
  // UI state
  shouldShowFooter: boolean;
  isMakerTheme: boolean;
  isDesktop: boolean;
}

export function ChatInput({
  inputRef,
  inputValue,
  onInputChange,
  onSubmit,
  isLoading,
  documentSlug,
  rateLimitError,
  retryAfter,
  conversationLimitError,
  shouldShowFooter,
  isMakerTheme,
  isDesktop,
}: ChatInputProps) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  const handleInputChange = (value: string) => {
    // Enforce character limit
    if (value.length <= MAX_INPUT_LENGTH) {
      onInputChange(value);
    }
  };

  const remainingChars = MAX_INPUT_LENGTH - inputValue.length;
  const isNearLimit = remainingChars < 100;
  const isAtLimit = remainingChars === 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100]">
      {/* Chat input form */}
      <div 
        className="border-t border-gray-200 p-3 md:p-4"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.6)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.08), 0 -2px 8px rgba(0, 0, 0, 0.04)',
          borderTop: '1px solid rgba(229, 231, 235, 0.6)',
          backgroundImage: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0.6) 100%)'
        }}
      >
        <form
          onSubmit={handleSubmit}
          className="flex gap-3 max-w-4xl mx-auto"
        >
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              id="messageInput"
              type="text"
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder={documentSlug ? "Ask a question..." : "Select a document to start chatting..."}
              maxLength={MAX_INPUT_LENGTH}
              className={`w-full px-3 md:px-4 py-2.5 md:py-3 pr-12 md:pr-14 text-base border rounded-xl bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:scale-[1.01] transition-all duration-200 ease-in-out shadow-sm hover:shadow-md focus:shadow-lg ${
                isAtLimit 
                  ? 'border-red-300 focus:border-red-400 focus:ring-red-200' 
                  : isNearLimit 
                    ? 'border-yellow-300 focus:border-yellow-400 focus:ring-yellow-200' 
                    : 'border-gray-300 focus:border-gray-400 focus:ring-gray-200'
              }`}
              disabled={isLoading || !documentSlug || !!rateLimitError || !!conversationLimitError}
            />
            {/* Character counter */}
            <div className={`absolute right-3 md:right-4 bottom-2.5 md:bottom-3 text-xs pointer-events-none ${
              isAtLimit 
                ? 'text-red-600 font-semibold' 
                : isNearLimit 
                  ? 'text-yellow-600' 
                  : 'text-gray-400'
            }`}>
              {remainingChars}
            </div>
          </div>
          <button
            type="submit"
            id="sendButton"
            disabled={isLoading || !inputValue.trim() || !documentSlug || !!rateLimitError || !!conversationLimitError}
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

        {/* Conversation Limit Error Message */}
        {conversationLimitError && (
          <div className="mt-3 max-w-4xl mx-auto">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
              <svg 
                className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                />
              </svg>
              <div className="flex-1">
                <p className="text-sm text-blue-800 font-medium">
                  {conversationLimitError}
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  💡 Tip: Close this tab and open a new one to start a fresh chat session, or refresh the page.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Rate Limit Error Message */}
        {rateLimitError && (
          <div className="mt-3 max-w-4xl mx-auto">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
              <svg 
                className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
                />
              </svg>
              <div className="flex-1">
                <p className="text-sm text-yellow-800 font-medium">
                  {rateLimitError}
                </p>
                {retryAfter > 0 && (
                  <p className="text-xs text-yellow-700 mt-1">
                    You can send another message in {retryAfter} second{retryAfter !== 1 ? 's' : ''}.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Text Selection Hint - Only show on desktop */}
        {isDesktop && (
          <div className="mt-2 text-center">
            <p className="text-xs text-gray-500">
              💡 Hint: You can highlight any response by the chat bot and it will search for that selection
            </p>
          </div>
        )}
      </div>

      {/* Footer - subtle indication this is a Docutrain article */}
      {/* Positioned below the input field */}
      {shouldShowFooter && <DocutrainFooter />}
    </div>
  );
}

