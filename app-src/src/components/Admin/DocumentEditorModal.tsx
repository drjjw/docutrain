import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/UI/Button';
import { Toggle } from '@/components/UI/Toggle';
import { WysiwygEditor } from '@/components/UI/WysiwygEditor';
import { FileUploadManager } from './FileUploadManager';
import { CoverImageUploader } from './CoverImageUploader';
import { DocumentRetrainer } from './DocumentRetrainer';
import { updateDocument, checkSlugUniqueness } from '@/lib/supabase/admin';
import type { DocumentWithOwner, Owner, DocumentAccessLevel } from '@/types/admin';

interface DocumentEditorModalProps {
  document: DocumentWithOwner | null;
  owners: Owner[];
  isSuperAdmin?: boolean;
  onSave: () => void;
  onCancel: () => void;
}

export function DocumentEditorModal({ document, owners, isSuperAdmin = false, onSave, onCancel }: DocumentEditorModalProps) {
  const [editingValues, setEditingValues] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retraining, setRetraining] = useState(false);
  const [showRetrainSection, setShowRetrainSection] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

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
        active: document.active ?? true,
        access_level: document.access_level || 'public',
        passcode: document.passcode || '',
        welcome_message: document.welcome_message || '',
        intro_message: document.intro_message || '',
        downloads: document.downloads || [],
      });
    }
  }, [document]);

  const handleFieldChange = (field: string, value: any) => {
    console.log('DocumentEditorModal: Field change:', field, value);
    setEditingValues(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    console.log('DocumentEditorModal: handleSave called');
    try {
      setSaving(true);
      setError(null);

      // Validate slug uniqueness if slug has been changed
      const newSlug = editingValues.slug?.trim();
      const originalSlug = document.slug;

      if (newSlug && newSlug !== originalSlug) {
        const isUnique = await checkSlugUniqueness(newSlug, document.id);
        if (!isUnique) {
          setError('This slug is already taken. Please choose a different slug.');
          return;
        }
      }

      await updateDocument(document.id, editingValues);
      
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

  const renderField = (field: string, label: string, type: 'text' | 'textarea' | 'number' | 'select' | 'checkbox' | 'toggle' | 'wysiwyg' = 'text', options?: { description?: string }) => {
    const value = editingValues[field];

    const inputClasses = "px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 w-full";

    switch (type) {
      case 'textarea':
        return (
          <textarea
            value={value || ''}
            onChange={(e) => handleFieldChange(field, e.target.value)}
            rows={3}
            placeholder={`Enter ${label.toLowerCase()}...`}
            className={inputClasses}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={value ?? ''}
            onChange={(e) => handleFieldChange(field, e.target.value === '' ? null : parseInt(e.target.value) || null)}
            min="1"
            max="200"
            className={inputClasses.replace('w-full', 'w-32')}
          />
        );

      case 'select':
        if (field === 'embedding_type') {
          return (
            <select
              value={value || 'openai'}
              onChange={(e) => handleFieldChange(field, e.target.value)}
              className={inputClasses}
            >
              <option value="openai">OpenAI</option>
              <option value="local">Local</option>
            </select>
          );
        } else if (field === 'owner_id') {
          return (
            <select
              value={value || ''}
              onChange={(e) => handleFieldChange(field, e.target.value || null)}
              className={inputClasses}
            >
              <option value="">None</option>
              {owners.map(owner => (
                <option key={owner.id} value={owner.id}>
                  {owner.name}
                </option>
              ))}
            </select>
          );
        } else if (field === 'category') {
          return (
            <select
              value={value || ''}
              onChange={(e) => handleFieldChange(field, e.target.value === '' ? null : e.target.value)}
              className={inputClasses}
            >
              <option value="">None</option>
              <option value="Guidelines">Guidelines</option>
              <option value="Maker">Maker</option>
              <option value="Manuals">Manuals</option>
              <option value="Presentation">Presentation</option>
              <option value="Recipes">Recipes</option>
              <option value="Reviews">Reviews</option>
              <option value="Slides">Slides</option>
              <option value="Training">Training</option>
            </select>
          );
        }
        break;

      case 'checkbox':
        return (
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={value || false}
              onChange={(e) => handleFieldChange(field, e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
          </div>
        );

      case 'toggle':
        return (
          <Toggle
            checked={value || false}
            onChange={(checked) => handleFieldChange(field, checked)}
            label={label}
            description={options?.description}
            size="md"
          />
        );

      case 'wysiwyg':
        return (
          <WysiwygEditor
            value={value || ''}
            onChange={(val) => handleFieldChange(field, val)}
            placeholder={`Enter ${label.toLowerCase()} with basic HTML formatting...`}
            className="w-full"
          />
        );

      default:
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => handleFieldChange(field, e.target.value)}
            placeholder={`Enter ${label.toLowerCase()}...`}
            className={inputClasses}
          />
        );
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

          {/* Scrollable content area */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="space-y-8">
              {/* Header Info */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Document Overview
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Document ID</label>
                    <div className="text-sm text-gray-900 font-mono bg-gray-50 px-3 py-2 rounded-lg break-all">{document.id}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Slug</label>
                    {renderField('slug', 'Slug')}
                  </div>
                  {isSuperAdmin && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Owner</label>
                      {renderField('owner_id', 'Owner', 'select')}
                    </div>
                  )}
                </div>
              </div>

              {/* Retrain Document Section */}
              {document.slug && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200 overflow-hidden">
                  <button
                    onClick={() => setShowRetrainSection(!showRetrainSection)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-amber-100/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-100 rounded-lg">
                        <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <h4 className="text-lg font-semibold text-gray-900">Retrain Document</h4>
                        <p className="text-sm text-gray-600">Upload new PDF to replace existing content</p>
                      </div>
                    </div>
                    <svg 
                      className={`w-5 h-5 text-gray-500 transition-transform ${showRetrainSection ? 'rotate-180' : ''}`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {showRetrainSection && (
                    <div className="px-6 py-4 border-t border-amber-200 bg-white">
                      <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex gap-2">
                          <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <div className="text-sm text-amber-800">
                            <p className="font-medium mb-1">Important:</p>
                            <ul className="list-disc list-inside space-y-1">
                              <li>This will delete all existing chunks for this document</li>
                              <li>The document slug <span className="font-mono bg-amber-100 px-1 rounded">{document.slug}</span> will be preserved</li>
                              <li>All metadata and settings will remain unchanged</li>
                              <li>Processing may take several minutes</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                      
                      <DocumentRetrainer
                        documentId={document.id}
                        documentSlug={document.slug}
                        onRetrainStart={() => {
                          setRetraining(true);
                          setError(null);
                        }}
                        onRetrainSuccess={() => {
                          setRetraining(false);
                          setShowRetrainSection(false);
                          onSave(); // Refresh the document list
                        }}
                        onRetrainError={(err) => {
                          setRetraining(false);
                          setError(err);
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Main Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Basic Information Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 bg-gradient-to-r from-emerald-50 to-green-50 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-100 rounded-lg">
                        <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <h4 className="text-lg font-semibold text-gray-900">Basic Information</h4>
                    </div>
                  </div>
                  <div className="px-6 py-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                      {renderField('title', 'Title')}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Subtitle</label>
                      {renderField('subtitle', 'Subtitle')}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                        {renderField('category', 'Category', 'select')}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
                        {renderField('year', 'Year', 'number')}
                      </div>
                    </div>
                    {isSuperAdmin && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Back Link</label>
                        {renderField('back_link', 'Back Link')}
                      </div>
                    )}
                  </div>
                </div>

                {/* File & Technical Details Card */}
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
                      {renderField('pdf_filename', 'PDF Filename')}
                    </div>
                    {isSuperAdmin && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">PDF Subdirectory</label>
                          {renderField('pdf_subdirectory', 'PDF Subdirectory')}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Embedding Type</label>
                          {renderField('embedding_type', 'Embedding Type', 'select')}
                        </div>
                      </>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Cover Image</label>
                      <CoverImageUploader
                        coverUrl={editingValues.cover || ''}
                        onChange={(url) => handleFieldChange('cover', url)}
                        documentId={document.id}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Settings & Permissions Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900">Settings & Permissions</h4>
                  </div>
                </div>
                <div className="px-6 py-4">
                  {/* Document Status */}
                  <div className="mb-6">
                    <h5 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
                      <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Status
                    </h5>
                    <div className="space-y-4">
                      {renderField('active', 'Active Document', 'toggle', {
                        description: 'When enabled, this document is available for users to access'
                      })}
                    </div>
                  </div>

                  {/* Access Level - Full Width */}
                  <div className="mb-6">
                        <h5 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                          Access Level
                        </h5>
                        
                        {/* Compact Grid Layout */}
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          {/* Public */}
                          <label className={`relative flex flex-col p-4 border-2 rounded-lg cursor-pointer transition-all ${
                            editingValues.access_level === 'public' 
                              ? 'border-blue-500 bg-blue-50 shadow-sm' 
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}>
                            <input
                              type="radio"
                              name="access_level"
                              value="public"
                              checked={editingValues.access_level === 'public'}
                              onChange={(e) => handleFieldChange('access_level', e.target.value)}
                              className="sr-only"
                            />
                            <div className="flex items-center gap-2 mb-1">
                              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 002 2h2.945M11 3.055V5a2 2 0 002 2h1M13 13v2.945M20.945 13H19a2 2 0 00-2-2v-1a2 2 0 00-2-2 2 2 0 00-2-2H9.055M11 20.945V19a2 2 0 002-2v-1a2 2 0 002 2h2.945M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className="font-medium text-gray-900">Public</span>
                            </div>
                            <span className="text-xs text-gray-600">No login required</span>
                          </label>

                          {/* Passcode */}
                          <label className={`relative flex flex-col p-4 border-2 rounded-lg cursor-pointer transition-all ${
                            editingValues.access_level === 'passcode'
                              ? 'border-docutrain-medium bg-docutrain-light/10 shadow-sm' 
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}>
                            <input
                              type="radio"
                              name="access_level"
                              value="passcode"
                              checked={editingValues.access_level === 'passcode'}
                              onChange={(e) => handleFieldChange('access_level', e.target.value)}
                              className="sr-only"
                            />
                            <div className="flex items-center gap-2 mb-1">
                              <svg className="w-5 h-5 text-docutrain-medium" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                              </svg>
                              <span className="font-medium text-gray-900">Passcode</span>
                            </div>
                            <span className="text-xs text-gray-600">URL with passcode</span>
                            <span className="text-xs text-docutrain-medium mt-0.5">(Coming soon)</span>
                          </label>

                          {/* Registered */}
                          <label className={`relative flex flex-col p-4 border-2 rounded-lg cursor-pointer transition-all ${
                            editingValues.access_level === 'registered' 
                              ? 'border-green-500 bg-green-50 shadow-sm' 
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}>
                            <input
                              type="radio"
                              name="access_level"
                              value="registered"
                              checked={editingValues.access_level === 'registered'}
                              onChange={(e) => handleFieldChange('access_level', e.target.value)}
                              className="sr-only"
                            />
                            <div className="flex items-center gap-2 mb-1">
                              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              <span className="font-medium text-gray-900">Registered</span>
                            </div>
                            <span className="text-xs text-gray-600">Any logged-in user</span>
                          </label>

                          {/* Owner Restricted */}
                          <label className={`relative flex flex-col p-4 border-2 rounded-lg transition-all ${
                            !editingValues.owner_id 
                              ? 'opacity-50 cursor-not-allowed border-gray-200 bg-gray-50' 
                              : editingValues.access_level === 'owner_restricted'
                                ? 'border-yellow-500 bg-yellow-50 shadow-sm cursor-pointer'
                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 cursor-pointer'
                          }`}>
                            <input
                              type="radio"
                              name="access_level"
                              value="owner_restricted"
                              checked={editingValues.access_level === 'owner_restricted'}
                              onChange={(e) => handleFieldChange('access_level', e.target.value)}
                              disabled={!editingValues.owner_id}
                              className="sr-only"
                            />
                            <div className="flex items-center gap-2 mb-1">
                              <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                              </svg>
                              <span className="font-medium text-gray-900">Owner Group</span>
                            </div>
                            <span className="text-xs text-gray-600">Group members only</span>
                          </label>

                          {/* Owner Admins Only */}
                          <label className={`relative flex flex-col p-4 border-2 rounded-lg transition-all col-span-2 ${
                            !editingValues.owner_id 
                              ? 'opacity-50 cursor-not-allowed border-gray-200 bg-gray-50' 
                              : editingValues.access_level === 'owner_admin_only'
                                ? 'border-red-500 bg-red-50 shadow-sm cursor-pointer'
                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 cursor-pointer'
                          }`}>
                            <input
                              type="radio"
                              name="access_level"
                              value="owner_admin_only"
                              checked={editingValues.access_level === 'owner_admin_only'}
                              onChange={(e) => handleFieldChange('access_level', e.target.value)}
                              disabled={!editingValues.owner_id}
                              className="sr-only"
                            />
                            <div className="flex items-center gap-2 mb-1">
                              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                              </svg>
                              <span className="font-medium text-gray-900">Owner Admins Only</span>
                            </div>
                            <span className="text-xs text-gray-600">Administrators of {editingValues.owner_id ? (owners.find(o => o.id === editingValues.owner_id)?.name || 'owner group') : 'owner group'} only</span>
                          </label>
                        </div>

                        {/* Warning for owner-restricted options */}
                        {!editingValues.owner_id && (
                          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                            <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                            <div>
                              <div className="font-medium text-amber-900">Owner Required</div>
                              <div className="text-amber-700 mt-0.5">Select an owner above to enable owner-based access levels</div>
                            </div>
                          </div>
                        )}

                        {/* Passcode Input Field */}
                        {editingValues.access_level === 'passcode' && (
                          <div className="mt-3 p-4 bg-docutrain-light/10 border border-docutrain-light/30 rounded-lg">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Passcode</label>
                            <input
                              type="text"
                              value={editingValues.passcode || ''}
                              onChange={(e) => handleFieldChange('passcode', e.target.value)}
                              placeholder="Enter passcode..."
                              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-docutrain-medium focus:border-docutrain-medium w-full"
                            />
                            <p className="text-xs text-gray-600 mt-2">Users will need to append <code className="px-1 py-0.5 bg-white rounded text-docutrain-medium">?passcode=VALUE</code> to the URL</p>
                          </div>
                        )}
                      </div>

                  {/* Technical Configuration - Super Admin Only */}
                  {isSuperAdmin && (
                    <div className="mb-6">
                      <h5 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Technical Configuration
                      </h5>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">Chunk Limit Override</label>
                        <div className="max-w-xs">
                          {renderField('chunk_limit_override', 'Chunk Limit Override', 'number')}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Override the default maximum number of chunks to process (leave empty for default)
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* UI Configuration Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900">UI Configuration</h4>
                  </div>
                </div>
                <div className="px-6 py-4 space-y-4">
                  {renderField('show_document_selector', 'Document Selector', 'toggle', {
                    description: 'Show a document selection interface in the chat interface'
                  })}
                  {renderField('show_keywords', 'Show Keywords Cloud', 'toggle', {
                    description: 'Display the keywords cloud in the chat interface'
                  })}
                  {renderField('show_downloads', 'Show Downloads Section', 'toggle', {
                    description: 'Display the downloads section in the chat interface'
                  })}
                </div>
              </div>

              {/* Content Messages Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 bg-gradient-to-r from-rose-50 to-pink-50 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-100 rounded-lg">
                      <svg className="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900">Content Messages</h4>
                  </div>
                </div>
                <div className="px-6 py-4 space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">Welcome Message</label>
                    <div className="text-xs text-gray-500 mb-2">HTML formatted welcome message. Supports: &lt;p&gt;, &lt;strong&gt;, &lt;em&gt;, &lt;br&gt;, &lt;ul&gt;, &lt;ol&gt;, &lt;li&gt;, &lt;a&gt;</div>
                    {renderField('welcome_message', 'Welcome Message', 'wysiwyg')}
                    {editingValues.welcome_message && (
                      <div className="mt-4 p-4 bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 rounded-lg">
                        <div className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Preview
                        </div>
                        <div className="prose prose-sm max-w-none text-gray-800 wysiwyg-preview" dangerouslySetInnerHTML={{ __html: editingValues.welcome_message }} />
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">Intro Message</label>
                    <div className="text-xs text-gray-500 mb-2">HTML formatted introduction message. Supports: &lt;p&gt;, &lt;strong&gt;, &lt;em&gt;, &lt;br&gt;, &lt;ul&gt;, &lt;ol&gt;, &lt;li&gt;, &lt;a&gt;</div>
                    {renderField('intro_message', 'Intro Message', 'wysiwyg')}
                    {editingValues.intro_message && (
                      <div className="mt-4 p-4 bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 rounded-lg">
                        <div className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Preview
                        </div>
                        <div className="prose prose-sm max-w-none text-gray-800 wysiwyg-preview" dangerouslySetInnerHTML={{ __html: editingValues.intro_message }} />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Downloads Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 bg-gradient-to-r from-cyan-50 to-blue-50 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-cyan-100 rounded-lg">
                      <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900">Downloadable Files</h4>
                      <p className="text-xs text-gray-600 mt-0.5">Upload supporting documents that will be available for download within your document chatbot interface</p>
                    </div>
                  </div>
                </div>
                <div className="px-6 py-4">
                  <FileUploadManager
                    downloads={editingValues.downloads || []}
                    onChange={(downloads) => handleFieldChange('downloads', downloads)}
                    documentId={document.id}
                  />
                </div>
              </div>

              {/* Metadata & Timestamps Card - Super Admin Only */}
              {isSuperAdmin && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-gray-50 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-100 rounded-lg">
                        <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <h4 className="text-lg font-semibold text-gray-900">Metadata & Timestamps</h4>
                    </div>
                  </div>
                  <div className="px-6 py-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div>
                        <h5 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Timestamps
                        </h5>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Created:</span>
                            <span className="text-gray-900 font-medium">{new Date(document.created_at).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Updated:</span>
                            <span className="text-gray-900 font-medium">{new Date(document.updated_at).toLocaleString()}</span>
                          </div>
                          {document.uploaded_by_user_id && (
                            <div className="flex justify-between items-start pt-2 border-t border-gray-200">
                              <span className="text-gray-600">Uploaded by:</span>
                              <div className="text-right">
                                <div className="text-gray-900 font-medium font-mono text-xs break-all max-w-[200px]">
                                  {document.uploaded_by_user_id}
                                </div>
                                {isSuperAdmin && (
                                  <div className="text-xs text-gray-500 mt-0.5">
                                    (User ID - email available in user management)
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <h5 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                          </svg>
                          Document Metadata
                        </h5>
                        <div className="bg-gray-50 rounded-lg p-3 max-h-32 overflow-y-auto">
                          <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                            {JSON.stringify(document.metadata, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
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
