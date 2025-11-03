import React from 'react';
import { TextInput, SelectInput, type SelectOption } from './fields';
import { CoverImageUploader } from '../CoverImageUploader';
import type { DocumentFileDetailsCardProps } from './types';

export function DocumentFileDetailsCard({
  pdfFilename,
  pdfSubdirectory,
  embeddingType,
  cover,
  onFieldChange,
  onCoverChange,
  documentId,
  isSuperAdmin
}: DocumentFileDetailsCardProps) {
  const embeddingOptions: SelectOption[] = [
    { value: 'openai', label: 'OpenAI' },
    { value: 'local', label: 'Local' }
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 bg-gradient-to-r from-docutrain-light/10 to-docutrain-lighter/10 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-docutrain-light/20 rounded-lg">
            <svg className="w-5 h-5 text-docutrain-medium" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <h4 className="text-lg font-semibold text-gray-900">File & Technical Details</h4>
        </div>
      </div>
      <div className="px-6 py-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">PDF Filename</label>
          <TextInput
            value={pdfFilename}
            onChange={(value) => onFieldChange('pdf_filename', value)}
            placeholder="Enter PDF filename..."
          />
        </div>
        {isSuperAdmin && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">PDF Subdirectory</label>
              <TextInput
                value={pdfSubdirectory}
                onChange={(value) => onFieldChange('pdf_subdirectory', value)}
                placeholder="Enter PDF subdirectory..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Embedding Type</label>
              <SelectInput
                value={embeddingType}
                onChange={(value) => onFieldChange('embedding_type', value)}
                options={embeddingOptions}
                allowEmpty={false}
              />
            </div>
          </>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Cover Image</label>
          <CoverImageUploader
            coverUrl={cover || ''}
            onChange={onCoverChange}
            documentId={documentId}
          />
        </div>
      </div>
    </div>
  );
}

