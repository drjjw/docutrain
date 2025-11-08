import { useState } from 'react';
import { DocumentRetrainer } from '../DocumentRetrainer';
import type { DocumentRetrainSectionProps } from './types';

export function DocumentRetrainSection({
  document,
  retraining,
  onRetrainStart,
  onRetrainSuccess,
  onRetrainError,
  onRetrainingStart
}: DocumentRetrainSectionProps) {
  const [activeTab, setActiveTab] = useState<'pdf' | 'text'>('pdf');

  if (!document.slug) return null;

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-amber-200 bg-white">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-lg">
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <div className="text-left">
            <h4 className="text-lg font-semibold text-gray-900">Retrain Document</h4>
            <p className="text-sm text-gray-600">Replace or add to existing content with new PDF or text</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-4 bg-white">
        {/* Tab Navigation */}
        <div className="mb-4 border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('pdf')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'pdf'
                  ? 'border-amber-600 text-amber-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Upload PDF File
            </button>
            <button
              onClick={() => setActiveTab('text')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'text'
                  ? 'border-amber-600 text-amber-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Paste Text Content
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="min-h-[200px] space-y-6">
          {activeTab === 'pdf' ? (
            <div className="text-sm text-gray-600">
              <p className="mb-1">
                <strong>PDF Retraining:</strong> Upload a new PDF to replace or add to existing training data.
              </p>
              <p className="text-xs text-gray-500">
                Supports PDF files up to 75MB (superadmin) or 50MB (regular users). Text is automatically extracted and processed.
              </p>
            </div>
          ) : (
            <div className="text-sm text-gray-600">
              <p className="mb-1">
                <strong>Text Retraining:</strong> Directly paste text content without needing a PDF file.
              </p>
              <p className="text-xs text-gray-500">
                Supports up to 5 million characters. Faster processing since no PDF extraction is needed.
              </p>
            </div>
          )}

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex gap-2">
              <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-xs text-amber-800">
                <p className="font-medium mb-1">Note:</p>
                <p>The document slug <span className="font-mono bg-amber-100 px-1 rounded">{document.slug}</span> and all metadata will be preserved. Processing may take several minutes.</p>
              </div>
            </div>
          </div>

          <DocumentRetrainer
            documentId={document.id}
            documentSlug={document.slug}
            uploadMode={activeTab}
            retraining={retraining}
            onRetrainStart={onRetrainStart}
            onRetrainSuccess={onRetrainSuccess}
            onRetrainError={onRetrainError}
            onRetrainingStart={onRetrainingStart}
          />
        </div>
      </div>
    </div>
  );
}

