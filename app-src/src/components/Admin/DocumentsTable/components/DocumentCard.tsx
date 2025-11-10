import React from 'react';
import type { DocumentWithOwner, Owner } from '@/types/admin';
import { VisibilityBadge } from './VisibilityBadge';
import { DocumentActionButtons } from './DocumentActionButtons';
import { DocumentMetadata } from './DocumentMetadata';
import { InlineEditableVisibility } from './InlineEditableVisibility';
import { InlineEditableCategory } from './InlineEditableCategory';
import { InlineEditableOwner } from './InlineEditableOwner';
import { InlineEditableTitle } from './InlineEditableTitle';

interface DocumentCardProps {
  doc: DocumentWithOwner;
  isSelected: boolean;
  isUpdating: boolean;
  copiedDocId: string | null;
  copiedSlugId: string | null;
  hasDownload: boolean;
  owners?: Owner[];
  isSuperAdmin?: boolean;
  onToggleSelection: (docId: string) => void;
  onCopySlug: (doc: DocumentWithOwner) => void;
  onToggleActive: (doc: DocumentWithOwner, newActive: boolean) => void;
  onView: (slug: string) => void;
  onDownload: (doc: DocumentWithOwner) => void;
  onCopyLink: (doc: DocumentWithOwner) => void;
  onViewAnalytics: (doc: DocumentWithOwner) => void;
  onEdit: (doc: DocumentWithOwner) => void;
  onDelete: (doc: DocumentWithOwner) => void;
  onUpdateVisibility?: (doc: DocumentWithOwner, newAccessLevel: string) => Promise<void>;
  onUpdateCategory?: (doc: DocumentWithOwner, newCategory: string | null) => Promise<void>;
  onUpdateOwner?: (doc: DocumentWithOwner, newOwnerId: string | null) => Promise<void>;
  onUpdateTitle?: (doc: DocumentWithOwner, newTitle: string) => Promise<void>;
}

export function DocumentCard({
  doc,
  isSelected,
  isUpdating,
  copiedDocId,
  copiedSlugId,
  hasDownload,
  owners = [],
  isSuperAdmin = false,
  onToggleSelection,
  onCopySlug,
  onToggleActive,
  onView,
  onDownload,
  onCopyLink,
  onViewAnalytics,
  onEdit,
  onDelete,
  onUpdateVisibility,
  onUpdateCategory,
  onUpdateOwner,
  onUpdateTitle,
}: DocumentCardProps) {
  const handleCardClick = (e: React.MouseEvent) => {
    // Don't toggle if clicking on action buttons, editable components, or their children
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('select') ||
      target.closest('input[type="text"]') ||
      target.closest('[title*="edit"]') ||
      target.closest('[title*="Click"]') ||
      target.closest('.downloads-keywords-drawer-trigger')
    ) {
      return;
    }
    onToggleSelection(doc.id);
  };

  return (
    <div
      onClick={handleCardClick}
      className={`lg:hidden bg-white/90 backdrop-blur-sm rounded-xl hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 cursor-pointer relative ${
        isSelected
          ? 'border-2 border-docutrain-light shadow-md bg-docutrain-light/5'
          : 'border border-gray-200/60 hover:border-gray-300'
      }`}
    >
      {/* Selection Indicator - Top Right */}
      <div className="absolute top-3 right-3 z-10">
        {isSelected ? (
          <div className="w-6 h-6 rounded-full bg-docutrain-light border-2 border-docutrain-light flex items-center justify-center shadow-sm">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        ) : (
          <div className="w-6 h-6 rounded-full border-2 border-gray-300 bg-white shadow-sm"></div>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* Header: Icon, Title */}
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="w-10 h-10 rounded-xl bg-docutrain-light/10 flex items-center justify-center flex-shrink-0 shadow-sm">
            <svg className="w-5 h-5 text-docutrain-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          
          {/* Title and Metadata */}
          <div className="flex-1 min-w-0 pr-8" onClick={(e) => e.stopPropagation()}>
            {onUpdateTitle ? (
              <InlineEditableTitle
                title={doc.title || 'Untitled Document'}
                isUpdating={isUpdating}
                onUpdate={(newTitle) => onUpdateTitle(doc, newTitle)}
              />
            ) : (
              <div className="font-bold text-gray-900 text-base break-words mb-1" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                {doc.title || 'Untitled Document'}
              </div>
            )}
            <div className="text-sm text-gray-500 font-medium flex items-center gap-1.5 min-w-0 flex-wrap">
              <DocumentMetadata doc={doc} />
            </div>
          </div>
        </div>

        {/* Badges: Visibility, Category, and Owner */}
        <div className="grid grid-cols-3 gap-2 items-stretch" onClick={(e) => e.stopPropagation()}>
          {onUpdateVisibility ? (
            <div className="flex items-center justify-center">
              <InlineEditableVisibility
                accessLevel={doc.access_level || 'public'}
                isUpdating={isUpdating}
                onUpdate={(newAccessLevel) => onUpdateVisibility(doc, newAccessLevel)}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <VisibilityBadge accessLevel={doc.access_level || 'public'} />
            </div>
          )}
          {onUpdateCategory ? (
            <div className="flex items-center justify-center">
              <InlineEditableCategory
                categoryObj={doc.category_obj}
                isUpdating={isUpdating}
                onUpdate={(newCategory) => onUpdateCategory(doc, newCategory)}
                owner={doc.owners || null}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center">
              {doc.category_obj?.name ? (
                <span className="inline-flex items-center justify-center px-2 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200/50 shadow-sm">
                  {doc.category_obj.name}
                </span>
              ) : (
                <span className="inline-flex items-center justify-center px-2 py-1.5 rounded-lg text-xs font-semibold bg-gray-50 text-gray-400 border border-gray-200/50 shadow-sm">
                  (None)
                </span>
              )}
            </div>
          )}
          {isSuperAdmin && onUpdateOwner ? (
            <div className="flex items-center justify-center">
              <InlineEditableOwner
                owner={doc.owners || null}
                owners={owners}
                isUpdating={isUpdating}
                onUpdate={(newOwnerId) => onUpdateOwner(doc, newOwnerId)}
              />
            </div>
          ) : isSuperAdmin ? (
            <div className="flex items-center justify-center">
              {doc.owners ? (
                <span className="inline-flex items-center justify-center px-2 py-1.5 rounded-lg text-xs font-semibold bg-docutrain-light/10 text-docutrain-dark border border-docutrain-light/30 shadow-sm">
                  {doc.owners.name}
                </span>
              ) : (
                <span className="inline-flex items-center justify-center px-2 py-1.5 rounded-lg text-xs font-semibold bg-gray-50 text-gray-400 border border-gray-200/50 shadow-sm">
                  (None)
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center"></div>
          )}
        </div>

        {/* Actions */}
        <div className="pt-2 border-t border-gray-200" onClick={(e) => e.stopPropagation()}>
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

