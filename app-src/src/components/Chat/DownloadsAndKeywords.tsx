/**
 * DownloadsAndKeywords - Container for downloads and keywords sections
 * Now using a drawer-based UI pattern
 */

import { useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Plus } from 'lucide-react';
import { KeywordsCloud } from './KeywordsCloud';
import { DownloadsSection } from './DownloadsSection';
import { Keyword, Download } from '@/hooks/useDocumentConfig';
import { debugLog } from '@/utils/debug';

/**
 * Hook to detect mobile viewport
 */
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 768px)').matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    const handleChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    
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

  return isMobile;
}

interface DownloadsAndKeywordsProps {
  keywords?: Keyword[];
  downloads?: Download[];
  isMultiDoc?: boolean;
  documentTitles?: string[]; // For multi-doc scenarios
  inputRef?: React.RefObject<HTMLInputElement | null>; // For keyword click handling
  onKeywordClick?: (term: string) => void; // Callback for keyword clicks
  onQuizClick?: () => void; // Callback for quiz button click
  documentSlug?: string | null; // Document slug for quiz button visibility
  showQuizzes?: boolean; // Whether quizzes are enabled for this document
}

// Height equalization no longer needed with unified container

export function DownloadsAndKeywords({
  keywords,
  downloads,
  isMultiDoc = false,
  documentTitles = [],
  inputRef,
  onKeywordClick,
  onQuizClick,
  documentSlug,
  showQuizzes = false,
}: DownloadsAndKeywordsProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const portalRootRef = useRef<HTMLDivElement | null>(null);
  const [portalReady, setPortalReady] = useState(false);
  const isMobile = useIsMobile();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  // Setup portal for drawer overlay
  useEffect(() => {
    // Check if we're in an iframe and try to use parent window
    const isInIframe = window.self !== window.top;
    let targetDocument = document;
    let targetBody = document.body;
    
    if (isInIframe) {
      try {
        // Try to access parent window (may fail due to cross-origin restrictions)
        const parentWindow = window.parent;
        if (parentWindow && parentWindow.document) {
          targetDocument = parentWindow.document;
          targetBody = parentWindow.document.body;
        }
      } catch (e) {
        // Cross-origin restriction - stay in current iframe
        console.warn('Cannot access parent window, using iframe body:', e);
      }
    }
    
    let portalRoot = targetDocument.getElementById('drawer-portal-root');
    if (!portalRoot) {
      portalRoot = targetDocument.createElement('div');
      portalRoot.id = 'drawer-portal-root';
      targetBody.appendChild(portalRoot);
    }
    portalRootRef.current = portalRoot;
    setPortalReady(true);

    return () => {
      // Don't remove portal root on unmount as it might be used by other components
    };
  }, []);

  // Handle escape key to close drawer
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDrawerOpen) {
        setIsDrawerOpen(false);
      }
    };

    if (isDrawerOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when drawer is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isDrawerOpen]);

  // DEBUG: Log keywords received
  useEffect(() => {
    debugLog('[DownloadsAndKeywords] 🔍 DEBUG - Keywords received:', {
      keywords,
      keywordsType: typeof keywords,
      isArray: Array.isArray(keywords),
      keywordsLength: Array.isArray(keywords) ? keywords.length : 'N/A',
    });
  }, [keywords]);
  
  // Use useMemo to ensure proper re-computation when keywords change
  const hasKeywords = useMemo(() => {
    const isArray = Array.isArray(keywords);
    const hasLength = isArray && keywords.length > 0;
    const hasValidTerms = hasLength && keywords.some(k => k && k.term && k.term.trim().length > 0);
    return isArray && hasLength && hasValidTerms;
  }, [keywords]);
  
  const hasDownloads = useMemo(() => {
    return Array.isArray(downloads) && downloads.length > 0;
  }, [downloads]);

  // Don't render if neither keywords, downloads, nor quizzes are present
  if (!hasKeywords && !hasDownloads && showQuizzes !== true) {
    return null;
  }

  // Prepare downloads with document titles for multi-doc
  const downloadsWithTitles = downloads?.map((download, index) => ({
    ...download,
    documentTitle: isMultiDoc && documentTitles[index] ? documentTitles[index] : undefined,
  }));

  // Determine button text and badge count
  let buttonText = '';
  let badgeCount = 0;
  if (hasKeywords && hasDownloads) {
    buttonText = 'Downloads & Key Topics';
    badgeCount = (keywords?.length || 0) + (downloads?.length || 0);
  } else if (hasKeywords) {
    buttonText = 'Key Topics';
    badgeCount = keywords?.length || 0;
  } else if (hasDownloads) {
    buttonText = 'Downloads';
    badgeCount = downloads?.length || 0;
  }

  const handleOpenDrawer = () => {
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
  };

  return (
    <>
      {/* Trigger Button */}
      <div className="downloads-keywords-drawer-trigger" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {/* Only show Downloads/Keywords button if there are keywords or downloads */}
        {(hasKeywords || hasDownloads) && (
          <button
            onClick={handleOpenDrawer}
            className="drawer-trigger-button"
            aria-label={`Open ${buttonText}`}
            type="button"
          >
            <div className="drawer-trigger-content">
              <span>{buttonText}</span>
              <div className="drawer-plus-icon">
                <Plus size={16} />
              </div>
            </div>
          </button>
        )}
        
        {/* Quiz Button - shown if quizzes are enabled and documentSlug is available */}
        {showQuizzes === true && onQuizClick && documentSlug && (
          <>
            {(hasKeywords || hasDownloads) && (
              <span style={{ color: '#9ca3af', fontSize: '14px' }}>|</span>
            )}
            <button
              onClick={onQuizClick}
              className="drawer-trigger-button"
              aria-label="Take quiz"
              type="button"
            >
              <div className="drawer-trigger-content">
                <span>Quiz</span>
                <div className="drawer-plus-icon">
                  <Plus size={16} />
                </div>
              </div>
            </button>
          </>
        )}
      </div>

      {/* Drawer Overlay - Render via portal */}
      {isDrawerOpen && portalReady && portalRootRef.current && createPortal(
        <>
          {/* Backdrop */}
          <div
            ref={overlayRef}
            className="drawer-backdrop"
            onClick={handleCloseDrawer}
            style={{ zIndex: 10000 }}
          />

          {/* Drawer Panel */}
          <div
            ref={drawerRef}
            className={`drawer-panel ${isMobile ? 'drawer-panel-mobile' : 'drawer-panel-desktop'}`}
            style={{ zIndex: 10001 }}
          >
            {/* Header */}
            <div className="drawer-header" style={{ position: 'relative', zIndex: 10003 }}>
              <h2 className="drawer-title">{buttonText}</h2>
            </div>

            {/* Content */}
            <div className="drawer-content">
              {hasKeywords && keywords && (
                <KeywordsCloud 
                  keywords={keywords} 
                  inputRef={inputRef} 
                  onKeywordClick={(term) => {
                    if (onKeywordClick) {
                      onKeywordClick(term);
                    }
                    // Close drawer after clicking keyword
                    setTimeout(() => setIsDrawerOpen(false), 300);
                  }}
                  isExpanded={true}
                />
              )}
              {hasDownloads && downloadsWithTitles && (
                <DownloadsSection 
                  downloads={downloadsWithTitles} 
                  isMultiDoc={isMultiDoc}
                  isExpanded={true}
                />
              )}
            </div>

            {/* Footer with Close Button */}
            <div className="drawer-footer">
              <button
                onClick={handleCloseDrawer}
                className="drawer-footer-close-button"
                aria-label="Close drawer"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </>,
        portalRootRef.current
      )}
    </>
  );
}

