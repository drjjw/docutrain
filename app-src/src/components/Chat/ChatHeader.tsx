/**
 * ChatHeader - Main header component for chat page
 * Combines OwnerLogo, DocumentTitle, PubMedButton, UserMenu, and DocumentSelector
 * Ported from vanilla JS header implementation
 */

import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { OwnerLogo } from './OwnerLogo';
import { DocumentTitle } from './DocumentTitle';
import { PubMedButton } from './PubMedButton';
import { CombinedHeaderMenu } from './CombinedHeaderMenu';
import { useDocumentConfig } from '@/hooks/useDocumentConfig';
import { useAuth } from '@/hooks/useAuth';

interface ChatHeaderProps {
  documentSlug: string | null;
  hasAuthError?: boolean;
  onSubtitlePresence?: (hasSubtitle: boolean) => void;
}

export function ChatHeader({ documentSlug, hasAuthError = false, onSubtitlePresence }: ChatHeaderProps) {
  const [searchParams] = useSearchParams();
  const { config: docConfig } = useDocumentConfig(documentSlug || '');
  const { user } = useAuth();
  const [hasSubtitle, setHasSubtitle] = useState(false);
  
  // Notify parent component about subtitle presence
  const handleSubtitlePresence = (hasSubtitle: boolean) => {
    setHasSubtitle(hasSubtitle);
    if (onSubtitlePresence) {
      onSubtitlePresence(hasSubtitle);
    }
  };
  
  // Get owner from document config (not URL param) - URL param is for owner mode
  // Document owner is in config.ownerInfo?.slug or config.owner
  const documentOwnerSlug = docConfig?.ownerInfo?.slug || docConfig?.owner || null;
  const ownerModeSlug = searchParams.get('owner'); // This is for owner mode, separate from document owner
  // Check for PubMed ID in multiple possible field names (pmid, pubmed_id, pubmed_pmid, PMID)
  const metadata = docConfig?.metadata || {};
  const pubmedId = metadata.pmid || metadata.pubmed_id || metadata.pubmed_pmid || metadata.PMID;
  const hasPubMed = !!pubmedId;
  
  // Determine if document selector should show (same logic as DocumentSelector)
  // For mobile menu visibility check - actual visibility is managed inside DocumentSelector
  const documentSelectorParam = searchParams.get('document_selector');
  const docParam = searchParams.get('doc');
  const ownerParam = searchParams.get('owner');
  const isModalMode = !!ownerParam && !docParam;
  const shouldShowDocumentSelector = 
    documentSelectorParam === 'true' || 
    (!!ownerModeSlug && !docParam) || // Owner mode with no doc: show selector
    (docConfig?.showDocumentSelector !== false); // Default to true if not explicitly false
  const shouldShowInHeader = shouldShowDocumentSelector && !isModalMode;
  // NOTE: When no doc param and no owner param, DocumentOwnerModal shows instead, not DocumentSelector

  // In owner mode, show owner from URL. Otherwise, show owner from document
  const logoOwnerSlug = ownerModeSlug || documentOwnerSlug;
  
  // Check if CombinedHeaderMenu will show anything on mobile
  // It only shows if there's a user OR document selector
  const hasMobileMenu = !!user || shouldShowInHeader;

  return (
    <header 
      className={`relative md:fixed md:top-0 left-0 right-0 text-gray-900 border-b border-gray-200 z-[100]
        py-3 md:py-6 px-4 md:px-6
        overflow-hidden ${hasSubtitle ? 'has-subtitle' : ''}`}
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)'
      }}
    >
      {/* Desktop: Single row layout */}
      <div className="hidden md:flex items-center gap-4 lg:gap-6">
        <div className="flex-shrink-0 flex justify-start">
          <OwnerLogo ownerSlug={logoOwnerSlug} />
        </div>
        <div className="flex flex-col items-center justify-center min-w-0 flex-1 text-center px-2 md:px-4 lg:px-6 xl:px-8">
          <DocumentTitle 
            documentSlug={documentSlug} 
            ownerSlug={ownerModeSlug}
            pubmedButton={hasPubMed && pubmedId ? <PubMedButton pmid={pubmedId} /> : undefined}
            onSubtitlePresence={handleSubtitlePresence}
          />
        </div>
        <div className="flex-shrink-0 flex justify-end">
          <CombinedHeaderMenu
            documentSlug={documentSlug || ''}
            ownerSlug={ownerModeSlug}
            shouldShowDocumentSelector={shouldShowDocumentSelector}
            hasAuthError={hasAuthError}
          />
        </div>
      </div>

      {/* Mobile: Compact single row layout */}
      {/* Logo (left) | Title (center, truncates) | Hamburger (right) */}
      {/* When no menu: Logo (left) | Title (expanded center) */}
      <div className={`md:hidden flex items-center ${hasMobileMenu ? 'justify-between gap-3' : 'justify-start gap-3'}`}>
        <div className="flex-shrink-0">
          <OwnerLogo ownerSlug={logoOwnerSlug} />
        </div>
        <div className={`${hasMobileMenu ? 'flex-1 min-w-0 px-2' : 'flex-1 min-w-0 px-4'} flex items-center ${hasMobileMenu ? 'justify-center' : 'justify-start'}`}>
          <DocumentTitle 
            documentSlug={documentSlug} 
            ownerSlug={ownerModeSlug}
            pubmedButton={hasPubMed && pubmedId ? <PubMedButton pmid={pubmedId} /> : undefined}
            onSubtitlePresence={handleSubtitlePresence}
          />
        </div>
        {hasMobileMenu && (
          <div className="flex-shrink-0">
            <CombinedHeaderMenu
              documentSlug={documentSlug || ''}
              ownerSlug={ownerModeSlug}
              shouldShowDocumentSelector={shouldShowDocumentSelector}
              hasAuthError={hasAuthError}
            />
          </div>
        )}
      </div>

    </header>
  );
}
