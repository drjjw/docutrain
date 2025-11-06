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
      {/* Compact Button Interface */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          onClick={() => {
            setActiveTab('pdf');
            setIsModalOpen(true);
          }}
          className="flex-1 flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          Upload PDF File
        </Button>
        <Button
          onClick={() => {
            setActiveTab('text');
            setIsModalOpen(true);
          }}
          variant="outline"
          className="flex-1 flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Paste Text Content
        </Button>
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
                  ? 'border-[#3399ff] text-[#3399ff]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Upload PDF File
            </button>
            <button
              onClick={() => setActiveTab('text')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'text'
                  ? 'border-[#3399ff] text-[#3399ff]'
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

