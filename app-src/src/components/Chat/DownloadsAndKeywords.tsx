/**
 * DownloadsAndKeywords - Container for downloads and keywords sections
 * Matches vanilla JS downloads-keywords-container layout
 */

import { useEffect, useRef, useState, useMemo } from 'react';
import { Minus, Plus } from 'lucide-react';
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
}

// Height equalization no longer needed with unified container

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
  const prevKeywordsLengthRef = useRef<number>(0);
  const prevDownloadsLengthRef = useRef<number>(0);
  
  // DEBUG: Log keywords received
  useEffect(() => {
    debugLog('[DownloadsAndKeywords] 🔍 DEBUG - Keywords received:', {
      keywords,
      keywordsType: typeof keywords,
      isArray: Array.isArray(keywords),
      keywordsLength: Array.isArray(keywords) ? keywords.length : 'N/A',
      keywordsDetails: Array.isArray(keywords) ? keywords.map(k => ({
        term: k?.term,
        weight: k?.weight,
        hasTerm: !!k?.term,
        termType: typeof k?.term,
        termLength: k?.term?.length || 0,
        termTrimmed: k?.term?.trim().length || 0
      })) : 'N/A'
    });
  }, [keywords]);
  
  // Use useMemo to ensure proper re-computation when keywords change
  // Check for valid array with actual keyword objects (not just empty array)
  const hasKeywords = useMemo(() => {
    const isArray = Array.isArray(keywords);
    const hasLength = isArray && keywords.length > 0;
    const hasValidTerms = hasLength && keywords.some(k => k && k.term && k.term.trim().length > 0);
    const result = isArray && hasLength && hasValidTerms;
    
    debugLog('[DownloadsAndKeywords] 🔍 DEBUG - hasKeywords calculation:', {
      isArray,
      hasLength,
      hasValidTerms,
      result,
      keywordsLength: isArray ? keywords.length : 0,
      validKeywordsCount: isArray ? keywords.filter(k => k && k.term && k.term.trim().length > 0).length : 0
    });
    
    return result;
  }, [keywords]);
  
  const hasDownloads = useMemo(() => {
    return Array.isArray(downloads) && downloads.length > 0;
  }, [downloads]);

  // Update container expanded state when mobile state changes, but only if user hasn't manually interacted
  useEffect(() => {
    if (!hasUserInteracted) {
      setIsContainerExpanded(!isMobile);
    }
  }, [isMobile, hasUserInteracted]);

  // Track changes to keywords/downloads to trigger height recalculation
  useEffect(() => {
    const keywordsLength = Array.isArray(keywords) ? keywords.length : 0;
    const downloadsLength = Array.isArray(downloads) ? downloads.length : 0;
    
    // If keywords or downloads count changed, reset container height to force recalculation
    if (keywordsLength !== prevKeywordsLengthRef.current || downloadsLength !== prevDownloadsLengthRef.current) {
      prevKeywordsLengthRef.current = keywordsLength;
      prevDownloadsLengthRef.current = downloadsLength;
      setContainerHeight(undefined); // Reset to trigger recalculation
    }
  }, [keywords, downloads]);

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
    // Always recalculate when keywords/downloads change to catch async updates
    const shouldRecalculate = isContainerExpanded || !containerHeight;
    if (shouldRecalculate) {
      // Delay measurement to ensure content is rendered, especially for async keywords
      // Use requestAnimationFrame to ensure DOM is updated
      const timeoutId = setTimeout(() => {
        requestAnimationFrame(() => {
          updateHeight();
        });
      }, 100); // Increased delay to ensure keywords are rendered

      return () => clearTimeout(timeoutId);
    }
  }, [hasKeywords, hasDownloads, keywords, downloads, isContainerExpanded, containerHeight]);

  // Height equalization no longer needed with unified container

  // Don't render if neither keywords nor downloads are present
  if (!hasKeywords && !hasDownloads) {
    debugLog('[DownloadsAndKeywords] 🔍 DEBUG - Not rendering (no keywords or downloads):', {
      hasKeywords,
      hasDownloads,
      keywordsLength: Array.isArray(keywords) ? keywords.length : 0,
      downloadsLength: Array.isArray(downloads) ? downloads.length : 0
    });
    return null;
  }
  
  debugLog('[DownloadsAndKeywords] 🔍 DEBUG - Rendering component:', {
    hasKeywords,
    hasDownloads,
    isContainerExpanded,
    containerHeight,
    keywordsLength: Array.isArray(keywords) ? keywords.length : 0
  });

  // Prepare downloads with document titles for multi-doc
  const downloadsWithTitles = downloads?.map((download, index) => ({
    ...download,
    documentTitle: isMultiDoc && documentTitles[index] ? documentTitles[index] : undefined,
  }));

  // Determine header text based on what's available
  let headerText = '';
  if (hasKeywords && hasDownloads) {
    headerText = 'Downloads & Key Topics';
  } else if (hasKeywords) {
    headerText = 'Key Topics';
  } else if (hasDownloads) {
    headerText = 'Downloads';
  }

  return (
    <div className="downloads-keywords-wrapper">
      <button
        className={`downloads-keywords-container-header ${isContainerExpanded ? 'expanded' : ''}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setHasUserInteracted(true);
          setIsContainerExpanded(!isContainerExpanded);
        }}
        aria-expanded={isContainerExpanded}
        aria-label={isContainerExpanded ? `Collapse ${headerText}` : `Expand ${headerText}`}
        type="button"
      >
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
        <span>{headerText}</span>
      </button>
      <div
        ref={containerRef}
        id="downloadsKeywordsContainer"
        className={`downloads-keywords-container ${!isContainerExpanded ? 'collapsed' : ''}`}
        style={{ 
          display: hasKeywords || hasDownloads ? 'flex' : 'none',
          maxHeight: isContainerExpanded && containerHeight ? `${containerHeight}px` : '0px',
        }}
      >
        <div className="downloads-keywords-container-content">
          {hasKeywords && keywords && (() => {
            debugLog('[DownloadsAndKeywords] 🔍 DEBUG - About to render KeywordsCloud:', {
              hasKeywords,
              keywordsExists: !!keywords,
              keywordsLength: Array.isArray(keywords) ? keywords.length : 'N/A',
              isExpanded: isContainerExpanded,
              keywordsPreview: Array.isArray(keywords) ? keywords.slice(0, 3) : 'N/A'
            });
            return (
              <KeywordsCloud 
                keywords={keywords} 
                inputRef={inputRef} 
                onKeywordClick={onKeywordClick}
                isExpanded={isContainerExpanded}
              />
            );
          })()}
          {hasDownloads && downloadsWithTitles && (
            <DownloadsSection 
              downloads={downloadsWithTitles} 
              isMultiDoc={isMultiDoc}
              isExpanded={isContainerExpanded}
            />
          )}
        </div>
      </div>
    </div>
  );
}

