import React from 'react';
import type { DocumentWithOwner } from '@/types/admin';
import { VisibilityBadge } from './VisibilityBadge';
import { DocumentActionButtons } from './DocumentActionButtons';
import { DocumentMetadata } from './DocumentMetadata';

interface DocumentRowProps {
  doc: DocumentWithOwner;
  isSelected: boolean;
  isUpdating: boolean;
  isSuperAdmin: boolean;
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

export function DocumentRow({
  doc,
  isSelected,
  isUpdating,
  isSuperAdmin,
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
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        {/* Document Info */}
        <div className={`${isSuperAdmin ? 'flex-1 min-w-[400px] mr-4' : 'flex-1 min-w-[400px] mr-4'}`}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0 shadow-sm">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-gray-900 text-base break-words" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                {doc.title || 'Untitled Document'}
              </div>
              <div className="text-sm text-gray-600 font-medium mt-0.5 flex items-center gap-1.5 min-w-0 flex-wrap">
                <DocumentMetadata doc={doc} />
              </div>
            </div>
          </div>
        </div>

        {/* Visibility */}
        <div className="w-24 flex items-center justify-center mr-4">
          <VisibilityBadge accessLevel={doc.access_level || 'public'} />
        </div>

        {/* Category */}
        <div className="w-24 flex items-center justify-center mr-4">
          {doc.category ? (
            <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200/50 shadow-sm">
              {doc.category}
            </span>
          ) : null}
        </div>

        {/* Owner (Super Admin only) */}
        {isSuperAdmin && (
          <div className="w-24 flex items-center justify-center mr-4">
            {doc.owners?.name ? (
              <div className="relative group w-full min-w-0">
                <span
                  className="inline-block px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200 shadow-sm overflow-hidden text-ellipsis whitespace-nowrap w-full text-center"
                >
                  {doc.owners.name}
                </span>
                {/* Tooltip */}
                <div className="absolute left-0 bottom-full mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-50 whitespace-nowrap max-w-xs">
                  {doc.owners.name}
                  <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                </div>
              </div>
            ) : null}
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

