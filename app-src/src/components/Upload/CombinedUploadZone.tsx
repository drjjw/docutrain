import React, { useState, useImperativeHandle, forwardRef } from 'react';
import { UploadZone } from './UploadZone';
import { TextUploadZone } from './TextUploadZone';
import { Modal } from '@/components/UI/Modal';
import { Button } from '@/components/UI/Button';
import { Alert } from '@/components/UI/Alert';

interface CombinedUploadZoneProps {
  onUploadSuccess?: () => void;
}

export interface CombinedUploadZoneRef {
  closeModal: () => void;
}

export const CombinedUploadZone = forwardRef<CombinedUploadZoneRef, CombinedUploadZoneProps>(
  ({ onUploadSuccess }, ref) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'pdf' | 'text'>('pdf');
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  const handleUploadSuccess = () => {
    if (onUploadSuccess) {
      onUploadSuccess();
    }
    // Show success message - modal stays open so user can read it
    setShowSuccessMessage(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setActiveTab('pdf');
    setShowSuccessMessage(false);
  };

  // Expose closeModal method via ref
  useImperativeHandle(ref, () => ({
    closeModal: handleModalClose
  }));

  return (
    <>
      {/* Upload Options with Explanations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* PDF Upload Option */}
        <div className="flex items-stretch gap-2 w-full">
          <button
            onClick={() => {
              setActiveTab('pdf');
              setShowSuccessMessage(false);
              setIsModalOpen(true);
            }}
            className="group relative bg-gradient-to-br from-docutrain-light to-docutrain-medium hover:from-docutrain-medium hover:to-docutrain-dark text-white rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-docutrain-light focus:ring-offset-2 flex flex-row items-center gap-2 px-4 py-3 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-100 flex-shrink-0 h-full"
          >
            <div className="w-8 h-8 bg-white/20 rounded flex items-center justify-center group-hover:bg-white/30 transition-colors flex-shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div className="text-left whitespace-nowrap">
              <div className="text-sm font-semibold leading-tight">Train with PDF</div>
              <div className="text-xs text-white/80 leading-tight">Upload PDF</div>
            </div>
          </button>
          <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-200 flex-1 flex items-center min-w-0 w-full h-full">
            <p className="text-sm text-gray-700 leading-relaxed">
              <strong className="text-gray-900 font-semibold">Perfect for:</strong> PDF files, research papers, manuals, and documents that are already in PDF format. The system automatically extracts text, processes it into searchable chunks, and generates AI embeddings. Processing typically takes 1-10 minutes depending on document size.
            </p>
          </div>
        </div>

        {/* Text Upload Option */}
        <div className="flex items-stretch gap-2 w-full">
          <button
            onClick={() => {
              setActiveTab('text');
              setShowSuccessMessage(false);
              setIsModalOpen(true);
            }}
            className="group relative bg-gradient-to-br from-docutrain-medium to-docutrain-dark hover:from-docutrain-dark hover:to-docutrain-dark/90 text-white rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-docutrain-medium focus:ring-offset-2 flex flex-row items-center gap-2 px-4 py-3 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-100 flex-shrink-0 h-full"
          >
            <div className="w-8 h-8 bg-white/20 rounded flex items-center justify-center group-hover:bg-white/30 transition-colors flex-shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="text-left whitespace-nowrap">
              <div className="text-sm font-semibold leading-tight">Train with Text</div>
              <div className="text-xs text-white/80 leading-tight">Paste text</div>
            </div>
          </button>
          <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-200 flex-1 flex items-center min-w-0 w-full h-full">
            <p className="text-sm text-gray-700 leading-relaxed">
              <strong className="text-gray-900 font-semibold">Perfect for:</strong> Articles, notes, research content, or any text you already have. Simply paste your text directly—no file conversion needed. This option is faster since it skips PDF extraction and goes straight to processing. Supports up to 5 million characters.
            </p>
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        title={showSuccessMessage ? "Upload Successful" : "Upload New Document"}
        size="lg"
      >
        {showSuccessMessage ? (
          /* Success View - Clean and focused */
          <div className="space-y-4">
            <Alert variant="success">
              <div className="space-y-3">
                <p className="font-semibold text-lg">
                  {activeTab === 'pdf' ? 'PDF Upload Successful!' : 'Text Upload Successful!'}
                </p>
                <p className="text-sm">
                  Your {activeTab === 'pdf' ? 'document' : 'text'} is now being processed. You can watch the progress in the <strong>"Your Uploaded Documents"</strong> section below.
                </p>
                <div className="pt-2">
                  <Button onClick={handleModalClose} className="w-full">
                    Close
                  </Button>
                </div>
              </div>
            </Alert>
          </div>
        ) : (
          /* Upload View - Normal upload interface */
          <div className="space-y-4">
            {/* Tab Navigation */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => {
                  setActiveTab('pdf');
                  setShowSuccessMessage(false);
                }}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'pdf'
                    ? 'border-docutrain-light text-docutrain-light'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Upload PDF File
              </button>
              <button
                onClick={() => {
                  setActiveTab('text');
                  setShowSuccessMessage(false);
                }}
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
                  <UploadZone onUploadSuccess={handleUploadSuccess} suppressSuccessMessage />
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
                  <TextUploadZone onUploadSuccess={handleUploadSuccess} suppressSuccessMessage />
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
  }
);

