import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/UI/Button';
import { Spinner } from '@/components/UI/Spinner';
import { Alert } from '@/components/UI/Alert';
import { Input } from '@/components/UI/Input';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from '@/components/UI/Tabs';
import { LogoUploader } from '@/components/Admin/LogoUploader';
import { CoverImageUploader } from '@/components/Admin/CoverImageUploader';
import { useOwnerSettings } from './hooks/useOwnerSettings';
import { usePermissions } from '@/hooks/usePermissions';
import { getCategoriesForOwner, createCategory, deleteCategory } from '@/lib/supabase/admin';
import { invalidateCategoryCache } from '@/utils/categories';
import { sanitizePastedContent } from '@/utils/htmlSanitizer';
import type { Owner, Category } from '@/types/admin';

interface OwnerSettingsProps {
  ownerId: string;
}

export function OwnerSettings({ ownerId }: OwnerSettingsProps) {
  const { owner, loading, error, saving, updateSettings } = useOwnerSettings(ownerId);
  const { isSuperAdmin } = usePermissions();
  
  // Form state
  const [logoUrl, setLogoUrl] = useState('');
  const [introMessage, setIntroMessage] = useState('');
  const [defaultCover, setDefaultCover] = useState('');
  const [accentColor, setAccentColor] = useState('#3399ff');
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  // Initialize form state when owner data loads
  useEffect(() => {
    if (owner) {
      setLogoUrl(owner.logo_url || '');
      setIntroMessage(owner.intro_message || '');
      setDefaultCover(owner.default_cover || '');
      const metadata = owner.metadata as Record<string, any> | null;
      setAccentColor(metadata?.accent_color || '#3399ff');
    }
  }, [owner]);

  // Load owner-specific categories from database
  useEffect(() => {
    const loadCategories = async () => {
      if (!owner?.id || !isSuperAdmin) {
        setCategories([]);
        return;
      }

      try {
        setLoadingCategories(true);
        const ownerCategories = await getCategoriesForOwner(owner.id);
        // Filter to only owner-specific categories (exclude system defaults)
        const customCategories = ownerCategories.filter(cat => cat.owner_id === owner.id);
        setCategories(customCategories);
      } catch (error) {
        console.error('Failed to load owner categories:', error);
        setCategories([]);
      } finally {
        setLoadingCategories(false);
      }
    };

    loadCategories();
  }, [owner?.id, isSuperAdmin]);

  const handleSave = async () => {
    try {
      setSaveError(null);
      setSaveSuccess(false);

      const metadata: Record<string, any> = {
        accent_color: accentColor || undefined,
      };

      await updateSettings({
        logo_url: logoUrl || null,
        intro_message: introMessage || null,
        default_cover: defaultCover || null,
        metadata,
      });

      setSaveSuccess(true);
      invalidateCategoryCache(); // Clear cache after saving
      // Clear success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save settings');
    }
  };

  const handleAddCategory = async () => {
    const trimmed = newCategory.trim();
    if (!trimmed || !owner?.id) return;
    
    // Check if category already exists in owner's list
    if (categories.some(cat => cat.name.toLowerCase() === trimmed.toLowerCase())) {
      setCategoryError('This category already exists');
      return;
    }

    // Check if it conflicts with system defaults
    try {
      const systemDefaults = await getCategoriesForOwner(null);
      const systemDefaultNames = systemDefaults
        .filter(cat => cat.owner_id === null)
        .map(cat => cat.name.toLowerCase());
      
      if (systemDefaultNames.includes(trimmed.toLowerCase())) {
        setCategoryError('This category already exists as a system default. Please use the existing category instead.');
        return;
      }
    } catch (err) {
      console.warn('Failed to check system defaults:', err);
      // Continue anyway - better to allow than block
    }

    try {
      setLoadingCategories(true);
      setCategoryError(null);
      
      const newCat = await createCategory({
        name: trimmed,
        is_custom: true,
        owner_id: owner.id,
      });
      
      setCategories([...categories, newCat]);
      setNewCategory('');
      invalidateCategoryCache();
    } catch (err) {
      setCategoryError(err instanceof Error ? err.message : 'Failed to add category');
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleRemoveCategory = async (categoryId: number) => {
    if (!window.confirm('Are you sure you want to remove this category? Documents using this category will have their category_id set to NULL.')) {
      return;
    }

    try {
      setLoadingCategories(true);
      setCategoryError(null);
      
      await deleteCategory(categoryId);
      setCategories(categories.filter(cat => cat.id !== categoryId));
      invalidateCategoryCache();
    } catch (err) {
      setCategoryError(err instanceof Error ? err.message : 'Failed to remove category');
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleCategoryKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddCategory();
    }
  };

  const editorRef = useRef<HTMLDivElement>(null);
  const lastPropValueRef = useRef<string>('');

  // Initialize editor content when introMessage changes
  useEffect(() => {
    if (!editorRef.current) return;
    
    const newValue = introMessage || '';
    
    // Only update if the prop value has changed externally
    if (newValue !== lastPropValueRef.current) {
      // Use multiple attempts to ensure DOM is ready
      const setContent = () => {
        if (!editorRef.current) return;
        
        let cleanValue = newValue;
        cleanValue = cleanValue.replace(/^(<p><\/p>|<br\s*\/?>|\s)+/gi, '');
        cleanValue = cleanValue.replace(/(<p><\/p>|<br\s*\/?>|\s)+$/gi, '');
        if (!cleanValue.trim()) {
          cleanValue = '';
        }
        
        // Force update
        editorRef.current.innerHTML = cleanValue;
        document.execCommand('defaultParagraphSeparator', false, 'p');
        lastPropValueRef.current = newValue;
      };

      // Try immediately
      setContent();
      
      // Also try after a short delay to ensure DOM is ready
      const timer = setTimeout(setContent, 50);
      return () => clearTimeout(timer);
    }
  }, [introMessage]);

  const execCommand = (command: string, value?: string) => {
    editorRef.current?.focus();
    if (command === 'createLink') {
      const url = prompt('Enter URL:');
      if (url) {
        document.execCommand('createLink', false, url);
        requestAnimationFrame(() => {
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            let anchor: HTMLAnchorElement | null = null;
            const commonAncestor = range.commonAncestorContainer;
            if (commonAncestor.nodeType === Node.ELEMENT_NODE && (commonAncestor as Element).tagName === 'A') {
              anchor = commonAncestor as HTMLAnchorElement;
            } else if (commonAncestor.parentElement?.tagName === 'A') {
              anchor = commonAncestor.parentElement as HTMLAnchorElement;
            } else if (editorRef.current) {
              const links = editorRef.current.querySelectorAll('a');
              for (let i = links.length - 1; i >= 0; i--) {
                const link = links[i];
                const hrefAttr = link.getAttribute('href');
                if (hrefAttr === url || link.href === url || link.href.endsWith(url)) {
                  anchor = link as HTMLAnchorElement;
                  break;
                }
              }
            }
            if (anchor) {
              anchor.setAttribute('target', '_blank');
              anchor.setAttribute('rel', 'noopener noreferrer');
            }
          }
        });
      }
    } else {
      document.execCommand(command, false, value);
    }
  };

  const handleEditorInput = (e: React.FormEvent<HTMLDivElement>) => {
    if (editorRef.current) {
      const newContent = editorRef.current.innerHTML;
      // Update lastPropValueRef to match what user is editing
      lastPropValueRef.current = newContent;
      setIntroMessage(newContent);
    }
  };

  const handleEditorPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const clipboardData = e.clipboardData || (window as any).clipboardData;
    const sanitizedHtml = sanitizePastedContent(clipboardData, false);
    if (!sanitizedHtml) return;

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && editorRef.current) {
      const range = selection.getRangeAt(0);
      if (!editorRef.current.contains(range.commonAncestorContainer)) {
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
      }
      range.deleteContents();
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = sanitizedHtml;
      let lastNode: Node | null = null;
      const fragment = document.createDocumentFragment();
      while (tempDiv.firstChild) {
        lastNode = tempDiv.firstChild;
        fragment.appendChild(lastNode);
      }
      range.insertNode(fragment);
      if (lastNode) {
        range.setStartAfter(lastNode);
        range.collapse(true);
      } else {
        range.collapse(true);
      }
      selection.removeAllRanges();
      selection.addRange(range);
      setIntroMessage(editorRef.current.innerHTML);
    } else if (editorRef.current) {
      const currentHtml = editorRef.current.innerHTML;
      editorRef.current.innerHTML = currentHtml + sanitizedHtml;
      setIntroMessage(editorRef.current.innerHTML);
      setTimeout(() => {
        const range = document.createRange();
        const sel = window.getSelection();
        if (editorRef.current && sel) {
          range.selectNodeContents(editorRef.current);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }, 0);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!owner) {
    return (
      <Alert variant="error">
        Owner not found or you don't have permission to access it.
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl shadow-sm p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900 mb-1">{owner.name} Settings</h2>
            <p className="text-sm text-gray-600">
              Manage your owner group's branding, content, and configuration settings.
            </p>
          </div>
        </div>
      </div>

      {/* Success Message */}
      {saveSuccess && (
        <Alert variant="success" onDismiss={() => setSaveSuccess(false)}>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Settings saved successfully!
          </div>
        </Alert>
      )}

      {/* Error Messages */}
      {(error || saveError) && (
        <Alert variant="error" onDismiss={() => { setSaveError(null); }}>
          {error || saveError}
        </Alert>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <Tabs defaultIndex={0}>
          <TabList>
            <Tab index={0}>
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
                Branding
              </span>
            </Tab>
            <Tab index={1}>
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Content
              </span>
            </Tab>
            {isSuperAdmin && (
              <Tab index={2}>
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  Categories
                </span>
              </Tab>
            )}
          </TabList>

          <TabPanels>
            {/* Branding Tab */}
            <TabPanel>
              <div className="p-6 space-y-8">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                    </svg>
                    <div>
                      <h3 className="text-sm font-semibold text-purple-900 mb-1">Visual Branding</h3>
                      <p className="text-sm text-purple-700">Customize the visual appearance of your owner group's documents and interface.</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  {/* Logo and Cover Image Side by Side */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Logo Section */}
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-3">
                          Logo
                        </label>
                        <LogoUploader
                          logoUrl={logoUrl}
                          onChange={setLogoUrl}
                          ownerId={ownerId}
                          allowManualUrl={false}
                        />
                        <p className="mt-3 text-xs text-gray-500">
                          Upload your owner group's logo. This will be displayed in the dashboard and chat interface.
                        </p>
                      </div>

                      {/* Accent Color Section */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-3">
                          Accent Color
                        </label>
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={accentColor || '#3399ff'}
                            onChange={(e) => setAccentColor(e.target.value)}
                            className="w-20 h-14 border-2 border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 transition-colors"
                          />
                          <Input
                            value={accentColor}
                            onChange={(e) => setAccentColor(e.target.value)}
                            placeholder="#3399ff"
                            className="font-mono"
                            helperText="Hex color code for UI accents (buttons, highlights). Default: #3399ff"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Default Cover Image Section */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-3">
                        Default Cover Image
                      </label>
                      <CoverImageUploader
                        coverUrl={defaultCover}
                        onChange={setDefaultCover}
                        ownerId={ownerId}
                        allowManualUrl={false}
                      />
                      <p className="mt-3 text-xs text-gray-500">
                        Set a default cover image that will be used for documents in this owner group when no specific cover is set.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </TabPanel>

            {/* Content Tab */}
            <TabPanel>
              <div className="p-6 space-y-6">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div>
                      <h3 className="text-sm font-semibold text-amber-900 mb-1">Content Settings</h3>
                      <p className="text-sm text-amber-700">Configure default content that appears in your owner group's documents.</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-3">
                    Default HTML Intro Message for Documents
                  </label>
                  <style>{`
                    #owner-settings-intro-editor {
                      line-height: 1.7;
                      color: #212529;
                    }
                    #owner-settings-intro-editor p {
                      margin: 10px 0;
                      line-height: 1.7;
                    }
                    #owner-settings-intro-editor p:first-child {
                      margin-top: 0;
                    }
                    #owner-settings-intro-editor p:last-child {
                      margin-bottom: 0;
                    }
                    #owner-settings-intro-editor ul,
                    #owner-settings-intro-editor ol {
                      margin: 8px 0;
                      padding-left: 30px;
                    }
                    #owner-settings-intro-editor ul {
                      list-style: disc;
                    }
                    #owner-settings-intro-editor ol {
                      list-style: auto;
                    }
                    #owner-settings-intro-editor li {
                      margin: 5px 0;
                      line-height: 1.7;
                    }
                    #owner-settings-intro-editor strong {
                      font-weight: 600;
                      color: #333;
                    }
                    #owner-settings-intro-editor em {
                      font-style: italic;
                      color: #666;
                      font-size: 0.95em;
                    }
                    #owner-settings-intro-editor a {
                      font-weight: bold;
                      color: #007bff;
                      text-decoration: underline;
                    }
                    #owner-settings-intro-editor a:hover {
                      color: #0056b3;
                    }
                  `}</style>
                  {/* Toolbar */}
                  <div className="inline-editor-toolbar mb-0">
                    <button
                      type="button"
                      className="inline-editor-toolbar-btn"
                      onClick={() => execCommand('bold')}
                      title="Bold"
                    >
                      B
                    </button>
                    <button
                      type="button"
                      className="inline-editor-toolbar-btn"
                      onClick={() => execCommand('italic')}
                      title="Italic"
                    >
                      I
                    </button>
                    <button
                      type="button"
                      className="inline-editor-toolbar-btn"
                      onClick={() => execCommand('underline')}
                      title="Underline"
                    >
                      U
                    </button>
                    <div className="inline-editor-toolbar-separator" />
                    <button
                      type="button"
                      className="inline-editor-toolbar-btn"
                      onClick={() => execCommand('insertUnorderedList')}
                      title="Bullet List"
                    >
                      •
                    </button>
                    <button
                      type="button"
                      className="inline-editor-toolbar-btn"
                      onClick={() => execCommand('insertOrderedList')}
                      title="Numbered List"
                    >
                      1.
                    </button>
                    <div className="inline-editor-toolbar-separator" />
                    <button
                      type="button"
                      className="inline-editor-toolbar-btn"
                      onClick={() => execCommand('createLink')}
                      title="Insert Link"
                    >
                      🔗
                    </button>
                    <button
                      type="button"
                      className="inline-editor-toolbar-btn"
                      onClick={() => execCommand('unlink')}
                      title="Remove Link"
                    >
                      🔗❌
                    </button>
                  </div>
                  {/* Editor */}
                  <div
                    ref={(el) => {
                      editorRef.current = el;
                      // Initialize content when ref is set
                      if (el && introMessage) {
                        const newValue = introMessage || '';
                        if (newValue !== lastPropValueRef.current) {
                          let cleanValue = newValue;
                          cleanValue = cleanValue.replace(/^(<p><\/p>|<br\s*\/?>|\s)+/gi, '');
                          cleanValue = cleanValue.replace(/(<p><\/p>|<br\s*\/?>|\s)+$/gi, '');
                          if (!cleanValue.trim()) {
                            cleanValue = '';
                          }
                          el.innerHTML = cleanValue;
                          document.execCommand('defaultParagraphSeparator', false, 'p');
                          lastPropValueRef.current = newValue;
                        }
                      }
                    }}
                    contentEditable
                    className="inline-editor-active flex-1 overflow-y-auto border border-gray-300 rounded-b-lg p-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    id="owner-settings-intro-editor"
                    style={{ minHeight: '200px', maxHeight: '400px' }}
                    onInput={handleEditorInput}
                    onPaste={handleEditorPaste}
                  />
                  {introMessage && (
                    <div className="mt-4 p-4 bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 rounded-lg">
                      <div className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        Preview
                      </div>
                      <div className="prose prose-sm max-w-none text-gray-800 wysiwyg-preview" dangerouslySetInnerHTML={{ __html: introMessage }} />
                    </div>
                  )}
                  <p className="mt-3 text-xs text-gray-500">
                    HTML formatted introduction message that will be used as the default for all documents in this owner group.
                  </p>
                </div>
              </div>
            </TabPanel>

            {/* Categories Tab (Super Admin only) */}
            {isSuperAdmin && (
              <TabPanel>
                <div className="p-6 space-y-6">
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      <div>
                        <h3 className="text-sm font-semibold text-indigo-900 mb-1">Document Categories</h3>
                        <p className="text-sm text-indigo-700">Define custom category options for documents in this owner group. If no categories are set, system default categories will be used.</p>
                      </div>
                    </div>
                  </div>

                  {loadingCategories ? (
                    <div className="flex items-center justify-center py-12">
                      <svg className="animate-spin h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                  ) : (
                    <>
                      {/* Current Categories */}
                      {categories.length > 0 && (
                        <div>
                          <label className="block text-sm font-semibold text-gray-900 mb-3">
                            Current Categories
                          </label>
                          {categoryError && (
                            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                              <p className="text-sm text-red-600">{categoryError}</p>
                            </div>
                          )}
                          <div className="flex flex-wrap gap-2">
                            {categories.map((category) => (
                              <div
                                key={category.id}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-900 rounded-lg border border-indigo-200 shadow-sm"
                              >
                                <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                </svg>
                                <span className="text-sm font-medium">{category.name}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveCategory(category.id)}
                                  className="text-gray-400 hover:text-red-600 transition-colors ml-1"
                                  title="Remove category"
                                  disabled={loadingCategories}
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Add Category */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-3">
                          Add New Category
                        </label>
                        <div className="flex gap-2">
                          <Input
                            value={newCategory}
                            onChange={(e) => {
                              setNewCategory(e.target.value);
                              setCategoryError(null);
                            }}
                            onKeyDown={handleCategoryKeyDown}
                            placeholder="Enter category name (e.g., 'Guidelines', 'Training')"
                            disabled={loadingCategories}
                            helperText="Press Enter to add"
                          />
                          <Button
                            type="button"
                            onClick={handleAddCategory}
                            disabled={!newCategory.trim() || categories.some(cat => cat.name.toLowerCase() === newCategory.trim().toLowerCase()) || loadingCategories}
                            variant="secondary"
                            className="whitespace-nowrap"
                          >
                            {loadingCategories ? (
                              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            ) : (
                              <>
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Add
                              </>
                            )}
                          </Button>
                        </div>
                        {categories.length === 0 && (
                          <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
                            <p className="text-sm text-gray-600">
                              <strong>No custom categories set.</strong> System default categories will be used (configurable in Category Management).
                            </p>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </TabPanel>
            )}
          </TabPanels>
        </Tabs>
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-end gap-3 pt-4">
        <Button
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Saving...
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Save Settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
