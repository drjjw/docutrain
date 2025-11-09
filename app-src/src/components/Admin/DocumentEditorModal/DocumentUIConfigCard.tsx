import React from 'react';
import { Toggle } from '@/components/UI/Toggle';
import type { DocumentUIConfigCardProps } from './types';

export function DocumentUIConfigCard({
  showDocumentSelector,
  showKeywords,
  showDownloads,
  showReferences,
  showRecentQuestions,
  showCountryFlags,
  onFieldChange,
  isTextUpload = false
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
        <Toggle
          checked={showReferences !== false}
          onChange={(checked) => onFieldChange('show_references', checked)}
          label="Show References"
          description={isTextUpload 
            ? "References are disabled for text uploads since there are no page numbers in the source material"
            : "Display references section at the end of chat messages"}
          size="md"
          disabled={isTextUpload}
        />
        <Toggle
          checked={showRecentQuestions === true}
          onChange={(checked) => onFieldChange('show_recent_questions', checked)}
          label="Show Recent Questions"
          description="Display a gallery of recent questions asked about this document. Note: The gallery will only appear if there are at least 2 recent questions available."
          size="md"
        />
        {showRecentQuestions && (
          <div className="ml-6 pl-4 border-l-2 border-gray-200">
            <Toggle
              checked={showCountryFlags === true}
              onChange={(checked) => onFieldChange('show_country_flags', checked)}
              label="Show Country Flags"
              description="Display country flags next to recent questions based on the user's IP address location"
              size="md"
            />
          </div>
        )}
        {isTextUpload && (
          <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-amber-800">
                <strong>Note:</strong> This document was uploaded as text. References require page numbers, which are only available for PDF uploads.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

