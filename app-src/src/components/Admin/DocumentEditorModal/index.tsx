import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/UI/Button';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from '@/components/UI/Tabs';
import { updateDocument, checkSlugUniqueness, checkReferencesDisabled } from '@/lib/supabase/admin';
import { DocumentOverviewSection } from './DocumentOverviewSection';
import { DocumentRetrainSection } from './DocumentRetrainSection';
import { DocumentTrainingHistory } from './DocumentTrainingHistory';
import { DocumentBasicInfoCard } from './DocumentBasicInfoCard';
import { DocumentFileDetailsCard } from './DocumentFileDetailsCard';
import { DocumentSettingsCard } from './DocumentSettingsCard';
import { DocumentUIConfigCard } from './DocumentUIConfigCard';
import { DocumentMessagesCard } from './DocumentMessagesCard';
import { DocumentDisclaimerCard } from './DocumentDisclaimerCard';
import { DocumentDownloadsCard } from './DocumentDownloadsCard';
import { DocumentMetadataCard } from './DocumentMetadataCard';
import { DocumentEmbedCodeCard } from './DocumentEmbedCodeCard';
import { QuizQuestionsAndStats } from './QuizQuestionsAndStats';
import { QuizGenerationSection } from './QuizGenerationSection';
import type { DocumentEditorModalProps } from './types';
import { debugLog } from '@/utils/debug';

