/**
 * DownloadsAndKeywords - Container for downloads and keywords sections
 * Matches vanilla JS downloads-keywords-container layout
 */

import { useEffect, useRef } from 'react';
import { KeywordsCloud } from './KeywordsCloud';
import { DownloadsSection } from './DownloadsSection';
import { Keyword, Download } from '@/hooks/useDocumentConfig';

interface DownloadsAndKeywordsProps {
  keywords?: Keyword[];
  downloads?: Download[];
  isMultiDoc?: boolean;
  documentTitles?: string[]; // For multi-doc scenarios
  inputRef?: React.RefObject<HTMLInputElement | null>; // For keyword click handling
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
}: DownloadsAndKeywordsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasKeywords = keywords && keywords.length > 0;
  const hasDownloads = downloads && downloads.length > 0;

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
    <div
      ref={containerRef}
      id="downloadsKeywordsContainer"
      className="downloads-keywords-container"
      style={{ display: hasKeywords || hasDownloads ? 'flex' : 'none' }}
    >
      {hasKeywords && (
        <KeywordsCloud keywords={keywords} inputRef={inputRef} />
      )}
      {hasDownloads && downloadsWithTitles && (
        <DownloadsSection downloads={downloadsWithTitles} isMultiDoc={isMultiDoc} />
      )}
    </div>
  );
}

