import React, { useState, useRef } from 'react';
import { Button } from '@/components/UI/Button';
import { supabase } from '@/lib/supabase/client';
import type { DownloadLink } from '@/types/admin';

interface FileUploadManagerProps {
  downloads: DownloadLink[];
  onChange: (downloads: DownloadLink[]) => void;
  documentId: string;
}

const DOWNLOADS_BUCKET = 'downloads';

export function FileUploadManager({ downloads, onChange, documentId }: FileUploadManagerProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Debug component lifecycle
  React.useEffect(() => {
    console.log('FileUploadManager mounted for document:', documentId);
    console.log('Initial downloads:', downloads);
    
    return () => {
      console.log('FileUploadManager unmounting for document:', documentId);
    };
  }, []);

  React.useEffect(() => {
    console.log('FileUploadManager downloads changed:', downloads);
  }, [downloads]);

  React.useEffect(() => {
    console.log('FileUploadManager uploading state changed:', uploading);
  }, [uploading]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('Starting file upload:', file.name);

    try {
      setUploading(true);
      setUploadError(null);

      // Create a unique filename with timestamp
      const timestamp = Date.now();
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `${documentId}/${timestamp}-${sanitizedFileName}`;

      console.log('Uploading to path:', filePath);

      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from(DOWNLOADS_BUCKET)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        console.error('Supabase upload error:', error);
        throw new Error(`Upload failed: ${error.message}`);
      }

      console.log('Upload successful, data:', data);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(DOWNLOADS_BUCKET)
        .getPublicUrl(filePath);

      console.log('Public URL:', urlData.publicUrl);

      // Add to downloads array
      const newDownload: DownloadLink = {
        url: urlData.publicUrl,
        title: file.name,
      };

      console.log('Adding new download:', newDownload);
      console.log('Current downloads before update:', downloads);

      onChange([...downloads, newDownload]);

      console.log('Downloads updated, resetting file input');

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      console.log('File upload completed successfully');
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError(error instanceof Error ? error.message : 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async (index: number) => {
    const download = downloads[index];
    
    // Try to extract the file path from the URL to delete from storage
    try {
      const url = new URL(download.url);
      const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/downloads\/(.+)/);
      
      if (pathMatch) {
        const filePath = pathMatch[1];
        await supabase.storage
          .from(DOWNLOADS_BUCKET)
          .remove([filePath]);
      }
    } catch (error) {
      console.error('Failed to delete file from storage:', error);
      // Continue with removing from array even if storage deletion fails
    }

    // Remove from downloads array
    const updated = downloads.filter((_, i) => i !== index);
    onChange(updated);
  };

  const handleTitleChange = (index: number, newTitle: string) => {
    const updated = [...downloads];
    updated[index] = { ...updated[index], title: newTitle };
    onChange(updated);
    setEditingIndex(null);
  };

  const handleAddManualUrl = () => {
    const newDownload: DownloadLink = {
      url: '',
      title: '',
    };
    onChange([...downloads, newDownload]);
    setEditingIndex(downloads.length);
  };

  const handleManualChange = (index: number, field: 'url' | 'title', value: string) => {
    const updated = [...downloads];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const isValidUrl = (url: string): boolean => {
    if (!url.trim()) return false;
    try {
      new URL(url);
      return url.startsWith('http://') || url.startsWith('https://');
    } catch {
      return false;
    }
  };

  console.log('FileUploadManager rendering - uploading:', uploading, 'downloads:', downloads.length);

  return (
    <div className="space-y-4">
      {/* Upload Section */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 bg-gray-50">
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <div className="mt-4">
            <label htmlFor="file-upload" className="cursor-pointer">
              <span className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                {uploading ? 'Uploading...' : 'Upload File'}
              </span>
              <input
                id="file-upload"
                ref={fileInputRef}
                type="file"
                className="sr-only"
                onChange={handleFileSelect}
                disabled={uploading}
              />
            </label>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Upload files to Supabase storage (downloads bucket)
          </p>
          {uploadError && (
            <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">
              {uploadError}
            </div>
          )}
        </div>
      </div>

      {/* Manual URL Entry */}
      <div className="flex justify-center">
        <button
          onClick={handleAddManualUrl}
          className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          Or add manual URL
        </button>
      </div>

      {/* Downloads List */}
      {downloads.length > 0 && (
        <div className="space-y-3">
          <h5 className="text-sm font-medium text-gray-900 flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download Links ({downloads.length})
          </h5>

          {downloads.map((download, index) => {
            const isEditing = editingIndex === index;
            const isManualEntry = !download.url || !download.title;

            return (
              <div
                key={index}
                className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-sm transition-shadow"
              >
                {isEditing || isManualEntry ? (
                  // Edit Mode
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Title *
                      </label>
                      <input
                        type="text"
                        value={download.title}
                        onChange={(e) => handleManualChange(index, 'title', e.target.value)}
                        placeholder="e.g., Download Slides"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        URL *
                      </label>
                      <input
                        type="url"
                        value={download.url}
                        onChange={(e) => handleManualChange(index, 'url', e.target.value)}
                        placeholder="https://example.com/file.pdf"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      />
                      {download.url && !isValidUrl(download.url) && (
                        <p className="mt-1 text-xs text-red-600">Please enter a valid URL starting with http:// or https://</p>
                      )}
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          if (!download.url || !download.title) {
                            handleRemove(index);
                          } else {
                            setEditingIndex(null);
                          }
                        }}
                        className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => setEditingIndex(null)}
                        disabled={!download.url || !download.title || !isValidUrl(download.url)}
                        className="px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="font-medium text-gray-900 text-sm">{download.title}</span>
                      </div>
                      <a
                        href={download.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:text-blue-800 hover:underline break-all"
                      >
                        {download.url}
                      </a>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => setEditingIndex(index)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleRemove(index)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Remove"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {downloads.length === 0 && (
        <div className="text-center py-6 text-gray-500 text-sm">
          No downloads yet. Upload a file or add a manual URL to get started.
        </div>
      )}
    </div>
  );
}

