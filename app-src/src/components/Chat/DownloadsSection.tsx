/**
 * DownloadsSection - Displays document download buttons
 * Matches vanilla JS implementation from ui-downloads.js
 */

import { useState } from 'react';
import { Download } from '@/hooks/useDocumentConfig';
import { trackAttachmentDownload } from '@/lib/supabase/admin';
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
  Download as DownloadIcon,
} from 'lucide-react';

interface DownloadWithDocTitle extends Download {
  documentTitle?: string;
}

interface DownloadsSectionProps {
  downloads: DownloadWithDocTitle[];
  isMultiDoc?: boolean;
  isExpanded?: boolean; // Controlled by parent
}

/**
 * Get file extension from URL
 */
function getFileExtension(url: string): string {
  const urlParts = url.split('/');
  const filename = urlParts[urlParts.length - 1];
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  return extension;
}

/**
 * Get appropriate icon component based on file type
 */
function getFileIcon(url: string): JSX.Element {
  const extension = getFileExtension(url);
  
  // PDF icon
  if (extension === 'pdf') {
    return <FileText className="download-icon" size={24} />;
  }
  
  // PowerPoint icon (PPT, PPTX)
  if (extension === 'ppt' || extension === 'pptx') {
    return <Presentation className="download-icon" size={24} />;
  }
  
  // Word icon (DOC, DOCX)
  if (extension === 'doc' || extension === 'docx') {
    return <FileEdit className="download-icon" size={24} />;
  }
  
  // Excel icon (XLS, XLSX)
  if (extension === 'xls' || extension === 'xlsx') {
    return <FileSpreadsheet className="download-icon" size={24} />;
  }
  
  // Image icon (JPG, JPEG, PNG, GIF, SVG)
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(extension)) {
    return <ImageIcon className="download-icon" size={24} />;
  }
  
  // Archive icon (ZIP, RAR, 7Z, TAR, GZ)
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) {
    return <Archive className="download-icon" size={24} />;
  }
  
  // Video icon (MP4, AVI, MOV, WMV)
  if (['mp4', 'avi', 'mov', 'wmv', 'mkv', 'webm'].includes(extension)) {
    return <Video className="download-icon" size={24} />;
  }
  
  // Audio icon (MP3, WAV, OGG, M4A)
  if (['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(extension)) {
    return <Music className="download-icon" size={24} />;
  }
  
  // Default document icon
  return <File className="download-icon" size={24} />;
}

export function DownloadsSection({ downloads, isMultiDoc = false, isExpanded = true }: DownloadsSectionProps) {
  const [downloadingStates, setDownloadingStates] = useState<Record<string, 'idle' | 'downloading' | 'error'>>({});

  if (!downloads || downloads.length === 0) {
    return null;
  }

  const handleDownload = async (download: DownloadWithDocTitle) => {
    const downloadKey = download.url;
    
    try {
      // Set downloading state
      setDownloadingStates(prev => ({ ...prev, [downloadKey]: 'downloading' }));
      
      // Track download event if attachment_id is available
      if (download.attachment_id) {
        try {
          await trackAttachmentDownload(download.attachment_id);
        } catch (trackingError) {
          // Don't fail download if tracking fails
          console.warn('Failed to track download:', trackingError);
        }
      }
      
      // Extract filename from URL
      const urlParts = download.url.split('/');
      const filename = urlParts[urlParts.length - 1];
      
      // Fetch the file
      const response = await fetch(download.url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      // Get the blob
      const blob = await response.blob();
      
      // Create blob URL
      const blobUrl = window.URL.createObjectURL(blob);
      
      // Create temporary link and trigger download
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up blob URL
      window.URL.revokeObjectURL(blobUrl);
      
      // Reset state
      setDownloadingStates(prev => ({ ...prev, [downloadKey]: 'idle' }));
    } catch (error) {
      console.error(`❌ Download failed: ${download.url}`, error);
      
      // Set error state
      setDownloadingStates(prev => ({ ...prev, [downloadKey]: 'error' }));
      
      // Reset after 3 seconds
      setTimeout(() => {
        setDownloadingStates(prev => ({ ...prev, [downloadKey]: 'idle' }));
      }, 3000);
    }
  };

  const getButtonText = (download: DownloadWithDocTitle) => {
    const state = downloadingStates[download.url] || 'idle';
    switch (state) {
      case 'downloading':
        return 'Downloading...';
      case 'error':
        return 'Failed - Click to retry';
      default:
        return download.title;
    }
  };

  return (
    <div className="downloads-section">
      <div className="downloads-header">
        <DownloadIcon className="download-header-icon" size={16} />
        <span>Available Downloads</span>
      </div>
      
      <div className={`downloads-content ${isExpanded ? 'expanded' : 'collapsed'}`}>
        <div className="downloads-list">
        {downloads.map((download, index) => {
          const downloadKey = download.url;
          const state = downloadingStates[downloadKey] || 'idle';
          const isDownloading = state === 'downloading';
          const hasError = state === 'error';
          
          return (
            <button
              key={index}
              className={`download-button ${isDownloading ? 'downloading' : ''} ${hasError ? 'error' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                handleDownload(download);
              }}
              disabled={isDownloading}
            >
              {getFileIcon(download.url)}
              <div className="download-content">
                <div className="download-title">{getButtonText(download)}</div>
                {isMultiDoc && download.documentTitle && (
                  <div className="download-subtitle">{download.documentTitle}</div>
                )}
              </div>
            </button>
          );
        })}
        </div>
      </div>
    </div>
  );
}

