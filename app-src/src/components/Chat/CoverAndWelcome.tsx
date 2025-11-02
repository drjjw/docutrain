/**
 * CoverAndWelcome - Combined cover image and welcome message layout
 * Matches vanilla JS document-cover-and-welcome container
 */

import { useEffect, useRef } from 'react';
import { CoverImage } from './CoverImage';
import { WelcomeMessage } from './WelcomeMessage';

interface CoverAndWelcomeProps {
  cover?: string;
  title: string;
  category?: string;
  year?: string;
  welcomeMessage: string;
  introMessage?: string | null;
  documentSlug: string;
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

export function CoverAndWelcome({
  cover,
  title,
  category,
  year,
  welcomeMessage,
  introMessage,
  documentSlug,
}: CoverAndWelcomeProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Equalize heights after render and on window resize
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

    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(resizeTimeout);
      window.removeEventListener('resize', handleResize);
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
      />
      <WelcomeMessage
        welcomeMessage={welcomeMessage}
        introMessage={introMessage}
        documentSlug={documentSlug}
      />
    </div>
  );
}

