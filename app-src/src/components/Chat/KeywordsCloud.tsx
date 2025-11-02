/**
 * KeywordsCloud - Displays document keywords as an interactive word cloud
 * Matches vanilla JS implementation from ui-keywords.js
 */

import { Keyword } from '@/hooks/useDocumentConfig';

interface KeywordsCloudProps {
  keywords: Keyword[];
  onKeywordClick?: (term: string) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

export function KeywordsCloud({ keywords, onKeywordClick, inputRef }: KeywordsCloudProps) {
  if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
    return null;
  }

  // Normalize weights to determine font size range
  // Weight range: 0.1 to 1.0
  // Font size range: 0.75rem (smallest) to 1.75rem (largest)
  const minWeight = Math.min(...keywords.map(k => k.weight || 0.5));
  const maxWeight = Math.max(...keywords.map(k => k.weight || 0.5));
  const weightRange = maxWeight - minWeight || 1; // Avoid division by zero

  const handleKeywordClick = (term: string) => {
    if (onKeywordClick) {
      onKeywordClick(term);
    } else if (inputRef?.current) {
      // Default behavior: insert into chat input via ref
      inputRef.current.value = `Tell me about ${term}`;
      inputRef.current.focus();
    } else {
      // Fallback: try to find input by ID (for compatibility)
      const messageInput = document.getElementById('messageInput');
      if (messageInput) {
        (messageInput as HTMLInputElement).value = `Tell me about ${term}`;
        messageInput.focus();
      }
    }
  };

  return (
    <div className="document-keywords">
      <div className="document-keywords-header">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
          <line x1="7" y1="7" x2="7.01" y2="7"></line>
        </svg>
        <span className="keywords-title">Key Topics</span>
      </div>
      
      <div className="keywords-hint">
        Click a topic to quickly ask about it
      </div>
      
      <div className="document-keywords-wordcloud">
        {keywords.map((keyword, index) => {
          // Calculate font size based on weight (larger = more important)
          const normalizedWeight = weightRange > 0 
            ? (keyword.weight - minWeight) / weightRange 
            : 0.5;
          
          // Font size range: 0.75rem to 1.75rem
          const minSize = 0.75;
          const maxSize = 1.75;
          const fontSize = minSize + (normalizedWeight * (maxSize - minSize));
          
          // Set font weight based on importance (bolder = more important)
          // Range: 400 (normal) to 700 (bold)
          const fontWeight = Math.round(400 + (normalizedWeight * 300));
          
          // Set color opacity based on weight (darker = more important)
          // Range: 0.7 to 1.0 opacity
          const opacity = 0.7 + (normalizedWeight * 0.3);
          
          return (
            <span key={index}>
              <span
                className="keyword-word"
                style={{
                  fontSize: `${fontSize}rem`,
                  fontWeight,
                  opacity,
                }}
                onClick={() => handleKeywordClick(keyword.term)}
              >
                {keyword.term}
              </span>
              {index < keywords.length - 1 && (
                <span className="keyword-separator"> • </span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

