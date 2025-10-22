import React, { useRef, useState } from 'react';
import { Button } from '@/components/UI/Button';
import { Alert } from '@/components/UI/Alert';
import { useUpload } from '@/hooks/useUpload';

export function UploadZone() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { upload, uploading, progress, error, reset } = useUpload();

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
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload Document</h2>

      {error && (
        <Alert variant="error" onDismiss={reset} className="mb-4">
          {error}
        </Alert>
      )}

      <div className="space-y-4">
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            disabled={uploading}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-lg file:border-0
              file:text-sm file:font-medium
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100
              file:cursor-pointer cursor-pointer"
          />
          <p className="mt-2 text-xs text-gray-500">
            PDF files only, max 50MB
          </p>
        </div>

        {selectedFile && (
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-sm text-gray-700 truncate">
              {selectedFile.name}
            </span>
            <Button
              onClick={handleUpload}
              loading={uploading}
              size="sm"
            >
              Upload
            </Button>
          </div>
        )}

        {uploading && progress > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Uploading...</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

