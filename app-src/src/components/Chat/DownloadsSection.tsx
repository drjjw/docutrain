/**
 * DownloadsSection - Displays document download buttons
 * Matches vanilla JS implementation from ui-downloads.js
 */

import { useState } from 'react';
import { Download } from '@/hooks/useDocumentConfig';

interface DownloadWithDocTitle extends Download {
  documentTitle?: string;
}

interface DownloadsSectionProps {
  downloads: DownloadWithDocTitle[];
  isMultiDoc?: boolean;
}

export function DownloadsSection({ downloads, isMultiDoc = false }: DownloadsSectionProps) {
  const [downloadingStates, setDownloadingStates] = useState<Record<string, 'idle' | 'downloading' | 'error'>>({});

  if (!downloads || downloads.length === 0) {
    return null;
  }

  const handleDownload = async (download: DownloadWithDocTitle) => {
    const downloadKey = download.url;
    
    try {
      // Set downloading state
      setDownloadingStates(prev => ({ ...prev, [downloadKey]: 'downloading' }));
      
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
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        <span>Available Downloads</span>
      </div>
      
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
              <svg className="download-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="12" y1="18" x2="12" y2="12"></line>
                <polyline points="9 15 12 18 15 15"></polyline>
              </svg>
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
  );
}