export function DocumentEditorModal({ document, owners, isSuperAdmin = false, onSave, onCancel, onRetrainingStart, onRetrainSuccess }: DocumentEditorModalProps) {
  const [editingValues, setEditingValues] = useState<Record<string, any>>({});
  const [baselineValues, setBaselineValues] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [savedField, setSavedField] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [retraining, setRetraining] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [yearError, setYearError] = useState<string | null>(null);
  const [referencesDisabled, setReferencesDisabled] = useState(false);
  const [referencesDisabledReason, setReferencesDisabledReason] = useState<string | null>(null);
  
  // Ref to track debounce timeout for auto-save
  const autoSaveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  
  // UI config toggle fields that should auto-save
  const autoSaveToggleFields = [
    'show_document_selector',
    'show_keywords',
    'show_downloads',
    'show_references',
    'show_recent_questions',
    'show_country_flags',
    'show_quizzes'
  ];

  debugLog('DocumentEditorModal rendering - document:', document?.id, 'editingValues.downloads:', editingValues.downloads?.length);

  // Debug component lifecycle
  React.useEffect(() => {
    debugLog('DocumentEditorModal mounted for document:', document?.id);
    
    return () => {
      debugLog('DocumentEditorModal unmounting for document:', document?.id);
    };
  }, []);

  React.useEffect(() => {
    if (error) {
      debugLog('DocumentEditorModal: Error state changed:', error);
    }
  }, [error]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onCancel();
    }, 200); // Match animation duration
  }, [onCancel]);

  if (!document) {
    debugLog('DocumentEditorModal: No document provided, returning null');
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

  // Helper function to normalize values for comparison
  const normalizeValue = (value: any): any => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number') return value;
    if (Array.isArray(value)) return JSON.stringify(value);
    return value;
  };

  // Helper function to check if there are changes
  const hasChanges = React.useCallback((): boolean => {
    if (!document || Object.keys(editingValues).length === 0) return false;
    
    const fieldsToCompare = [
      'title', 'subtitle', 'year', 'back_link', 'slug', 'owner_id',
      'pdf_filename', 'pdf_subdirectory', 'embedding_type', 'cover',
      'chunk_limit_override', 'show_document_selector', 'show_keywords',
      'show_downloads', 'show_references', 'show_recent_questions',
      'show_country_flags', 'show_quizzes', 'quizzes_generated',
      'active', 'access_level', 'passcode', 'welcome_message',
      'intro_message', 'show_disclaimer', 'disclaimer_text',
      'include_in_sitemap'
    ];

    for (const field of fieldsToCompare) {
      const currentValue = normalizeValue(editingValues[field]);
      const baselineValue = normalizeValue(baselineValues[field]);
      
      if (currentValue !== baselineValue) {
        return true;
      }
    }

    // Compare downloads array separately
    const currentDownloads = JSON.stringify(editingValues.downloads || []);
    const baselineDownloads = JSON.stringify(baselineValues.downloads || []);
    if (currentDownloads !== baselineDownloads) {
      return true;
    }

    return false;
  }, [editingValues, baselineValues, document]);

  // Track document ID to prevent unnecessary re-initialization
  const documentIdRef = React.useRef<string | null>(null);
  const documentSlugRef = React.useRef<string | null>(null);

  // Initialize editing values and baseline when document changes
  React.useEffect(() => {
    if (!document) return;
    
    // Only re-initialize if document ID or slug actually changed
    const docId = document.id;
    const docSlug = document.slug;
    
    if (documentIdRef.current === docId && documentSlugRef.current === docSlug) {
      debugLog('DocumentEditorModal: Document ID and slug unchanged, skipping re-initialization');
      return;
    }
    
    documentIdRef.current = docId;
    documentSlugRef.current = docSlug;
    
    debugLog('DocumentEditorModal: Initializing editing values for document:', document.slug);
    debugLog('DocumentEditorModal: show_disclaimer =', document.show_disclaimer);
    debugLog('DocumentEditorModal: disclaimer_text =', document.disclaimer_text);
    const initialValues = {
      title: document.title || '',
      subtitle: document.subtitle || '',
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
      show_recent_questions: document.show_recent_questions === true,
      show_country_flags: document.show_country_flags === true,
      show_quizzes: document.show_quizzes === true, // Explicitly check for true (defaults to false)
      quizzes_generated: document.quizzes_generated === true, // Explicitly check for true (defaults to false)
      active: document.active ?? true,
      access_level: document.access_level || 'public',
      passcode: document.passcode || '',
      welcome_message: document.welcome_message || '',
      intro_message: document.intro_message || '',
      downloads: document.downloads || [],
      show_disclaimer: document.show_disclaimer === true, // Explicitly check for true
      disclaimer_text: document.disclaimer_text || null,
      include_in_sitemap: document.include_in_sitemap !== false, // Default to true
    };
    setEditingValues(initialValues);
    setBaselineValues(initialValues); // Set baseline to same values initially
    debugLog('DocumentEditorModal: Set show_disclaimer to', document.show_disclaimer === true);
    debugLog('DocumentEditorModal: Set disclaimer_text to', document.disclaimer_text || null);
    debugLog('DocumentEditorModal: Full document object keys:', Object.keys(document));
    setYearError(null); // Clear year error when document changes
    
    // Check if references should be disabled
    if (document.id) {
      checkReferencesDisabled(document.id).then(({ disabled, reason }) => {
        setReferencesDisabled(disabled);
        setReferencesDisabledReason(reason);
        // If references are disabled, force show_references to false
        if (disabled) {
          setEditingValues(prev => ({ ...prev, show_references: false }));
        }
      }).catch(error => {
        debugLog('Error checking references disabled:', error);
        // Default to allowing references if check fails
        setReferencesDisabled(false);
        setReferencesDisabledReason(null);
      });
    }
  }, [document]);

  // Auto-save function for toggle fields
  const autoSaveToggleField = React.useCallback(async (field: string, value: any) => {
    if (!document?.id) return;
    
    try {
      setSavingField(field);
      setSavedField(null); // Clear any previous "Saved!" indicator
      setError(null);
      
      // Prepare the update object
      const updateData: Record<string, any> = { [field]: value };
      
      // Ensure boolean fields are explicitly set
      if (field === 'show_quizzes') {
        updateData.show_quizzes = value === true;
      }
      
      // Prevent enabling references for text uploads or when disabled
      const isTextUpload = 
        document.pdf_filename === 'text-upload' ||
        document.pdf_filename === 'text-content.txt' ||
        document.pdf_subdirectory === 'text-retrain' ||
        document.metadata?.upload_type === 'text' || 
        document.metadata?.upload_type === 'text_retrain';
      if (field === 'show_references' && (isTextUpload || referencesDisabled) && value === true) {
        updateData.show_references = false;
      }
      
      debugLog('DocumentEditorModal: Auto-saving toggle field:', field, value);
      await updateDocument(document.id, updateData);
      
      // Update baseline to reflect saved state
      setBaselineValues(prev => ({ ...prev, [field]: updateData[field] || value }));
      
      // Dispatch event to refresh other components
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('document-updated', {
          detail: { documentSlug: editingValues.slug || document.slug }
        }));
      }, 200);
      
      debugLog('DocumentEditorModal: Auto-save successful for field:', field);
      
      // Show "Saved!" indicator briefly
      setSavedField(field);
      setTimeout(() => {
        setSavedField(null);
      }, 2000); // Show for 2 seconds
    } catch (error) {
      console.error('Failed to auto-save toggle field:', error);
      setError(error instanceof Error ? error.message : 'Failed to auto-save. Please try again.');
    } finally {
      setSavingField(null);
    }
  }, [document, editingValues.slug, referencesDisabled]);

  const handleFieldChange = (field: string, value: any) => {
    debugLog('DocumentEditorModal: Field change:', field, value);
    
    // Clear success message when user starts editing
    if (successMessage) {
      setSuccessMessage(null);
    }
    
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
    
    // Prevent enabling references for text uploads or when disabled (multiple PDFs/retrain_add)
    // Primary check: pdf_filename column (most reliable indicator)
    const isTextUpload = 
      document.pdf_filename === 'text-upload' ||
      document.pdf_filename === 'text-content.txt' ||
      document.pdf_subdirectory === 'text-retrain' ||
      // Fallback: check metadata if pdf_filename isn't set
      document.metadata?.upload_type === 'text' || 
      document.metadata?.upload_type === 'text_retrain';
    if (field === 'show_references') {
      if ((isTextUpload || referencesDisabled) && value === true) {
        console.warn('Cannot enable references: text upload or disabled due to multiple PDFs/retrain_add');
        return; // Don't allow enabling references
      }
    }
    
    setEditingValues(prev => ({ ...prev, [field]: value }));
    
    // Auto-save toggle fields after a short debounce
    if (autoSaveToggleFields.includes(field)) {
      // Clear any "Saved!" indicator when user starts changing again
      setSavedField(null);
      
      // Clear existing timeout
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      
      // Set new timeout for auto-save (500ms debounce)
      autoSaveTimeoutRef.current = setTimeout(() => {
        autoSaveToggleField(field, value);
      }, 500);
    }
  };
  
  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  const handleSave = async () => {
    debugLog('DocumentEditorModal: handleSave called');
    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

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

      // Handle category_id: find or create category and set category_id
      if ('category_id' in documentUpdates && documentUpdates.category_id !== undefined) {
        // category_id is already set, no conversion needed
      } else if ('category' in documentUpdates && documentUpdates.category !== undefined) {
        // Legacy support: if category name is provided, convert to category_id
        const categoryName = documentUpdates.category;
        if (categoryName) {
          try {
            const { findOrCreateCategory } = await import('@/lib/supabase/admin');
            const categoryId = await findOrCreateCategory(categoryName, document.owner_id || null);
            documentUpdates.category_id = categoryId;
            delete documentUpdates.category; // Remove category field
          } catch (error) {
            console.error('Failed to find/create category:', error);
            // Continue without category_id if it fails
            delete documentUpdates.category; // Remove category field even on error
          }
        } else {
          documentUpdates.category_id = null;
          delete documentUpdates.category; // Remove category field
        }
      }

      // Ensure boolean fields are explicitly set (including false values)
      // This ensures they are properly saved to the database
      if ('show_quizzes' in editingValues) {
        documentUpdates.show_quizzes = editingValues.show_quizzes === true;
      }
      if ('quizzes_generated' in editingValues) {
        documentUpdates.quizzes_generated = editingValues.quizzes_generated === true;
      }

      // Prevent enabling references for text uploads or when disabled (multiple PDFs/retrain_add)
      // Primary check: pdf_filename column (most reliable indicator)
      const isTextUpload = 
        document.pdf_filename === 'text-upload' ||
        document.pdf_filename === 'text-content.txt' ||
        document.pdf_subdirectory === 'text-retrain' ||
        // Fallback: check metadata if pdf_filename isn't set
        document.metadata?.upload_type === 'text' || 
        document.metadata?.upload_type === 'text_retrain';
      if ((isTextUpload || referencesDisabled) && documentUpdates.show_references === true) {
        documentUpdates.show_references = false; // Force false for text uploads or when disabled
      }

      const saveStartTime = performance.now();
      debugLog('DocumentEditorModal: Saving document updates:', documentUpdates);
      await updateDocument(document.id, documentUpdates);
      const saveEndTime = performance.now();
      debugLog(`DocumentEditorModal: Save completed in ${(saveEndTime - saveStartTime).toFixed(2)}ms`);
      
      // Update baseline values to current editing values after successful save
      // This resets the change detection
      setBaselineValues({ ...editingValues });
      
      // Dispatch document-updated event with slug so listeners can clear the right cache
      // Note: Realtime subscription will also trigger a refresh, so this is mainly for other components
      // Use a small delay to ensure backend cache refresh completes
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('document-updated', {
          detail: { documentSlug: editingValues.slug || document.slug }
        }));
      }, 200);
      
      // Show success message
      setSuccessMessage('Changes saved');
      
      // Auto-dismiss success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
      
      // Don't call onSave() to keep modal open - user can continue editing
      // The document-updated event will refresh the data in the background
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
                className="relative w-10 h-10 flex items-center justify-center rounded-full bg-red-500 hover:bg-red-600 text-white border-2 border-white transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-red-300 focus:ring-offset-2"
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
                <Tab index={2}>Training History</Tab>
                <Tab index={3}>Settings & Access</Tab>
                <Tab index={4}>Options</Tab>
                {editingValues.show_quizzes === true && (
                  <Tab index={5}>Quiz</Tab>
                )}
                <Tab index={editingValues.show_quizzes === true ? 6 : 5}>Disclaimer</Tab>
                <Tab index={editingValues.show_quizzes === true ? 7 : 6}>Attachments</Tab>
                <Tab index={editingValues.show_quizzes === true ? 8 : 7}>Share</Tab>
                {isSuperAdmin && (
                  <Tab index={editingValues.show_quizzes === true ? 9 : 8}>Metadata</Tab>
                )}
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
                        categoryObj={document.category_obj}
                        year={editingValues.year}
                        backLink={editingValues.back_link || ''}
                        onFieldChange={handleFieldChange}
                        isSuperAdmin={isSuperAdmin}
                        yearError={yearError}
                        owner={document.owners || null}
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
                      onRetrainSuccess={(userDocumentId) => {
                        setRetraining(false);
                        // If onRetrainSuccess callback provided, call it with userDocumentId for immediate modal trigger
                        if (onRetrainSuccess && userDocumentId) {
                          onRetrainSuccess(userDocumentId);
                        }
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

                {/* Tab 3: Training History */}
                <TabPanel>
                  <div className="space-y-8">
                    <DocumentTrainingHistory documentSlug={document.slug || ''} />
                  </div>
                </TabPanel>

                {/* Tab 4: Settings & Access */}
                <TabPanel>
                  <div className="space-y-8">
                    <DocumentSettingsCard
                      active={editingValues.active ?? true}
                      accessLevel={editingValues.access_level || 'public'}
                      passcode={editingValues.passcode || ''}
                      ownerId={editingValues.owner_id}
                      owners={owners}
                      chunkLimitOverride={editingValues.chunk_limit_override}
                      includeInSitemap={editingValues.include_in_sitemap !== false}
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
                      showRecentQuestions={editingValues.show_recent_questions === true}
                      showCountryFlags={editingValues.show_country_flags === true}
                      showQuizzes={editingValues.show_quizzes === true}
                      quizzesGenerated={editingValues.quizzes_generated === true}
                      documentSlug={editingValues.slug || document.slug}
                      onFieldChange={handleFieldChange}
                      isSuperAdmin={isSuperAdmin}
                      isTextUpload={
                        // Primary check: pdf_filename column (most reliable indicator)
                        document.pdf_filename === 'text-upload' ||
                        document.pdf_filename === 'text-content.txt' ||
                        document.pdf_subdirectory === 'text-retrain' ||
                        // Fallback: check metadata if pdf_filename isn't set
                        document.metadata?.upload_type === 'text' || 
                        document.metadata?.upload_type === 'text_retrain'
                      }
                      referencesDisabled={referencesDisabled}
                      referencesDisabledReason={referencesDisabledReason}
                      savingField={savingField}
                      savedField={savedField}
                    />

                    <DocumentMessagesCard
                      welcomeMessage={editingValues.welcome_message || ''}
                      introMessage={editingValues.intro_message || ''}
                      onFieldChange={handleFieldChange}
                    />
                  </div>
                </TabPanel>

                {/* Tab 5: Quiz (when enabled) or Disclaimer (when disabled) */}
                <TabPanel>
                  {editingValues.show_quizzes === true ? (
                    <div className="space-y-8">
                      {editingValues.quizzes_generated === true ? (
                        <QuizQuestionsAndStats 
                          documentSlug={editingValues.slug || document.slug || ''} 
                          isSuperAdmin={isSuperAdmin}
                          onRegenerationSuccess={() => {
                            // Refresh the document data if needed
                            debugLog('Quiz regeneration successful');
                            // Only update if values have changed to prevent infinite loops
                            if (editingValues.quizzes_generated !== true) {
                              handleFieldChange('quizzes_generated', true);
                            }
                            if (editingValues.show_quizzes !== true) {
                              handleFieldChange('show_quizzes', true);
                            }
                          }}
                        />
                      ) : (
                        <>
                          <QuizGenerationSection
                            documentSlug={editingValues.slug || document.slug || ''}
                            quizzesGenerated={editingValues.quizzes_generated === true}
                            isSuperAdmin={isSuperAdmin}
                            onGenerationSuccess={() => {
                              handleFieldChange('quizzes_generated', true);
                              // Automatically enable show_quizzes if not already enabled
                              if (editingValues.show_quizzes !== true) {
                                handleFieldChange('show_quizzes', true);
                              }
                            }}
                          />
                          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                            <div className="flex items-start gap-3">
                              <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <div>
                                <p className="text-sm font-medium text-amber-900 mb-1">
                                  Quiz questions need to be generated
                                </p>
                                <p className="text-sm text-amber-800">
                                  Generate quiz questions using the button above. Once questions are generated, they will appear here and quizzes will be available to users.
                                </p>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-8">
                      <DocumentDisclaimerCard
                        showDisclaimer={editingValues.show_disclaimer || false}
                        disclaimerText={editingValues.disclaimer_text || null}
                        onFieldChange={handleFieldChange}
                      />
                    </div>
                  )}
                </TabPanel>

                {/* Tab 6: Disclaimer (when quiz enabled) or Attachments (when quiz disabled) */}
                <TabPanel>
                  {editingValues.show_quizzes === true ? (
                    <div className="space-y-8">
                      <DocumentDisclaimerCard
                        showDisclaimer={editingValues.show_disclaimer || false}
                        disclaimerText={editingValues.disclaimer_text || null}
                        onFieldChange={handleFieldChange}
                      />
                    </div>
                  ) : (
                    <div className="space-y-8">
                      <DocumentDownloadsCard
                        downloads={editingValues.downloads || []}
                        onDownloadsChange={(downloads) => handleFieldChange('downloads', downloads)}
                        documentId={document.id}
                      />
                    </div>
                  )}
                </TabPanel>

                {/* Tab 7: Attachments (when quiz enabled) or Embed Code (when quiz disabled) */}
                <TabPanel>
                  {editingValues.show_quizzes === true ? (
                    <div className="space-y-8">
                      <DocumentDownloadsCard
                        downloads={editingValues.downloads || []}
                        onDownloadsChange={(downloads) => handleFieldChange('downloads', downloads)}
                        documentId={document.id}
                      />
                    </div>
                  ) : (
                    <div className="space-y-8">
                      <DocumentEmbedCodeCard
                        documentSlug={editingValues.slug || document.slug || ''}
                        documentTitle={editingValues.title || document.title || ''}
                      />
                    </div>
                  )}
                </TabPanel>

                {/* Tab 8: Embed Code (when quiz enabled) or Metadata (when quiz disabled and super admin) */}
                <TabPanel>
                  {editingValues.show_quizzes === true ? (
                    <div className="space-y-8">
                      <DocumentEmbedCodeCard
                        documentSlug={editingValues.slug || document.slug || ''}
                        documentTitle={editingValues.title || document.title || ''}
                      />
                    </div>
                  ) : isSuperAdmin ? (
                    <div className="space-y-8">
                      <DocumentMetadataCard
                        document={document}
                        isSuperAdmin={isSuperAdmin}
                      />
                    </div>
                  ) : null}
                </TabPanel>

                {/* Tab 9: Metadata (Super Admin Only, only when quiz enabled) */}
                {isSuperAdmin && editingValues.show_quizzes === true && (
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
          <div className="bg-gray-50 px-4 py-3 md:px-6 md:py-4 border-t border-gray-200 flex items-center justify-end gap-3 flex-shrink-0">
            {/* Success message */}
            {successMessage && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>{successMessage}</span>
              </div>
            )}
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={saving || savingField !== null}
              className="flex-1 md:flex-none"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || savingField !== null || retraining || !hasChanges()}
              loading={saving}
              className="flex-1 md:flex-none"
            >
              {retraining ? 'Retraining in progress...' : 'Apply'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  // Render modal via portal at document body level to escape container constraints
  return createPortal(modalContent, window.document.body);
}

