import React from 'react';
import type { DocumentWithOwner } from '@/types/admin';

interface DocumentMetadataProps {
  doc: DocumentWithOwner;
  copiedSlugId: string | null;
  onCopySlug: (doc: DocumentWithOwner) => void;
}

export function DocumentMetadata({ doc, copiedSlugId, onCopySlug }: DocumentMetadataProps) {
  const parts: React.ReactNode[] = [];
  
  // Add subtitle or year if available (category is shown separately as a badge, NOT in metadata)
  // Check for both null and empty string to avoid showing empty subtitles
  const hasSubtitle = doc.subtitle && doc.subtitle.trim() !== '';
  const hasYear = doc.year && doc.year.toString().trim() !== '';
  
  if (hasSubtitle) {
    parts.push(<span key="subtitle" className="truncate">{doc.subtitle}</span>);
  } else if (hasYear) {
    // Only show year in metadata, not category (category has its own badge column)
    parts.push(<span key="year" className="truncate">{doc.year}</span>);
  }
  
  // Always show slug with copy button
  const hasOtherContent = parts.length > 0;
  parts.push(
    <div key="slug" className="flex items-center gap-1.5 min-w-0 flex-shrink-0 max-w-full">
      {hasOtherContent && <span className="text-gray-300 mx-1 flex-shrink-0">•</span>}
      <span className="text-gray-400 flex-shrink-0">slug:</span>
      <span className="truncate max-w-[120px]">{doc.slug}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onCopySlug(doc);
        }}
        className="flex-shrink-0 p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
        title="Copy slug"
      >
        {copiedSlugId === doc.id ? (
          <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        )}
      </button>
    </div>
  );
  
  return <>{parts}</>;
}

