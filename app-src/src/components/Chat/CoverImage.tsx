/**
 * CoverImage - Displays document cover image with overlay showing title and metadata
 * Matches vanilla JS implementation from ui-document.js
 */

import { useEffect, useRef } from 'react';
import { InlineImageEditor } from './InlineImageEditor';
import { useCanEditDocument } from '@/hooks/useCanEditDocument';

interface CoverImageProps {
  cover?: string;
  title: string;
  category?: string;
  year?: string;
  onImageLoad?: () => void;
  documentSlug?: string;
  onCoverSave?: (url: string) => Promise<boolean>;
}

export function CoverImage({ cover, title, category, year, onImageLoad, documentSlug, onCoverSave }: CoverImageProps) {
  const coverSectionRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Determine image source - use cover if available, otherwise placeholder
  const hasValidCover = cover && typeof cover === 'string' && cover.trim().length > 0;
  // Use WebP placeholder - works via proxy in dev, Express serves in prod
  const placeholderPath = '/Docutrain-Intro-Image.webp';
  const imageSrc = hasValidCover ? cover.trim() : placeholderPath;
  const imageAlt = hasValidCover ? `${title} - Title Slide` : `${title} - Cover Placeholder`;

  // Build meta text (category and year) - matches vanilla JS format
  const metaParts: string[] = [];
  if (category) metaParts.push(category);
  if (year) metaParts.push(year);
  const metaText = metaParts.length > 0 ? metaParts.join(' | ') : undefined;

  // Handle image load event and orientation changes
  useEffect(() => {
    const img = imageRef.current;
    const container = coverSectionRef.current;
    if (!img || !container) return;

    const handleLoad = () => {
      // Equalize heights on desktop (matching vanilla JS equalizeContainerHeights)
      if (onImageLoad) {
        onImageLoad();
      }
    };

    // Force image recalibration on orientation change
    // Some devices fire 'orientationchange', others fire 'resize' - handle both
    let recalibrationTimeout: NodeJS.Timeout;
    const forceRecalibration = () => {
      clearTimeout(recalibrationTimeout);
      recalibrationTimeout = setTimeout(() => {
        // Force browser to recalculate image dimensions by:
        // 1. Temporarily changing object-fit to let browser recalculate natural size
        // 2. Then restoring it to trigger proper scaling
        const originalObjectFit = img.style.objectFit;
        img.style.objectFit = 'contain';
        // Force reflow
        void img.offsetHeight;
        // Restore original object-fit (from CSS class)
        img.style.objectFit = '';
        // Trigger container height recalculation
        if (onImageLoad) {
          onImageLoad();
        }
      }, 150);
    };

    img.addEventListener('load', handleLoad);
    window.addEventListener('orientationchange', forceRecalibration);
    
    return () => {
      clearTimeout(recalibrationTimeout);
      img.removeEventListener('load', handleLoad);
      window.removeEventListener('orientationchange', forceRecalibration);
    };
  }, [onImageLoad]);

  // Check if user can edit (only if documentSlug and onCoverSave are provided)
  const canEdit = documentSlug && onCoverSave;
  const { canEdit: hasEditPermission } = useCanEditDocument(canEdit ? documentSlug : null);

  const imageElement = (
    <>
      <img
        ref={imageRef}
        src={imageSrc}
        alt={imageAlt}
        className="document-cover-image"
        loading="lazy"
        onError={(e) => {
          console.error(`❌ Cover image failed to load: ${imageSrc}`);
        }}
      />
      <div className="document-cover-overlay">
        <div className="document-cover-title" title={title}>{title}</div>
        {metaText && (
          <div className="document-cover-meta">{metaText}</div>
        )}
      </div>
    </>
  );

  return (
    <div ref={coverSectionRef} className="document-cover-section">
      {canEdit && hasEditPermission ? (
        <InlineImageEditor
          coverUrl={cover}
          documentSlug={documentSlug!}
          onSave={onCoverSave!}
        >
          {imageElement}
        </InlineImageEditor>
      ) : (
        imageElement
      )}
    </div>
  );
}

