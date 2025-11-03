import React from 'react';
import { DocumentRetrainer } from '../DocumentRetrainer';
import type { DocumentRetrainSectionProps } from './types';

export function DocumentRetrainSection({
  document,
  showSection,
  onToggleSection,
  retraining,
  onRetrainStart,
  onRetrainSuccess,
  onRetrainError
}: DocumentRetrainSectionProps) {
  if (!document.slug) return null;

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200 overflow-hidden">
      <button
        onClick={onToggleSection}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-amber-100/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-lg">
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <div className="text-left">
            <h4 className="text-lg font-semibold text-gray-900">Retrain Document</h4>
            <p className="text-sm text-gray-600">Upload new PDF to replace existing content</p>
          </div>
        </div>
        <svg 
          className={`w-5 h-5 text-gray-500 transition-transform ${showSection ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {showSection && (
        <div className="px-6 py-4 border-t border-amber-200 bg-white">
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex gap-2">
              <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="text-sm text-amber-800">
                <p className="font-medium mb-1">Important:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>This will delete all existing chunks for this document</li>
                  <li>The document slug <span className="font-mono bg-amber-100 px-1 rounded">{document.slug}</span> will be preserved</li>
                  <li>All metadata and settings will remain unchanged</li>
                  <li>Processing may take several minutes</li>
                </ul>
              </div>
            </div>
          </div>
          
          <DocumentRetrainer
            documentId={document.id}
            documentSlug={document.slug}
            onRetrainStart={onRetrainStart}
            onRetrainSuccess={onRetrainSuccess}
            onRetrainError={onRetrainError}
          />
        </div>
      )}
    </div>
  );
}

