import React from 'react';
import type { DocumentWithOwner } from '@/types/admin';
import { VisibilityBadge } from './VisibilityBadge';
import { DocumentActionButtons } from './DocumentActionButtons';
import { DocumentMetadata } from './DocumentMetadata';

interface DocumentCardProps {
  doc: DocumentWithOwner;
  isSelected: boolean;
  isUpdating: boolean;
  copiedDocId: string | null;
  copiedSlugId: string | null;
  hasDownload: boolean;
  onToggleSelection: (docId: string) => void;
  onCopySlug: (doc: DocumentWithOwner) => void;
  onToggleActive: (doc: DocumentWithOwner, newActive: boolean) => void;
  onView: (slug: string) => void;
  onDownload: (doc: DocumentWithOwner) => void;
  onCopyLink: (doc: DocumentWithOwner) => void;
  onViewAnalytics: (doc: DocumentWithOwner) => void;
  onEdit: (doc: DocumentWithOwner) => void;
  onDelete: (doc: DocumentWithOwner) => void;
}

export function DocumentCard({
  doc,
  isSelected,
  isUpdating,
  copiedDocId,
  copiedSlugId,
  hasDownload,
  onToggleSelection,
  onCopySlug,
  onToggleActive,
  onView,
  onDownload,
  onCopyLink,
  onViewAnalytics,
  onEdit,
  onDelete,
}: DocumentCardProps) {
  return (
    <div className="bg-white/90 backdrop-blur-sm border border-gray-200/60 rounded-xl hover:shadow-lg hover:border-gray-300 transition-all duration-300 hover:-translate-y-0.5">
      <div className="lg:hidden p-5 space-y-4">
        {/* Header: Checkbox, Icon, Title */}
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelection(doc.id)}
            className="w-4 h-4 mt-1 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          />
          
          {/* Icon */}
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0 shadow-sm">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          
          {/* Title and Metadata */}
          <div className="flex-1 min-w-0">
            <div className="font-bold text-gray-900 text-base break-words mb-1" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
              {doc.title || 'Untitled Document'}
            </div>
            <div className="text-sm text-gray-500 font-medium flex items-center gap-1.5 min-w-0 flex-wrap">
              <DocumentMetadata doc={doc} copiedSlugId={copiedSlugId} onCopySlug={onCopySlug} />
            </div>
          </div>
        </div>

        {/* Badges: Visibility and Category */}
        <div className="flex flex-wrap gap-2">
          <VisibilityBadge accessLevel={doc.access_level || 'public'} />
          {doc.category && (
            <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200/50 shadow-sm">
              {doc.category}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="pt-2 border-t border-gray-200">
          <DocumentActionButtons
            doc={doc}
            isMobile={true}
            isUpdating={isUpdating}
            copiedDocId={copiedDocId}
            hasDownload={hasDownload}
            onToggleActive={onToggleActive}
            onView={onView}
            onDownload={onDownload}
            onCopyLink={onCopyLink}
            onViewAnalytics={onViewAnalytics}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </div>
      </div>
    </div>
  );
}

