import React from 'react';
import type { DocumentWithOwner, Owner } from '@/types/admin';
import { VisibilityBadge } from './VisibilityBadge';
import { DocumentActionButtons } from './DocumentActionButtons';
import { DocumentMetadata } from './DocumentMetadata';
import { InlineEditableVisibility } from './InlineEditableVisibility';
import { InlineEditableCategory } from './InlineEditableCategory';
import { InlineEditableOwner } from './InlineEditableOwner';
import { InlineEditableTitle } from './InlineEditableTitle';

interface DocumentRowProps {
  doc: DocumentWithOwner;
  isSelected: boolean;
  isUpdating: boolean;
  isSuperAdmin: boolean;
  copiedDocId: string | null;
  copiedSlugId: string | null;
  hasDownload: boolean;
  owners: Owner[];
  onToggleSelection: (docId: string) => void;
  onCopySlug: (doc: DocumentWithOwner) => void;
  onToggleActive: (doc: DocumentWithOwner, newActive: boolean) => void;
  onView: (slug: string) => void;
  onDownload: (doc: DocumentWithOwner) => void;
  onCopyLink: (doc: DocumentWithOwner) => void;
  onViewAnalytics: (doc: DocumentWithOwner) => void;
  onEdit: (doc: DocumentWithOwner) => void;
  onDelete: (doc: DocumentWithOwner) => void;
  onUpdateVisibility: (doc: DocumentWithOwner, newAccessLevel: string) => Promise<void>;
  onUpdateCategory: (doc: DocumentWithOwner, newCategory: string | null) => Promise<void>;
  onUpdateOwner: (doc: DocumentWithOwner, newOwnerId: string | null) => Promise<void>;
  onUpdateTitle: (doc: DocumentWithOwner, newTitle: string) => Promise<void>;
}

export function DocumentRow({
  doc,
  isSelected,
  isUpdating,
  isSuperAdmin,
  copiedDocId,
  copiedSlugId,
  hasDownload,
  owners,
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
}: DocumentRowProps) {
  return (
    <div className="hidden lg:block bg-white/90 backdrop-blur-sm border border-gray-200/60 rounded-xl hover:shadow-lg hover:border-gray-300 transition-all duration-300 hover:-translate-y-0.5">
      <div className="flex p-6">
        {/* Checkbox */}
        <div className="flex items-center justify-center w-8 flex-shrink-0 mr-4">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelection(doc.id)}
            className="w-4 h-4 text-docutrain-light bg-gray-100 border-gray-300 rounded focus:ring-docutrain-light focus:ring-2 cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        {/* Document Info */}
        <div className={`${isSuperAdmin ? 'flex-1 min-w-[400px] mr-4' : 'flex-1 min-w-[400px] mr-4'}`}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-docutrain-light/10 flex items-center justify-center flex-shrink-0 shadow-sm">
              <svg className="w-6 h-6 text-docutrain-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <InlineEditableTitle
                title={doc.title || 'Untitled Document'}
                isUpdating={isUpdating}
                onUpdate={(newTitle) => onUpdateTitle(doc, newTitle)}
              />
              <div className="text-sm text-gray-600 font-medium mt-0.5 flex items-center gap-1.5 min-w-0 flex-wrap">
                <DocumentMetadata doc={doc} />
              </div>
            </div>
          </div>
        </div>

        {/* Visibility */}
        <div className="w-28 flex items-center justify-center mr-6 min-w-0">
          <div className="w-full max-w-full">
            <InlineEditableVisibility
              accessLevel={doc.access_level || 'public'}
              isUpdating={isUpdating}
              onUpdate={(newAccessLevel) => onUpdateVisibility(doc, newAccessLevel)}
            />
          </div>
        </div>

        {/* Category */}
        <div className="w-28 flex items-center justify-center mr-6 min-w-0">
          <div className="w-full max-w-full" style={{ textAlign: 'center' }}>
            <InlineEditableCategory
              categoryObj={doc.category_obj}
              isUpdating={isUpdating}
              onUpdate={(newCategory) => onUpdateCategory(doc, newCategory)}
              owner={doc.owners || null}
            />
          </div>
        </div>

        {/* Owner (Super Admin only) */}
        {isSuperAdmin && (
          <div className="w-28 flex items-center justify-center mr-6 min-w-0">
            <div className="w-full max-w-full" style={{ textAlign: 'center' }}>
              <InlineEditableOwner
                owner={doc.owners || null}
                owners={owners}
                isUpdating={isUpdating}
                onUpdate={(newOwnerId) => onUpdateOwner(doc, newOwnerId)}
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex-1 flex justify-center">
          <DocumentActionButtons
            doc={doc}
            isMobile={false}
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

