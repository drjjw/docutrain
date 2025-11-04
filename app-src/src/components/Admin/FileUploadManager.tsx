import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/UI/Button';
import { supabase } from '@/lib/supabase/client';
import { 
  getDocumentAttachments, 
  createDocumentAttachment, 
  updateDocumentAttachment, 
  deleteDocumentAttachment 
} from '@/lib/supabase/admin';
import type { DownloadLink, DocumentAttachment } from '@/types/admin';

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
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingTitle, setPendingTitle] = useState<string>('');
  const [showTitlePrompt, setShowTitlePrompt] = useState(false);
  const [attachments, setAttachments] = useState<DocumentAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch attachments on mount and when documentId changes
  useEffect(() => {
    const fetchAttachments = async () => {
      try {
        setLoading(true);
        const fetchedAttachments = await getDocumentAttachments(documentId);
        setAttachments(fetchedAttachments);
        // Convert to DownloadLink[] format for parent component
        const downloadsList = fetchedAttachments.map(att => ({
          title: att.title,
          url: att.url
        }));
        onChange(downloadsList);
      } catch (error) {
        console.error('Failed to fetch attachments:', error);
        // Fallback to props downloads if fetch fails
        setAttachments([]);
      } finally {
        setLoading(false);
      }
    };

    if (documentId) {
      fetchAttachments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('File selected:', file.name);
    
    // Show title prompt with filename as default
    setPendingFile(file);
    setPendingTitle(file.name.replace(/\.[^/.]+$/, '')); // Remove extension for cleaner default
    setShowTitlePrompt(true);
    setUploadError(null);
  };

  const handleUploadWithTitle = async () => {
    if (!pendingFile || !pendingTitle.trim()) {
      setUploadError('Please enter a link title');
      return;
    }

    console.log('Starting file upload:', pendingFile.name, 'with title:', pendingTitle);

    try {
      setUploading(true);
      setUploadError(null);
      setShowTitlePrompt(false);

      // Create a unique filename with timestamp
      const timestamp = Date.now();
      const sanitizedFileName = pendingFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `${documentId}/${timestamp}-${sanitizedFileName}`;

      console.log('Uploading to path:', filePath);

      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from(DOWNLOADS_BUCKET)
        .upload(filePath, pendingFile, {
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

      // Create attachment record via API
      const newAttachment = await createDocumentAttachment(documentId, {
        title: pendingTitle.trim(),
        url: urlData.publicUrl,
        storage_path: filePath,
        file_size: pendingFile.size,
        mime_type: pendingFile.type || undefined,
      });

      // Update local state
      setAttachments(prev => [...prev, newAttachment].sort((a, b) => a.display_order - b.display_order));

      console.log('Attachment created successfully');

      // Reset state
      setPendingFile(null);
      setPendingTitle('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      console.log('File upload completed successfully');
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError(error instanceof Error ? error.message : 'Failed to upload file');
      setShowTitlePrompt(true); // Show prompt again on error
    } finally {
      setUploading(false);
    }
  };

  const handleCancelUpload = () => {
    setPendingFile(null);
    setPendingTitle('');
    setShowTitlePrompt(false);
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemove = async (index: number) => {
    const attachment = attachments[index];
    
    if (!attachment) return;

    try {
      // Delete attachment via API (this will also handle storage deletion)
      await deleteDocumentAttachment(attachment.id);
      
      // Update local state
      setAttachments(prev => prev.filter((_, i) => i !== index));
    } catch (error) {
      console.error('Failed to delete attachment:', error);
      setUploadError('Failed to delete attachment. Please try again.');
      // Continue with local removal even if API call fails
      setAttachments(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleTitleChange = async (index: number, newTitle: string) => {
    const attachment = attachments[index];
    if (!attachment) return;

    try {
      // Update attachment via API
      const updated = await updateDocumentAttachment(attachment.id, {
        title: newTitle.trim()
      });
      
      // Update local state
      setAttachments(prev => {
        const updatedAttachments = [...prev];
        updatedAttachments[index] = updated;
        return updatedAttachments.sort((a, b) => a.display_order - b.display_order);
      });
      
    setEditingIndex(null);
    } catch (error) {
      console.error('Failed to update attachment:', error);
      setUploadError('Failed to update attachment. Please try again.');
    }
  };

  const handleAddManualUrl = () => {
    // Create a temporary attachment entry (will be saved when user fills in URL and title)
    const tempAttachment: DocumentAttachment = {
      id: `temp-${Date.now()}`,
      document_id: documentId,
      title: '',
      url: '',
      display_order: attachments.length,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setAttachments(prev => [...prev, tempAttachment]);
    setEditingIndex(attachments.length);
  };

  const handleManualChange = async (index: number, field: 'url' | 'title', value: string) => {
    const attachment = attachments[index];
    if (!attachment) return;

    // For temporary attachments, update local state only
    if (attachment.id.startsWith('temp-')) {
      const updated = [...attachments];
      updated[index] = { ...updated[index], [field]: value };
      setAttachments(updated);
      return;
    }

    // For existing attachments, update via API
    try {
      const updates: Partial<{ title: string; url: string }> = {};
      updates[field] = value;
      
      const updated = await updateDocumentAttachment(attachment.id, updates);
      
      // Update local state
      setAttachments(prev => {
        const updatedAttachments = [...prev];
        updatedAttachments[index] = updated;
        return updatedAttachments.sort((a, b) => a.display_order - b.display_order);
      });
    } catch (error) {
      console.error('Failed to update attachment:', error);
      // Still update local state for better UX
      const updated = [...attachments];
    updated[index] = { ...updated[index], [field]: value };
      setAttachments(updated);
    }
  };

  const handleSaveManualEntry = async (index: number) => {
    const attachment = attachments[index];
    if (!attachment) return;

    if (!attachment.url || !attachment.title || !isValidUrl(attachment.url)) {
      return;
    }

    // If it's a temporary attachment, create it via API
    if (attachment.id.startsWith('temp-')) {
      try {
        const newAttachment = await createDocumentAttachment(documentId, {
          title: attachment.title,
          url: attachment.url,
        });
        
        // Replace temporary with real attachment
        setAttachments(prev => {
          const updated = [...prev];
          updated[index] = newAttachment;
          return updated.sort((a, b) => a.display_order - b.display_order);
        });
        
        setEditingIndex(null);
      } catch (error) {
        console.error('Failed to create attachment:', error);
        setUploadError('Failed to create attachment. Please try again.');
      }
    } else {
      // Already exists, just exit edit mode
      setEditingIndex(null);
    }
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

  console.log('FileUploadManager rendering - uploading:', uploading, 'attachments:', attachments.length);

  if (loading) {
    return (
      <div className="text-center py-6 text-gray-500 text-sm">
        Loading attachments...
      </div>
    );
  }

  // Convert attachments to downloads format for display
  const downloadsForDisplay = attachments.map(att => ({
    title: att.title,
    url: att.url
  }));

  return (
    <div className="space-y-4">
      {/* Upload Section */}
      {!showTitlePrompt ? (
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
              Select a file to upload and specify its display name
            </p>
          </div>
        </div>
      ) : (
        /* Title Prompt Section */
        <div className="border-2 border-blue-300 rounded-lg p-6 bg-blue-50">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <div className="flex-1">
                <h5 className="text-sm font-semibold text-gray-900">Specify Link Text</h5>
                <p className="text-xs text-gray-600 mt-0.5">Enter the text that will appear as the download link in your chatbot</p>
              </div>
            </div>
            
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Link Text *
                </label>
                <input
                  type="text"
                  value={pendingTitle}
                  onChange={(e) => setPendingTitle(e.target.value)}
                  placeholder="e.g., Download Study Guide PDF"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && pendingTitle.trim()) {
                      handleUploadWithTitle();
                    } else if (e.key === 'Escape') {
                      handleCancelUpload();
                    }
                  }}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Selected file: <span className="font-mono text-gray-700">{pendingFile?.name}</span>
                </p>
              </div>
              
              {uploadError && (
                <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">
                  {uploadError}
                </div>
              )}
              
              <div className="flex justify-end gap-2">
                <button
                  onClick={handleCancelUpload}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
                  disabled={uploading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleUploadWithTitle}
                  disabled={uploading || !pendingTitle.trim()}
                  className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {uploading ? 'Uploading...' : 'Upload & Add'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual URL Entry - Only show when not prompting for title */}
      {!showTitlePrompt && (
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
      )}

      {/* Downloads List */}
      {attachments.length > 0 && (
        <div className="space-y-3">
          <h5 className="text-sm font-medium text-gray-900 flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download Links ({attachments.length})
          </h5>

          {attachments.map((attachment, index) => {
            const download = downloadsForDisplay[index];
            const isEditing = editingIndex === index;
            const isManualEntry = attachment.id.startsWith('temp-') || !download.url || !download.title;

            return (
              <div
                key={attachment.id}
                className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-sm transition-shadow"
              >
                {isEditing || isManualEntry ? (
                  // Edit Mode
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Link Text (Display Name) *
                      </label>
                      <input
                        type="text"
                        value={download.title}
                        onChange={(e) => handleManualChange(index, 'title', e.target.value)}
                        placeholder="e.g., Download Study Guide PDF"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">This text will appear as the clickable download link</p>
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
                          if (isManualEntry) {
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
                        onClick={() => {
                          if (isManualEntry) {
                            handleSaveManualEntry(index);
                          } else {
                            setEditingIndex(null);
                          }
                        }}
                        disabled={!download.url || !download.title || !isValidUrl(download.url)}
                        className="px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Save
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
                        title="Edit link text"
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

      {attachments.length === 0 && (
        <div className="text-center py-6 text-gray-500 text-sm">
          No downloads yet. Upload a file or add a manual URL to get started.
        </div>
      )}
    </div>
  );
}

