/**
 * DocumentTitle - Displays document title and subtitle with inline editing
 * Ported from vanilla JS ui-document.js
 */

import React, { useState, useCallback } from 'react';
import { useDocumentConfig } from '@/hooks/useDocumentConfig';
import { useOwnerLogo } from '@/hooks/useOwnerLogo';
import { useSearchParams } from 'react-router-dom';
import { useCanEditDocument } from '@/hooks/useCanEditDocument';
import { InlineEditor } from './InlineEditor';
import { clearAllDocumentCaches } from '@/services/documentApi';

interface DocumentTitleProps {
  documentSlug: string | null;
  ownerSlug?: string | null;
}

/**
 * Save document field via API
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

  // Clear all document cache keys (including versioned ones)
  clearAllDocumentCaches();

  return true;
}

export function DocumentTitle({ documentSlug, ownerSlug }: DocumentTitleProps) {
  const { config, loading } = useDocumentConfig(documentSlug || '');
  const { config: ownerConfig } = useOwnerLogo(ownerSlug);
  const [searchParams] = useSearchParams();
  const { canEdit } = useCanEditDocument(documentSlug || '');
  const [refreshKey, setRefreshKey] = useState(0);

  // Force refresh of document config after save
  const handleSave = useCallback(async (field: string, value: string) => {
    if (!documentSlug) return false;
    const success = await saveDocumentField(documentSlug, field, value);
    if (success) {
      // Force refresh by updating key
      setRefreshKey(prev => prev + 1);
      // Add a small delay before refetching to ensure backend cache refresh completes
      // The PUT endpoint refreshes cache, and DB trigger also fires async, so we wait a bit
      setTimeout(() => {
        // Trigger a manual cache clear and refetch
        window.dispatchEvent(new Event('document-updated'));
      }, 200); // 200ms delay to ensure backend cache refresh completes
    }
    return success;
  }, [documentSlug]);

  // In owner mode (URL has ?owner=), show "{Owner Name} Documents"
  const ownerMode = searchParams.get('owner');
  if (ownerMode && ownerSlug) {
    let ownerDisplayName = ownerSlug.charAt(0).toUpperCase() + ownerSlug.slice(1);
    
    if (ownerConfig) {
      ownerDisplayName = ownerConfig.alt || ownerConfig.name || ownerDisplayName;
    }
    
    // Special handling for known owners
    if (ownerSlug === 'ukidney' && ownerDisplayName === 'UKidney') {
      ownerDisplayName = 'UKidney Medical';
    }
    
    return (
      <div className="flex flex-col items-center justify-center flex-1 min-w-0 text-center w-full">
        <div className="flex items-center justify-center gap-2 md:gap-3 w-full">
          <h1 className="m-0 text-sm md:text-2xl font-semibold text-gray-900 line-clamp-2 md:line-clamp-none leading-tight md:leading-normal"
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {ownerDisplayName} Documents
          </h1>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 min-w-0 text-center w-full">
        <h1 className="m-0 text-sm md:text-2xl font-semibold text-gray-400 animate-pulse line-clamp-2 md:line-clamp-none leading-tight md:leading-normal"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          Loading...
        </h1>
      </div>
    );
  }

  if (!config) {
    // Don't show "Document Not Found" - just return empty or loading state
    return (
      <div className="flex flex-col items-center justify-center flex-1 min-w-0 text-center w-full">
        <h1 className="m-0 text-sm md:text-2xl font-semibold text-gray-400 line-clamp-2 md:line-clamp-none leading-tight md:leading-normal"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          Loading...
        </h1>
      </div>
    );
  }

  // Build subtitle with Category | Year format with icons (same as vanilla JS)
  // For multi-doc, show document count
  let subtitleContent: React.ReactNode = null;
  
  if (config.showDocumentSelector) {
    // Multi-doc mode - show document count
    // TODO: Get actual count when multi-doc is implemented
    subtitleContent = (
      <p className="text-xs md:text-base text-gray-600 font-medium tracking-wide truncate max-w-full">
          Multi-document search
      </p>
    );
  } else if (config.category || config.year) {
    // Single document - show category and year with icons
    const subtitleParts: React.ReactNode[] = [];
    
    if (config.category) {
      subtitleParts.push(
        <span key="category" className="flex items-center gap-0.5 md:gap-1">
          <svg 
            className="w-2.5 h-2.5 md:w-3.5 md:h-3.5 text-gray-500 flex-shrink-0" 
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
        <span key="year" className="flex items-center gap-0.5 md:gap-1">
          <svg 
            className="w-2.5 h-2.5 md:w-3.5 md:h-3.5 text-gray-500 flex-shrink-0" 
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
    
    if (subtitleParts.length > 0) {
      subtitleContent = (
        <div className="text-xs md:text-base text-gray-600 mt-0.5 md:mt-1 font-medium tracking-wide overflow-hidden flex items-center justify-center gap-1 md:gap-2 max-w-full">
          <div className="flex items-center gap-1 md:gap-2 truncate">
            {subtitleParts.map((part, index) => (
              <React.Fragment key={index}>
                {part}
                {index < subtitleParts.length - 1 && (
                  <span className="text-gray-300 font-light mx-0.5 md:mx-1 flex-shrink-0">|</span>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      );
    }
  } else if (config.subtitle) {
    // Fallback to original subtitle if no category/year
    subtitleContent = (
      <div className="text-xs md:text-base text-gray-600 mt-0.5 md:mt-1 font-medium tracking-wide overflow-hidden flex items-center justify-center gap-1 md:gap-2 max-w-full">
        {canEdit ? (
          <InlineEditor
            id="headerSubtitle"
            value={config.subtitle}
            field="subtitle"
            documentSlug={documentSlug}
            onSave={(value) => handleSave('subtitle', value)}
            className="text-xs md:text-base text-gray-600 font-medium tracking-wide truncate"
          />
        ) : (
          <p className="text-xs md:text-base text-gray-600 font-medium tracking-wide truncate max-w-full">{config.subtitle}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center flex-1 min-w-0 text-center w-full">
      {/* Title with smart multi-line wrapping - shows 2 lines on mobile, full on desktop */}
      <div className="flex items-center justify-center gap-2 md:gap-3 w-full min-w-0">
        {canEdit ? (
          <InlineEditor
            id="headerTitle"
            value={config.title}
            field="title"
            documentSlug={documentSlug}
            onSave={(value) => handleSave('title', value)}
            className="m-0 text-sm md:text-2xl font-semibold text-gray-900 w-full min-w-0
              leading-tight md:leading-normal
              text-center
              mobile-title-clamp"
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              wordBreak: 'break-word',
            }}
          />
        ) : (
          <h1 
            className="m-0 text-sm md:text-2xl font-semibold text-gray-900 w-full min-w-0
              leading-tight md:leading-normal
              text-center
              mobile-title-clamp"
            title={config.title}
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              wordBreak: 'break-word',
            }}
          >
            {config.title}
          </h1>
        )}
      </div>
      {subtitleContent && (
        <div className="w-full min-w-0 overflow-hidden mt-0.5">
          {subtitleContent}
        </div>
      )}
      
      {/* Mobile-only line clamp styling */}
      <style>{`
        @media (max-width: 768px) {
          .mobile-title-clamp {
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            text-overflow: ellipsis;
            word-break: break-word;
            hyphens: auto;
          }
        }
        @media (min-width: 769px) {
          .mobile-title-clamp {
            display: block;
            -webkit-line-clamp: none;
            overflow: visible;
          }
        }
      `}</style>
    </div>
  );
}
