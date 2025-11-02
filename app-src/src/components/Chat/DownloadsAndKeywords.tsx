/**
 * DownloadsAndKeywords - Container for downloads and keywords sections
 * Matches vanilla JS downloads-keywords-container layout
 */

import { useEffect, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { KeywordsCloud } from './KeywordsCloud';
import { DownloadsSection } from './DownloadsSection';
import { Keyword, Download } from '@/hooks/useDocumentConfig';

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
}

/**
 * Equalize heights of downloads and keywords containers on desktop
 * Matches vanilla JS equalizeDownloadsKeywordsHeights function
 */
function equalizeDownloadsKeywordsHeights() {
  const container = document.getElementById('downloadsKeywordsContainer');
  if (!container) return;
  
  // Only equalize when both are present (side-by-side)
  const downloadsSection = container.querySelector('.downloads-section');
  const keywordsSection = container.querySelector('.document-keywords');
  
  if (!downloadsSection || !keywordsSection) {
    // If only one is present, reset heights
    if (downloadsSection) (downloadsSection as HTMLElement).style.height = '';
    if (keywordsSection) (keywordsSection as HTMLElement).style.height = '';
    return;
  }
  
  // Only equalize on desktop (> 768px) - mobile uses vertical stacking
  const isMobile = window.innerWidth <= 768;
  if (isMobile) {
    (downloadsSection as HTMLElement).style.height = '';
    (keywordsSection as HTMLElement).style.height = '';
    return;
  }
  
  // Desktop: Reset any previously set heights to get natural heights
  (downloadsSection as HTMLElement).style.height = '';
  (keywordsSection as HTMLElement).style.height = '';
  
  // Get natural heights
  const downloadsHeight = (downloadsSection as HTMLElement).offsetHeight;
  const keywordsHeight = (keywordsSection as HTMLElement).offsetHeight;
  
  // Set both to the maximum height
  const maxHeight = Math.max(downloadsHeight, keywordsHeight);
  if (maxHeight > 0) {
    (downloadsSection as HTMLElement).style.height = `${maxHeight}px`;
    (keywordsSection as HTMLElement).style.height = `${maxHeight}px`;
  }
}

