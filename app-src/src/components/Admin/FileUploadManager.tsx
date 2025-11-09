import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { 
  getDocumentAttachments, 
  createDocumentAttachment, 
  updateDocumentAttachment, 
  deleteDocumentAttachment 
} from '@/lib/supabase/admin';
import { CopyrightDisclaimerModal } from './CopyrightDisclaimerModal';
import { debugLog } from '@/utils/debug';
import {
  FileText,
  Presentation,
  FileSpreadsheet,
  FileEdit,
  Image as ImageIcon,
  Archive,
  Video,
  Music,
  File,
} from 'lucide-react';
import type { DownloadLink, DocumentAttachment } from '@/types/admin';

interface FileUploadManagerProps {
  downloads: DownloadLink[];
  onChange: (downloads: DownloadLink[]) => void;
  documentId: string;
}

const DOWNLOADS_BUCKET = 'downloads';

/**
 * Get file extension from filename
 */
function getFileExtension(filename: string): string {
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  return extension;
}

/**
 * Get appropriate icon component based on file type
 */
function getFileIconForPreview(filename: string): JSX.Element {
  const extension = getFileExtension(filename);
  
  // PDF icon
  if (extension === 'pdf') {
    return <FileText className="w-6 h-6" style={{ color: '#007bff' }} />;
  }
  
  // PowerPoint icon (PPT, PPTX)
  if (extension === 'ppt' || extension === 'pptx') {
    return <Presentation className="w-6 h-6" style={{ color: '#007bff' }} />;
  }
  
  // Word icon (DOC, DOCX)
  if (extension === 'doc' || extension === 'docx') {
    return <FileEdit className="w-6 h-6" style={{ color: '#007bff' }} />;
  }
  
  // Excel icon (XLS, XLSX)
  if (extension === 'xls' || extension === 'xlsx') {
    return <FileSpreadsheet className="w-6 h-6" style={{ color: '#007bff' }} />;
  }
  
  // Image icon (JPG, JPEG, PNG, GIF, SVG)
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(extension)) {
    return <ImageIcon className="w-6 h-6" style={{ color: '#007bff' }} />;
  }
  
  // Archive icon (ZIP, RAR, 7Z, TAR, GZ)
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) {
    return <Archive className="w-6 h-6" style={{ color: '#007bff' }} />;
  }
  
  // Video icon (MP4, AVI, MOV, WMV)
  if (['mp4', 'avi', 'mov', 'wmv', 'mkv', 'webm'].includes(extension)) {
    return <Video className="w-6 h-6" style={{ color: '#007bff' }} />;
  }
  
  // Audio icon (MP3, WAV, OGG, M4A)
  if (['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(extension)) {
    return <Music className="w-6 h-6" style={{ color: '#007bff' }} />;
  }
  
  // Default document icon
  return <File className="w-6 h-6" style={{ color: '#007bff' }} />;
}

