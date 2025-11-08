import React, { useRef, useState } from 'react';
import { Button } from '@/components/UI/Button';
import { Alert } from '@/components/UI/Alert';
import { useUpload } from '@/hooks/useUpload';
import { usePermissions } from '@/hooks/usePermissions';

interface UploadZoneProps {
  onUploadSuccess?: () => void;
  suppressSuccessMessage?: boolean;
}

export function UploadZone({ onUploadSuccess, suppressSuccessMessage = false }: UploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { upload, uploading, progress, error, success, uploadedDocument, retryingProcessing, retryMessage, reset } = useUpload();
  const { isSuperAdmin } = usePermissions();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      reset();
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    const result = await upload(selectedFile);
    if (result) {
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      // Call the success callback to refresh the documents list
      if (onUploadSuccess) {
        onUploadSuccess();
      }
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="error" onDismiss={reset}>
          {error}
        </Alert>
      )}

      {success && uploadedDocument && !suppressSuccessMessage && (
        <Alert variant="success" onDismiss={reset}>
          <div className="space-y-1">
            <p className="font-medium">Upload successful!</p>
            <p className="text-sm">
              <strong>{uploadedDocument.title}</strong> has been uploaded and processing will begin shortly.
            </p>
            <p className="text-sm text-green-700">
              Check "Your Uploaded Documents" below to track the processing status.
            </p>
          </div>
        </Alert>
      )}

      {retryingProcessing && retryMessage && (
        <Alert variant="info">
          <div className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-sm">{retryMessage}</span>
          </div>
        </Alert>
      )}

      <div className="space-y-4">
        <div className="overflow-visible">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            disabled={uploading}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2.5 file:px-4
              file:rounded-lg file:border-0
              file:text-sm file:font-medium
              file:bg-gradient-to-r file:from-green-500 file:to-emerald-600
              file:text-white
              hover:file:from-green-600 hover:file:to-emerald-700
              file:cursor-pointer cursor-pointer
              file:transition-all file:duration-200
              file:shadow-md hover:file:shadow-lg
              file:origin-left"
          />
          <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            PDF files only, max {isSuperAdmin 
              ? (import.meta.env.PROD ? '75' : '200')
              : (import.meta.env.PROD ? '50' : '200')}MB
          </p>
        </div>

        {selectedFile && (
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-gray-600">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            <Button
              onClick={handleUpload}
              loading={uploading}
              size="sm"
              className="ml-3"
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
          </div>
        )}

        {uploading && progress > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm font-medium">
              <span className="text-gray-700">Uploading...</span>
              <span className="text-green-600">{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-green-500 to-emerald-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

