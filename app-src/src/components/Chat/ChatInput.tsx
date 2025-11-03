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
  shouldShowFooter,
  isMakerTheme,
  isDesktop,
}: ChatInputProps) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100]">
      {/* Chat input form */}
      <div 
        className="border-t border-gray-200 p-4"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.7)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)'
        }}
      >
        <form
          onSubmit={handleSubmit}
          className="flex gap-3 max-w-4xl mx-auto"
        >
          <input
            ref={inputRef}
            id="messageInput"
            type="text"
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder={documentSlug ? "Ask a question..." : "Select a document to start chatting..."}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-200 transition-all shadow-sm hover:shadow-md focus:shadow-md"
            disabled={isLoading || !documentSlug || !!rateLimitError}
          />
          <button
            type="submit"
            id="sendButton"
            disabled={isLoading || !inputValue.trim() || !documentSlug || !!rateLimitError}
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