export function FileUploadManager({ downloads, onChange, documentId }: FileUploadManagerProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingTitle, setPendingTitle] = useState<string>('');
  const [showTitlePrompt, setShowTitlePrompt] = useState(false);
  const [attachments, setAttachments] = useState<DocumentAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCopyrightModal, setShowCopyrightModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'upload' | null>(null);
  const [copyrightAcknowledgedAt, setCopyrightAcknowledgedAt] = useState<string | null>(null);
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

    debugLog('File selected:', file.name);
    
    // Store file and show copyright disclaimer first
    setPendingFile(file);
    setPendingTitle(file.name.replace(/\.[^/.]+$/, '')); // Remove extension for cleaner default
    setPendingAction('upload');
    setShowCopyrightModal(true);
    setUploadError(null);
  };

  const handleCopyrightAccept = () => {
    // Record the acknowledgment timestamp
    setCopyrightAcknowledgedAt(new Date().toISOString());
    setShowCopyrightModal(false);
    // After accepting copyright, proceed with upload
    setShowTitlePrompt(true);
    setPendingAction(null);
  };

  const handleCopyrightCancel = () => {
    setShowCopyrightModal(false);
    // Reset pending file and clear input
    setPendingFile(null);
    setPendingTitle('');
    setPendingAction(null);
    setCopyrightAcknowledgedAt(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUploadWithTitle = async () => {
    if (!pendingFile || !pendingTitle.trim()) {
      setUploadError('Please enter a link title');
      return;
    }

    debugLog('Starting file upload:', pendingFile.name, 'with title:', pendingTitle);

    try {
      setUploading(true);
      setUploadError(null);
      setShowTitlePrompt(false);

      // Create a unique filename with timestamp
      const timestamp = Date.now();
      const sanitizedFileName = pendingFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `${documentId}/${timestamp}-${sanitizedFileName}`;

      debugLog('Uploading to path:', filePath);

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

      debugLog('Upload successful, data:', data);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(DOWNLOADS_BUCKET)
        .getPublicUrl(filePath);

      debugLog('Public URL:', urlData.publicUrl);

      // Create attachment record via API
      const newAttachment = await createDocumentAttachment(documentId, {
        title: pendingTitle.trim(),
        url: urlData.publicUrl,
        storage_path: filePath,
        file_size: pendingFile.size,
        mime_type: pendingFile.type || undefined,
        copyright_acknowledged_at: copyrightAcknowledgedAt || undefined,
      });

      // Update local state
      setAttachments(prev => [...prev, newAttachment].sort((a, b) => a.display_order - b.display_order));

      debugLog('Attachment created successfully');

      // Reset state
      setPendingFile(null);
      setPendingTitle('');
      setCopyrightAcknowledgedAt(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      debugLog('File upload completed successfully');
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
    setCopyrightAcknowledgedAt(null);
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
      setEditingTitle('');
    } catch (error) {
      console.error('Failed to update attachment:', error);
      setUploadError('Failed to update attachment. Please try again.');
    }
  };


  debugLog('FileUploadManager rendering - uploading:', uploading, 'attachments:', attachments.length);

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
      {/* Copyright Disclaimer Modal */}
      <CopyrightDisclaimerModal
        isOpen={showCopyrightModal}
        onAccept={handleCopyrightAccept}
        onCancel={handleCopyrightCancel}
        fileName={pendingFile?.name}
      />

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
              
              {/* Preview Section */}
              {pendingTitle.trim() && pendingFile && (
                <div className="mb-3 pt-3 border-t border-gray-200">
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Preview
                  </label>
                  <div className="flex items-center justify-start">
                    <div 
                      className="inline-flex items-center justify-center gap-2 rounded-md border cursor-default"
                      style={{
                        padding: '10px 16px',
                        borderRadius: '6px',
                        background: 'linear-gradient(135deg, #ffffff 0%, #fefefe 100%)',
                        borderColor: '#dee2e6',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                        fontFamily: 'inherit',
                        fontSize: '13px',
                        fontWeight: 500,
                        color: '#495057',
                        gap: '8px',
                      }}
                    >
                      {getFileIconForPreview(pendingFile.name)}
                      <div style={{ flex: '0 1 auto', minWidth: 0 }}>
                        <div 
                          style={{
                            fontSize: '13px',
                            fontWeight: 500,
                            color: '#333',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {pendingTitle}
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    This is how the download button will appear in your chatbot
                  </p>
                </div>
              )}
              
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

      {/* Attachments List */}
      {attachments.length > 0 && (
        <div className="space-y-3">
          <h5 className="text-sm font-medium text-gray-900 flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Attachments ({attachments.length})
          </h5>

          {attachments.map((attachment, index) => {
            const download = downloadsForDisplay[index];
            const isEditing = editingIndex === index;

            return (
              <div
                key={attachment.id}
                className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-sm transition-shadow"
              >
                {isEditing ? (
                  // Edit Mode
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Link Text (Display Name) *
                      </label>
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        placeholder="e.g., Download Study Guide PDF"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && editingTitle.trim()) {
                            handleTitleChange(index, editingTitle);
                          } else if (e.key === 'Escape') {
                            setEditingIndex(null);
                            setEditingTitle('');
                          }
                        }}
                      />
                      <p className="text-xs text-gray-500 mt-1">This text will appear as the clickable download link</p>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setEditingIndex(null);
                          setEditingTitle('');
                        }}
                        className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleTitleChange(index, editingTitle)}
                        disabled={!editingTitle.trim()}
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
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="font-medium text-gray-900 text-sm">{download.title}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => {
                          setEditingIndex(index);
                          setEditingTitle(download.title);
                        }}
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
          No attachments yet. Upload a file to get started.
        </div>
      )}
    </div>
  );
}

