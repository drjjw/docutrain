/**
 * KeywordsCloud - Simple display of keywords
 */

import { Keyword } from '@/hooks/useDocumentConfig';

interface KeywordsCloudProps {
  keywords: Keyword[];
  onKeywordClick?: (term: string) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  isExpanded?: boolean;
}

export function KeywordsCloud({ keywords, onKeywordClick, inputRef, isExpanded = true }: KeywordsCloudProps) {
  if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
    return null;
  }

  // Filter valid keywords
  const validKeywords = keywords.filter(k => k?.term && typeof k.term === 'string' && k.term.trim().length > 0);
  
  if (validKeywords.length === 0) {
    return null;
  }

  const handleKeywordClick = (term: string) => {
    if (onKeywordClick) {
      onKeywordClick(term);
    } else if (inputRef?.current) {
      inputRef.current.value = `Tell me about ${term}`;
      inputRef.current.focus();
    } else {
      const messageInput = document.getElementById('messageInput');
      if (messageInput) {
        (messageInput as HTMLInputElement).value = `Tell me about ${term}`;
        messageInput.focus();
      }
    }
  };

  if (!isExpanded) {
    return null;
  }

  return (
    <div className="keywords-section">
      <div className="keywords-header">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
          <line x1="7" y1="7" x2="7.01" y2="7"></line>
        </svg>
        <span>Key Topics</span>
      </div>
      <div className="keywords-hint">Click keyword to ask about it</div>
      <div className="keywords-list">
        {validKeywords.map((keyword, index) => {
          const weightPercent = Math.round((keyword.weight || 0) * 100);
          return (
            <span key={`${keyword.term}-${index}`}>
              <span
                className="keyword-item"
                onClick={() => handleKeywordClick(keyword.term)}
              >
                {keyword.term}
              </span>
              <span className="keyword-weight"> ({weightPercent}%)</span>
              {index < validKeywords.length - 1 && <span className="keyword-separator">, </span>}
            </span>
          );
        })}
      </div>
      <div className="keywords-footnote">* Keyword estimated relative importance in brackets</div>
    </div>
  );
}
