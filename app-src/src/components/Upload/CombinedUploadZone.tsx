import React, { useState } from 'react';
import { UploadZone } from './UploadZone';
import { TextUploadZone } from './TextUploadZone';

interface CombinedUploadZoneProps {
  onUploadSuccess?: () => void;
}

export function CombinedUploadZone({ onUploadSuccess }: CombinedUploadZoneProps) {
  const [activeTab, setActiveTab] = useState<'pdf' | 'text'>('pdf');

  return (
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
      <div className="min-h-[400px]">
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
            <UploadZone onUploadSuccess={onUploadSuccess} />
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
            <TextUploadZone onUploadSuccess={onUploadSuccess} />
          </div>
        )}
      </div>
    </div>
  );
}
