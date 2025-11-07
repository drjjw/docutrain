import React from 'react';
import { FileUploadManager } from '../FileUploadManager';
import type { DocumentDownloadsCardProps } from './types';

export function DocumentDownloadsCard({
  downloads,
  onDownloadsChange,
  documentId
}: DocumentDownloadsCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 bg-gradient-to-r from-cyan-50 to-blue-50 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-100 rounded-lg">
            <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h4 className="text-lg font-semibold text-gray-900">Attachments</h4>
            <p className="text-xs text-gray-600 mt-0.5">Upload supporting documents that will be available for download within your document chatbot interface</p>
          </div>
        </div>
      </div>
      <div className="px-6 py-4">
        <FileUploadManager
          downloads={downloads || []}
          onChange={onDownloadsChange}
          documentId={documentId}
        />
      </div>
    </div>
  );
}