export function DownloadsAndKeywords({
  keywords,
  downloads,
  isMultiDoc = false,
  documentTitles = [],
  inputRef,
  onKeywordClick,
}: DownloadsAndKeywordsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [isContainerExpanded, setIsContainerExpanded] = useState(!isMobile);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [containerHeight, setContainerHeight] = useState<number | undefined>(undefined);
  const hasKeywords = keywords && keywords.length > 0;
  const hasDownloads = downloads && downloads.length > 0;

  // Update container expanded state when mobile state changes, but only if user hasn't manually interacted
  useEffect(() => {
    if (!hasUserInteracted) {
      setIsContainerExpanded(!isMobile);
    }
  }, [isMobile, hasUserInteracted]);

  // Measure and update container height for smooth animation
  useEffect(() => {
    if (!containerRef.current || (!hasKeywords && !hasDownloads)) return;

    const updateHeight = () => {
      if (containerRef.current) {
        // Temporarily remove max-height and collapsed class to measure natural height
        const wasCollapsed = containerRef.current.classList.contains('collapsed');
        const originalMaxHeight = containerRef.current.style.maxHeight;
        const originalDisplay = containerRef.current.style.display;
        
        containerRef.current.classList.remove('collapsed');
        containerRef.current.style.maxHeight = 'none';
        containerRef.current.style.opacity = '0';
        containerRef.current.style.position = 'absolute';
        containerRef.current.style.visibility = 'hidden';
        
        const height = containerRef.current.scrollHeight;
        
        // Restore original state
        containerRef.current.style.maxHeight = originalMaxHeight;
        containerRef.current.style.opacity = '';
        containerRef.current.style.position = '';
        containerRef.current.style.visibility = '';
        containerRef.current.style.display = originalDisplay;
        if (wasCollapsed) {
          containerRef.current.classList.add('collapsed');
        }
        
        setContainerHeight(height);
      }
    };

    // Measure height when expanded or when content changes
    if (isContainerExpanded || !containerHeight) {
      // Delay measurement to ensure content is rendered
      const timeoutId = setTimeout(() => {
        updateHeight();
      }, 50);

      return () => clearTimeout(timeoutId);
    }
  }, [hasKeywords, hasDownloads, keywords, downloads, isContainerExpanded]);

  // Equalize heights after render and on window resize
  useEffect(() => {
    if (!hasKeywords && !hasDownloads) return;
    
    // Equalize after initial render
    const timeoutId = setTimeout(() => {
      equalizeDownloadsKeywordsHeights();
    }, 100);

    // Handle window resize with debounce
    let resizeTimeout: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        equalizeDownloadsKeywordsHeights();
      }, 250);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(resizeTimeout);
      window.removeEventListener('resize', handleResize);
    };
  }, [hasKeywords, hasDownloads, keywords, downloads]);

  // Don't render if neither keywords nor downloads are present
  if (!hasKeywords && !hasDownloads) {
    return null;
  }

  // Prepare downloads with document titles for multi-doc
  const downloadsWithTitles = downloads?.map((download, index) => ({
    ...download,
    documentTitle: isMultiDoc && documentTitles[index] ? documentTitles[index] : undefined,
  }));

  return (
    <div className="downloads-keywords-wrapper">
      <button
        className="downloads-keywords-container-header"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setHasUserInteracted(true);
          setIsContainerExpanded(!isContainerExpanded);
        }}
        aria-expanded={isContainerExpanded}
        aria-label={isContainerExpanded ? 'Collapse Downloads & Topics' : 'Expand Downloads & Topics'}
        type="button"
      >
        <span>Downloads & Key Topics</span>
        <div 
          className="collapse-icon" 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            backgroundColor: isContainerExpanded ? '#ef4444' : '#22c55e',
            flexShrink: 0,
            transition: 'background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <div style={{ position: 'relative', width: '16px', height: '16px' }}>
            <Minus 
              size={16} 
              strokeWidth={3} 
              style={{ 
                color: 'white',
                position: 'absolute',
                top: 0,
                left: 0,
                transition: 'opacity 0.25s ease-out, transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                opacity: isContainerExpanded ? 1 : 0,
                transform: isContainerExpanded ? 'scale(1) rotate(0deg)' : 'scale(0.8) rotate(-90deg)',
                pointerEvents: 'none',
              }} 
            />
            <Plus 
              size={16} 
              strokeWidth={3} 
              style={{ 
                color: 'white',
                position: 'absolute',
                top: 0,
                left: 0,
                transition: 'opacity 0.25s ease-out, transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                opacity: isContainerExpanded ? 0 : 1,
                transform: isContainerExpanded ? 'scale(0.8) rotate(90deg)' : 'scale(1) rotate(0deg)',
                pointerEvents: 'none',
              }} 
            />
          </div>
        </div>
      </button>
      <div
        ref={containerRef}
        id="downloadsKeywordsContainer"
        className={`downloads-keywords-container ${!isContainerExpanded ? 'collapsed' : ''}`}
        style={{ 
          display: hasKeywords || hasDownloads ? 'flex' : 'none',
          maxHeight: isContainerExpanded && containerHeight ? `${containerHeight}px` : '0px',
          opacity: isContainerExpanded ? 1 : undefined,
        }}
      >
        {hasKeywords && (
          <KeywordsCloud 
            keywords={keywords} 
            inputRef={inputRef} 
            onKeywordClick={onKeywordClick}
            isExpanded={isContainerExpanded}
          />
        )}
        {hasDownloads && downloadsWithTitles && (
          <DownloadsSection 
            downloads={downloadsWithTitles} 
            isMultiDoc={isMultiDoc}
            isExpanded={isContainerExpanded}
          />
        )}
      </div>
    </div>
  );
}

