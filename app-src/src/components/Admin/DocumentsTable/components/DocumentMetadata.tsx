import React from 'react';
import type { DocumentWithOwner } from '@/types/admin';

interface DocumentMetadataProps {
  doc: DocumentWithOwner;
}

export function DocumentMetadata({ doc }: DocumentMetadataProps) {
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
  
  return <>{parts}</>;
}

