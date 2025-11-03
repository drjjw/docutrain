import React from 'react';
import type { DocumentMetadataCardProps } from './types';

export function DocumentMetadataCard({
  document,
  isSuperAdmin
}: DocumentMetadataCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-100 rounded-lg">
            <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h4 className="text-lg font-semibold text-gray-900">Metadata & Timestamps</h4>
        </div>
      </div>
      <div className="px-6 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h5 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Timestamps
            </h5>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Created:</span>
                <span className="text-gray-900 font-medium">{new Date(document.created_at).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Updated:</span>
                <span className="text-gray-900 font-medium">{new Date(document.updated_at).toLocaleString()}</span>
              </div>
              {document.uploaded_by_user_id && (
                <div className="flex justify-between items-start pt-2 border-t border-gray-200">
                  <span className="text-gray-600">Uploaded by:</span>
                  <div className="text-right">
                    <div className="text-gray-900 font-medium font-mono text-xs break-all max-w-[200px]">
                      {document.uploaded_by_user_id}
                    </div>
                    {isSuperAdmin && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        (User ID - email available in user management)
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div>
            <h5 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
              </svg>
              Document Metadata
            </h5>
            <div className="bg-gray-50 rounded-lg p-3 max-h-32 overflow-y-auto">
              <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                {JSON.stringify(document.metadata, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

