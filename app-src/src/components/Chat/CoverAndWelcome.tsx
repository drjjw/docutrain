/**
 * CoverAndWelcome - Combined cover image and welcome message layout
 * Matches vanilla JS document-cover-and-welcome container
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { CoverImage } from './CoverImage';
import { WelcomeMessage } from './WelcomeMessage';
import { useCanEditDocument } from '@/hooks/useCanEditDocument';
import { Keyword, Download } from '@/hooks/useDocumentConfig';
import { debugLog } from '@/utils/debug';

interface CoverAndWelcomeProps {
  cover?: string;
  title: string;
  category?: string;
  year?: string;
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
 * Equalize container heights on desktop (matching vanilla JS)
 * Only on desktop - mobile uses natural heights
 */
function equalizeContainerHeights() {
  const coverSection = document.querySelector('.document-cover-section');
  const welcomeSection = document.querySelector('.welcome-message-section');
  
  if (!coverSection || !welcomeSection) return;
  
  // Only equalize on desktop (> 768px) - mobile uses vertical stacking
  const isMobile = window.innerWidth <= 768;
  
  if (isMobile) {
    // Reset heights on mobile to allow natural sizing
    (coverSection as HTMLElement).style.height = '';
    (welcomeSection as HTMLElement).style.height = '';
    return;
  }
  
  // Desktop: Reset any previously set heights
  (coverSection as HTMLElement).style.height = '';
  (welcomeSection as HTMLElement).style.height = '';
  
  // Get natural heights
  const coverHeight = (coverSection as HTMLElement).offsetHeight;
  const welcomeHeight = (welcomeSection as HTMLElement).offsetHeight;
  
  // Set both to the maximum height
  const maxHeight = Math.max(coverHeight, welcomeHeight);
  if (maxHeight > 0) {
    (coverSection as HTMLElement).style.height = `${maxHeight}px`;
    (welcomeSection as HTMLElement).style.height = `${maxHeight}px`;
  }
}

/**
 * Save document field via API (same pattern as WelcomeMessage)
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

export function CoverAndWelcome({
  cover,
  title,
  category,
  year,
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
}: CoverAndWelcomeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { canEdit } = useCanEditDocument(documentSlug);
  const [refreshKey, setRefreshKey] = useState(0);

  // Handle cover image save
  const handleCoverSave = useCallback(async (url: string) => {
    debugLog(`[CoverAndWelcome] Saving cover for document: ${documentSlug}`);
    const success = await saveDocumentField(documentSlug, 'cover', url);
    if (success) {
      debugLog(`[CoverAndWelcome] ✅ Cover save successful, dispatching document-updated event`);
      // Force refresh by updating key
      setRefreshKey(prev => prev + 1);
      // Dispatch event immediately to trigger local refresh
      window.dispatchEvent(new CustomEvent('document-updated', {
        detail: { documentSlug }
      }));
      debugLog(`[CoverAndWelcome] Event dispatched for slug: ${documentSlug}`);
    } else {
      console.error(`[CoverAndWelcome] ❌ Cover save failed`);
    }
    return success;
  }, [documentSlug]);

  // Equalize heights after render and on window resize/orientation change
  useEffect(() => {
    // Equalize after initial render
    const timeoutId = setTimeout(() => {
      equalizeContainerHeights();
    }, 100);

    // Handle window resize with debounce
    let resizeTimeout: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        equalizeContainerHeights();
      }, 250);
    };

    // Handle orientation change - force immediate recalibration
    const handleOrientationChange = () => {
      // Small delay to allow browser to finish orientation change
      setTimeout(() => {
        equalizeContainerHeights();
        // Force image recalculation by dispatching a resize event
        window.dispatchEvent(new Event('resize'));
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(resizeTimeout);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, [cover, welcomeMessage, introMessage]);

  // Handle image load callback
  const handleImageLoad = () => {
    equalizeContainerHeights();
  };

  return (
    <div ref={containerRef} className="document-cover-and-welcome" id="documentCoverContainer">
      <CoverImage
        cover={cover}
        title={title}
        category={category}
        year={year}
        onImageLoad={handleImageLoad}
        documentSlug={canEdit ? documentSlug : undefined}
        onCoverSave={canEdit ? handleCoverSave : undefined}
      />
      <WelcomeMessage
        welcomeMessage={welcomeMessage}
        introMessage={introMessage}
        documentSlug={documentSlug}
        keywords={keywords}
        downloads={downloads}
        showKeywords={showKeywords}
        showDownloads={showDownloads}
        showQuizzes={showQuizzes}
        inputRef={inputRef}
        onKeywordClick={onKeywordClick}
        onQuizClick={onQuizClick}
      />
    </div>
  );
}

