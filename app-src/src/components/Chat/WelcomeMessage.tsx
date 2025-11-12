/**
 * WelcomeMessage - Displays welcome message and intro content with inline editing
 * Matches vanilla JS implementation from ui-document.js
 */

import { useCanEditDocument } from '@/hooks/useCanEditDocument';
import { InlineEditor } from './InlineEditor';
import { InlineWysiwygEditor } from './InlineWysiwygEditor';
import { DownloadsAndKeywords } from './DownloadsAndKeywords';
import { useState, useCallback, useEffect } from 'react';
import { Keyword, Download } from '@/hooks/useDocumentConfig';
import { debugLog } from '@/utils/debug';

interface WelcomeMessageProps {
  welcomeMessage: string;
  introMessage?: string | null;
  documentSlug: string;
  keywords?: Keyword[];
  downloads?: Download[];
  showKeywords?: boolean;
  showDownloads?: boolean;
  showQuizzes?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | HTMLTextAreaElement>;
  onKeywordClick?: (term: string) => void;
  onQuizClick?: () => void;
}

/**
 * Convert h1 tags to h2 tags in HTML content to maintain proper heading hierarchy
 * Page title is h1, so welcome content should use h2 or lower
 */
function convertH1ToH2(html: string): string {
  if (!html) return html;
  // Replace opening and closing h1 tags with h2
  return html
    .replace(/<h1\b([^>]*)>/gi, '<h2$1>')
    .replace(/<\/h1>/gi, '</h2>');
}

/**
 * Save document field via API
 */
async function saveDocumentField(
  documentSlug: string,
  field: string,
  value: string
): Promise<boolean> {
  const sessionKey = 'sb-mlxctdgnojvkgfqldaob-auth-token';
  const sessionData = localStorage.getItem(sessionKey);
  if (!sessionData) {
    throw new Error('Not authenticated');
  }

  const session = JSON.parse(sessionData);
  const token = session?.access_token;
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`/api/documents/${documentSlug}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      [field]: value
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to save');
  }

  return true;
}

/**
 * Hook to detect mobile/stacked view (portrait mobile or stacked layout)
 */
function useIsMobileOrStacked(): boolean {
  const [isMobileOrStacked, setIsMobileOrStacked] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= 768;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    const handleChange = (e: MediaQueryListEvent) => setIsMobileOrStacked(e.matches);
    
    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  return isMobileOrStacked;
}

export function WelcomeMessage({ 
  welcomeMessage, 
  introMessage, 
  documentSlug,
  keywords,
  downloads,
  showKeywords,
  showDownloads,
  showQuizzes,
  inputRef,
  onKeywordClick,
  onQuizClick,
}: WelcomeMessageProps) {
  const { canEdit } = useCanEditDocument(documentSlug);
  const [refreshKey, setRefreshKey] = useState(0);
  const isMobileOrStacked = useIsMobileOrStacked();
  
  // Initialize collapsed state - default to expanded (open)
  const [isIntroCollapsed, setIsIntroCollapsed] = useState(false);

  // Force refresh of document config after save
  const handleSave = useCallback(async (field: string, value: string) => {
    debugLog(`[WelcomeMessage] Saving ${field} for document: ${documentSlug}`);
    const success = await saveDocumentField(documentSlug, field, value);
    if (success) {
      debugLog(`[WelcomeMessage] ✅ Save successful, dispatching document-updated event`);
      // Force refresh by updating key
      setRefreshKey(prev => prev + 1);
      // Dispatch event immediately to trigger local refresh
      // Realtime will also trigger an update, but this ensures immediate feedback
      window.dispatchEvent(new CustomEvent('document-updated', {
        detail: { documentSlug }
      }));
      debugLog(`[WelcomeMessage] Event dispatched for slug: ${documentSlug}`);
    } else {
      console.error(`[WelcomeMessage] ❌ Save failed`);
    }
    return success;
  }, [documentSlug]);

  const toggleIntroCollapsed = () => {
    setIsIntroCollapsed(!isIntroCollapsed);
  };

  // Only show collapsible functionality on mobile/stacked view
  const showCollapsible = isMobileOrStacked && introMessage !== null && introMessage !== undefined;

  return (
    <div className="welcome-message-section">
      <div className="message assistant" id="welcomeMessage">
        <div className="message-content">
          {/* Collapsible toggle button - positioned in top right of container */}
          {showCollapsible && (
            <button
              onClick={toggleIntroCollapsed}
              className="intro-message-toggle"
              type="button"
              aria-label={isIntroCollapsed ? 'Expand intro message' : 'Collapse intro message'}
              aria-expanded={!isIntroCollapsed}
            >
              <svg
                className={`intro-message-toggle-icon ${isIntroCollapsed ? '' : 'expanded'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
          
          {canEdit ? (
            <InlineEditor
              id="welcomeTitle"
              value={welcomeMessage}
              field="welcome_message"
              documentSlug={documentSlug}
              onSave={(value) => handleSave('welcome_message', value)}
              className="loading-text"
              style={{ fontWeight: 'bold', display: 'block' }}
            />
          ) : (
            <h2 id="welcomeTitle" className="loading-text">
              {welcomeMessage}
            </h2>
          )}

          {/* Intro message content - collapsible on mobile/stacked */}
          {introMessage !== null && introMessage !== undefined && (
            <div className={`intro-message-content ${showCollapsible ? 'collapsible' : ''}`}>
              {/* Intro content - hidden when collapsed */}
              {!isIntroCollapsed && (
                <>
                  {canEdit ? (
                    <InlineWysiwygEditor
                      id="welcomeIntroContent"
                      value={introMessage}
                      field="intro_message"
                      documentSlug={documentSlug}
                      onSave={(value) => handleSave('intro_message', value)}
                      className=""
                    />
                  ) : (
                    <div 
                      id="welcomeIntroContent"
                      dangerouslySetInnerHTML={{ __html: convertH1ToH2(introMessage) }}
                    />
                  )}
                </>
              )}
            </div>
          )}
          
          {/* Downloads and Keywords - rendered inside intro message */}
          {/* Also render if only quizzes are enabled (no keywords/downloads) */}
          {(showKeywords !== false || showDownloads !== false || showQuizzes === true) && (
            (!showCollapsible || !isIntroCollapsed) && (
              <DownloadsAndKeywords
                keywords={showKeywords !== false ? keywords : undefined}
                downloads={showDownloads !== false ? downloads : undefined}
                isMultiDoc={false}
                inputRef={inputRef}
                onKeywordClick={onKeywordClick}
                onQuizClick={showQuizzes === true ? onQuizClick : undefined}
                documentSlug={documentSlug}
                showQuizzes={showQuizzes}
              />
            )
          )}
        </div>
      </div>
    </div>
  );
}

