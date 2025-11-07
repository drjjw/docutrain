import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/UI/Button';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from '@/components/UI/Tabs';
import { updateDocument, checkSlugUniqueness } from '@/lib/supabase/admin';
import { DocumentOverviewSection } from './DocumentOverviewSection';
import { DocumentRetrainSection } from './DocumentRetrainSection';
import { DocumentBasicInfoCard } from './DocumentBasicInfoCard';
import { DocumentFileDetailsCard } from './DocumentFileDetailsCard';
import { DocumentSettingsCard } from './DocumentSettingsCard';
import { DocumentUIConfigCard } from './DocumentUIConfigCard';
import { DocumentMessagesCard } from './DocumentMessagesCard';
import { DocumentDisclaimerCard } from './DocumentDisclaimerCard';
import { DocumentDownloadsCard } from './DocumentDownloadsCard';
import { DocumentMetadataCard } from './DocumentMetadataCard';
import { DocumentEmbedCodeCard } from './DocumentEmbedCodeCard';
import type { DocumentEditorModalProps } from './types';

export function DocumentEditorModal({ document, owners, isSuperAdmin = false, onSave, onCancel, onRetrainingStart }: DocumentEditorModalProps) {
  const [editingValues, setEditingValues] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retraining, setRetraining] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [yearError, setYearError] = useState<string | null>(null);

  console.log('DocumentEditorModal rendering - document:', document?.id, 'editingValues.downloads:', editingValues.downloads?.length);

  // Debug component lifecycle
  React.useEffect(() => {
    console.log('DocumentEditorModal mounted for document:', document?.id);
    
    return () => {
      console.log('DocumentEditorModal unmounting for document:', document?.id);
    };
  }, []);

  React.useEffect(() => {
    if (error) {
      console.log('DocumentEditorModal: Error state changed:', error);
    }
  }, [error]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onCancel();
    }, 200); // Match animation duration
  }, [onCancel]);

  if (!document) {
    console.log('DocumentEditorModal: No document provided, returning null');
    return null;
  }

  // Ensure we're in the browser before using portal
  if (typeof window === 'undefined' || !window.document.body) {
    return null;
  }

  // Reset closing state when document changes
  React.useEffect(() => {
    if (document) {
      setIsClosing(false);
    }
  }, [document]);

  // Handle Escape key to close modal
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isClosing) {
        handleClose();
      }
    };

    window.document.addEventListener('keydown', handleEscape);
    return () => {
      window.document.removeEventListener('keydown', handleEscape);
    };
  }, [isClosing, handleClose]);

  // Initialize editing values when document changes
  React.useEffect(() => {
    if (document) {
      console.log('DocumentEditorModal: Initializing editing values for document:', document.slug);
      console.log('DocumentEditorModal: show_disclaimer =', document.show_disclaimer);
      console.log('DocumentEditorModal: disclaimer_text =', document.disclaimer_text);
      setEditingValues({
        title: document.title || '',
        subtitle: document.subtitle || '',
        category: document.category,
        year: document.year,
        back_link: document.back_link || '',
        slug: document.slug || '',
        owner_id: document.owner_id || '',
        pdf_filename: document.pdf_filename || '',
        pdf_subdirectory: document.pdf_subdirectory || '',
        embedding_type: document.embedding_type || 'openai',
        cover: document.cover || '',
        chunk_limit_override: document.chunk_limit_override,
        show_document_selector: document.show_document_selector || false,
        show_keywords: document.show_keywords !== false,
        show_downloads: document.show_downloads !== false,
        show_references: document.show_references !== false,
        active: document.active ?? true,
        access_level: document.access_level || 'public',
        passcode: document.passcode || '',
        welcome_message: document.welcome_message || '',
        intro_message: document.intro_message || '',
        downloads: document.downloads || [],
        show_disclaimer: document.show_disclaimer === true, // Explicitly check for true
        disclaimer_text: document.disclaimer_text || null,
      });
      console.log('DocumentEditorModal: Set show_disclaimer to', document.show_disclaimer === true);
      console.log('DocumentEditorModal: Set disclaimer_text to', document.disclaimer_text || null);
      console.log('DocumentEditorModal: Full document object keys:', Object.keys(document));
      setYearError(null); // Clear year error when document changes
    }
  }, [document]);

  const handleFieldChange = (field: string, value: any) => {
    console.log('DocumentEditorModal: Field change:', field, value);
    
    // Validate year field
    if (field === 'year') {
      if (value === null || value === '') {
        setYearError(null);
      } else {
        const yearNum = typeof value === 'number' ? value : parseInt(value);
        if (isNaN(yearNum)) {
          setYearError('Year must be a valid number');
        } else if (yearNum < 1900 || yearNum > 2100) {
          setYearError('Year must be between 1900 and 2100');
        } else {
          setYearError(null);
        }
      }
    }
    
    // Prevent enabling references for text uploads
    // Primary check: pdf_filename column (most reliable indicator)
    const isTextUpload = 
      document.pdf_filename === 'text-upload' ||
      document.pdf_filename === 'text-content.txt' ||
      document.pdf_subdirectory === 'text-retrain' ||
      // Fallback: check metadata if pdf_filename isn't set
      document.metadata?.upload_type === 'text' || 
      document.metadata?.upload_type === 'text_retrain';
    if (field === 'show_references' && isTextUpload && value === true) {
      console.warn('Cannot enable references for text uploads');
      return; // Don't allow enabling references for text uploads
    }
    
    setEditingValues(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    console.log('DocumentEditorModal: handleSave called');
    try {
      setSaving(true);
      setError(null);

      // Validate year before saving
      const yearValue = editingValues.year;
      if (yearValue !== null && yearValue !== undefined && yearValue !== '') {
        const yearNum = typeof yearValue === 'number' ? yearValue : parseInt(yearValue);
        if (isNaN(yearNum) || yearNum < 1900 || yearNum > 2100) {
          setError('Please enter a valid year between 1900 and 2100');
          setSaving(false);
          return;
        }
      }

      // Validate slug uniqueness if slug has been changed
      const newSlug = editingValues.slug?.trim();
      const originalSlug = document.slug;

      if (newSlug && newSlug !== originalSlug) {
        const isUnique = await checkSlugUniqueness(newSlug, document.id);
        if (!isUnique) {
          setError('This slug is already taken. Please choose a different slug.');
          setSaving(false);
          return;
        }
      }

      // Exclude downloads from document update - attachments are managed separately via FileUploadManager
      const { downloads, ...documentUpdates } = editingValues;

      // Prevent enabling references for text uploads
      // Primary check: pdf_filename column (most reliable indicator)
      const isTextUpload = 
        document.pdf_filename === 'text-upload' ||
        document.pdf_filename === 'text-content.txt' ||
        document.pdf_subdirectory === 'text-retrain' ||
        // Fallback: check metadata if pdf_filename isn't set
        document.metadata?.upload_type === 'text' || 
        document.metadata?.upload_type === 'text_retrain';
      if (isTextUpload && documentUpdates.show_references === true) {
        documentUpdates.show_references = false; // Force false for text uploads
      }

      await updateDocument(document.id, documentUpdates);
      
      // Dispatch document-updated event with slug so listeners can clear the right cache
      // Use a small delay to ensure backend cache refresh completes
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('document-updated', {
          detail: { documentSlug: editingValues.slug || document.slug }
        }));
      }, 200);
      
      onSave();
    } catch (error) {
      console.error('Failed to save document:', error);
      setError(error instanceof Error ? error.message : 'Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Use portal to render modal at document body level, outside any container constraints
  const modalContent = (
    <div className="fixed inset-0 z-50">
      <style>{`
        .wysiwyg-preview ul {
          list-style-type: disc;
          margin-left: 1.5rem;
          margin-top: 0.5rem;
          margin-bottom: 0.5rem;
        }
        .wysiwyg-preview ol {
          list-style-type: decimal;
          margin-left: 1.5rem;
          margin-top: 0.5rem;
          margin-bottom: 0.5rem;
        }
        .wysiwyg-preview li {
          margin-top: 0.25rem;
          margin-bottom: 0.25rem;
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes fadeOut {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }
        @keyframes slideIn {
          from {
            transform: translateY(-20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes slideOut {
          from {
            transform: translateY(0);
            opacity: 1;
          }
          to {
            transform: translateY(-20px);
            opacity: 0;
          }
        }
        .modal-overlay {
          animation: fadeIn 0.2s ease-out;
        }
        .modal-overlay.closing {
          animation: fadeOut 0.2s ease-out;
        }
        .modal-content {
          animation: slideIn 0.2s ease-out;
        }
        .modal-content.closing {
          animation: slideOut 0.2s ease-out;
        }
      `}</style>
      {/* Background overlay */}
      <div 
        className={`fixed inset-0 z-10 bg-gray-500 bg-opacity-75 modal-overlay ${isClosing ? 'closing' : ''}`}
        onClick={handleClose}
      ></div>

      {/* Modal container - fullscreen, above entire app */}
      <div className="fixed inset-0 z-20 flex flex-col">
        {/* Modal panel - fullscreen */}
        <div className={`bg-white w-full h-full flex flex-col shadow-xl modal-content ${isClosing ? 'closing' : ''}`}>
          {/* Header - fixed height */}
          <div className="bg-white px-6 py-4 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">{document.title || 'Untitled Document'}</h3>
                  <p className="text-sm text-gray-600">Document Details & Configuration</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="relative w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2"
                aria-label="Close modal"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="px-6 py-4 bg-red-50 border-b border-red-200">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          )}

          {/* Scrollable content area with tabs */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <Tabs defaultIndex={0}>
              <TabList>
                <Tab index={0}>Overview</Tab>
                <Tab index={1}>Retrain Document</Tab>
                <Tab index={2}>Settings & Access</Tab>
                <Tab index={3}>UI</Tab>
                <Tab index={4}>Disclaimer</Tab>
                <Tab index={5}>Attachments</Tab>
                <Tab index={6}>Embed Code</Tab>
                {isSuperAdmin && <Tab index={7}>Metadata</Tab>}
              </TabList>

              <TabPanels>
                {/* Tab 1: Overview */}
                <TabPanel>
                  <div className="space-y-8">
                    <DocumentOverviewSection
                      documentId={document.id}
                      slug={editingValues.slug || ''}
                      onSlugChange={(value) => handleFieldChange('slug', value)}
                      ownerId={editingValues.owner_id}
                      onOwnerChange={(value) => handleFieldChange('owner_id', value || null)}
                      owners={owners}
                      isSuperAdmin={isSuperAdmin}
                    />

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <DocumentBasicInfoCard
                        title={editingValues.title || ''}
                        subtitle={editingValues.subtitle || ''}
                        category={editingValues.category}
                        year={editingValues.year}
                        backLink={editingValues.back_link || ''}
                        onFieldChange={handleFieldChange}
                        isSuperAdmin={isSuperAdmin}
                        yearError={yearError}
                      />

                      <DocumentFileDetailsCard
                        pdfFilename={editingValues.pdf_filename || ''}
                        pdfSubdirectory={editingValues.pdf_subdirectory || ''}
                        embeddingType={editingValues.embedding_type || 'openai'}
                        cover={editingValues.cover || ''}
                        onFieldChange={handleFieldChange}
                        onCoverChange={(url) => handleFieldChange('cover', url)}
                        documentId={document.id}
                        isSuperAdmin={isSuperAdmin}
                      />
                    </div>
                  </div>
                </TabPanel>

                {/* Tab 2: Retrain Document */}
                <TabPanel>
                  <div className="space-y-8">
                    <DocumentRetrainSection
                      document={document}
                      retraining={retraining}
                      onRetrainStart={() => {
                        setRetraining(true);
                        setError(null);
                      }}
                      onRetrainSuccess={() => {
                        setRetraining(false);
                        onSave(); // Refresh the document list
                      }}
                      onRetrainError={(err) => {
                        setRetraining(false);
                        setError(err);
                      }}
                      onRetrainingStart={onRetrainingStart}
                    />
                  </div>
                </TabPanel>

                {/* Tab 3: Settings & Access */}
                <TabPanel>
                  <div className="space-y-8">
                    <DocumentSettingsCard
                      active={editingValues.active ?? true}
                      accessLevel={editingValues.access_level || 'public'}
                      passcode={editingValues.passcode || ''}
                      ownerId={editingValues.owner_id}
                      owners={owners}
                      chunkLimitOverride={editingValues.chunk_limit_override}
                      onFieldChange={handleFieldChange}
                      isSuperAdmin={isSuperAdmin}
                    />
                  </div>
                </TabPanel>

                {/* Tab 4: UI */}
                <TabPanel>
                  <div className="space-y-8">
                    <DocumentUIConfigCard
                      showDocumentSelector={editingValues.show_document_selector || false}
                      showKeywords={editingValues.show_keywords !== false}
                      showDownloads={editingValues.show_downloads !== false}
                      showReferences={editingValues.show_references !== false}
                      onFieldChange={handleFieldChange}
                      isTextUpload={
                        // Primary check: pdf_filename column (most reliable indicator)
                        document.pdf_filename === 'text-upload' ||
                        document.pdf_filename === 'text-content.txt' ||
                        document.pdf_subdirectory === 'text-retrain' ||
                        // Fallback: check metadata if pdf_filename isn't set
                        document.metadata?.upload_type === 'text' || 
                        document.metadata?.upload_type === 'text_retrain'
                      }
                    />

                    <DocumentMessagesCard
                      welcomeMessage={editingValues.welcome_message || ''}
                      introMessage={editingValues.intro_message || ''}
                      onFieldChange={handleFieldChange}
                    />
                  </div>
                </TabPanel>

                {/* Tab 5: Disclaimer */}
                <TabPanel>
                  <div className="space-y-8">
                    <DocumentDisclaimerCard
                      showDisclaimer={editingValues.show_disclaimer || false}
                      disclaimerText={editingValues.disclaimer_text || null}
                      onFieldChange={handleFieldChange}
                    />
                  </div>
                </TabPanel>

                {/* Tab 6: Attachments */}
                <TabPanel>
                  <div className="space-y-8">
                    <DocumentDownloadsCard
                      downloads={editingValues.downloads || []}
                      onDownloadsChange={(downloads) => handleFieldChange('downloads', downloads)}
                      documentId={document.id}
                    />
                  </div>
                </TabPanel>

                {/* Tab 7: Embed Code */}
                <TabPanel>
                  <div className="space-y-8">
                    <DocumentEmbedCodeCard
                      documentSlug={editingValues.slug || document.slug || ''}
                      documentTitle={editingValues.title || document.title || ''}
                    />
                  </div>
                </TabPanel>

                {/* Tab 8: Metadata (Super Admin Only) */}
                {isSuperAdmin && (
                  <TabPanel>
                    <div className="space-y-8">
                      <DocumentMetadataCard
                        document={document}
                        isSuperAdmin={isSuperAdmin}
                      />
                    </div>
                  </TabPanel>
                )}
              </TabPanels>
            </Tabs>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end gap-3 flex-shrink-0">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || retraining}
              loading={saving}
            >
              {retraining ? 'Retraining in progress...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  // Render modal via portal at document body level to escape container constraints
  return createPortal(modalContent, window.document.body);
}

