import React, { useState } from 'react';
import { DocumentRetrainer } from '../DocumentRetrainer';
import type { DocumentRetrainSectionProps } from './types';

export function DocumentRetrainSection({
  document,
  retraining,
  onRetrainStart,
  onRetrainSuccess,
  onRetrainError
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
            <p className="text-sm text-gray-600">Replace existing content with new PDF or text</p>
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
        <div className="min-h-[200px]">
          {activeTab === 'pdf' ? (
            <div className="space-y-4">
              <div className="text-sm text-gray-600">
                <p className="mb-2">
                  <strong>PDF Retraining:</strong> Upload a new PDF to replace all existing training data.
                </p>
                <ul className="ml-4 space-y-1 text-xs">
                  <li>• Supports PDF files up to 75MB (superadmin) or 50MB (regular users)</li>
                  <li>• Text is automatically extracted from the PDF</li>
                  <li>• All existing chunks for this document will be deleted</li>
                  <li>• Processing includes text chunking and AI embedding generation</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-gray-600">
                <p className="mb-2">
                  <strong>Text Retraining:</strong> Directly replace content with new text without needing a PDF file.
                </p>
                <ul className="ml-4 space-y-1 text-xs">
                  <li>• Supports up to 5 million characters of text</li>
                  <li>• Perfect for articles, notes, research papers, or any text content</li>
                  <li>• Bypasses PDF extraction - text goes directly to processing</li>
                  <li>• Faster processing since no file download/extraction is needed</li>
                  <li>• All existing chunks for this document will be deleted</li>
                </ul>
              </div>
            </div>
          )}

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
            uploadMode={activeTab}
            retraining={retraining}
            onRetrainStart={onRetrainStart}
            onRetrainSuccess={onRetrainSuccess}
            onRetrainError={onRetrainError}
          />
        </div>
      </div>
    </div>
  );
}

