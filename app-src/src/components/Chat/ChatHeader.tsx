/**
 * ChatHeader - Main header component for chat page
 * Combines OwnerLogo, DocumentTitle, PubMedButton, UserMenu, and DocumentSelector
 * Ported from vanilla JS header implementation
 */

import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { OwnerLogo } from './OwnerLogo';
import { DocumentTitle } from './DocumentTitle';
import { PubMedButton } from './PubMedButton';
import { CombinedHeaderMenu } from './CombinedHeaderMenu';
import { useDocumentConfig } from '@/hooks/useDocumentConfig';

interface ChatHeaderProps {
  documentSlug: string | null;
}

// Helper component to render subtitle (category/date) for mobile
function DocumentSubtitle({ documentSlug }: { documentSlug: string | null }) {
  const { config } = useDocumentConfig(documentSlug || '');
  const [searchParams] = useSearchParams();
  
  if (!config) return null;
  
  // Check if this is actually a multi-document search
  const docParam = searchParams.get('doc');
  const isMultiDocSearch = docParam?.includes('+');
  
  if (isMultiDocSearch) {
    const docCount = docParam?.split('+').filter(Boolean).length || 0;
    return (
      <p className="text-xs text-gray-600 font-medium tracking-wide truncate">
        Multi-document search across {docCount} document{docCount !== 1 ? 's' : ''}
      </p>
    );
  }
  
  // Build category and year with icons
  const subtitleParts: React.ReactNode[] = [];
  
  if (config.category) {
    subtitleParts.push(
      <span key="category" className="flex items-center gap-0.5">
        <svg 
          className="w-2.5 h-2.5 text-gray-500 flex-shrink-0" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
        <span className="truncate">{config.category}</span>
      </span>
    );
  }
  
  if (config.year) {
    subtitleParts.push(
      <span key="year" className="flex items-center gap-0.5">
        <svg 
          className="w-2.5 h-2.5 text-gray-500 flex-shrink-0" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        <span className="truncate">{config.year}</span>
      </span>
    );
  }
  
  if (subtitleParts.length === 0) {
    if (config.subtitle) {
      return (
        <p className="text-xs text-gray-600 font-medium tracking-wide truncate">
          {config.subtitle}
        </p>
      );
    }
    return null;
  }
  
  return (
    <div className="flex items-center gap-1 truncate text-xs text-gray-600 font-medium tracking-wide">
      {subtitleParts.map((part, index) => (
        <React.Fragment key={index}>
          {part}
          {index < subtitleParts.length - 1 && (
            <span className="text-gray-300 font-light mx-0.5 flex-shrink-0">|</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

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

      {/* Mobile: OPTION 1 - Single row with truncated title (most compact) */}
      {/* Logo (left) | Title (center, truncated) | Hamburger (right) */}
      {/* Commented out - using Option 2 instead */}
      {/* 
      <div className="md:hidden flex items-center justify-between gap-2">
        <div className="flex-shrink-0">
          <OwnerLogo ownerSlug={logoOwnerSlug} />
        </div>
        <div className="flex-1 min-w-0 px-2">
          <div className="flex flex-col items-center justify-center min-w-0">
            <DocumentTitle 
              documentSlug={documentSlug} 
              ownerSlug={ownerModeSlug}
              pubmedButton={hasPubMed && pubmedId ? <PubMedButton pmid={pubmedId} /> : undefined}
            />
          </div>
        </div>
        <div className="flex-shrink-0">
          <CombinedHeaderMenu
            documentSlug={documentSlug || ''}
            ownerSlug={ownerModeSlug}
            shouldShowDocumentSelector={shouldShowDocumentSelector}
          />
        </div>
      </div>
      */}

      {/* Mobile: OPTION 2 - Title-first approach (title on top row) */}
      {/* ACTIVE: Title on top (centered), Logo + Category/Date + Hamburger on bottom row */}
      <div className="md:hidden flex flex-col gap-1.5">
        <div className="flex items-center justify-center w-full min-w-0">
          <DocumentTitle 
            documentSlug={documentSlug} 
            ownerSlug={ownerModeSlug}
            pubmedButton={hasPubMed && pubmedId ? <PubMedButton pmid={pubmedId} /> : undefined}
            showSubtitle={false}
          />
        </div>
        <div className="flex items-center justify-between w-full gap-2">
          <div className="flex-shrink-0">
            <OwnerLogo ownerSlug={logoOwnerSlug} />
          </div>
          <div className="flex-1 min-w-0 flex items-center justify-center px-2">
            <DocumentSubtitle documentSlug={documentSlug} />
          </div>
          <div className="flex-shrink-0">
            <CombinedHeaderMenu
              documentSlug={documentSlug || ''}
              ownerSlug={ownerModeSlug}
              shouldShowDocumentSelector={shouldShowDocumentSelector}
            />
          </div>
        </div>
      </div>

      {/* Mobile: OPTION 3 - Logo + Title side-by-side (logo smaller) */}
      {/* Uncomment this and comment out Option 1 to use: */}
      {/* 
      <div className="md:hidden flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex-shrink-0">
            <OwnerLogo ownerSlug={logoOwnerSlug} />
          </div>
          <div className="flex-1 min-w-0">
            <DocumentTitle 
              documentSlug={documentSlug} 
              ownerSlug={ownerModeSlug}
              pubmedButton={hasPubMed && pubmedId ? <PubMedButton pmid={pubmedId} /> : undefined}
            />
          </div>
        </div>
        <div className="flex-shrink-0">
          <CombinedHeaderMenu
            documentSlug={documentSlug || ''}
            ownerSlug={ownerModeSlug}
            shouldShowDocumentSelector={shouldShowDocumentSelector}
          />
        </div>
      </div>
      */}

      {/* Mobile: OPTION 4 - Compact with smaller logo above title */}
      {/* Uncomment this and comment out Option 1 to use: */}
      {/* 
      <div className="md:hidden flex flex-col gap-1.5">
        <div className="flex items-center justify-between w-full">
          <div className="flex-shrink-0 scale-75 origin-left">
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
        <div className="flex items-center justify-center w-full min-w-0 -mt-1">
          <DocumentTitle 
            documentSlug={documentSlug} 
            ownerSlug={ownerModeSlug}
            pubmedButton={hasPubMed && pubmedId ? <PubMedButton pmid={pubmedId} /> : undefined}
          />
        </div>
      </div>
      */}
    </header>
  );
}
