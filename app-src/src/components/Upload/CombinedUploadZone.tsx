import React, { useState } from 'react';
import { UploadZone } from './UploadZone';
import { TextUploadZone } from './TextUploadZone';
import { Modal } from '@/components/UI/Modal';
import { Button } from '@/components/UI/Button';

interface CombinedUploadZoneProps {
  onUploadSuccess?: () => void;
}

export function CombinedUploadZone({ onUploadSuccess }: CombinedUploadZoneProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'pdf' | 'text'>('pdf');

  const handleUploadSuccess = () => {
    if (onUploadSuccess) {
      onUploadSuccess();
    }
    // Close modal after successful upload
    setTimeout(() => {
      setIsModalOpen(false);
      setActiveTab('pdf'); // Reset to PDF tab for next time
    }, 1500);
  };

  return (
    <>
      {/* Upload Options with Explanations */}
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* PDF Upload Option */}
          <div className="flex items-stretch gap-4">
            <button
              onClick={() => {
                setActiveTab('pdf');
                setIsModalOpen(true);
              }}
              className="group relative bg-gradient-to-br from-docutrain-light to-docutrain-medium hover:from-docutrain-medium hover:to-docutrain-dark text-white rounded-xl font-medium transition-all focus:outline-none focus:ring-2 focus:ring-docutrain-light focus:ring-offset-2 flex flex-col items-center justify-center gap-3 p-6 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-100 flex-shrink-0 w-40"
            >
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center group-hover:bg-white/30 transition-colors">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div className="text-center">
                <div className="text-base font-semibold">Train with PDF</div>
                <div className="text-xs text-white/80 mt-1">Upload PDF documents</div>
              </div>
            </button>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 flex-1 flex items-center">
              <p className="text-sm text-gray-700 leading-relaxed">
                <strong className="text-gray-900 font-semibold">Perfect for:</strong> PDF files, research papers, manuals, and documents that are already in PDF format. The system automatically extracts text, processes it into searchable chunks, and generates AI embeddings. Processing typically takes 1-10 minutes depending on document size.
              </p>
            </div>
          </div>

          {/* Text Upload Option */}
          <div className="flex items-stretch gap-4">
            <button
              onClick={() => {
                setActiveTab('text');
                setIsModalOpen(true);
              }}
              className="group relative bg-gradient-to-br from-docutrain-medium to-docutrain-dark hover:from-docutrain-dark hover:to-docutrain-dark/90 text-white rounded-xl font-medium transition-all focus:outline-none focus:ring-2 focus:ring-docutrain-medium focus:ring-offset-2 flex flex-col items-center justify-center gap-3 p-6 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-100 flex-shrink-0 w-40"
            >
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center group-hover:bg-white/30 transition-colors">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="text-center">
                <div className="text-base font-semibold">Train with Text</div>
                <div className="text-xs text-white/80 mt-1">Paste text content</div>
              </div>
            </button>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 flex-1 flex items-center">
              <p className="text-sm text-gray-700 leading-relaxed">
                <strong className="text-gray-900 font-semibold">Perfect for:</strong> Articles, notes, research content, or any text you already have. Simply paste your text directly—no file conversion needed. This option is faster since it skips PDF extraction and goes straight to processing. Supports up to 5 million characters.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Upload New Document"
        size="lg"
      >
        <div className="space-y-4">
          {/* Tab Navigation */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('pdf')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'pdf'
                  ? 'border-docutrain-light text-docutrain-light'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Upload PDF File
            </button>
            <button
              onClick={() => setActiveTab('text')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'text'
                  ? 'border-docutrain-light text-docutrain-light'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Paste Text Content
            </button>
          </div>

          {/* Tab Content */}
          <div className="max-h-[calc(100vh-250px)] overflow-y-auto">
            {activeTab === 'pdf' ? (
              <div className="space-y-4">
                <div className="text-sm text-gray-600">
                  <p className="mb-2">
                    <strong>PDF Upload:</strong> Upload PDF documents that will be automatically processed and made searchable.
                  </p>
                  <ul className="ml-4 space-y-1 text-xs">
                    <li>• Supports PDF files up to 75MB (superadmin) or 50MB (regular users)</li>
                    <li>• Text is automatically extracted from the PDF</li>
                    <li>• Processing includes text chunking and AI embedding generation</li>
                    <li>• Takes 1-10 minutes depending on document size</li>
                  </ul>
                </div>
                <UploadZone onUploadSuccess={handleUploadSuccess} />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-sm text-gray-600">
                  <p className="mb-2">
                    <strong>Text Upload:</strong> Directly paste text content to train the AI without needing a PDF file.
                  </p>
                  <ul className="ml-4 space-y-1 text-xs">
                    <li>• Supports up to 5 million characters of text</li>
                    <li>• Perfect for articles, notes, research papers, or any text content</li>
                    <li>• Bypasses PDF extraction - text goes directly to processing</li>
                    <li>• Faster processing since no file download/extraction is needed</li>
                    <li>• Great for content that's already in text format</li>
                  </ul>
                </div>
                <TextUploadZone onUploadSuccess={handleUploadSuccess} />
              </div>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}

