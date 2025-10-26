import React, { useState } from 'react';
import { Button } from '@/components/UI/Button';
import { WysiwygEditor } from '@/components/UI/WysiwygEditor';
import { updateDocument, checkSlugUniqueness } from '@/lib/supabase/admin';
import type { DocumentWithOwner, Owner } from '@/types/admin';

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

  if (!document) return null;

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
        active: document.active ?? true,
        is_public: document.is_public ?? false,
        requires_auth: document.requires_auth ?? false,
        welcome_message: document.welcome_message || '',
        intro_message: document.intro_message || '',
      });
    }
  }, [document]);

  const handleFieldChange = (field: string, value: any) => {
    setEditingValues(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
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
      onSave();
    } catch (error) {
      console.error('Failed to save document:', error);
      setError(error instanceof Error ? error.message : 'Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const renderField = (field: string, label: string, type: 'text' | 'textarea' | 'number' | 'select' | 'checkbox' | 'wysiwyg' = 'text') => {
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

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
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
      `}</style>
      {/* Background overlay */}
      <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onCancel}></div>

      {/* Modal container - properly centered */}
      <div className="flex items-center justify-center min-h-screen p-4">
        {/* Modal panel */}
        <div className="bg-white rounded-lg shadow-xl transform transition-all max-w-6xl w-full max-h-[90vh] flex flex-col">
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
                onClick={onCancel}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Back Link</label>
                      {renderField('back_link', 'Back Link')}
                    </div>
                  </div>
                </div>

                {/* File & Technical Details Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 bg-gradient-to-r from-purple-50 to-violet-50 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">PDF Subdirectory</label>
                      {renderField('pdf_subdirectory', 'PDF Subdirectory')}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Embedding Type</label>
                        {renderField('embedding_type', 'Embedding Type', 'select')}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Cover Image</label>
                        {renderField('cover', 'Cover Image')}
                      </div>
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
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Chunk Limit Override</label>
                      {renderField('chunk_limit_override', 'Chunk Limit Override', 'number')}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Show Document Selector</label>
                      <div className="flex items-center h-10">
                        {renderField('show_document_selector', 'Show Document Selector', 'checkbox')}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Document Status</label>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600">Active:</span>
                          {renderField('active', 'Active', 'checkbox')}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600">Public:</span>
                          {renderField('is_public', 'Public', 'checkbox')}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600">Requires Auth:</span>
                          {renderField('requires_auth', 'Requires Auth', 'checkbox')}
                        </div>
                      </div>
                    </div>
                  </div>
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

              {/* Metadata & Timestamps Card */}
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
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end gap-3 flex-shrink-0">
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              loading={saving}
            >
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
