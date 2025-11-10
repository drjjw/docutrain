import React from 'react';
import type { DocumentWithOwner } from '@/types/admin';
import { StatusToggle } from './StatusToggle';
import { VisibilityBadge } from './VisibilityBadge';

interface DocumentActionButtonsProps {
  doc: DocumentWithOwner;
  isMobile: boolean;
  isUpdating: boolean;
  copiedDocId: string | null;
  hasDownload: boolean;
  onToggleActive: (doc: DocumentWithOwner, newActive: boolean) => void;
  onView: (slug: string) => void;
  onDownload: (doc: DocumentWithOwner) => void;
  onCopyLink: (doc: DocumentWithOwner) => void;
  onViewAnalytics: (doc: DocumentWithOwner) => void;
  onEdit: (doc: DocumentWithOwner) => void;
  onDelete: (doc: DocumentWithOwner) => void;
}

export function DocumentActionButtons({
  doc,
  isMobile,
  isUpdating,
  copiedDocId,
  hasDownload,
  onToggleActive,
  onView,
  onDownload,
  onCopyLink,
  onViewAnalytics,
  onEdit,
  onDelete,
}: DocumentActionButtonsProps) {
  const isActive = doc.active ?? false;

  if (isMobile) {
    // Mobile: horizontal layout with icons and text
    return (
      <div className="flex flex-wrap w-full gap-x-2 gap-y-2">
        {/* Enable/Disable Toggle */}
        <div className="flex flex-col items-center gap-1 flex-[1_1_calc(20%-0.4rem)] min-w-0 max-w-[calc(20%-0.4rem)]">
          <div className="flex items-center gap-2 p-2">
            <StatusToggle doc={doc} isUpdating={isUpdating} onToggle={onToggleActive} />
          </div>
          <span className="text-xs text-gray-500">
            {isActive ? 'Enabled' : 'Disabled'}
          </span>
        </div>

        {/* View Button */}
        <button
          onClick={() => onView(doc.slug)}
          className="flex flex-col items-center gap-1 p-2 text-gray-600 hover:text-docutrain-light hover:bg-docutrain-light/10 rounded-lg transition-colors flex-[1_1_calc(20%-0.4rem)] min-w-0 max-w-[calc(20%-0.4rem)]"
          title="View document"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <span className="text-xs text-gray-500">View</span>
        </button>

        {/* Copy Link Button */}
        <button
          onClick={() => onCopyLink(doc)}
          className="flex flex-col items-center gap-1 p-2 text-gray-600 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors flex-[1_1_calc(20%-0.4rem)] min-w-0 max-w-[calc(20%-0.4rem)]"
          title="Copy link"
        >
          {copiedDocId === doc.id ? (
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          )}
          <span className="text-xs text-gray-500">Link</span>
        </button>

        {/* Download PDF Button */}
        {hasDownload && (
          <button
            onClick={() => onDownload(doc)}
            className="flex flex-col items-center gap-1 p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors flex-[1_1_calc(20%-0.4rem)] min-w-0 max-w-[calc(20%-0.4rem)]"
            title={doc.downloads!.length > 1 ? `${doc.downloads!.length} downloads available` : 'Download PDF'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-xs text-gray-500">
              {doc.downloads!.length > 1 ? `PDF (${doc.downloads!.length})` : 'PDF'}
            </span>
          </button>
        )}

        {/* Analytics Button */}
        <button
          onClick={() => onViewAnalytics(doc)}
          className="flex flex-col items-center gap-1 p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors flex-[1_1_calc(20%-0.4rem)] min-w-0 max-w-[calc(20%-0.4rem)]"
          title="View analytics"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="text-xs text-gray-500">Analytics</span>
        </button>

        {/* Edit All Button */}
        <button
          onClick={() => onEdit(doc)}
          className="flex flex-col items-center gap-1 p-2 text-gray-600 hover:text-docutrain-light hover:bg-docutrain-light/10 rounded-lg transition-colors flex-[1_1_calc(20%-0.4rem)] min-w-0 max-w-[calc(20%-0.4rem)]"
          title="Edit all fields"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span className="text-xs text-gray-500">Config</span>
        </button>

        {/* Delete Button */}
        <button
          onClick={() => onDelete(doc)}
          className="flex flex-col items-center gap-1 p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-[1_1_calc(20%-0.4rem)] min-w-0 max-w-[calc(20%-0.4rem)]"
          title="Delete document"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <span className="text-xs text-gray-500">Delete</span>
        </button>
      </div>
    );
  }
  
  // Desktop: original layout
  return (
    <div className="flex items-center gap-3 pl-2">
      {/* Enable/Disable Toggle */}
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-2 p-2.5">
          <StatusToggle doc={doc} isUpdating={isUpdating} onToggle={onToggleActive} />
        </div>
        <span className="text-xs text-gray-500 font-medium">
          {isActive ? 'Enabled' : 'Disabled'}
        </span>
      </div>

      {/* View Button */}
      <div className="flex flex-col items-center gap-1">
        <button
          onClick={() => onView(doc.slug)}
          className="p-2.5 text-gray-400 hover:text-docutrain-light hover:bg-docutrain-light/10 rounded-xl transition-all duration-200 hover:shadow-md hover:scale-110"
          title="View document"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </button>
        <span className="text-xs text-gray-500 font-medium">View</span>
      </div>

      {/* Copy Link Button */}
      <div className="flex flex-col items-center gap-1">
        <button
          onClick={() => onCopyLink(doc)}
          className="p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50/80 rounded-xl transition-all duration-200 hover:shadow-md hover:scale-110"
          title="Copy link"
        >
          {copiedDocId === doc.id ? (
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          )}
        </button>
        <span className="text-xs text-gray-500 font-medium">Link</span>
      </div>

      {/* Download PDF Button */}
      {hasDownload && (
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => onDownload(doc)}
            className="p-2.5 text-gray-400 hover:text-green-600 hover:bg-green-50/80 rounded-xl transition-all duration-200 hover:shadow-md hover:scale-110"
            title={doc.downloads!.length > 1 ? `${doc.downloads!.length} downloads available` : 'Download PDF'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
          <span className="text-xs text-gray-500 font-medium">
            {doc.downloads!.length > 1 ? `PDF (${doc.downloads!.length})` : 'PDF'}
          </span>
        </div>
      )}

      {/* Analytics Button */}
      <div className="flex flex-col items-center gap-1">
        <button
          onClick={() => onViewAnalytics(doc)}
          className="p-2.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50/80 rounded-xl transition-all duration-200 hover:shadow-md hover:scale-110"
          title="View analytics"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </button>
        <span className="text-xs text-gray-500 font-medium">Analytics</span>
      </div>

      {/* Edit All Button */}
      <div className="flex flex-col items-center gap-1">
        <button
          onClick={() => onEdit(doc)}
          className="p-2.5 text-gray-400 hover:text-docutrain-light hover:bg-docutrain-light/10 rounded-xl transition-all duration-200 hover:shadow-md hover:scale-110"
          title="Edit all fields"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <span className="text-xs text-gray-500 font-medium">Config</span>
      </div>

      {/* Delete Button */}
      <div className="flex flex-col items-center gap-1">
        <button
          onClick={() => onDelete(doc)}
          className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50/80 rounded-xl transition-all duration-200 hover:shadow-md hover:scale-110"
          title="Delete document"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
        <span className="text-xs text-gray-500 font-medium">Delete</span>
      </div>
    </div>
  );
}

