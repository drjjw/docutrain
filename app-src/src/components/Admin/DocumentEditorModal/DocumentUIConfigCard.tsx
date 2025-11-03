import React from 'react';
import { Toggle } from '@/components/UI/Toggle';
import type { DocumentUIConfigCardProps } from './types';

export function DocumentUIConfigCard({
  showDocumentSelector,
  showKeywords,
  showDownloads,
  onFieldChange
}: DocumentUIConfigCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h4 className="text-lg font-semibold text-gray-900">UI Configuration</h4>
        </div>
      </div>
      <div className="px-6 py-4 space-y-4">
        <Toggle
          checked={showDocumentSelector || false}
          onChange={(checked) => onFieldChange('show_document_selector', checked)}
          label="Document Selector"
          description="Show a document selection interface in the chat interface"
          size="md"
        />
        <Toggle
          checked={showKeywords !== false}
          onChange={(checked) => onFieldChange('show_keywords', checked)}
          label="Show Keywords Cloud"
          description="Display the keywords cloud in the chat interface"
          size="md"
        />
        <Toggle
          checked={showDownloads !== false}
          onChange={(checked) => onFieldChange('show_downloads', checked)}
          label="Show Downloads Section"
          description="Display the downloads section in the chat interface"
          size="md"
        />
      </div>
    </div>
  );
}

