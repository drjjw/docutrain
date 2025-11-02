/**
 * ChatHeader - Main header component for chat page
 * Combines OwnerLogo, DocumentTitle, PubMedButton, UserMenu, and DocumentSelector
 * Ported from vanilla JS header implementation
 */

import { useSearchParams } from 'react-router-dom';
import { OwnerLogo } from './OwnerLogo';
import { DocumentTitle } from './DocumentTitle';
import { PubMedButton } from './PubMedButton';
import { CombinedHeaderMenu } from './CombinedHeaderMenu';
import { useDocumentConfig } from '@/hooks/useDocumentConfig';

interface ChatHeaderProps {
  documentSlug: string | null;
}

export function ChatHeader({ documentSlug }: ChatHeaderProps) {
  const [searchParams] = useSearchParams();
  const { config: docConfig } = useDocumentConfig(documentSlug || '');
  
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
  const shouldShowDocumentSelector = 
    documentSelectorParam === 'true' || 
    (!!ownerModeSlug && !docParam) || // Owner mode with no doc: show selector
    (docConfig?.showDocumentSelector !== false); // Default to true if not explicitly false
  // NOTE: When no doc param and no owner param, DocumentOwnerModal shows instead, not DocumentSelector

  // In owner mode, show owner from URL. Otherwise, show owner from document
  const logoOwnerSlug = ownerModeSlug || documentOwnerSlug;

  return (
    <header 
      className="fixed top-0 left-0 right-0 text-gray-900 border-b border-gray-200 z-[100]
        py-3 md:py-6 px-4 md:px-6
        overflow-hidden"
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)'
      }}
    >
      {/* Desktop: Single row layout */}
      <div className="hidden md:flex items-center justify-between gap-4">
        <div className="flex-shrink-0">
          <OwnerLogo ownerSlug={logoOwnerSlug} />
        </div>
        <div className="flex flex-col items-center justify-center flex-1 min-w-0 text-center px-4">
          <DocumentTitle 
            documentSlug={documentSlug} 
            ownerSlug={ownerModeSlug}
            pubmedButton={hasPubMed && pubmedId ? <PubMedButton pmid={pubmedId} /> : undefined}
          />
        </div>
        <div className="flex-shrink-0">
          <CombinedHeaderMenu
            documentSlug={documentSlug || ''}
            ownerSlug={ownerModeSlug}
            shouldShowDocumentSelector={shouldShowDocumentSelector}
          />
        </div>
      </div>

      {/* Mobile: Two-row layout - Row 1: Logo + Menu, Row 2: Title */}
      <div className="md:hidden flex flex-col gap-2">
        {/* Row 1: Logo and Menu */}
        <div className="flex items-center justify-between w-full">
          <div className="flex-shrink-0">
            <OwnerLogo ownerSlug={logoOwnerSlug} />
          </div>
          <div className="flex-shrink-0">
            <CombinedHeaderMenu
              documentSlug={documentSlug || ''}
              ownerSlug={ownerModeSlug}
              shouldShowDocumentSelector={shouldShowDocumentSelector}
            />
          </div>
        </div>

        {/* Row 2: Title - Full width, centered */}
        <div className="flex flex-col items-center justify-center w-full min-w-0">
          <DocumentTitle 
            documentSlug={documentSlug} 
            ownerSlug={ownerModeSlug}
            pubmedButton={hasPubMed && pubmedId ? <PubMedButton pmid={pubmedId} /> : undefined}
          />
        </div>
      </div>
    </header>
  );
}
