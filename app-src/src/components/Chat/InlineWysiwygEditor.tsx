/**
 * InlineWysiwygEditor - React component for inline editing of rich text fields (intro message)
 * Ported from vanilla JS inline-editor.js
 * Uses modal for editing instead of inline editing
 */

import { useState, useRef, useEffect } from 'react';
import { Modal } from '@/components/UI/Modal';
import { Pencil } from 'lucide-react';
import { debugLog } from '@/utils/debug';

interface InlineWysiwygEditorProps {
  value: string;
  field: string;
  documentSlug: string;
  onSave: (value: string) => Promise<boolean>;
  className?: string;
  id?: string;
}

/**
 * Normalize line breaks in HTML
 * Converts <div> tags to <p> tags and handles empty paragraphs
 */
function normalizeLineBreaks(html: string): string {
  if (!html) return '';
  
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  // Convert all <div> tags to <p> tags
  const divs = tempDiv.querySelectorAll('div');
  divs.forEach(div => {
    const p = document.createElement('p');
    while (div.firstChild) {
      p.appendChild(div.firstChild);
    }
    div.parentNode?.replaceChild(p, div);
  });
  
  // Convert empty <p> tags to <br> tags (but preserve structure)
  const emptyPs = tempDiv.querySelectorAll('p:empty');
  emptyPs.forEach(p => {
    const br = document.createElement('br');
    p.parentNode?.replaceChild(br, p);
  });
  
  let result = tempDiv.innerHTML;
  
  // Remove leading/trailing empty paragraphs and breaks
  result = result.replace(/^(<p><\/p>|<br\s*\/?>|\s)+/gi, '');
  result = result.replace(/(<p><\/p>|<br\s*\/?>|\s)+$/gi, '');
  
  return result;
}

/**
 * Sanitize HTML to prevent XSS attacks
 * Allows only safe HTML tags and attributes
 */
function sanitizeHTML(html: string): string {
  if (!html) return '';
  
  html = normalizeLineBreaks(html);
  
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  const allowedTags = {
    'p': [],
    'b': [],      // Allow <b> tags (created by execCommand('bold'))
    'strong': [],
    'i': [],      // Allow <i> tags (created by execCommand('italic'))
    'em': [],
    'u': [],
    'br': [],
    'ul': [],
    'ol': [],
    'li': [],
    'a': ['href', 'title', 'target', 'rel']
  };
  
  function cleanNode(node: Node): Node | DocumentFragment | null {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.cloneNode(true);
    }
    
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      const tagName = element.tagName.toLowerCase();
      
      if (!allowedTags[tagName as keyof typeof allowedTags]) {
        if (element.childNodes.length > 0) {
          const fragment = document.createDocumentFragment();
          Array.from(element.childNodes).forEach((child, index) => {
            const cleaned = cleanNode(child);
            if (cleaned) {
              if (cleaned.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
                Array.from((cleaned as DocumentFragment).childNodes).forEach(c => {
                  fragment.appendChild(c.cloneNode(true));
                });
              } else {
                fragment.appendChild(cleaned.cloneNode(true));
              }
              if (index < element.childNodes.length - 1 && 
                  (element.tagName === 'DIV' || element.tagName === 'P')) {
                fragment.appendChild(document.createElement('br'));
              }
            }
          });
          return fragment;
        }
        return document.createTextNode(element.textContent || '');
      }
      
      const cleanElement = document.createElement(tagName);
      const allowedAttrs = allowedTags[tagName as keyof typeof allowedTags];
      
      Array.from(element.attributes).forEach(attr => {
        if (allowedAttrs.includes(attr.name)) {
          if (attr.name === 'href') {
            const href = attr.value.trim();
            if (href && !href.startsWith('javascript:') && !href.startsWith('data:')) {
              cleanElement.setAttribute(attr.name, href);
            }
          } else {
            cleanElement.setAttribute(attr.name, attr.value);
          }
        }
      });
      
      // For anchor tags, ensure target="_blank" and rel="noopener noreferrer" are set
      if (tagName === 'a' && cleanElement.hasAttribute('href')) {
        if (!cleanElement.hasAttribute('target')) {
          cleanElement.setAttribute('target', '_blank');
        }
        if (!cleanElement.hasAttribute('rel')) {
          cleanElement.setAttribute('rel', 'noopener noreferrer');
        }
      }
      
      Array.from(element.childNodes).forEach(child => {
        const cleanedChild = cleanNode(child);
        if (cleanedChild) {
          if (cleanedChild.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
            Array.from((cleanedChild as DocumentFragment).childNodes).forEach(c => {
              cleanElement.appendChild(c.cloneNode(true));
            });
          } else {
            cleanElement.appendChild(cleanedChild);
          }
        }
      });
      
      return cleanElement;
    }
    
    return null;
  }
  
  const fragment = document.createDocumentFragment();
  Array.from(tempDiv.childNodes).forEach(node => {
    const cleaned = cleanNode(node);
    if (cleaned) {
      if (cleaned.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
        Array.from((cleaned as DocumentFragment).childNodes).forEach(child => {
          fragment.appendChild(child.cloneNode(true));
        });
      } else {
        fragment.appendChild(cleaned);
      }
    }
  });
  
  const resultDiv = document.createElement('div');
  resultDiv.appendChild(fragment);
  return resultDiv.innerHTML;
}

export function InlineWysiwygEditor({
  value,
  field,
  documentSlug,
  onSave,
  className = '',
  id,
}: InlineWysiwygEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [saving, setSaving] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const isInitializedRef = useRef(false);

  // Update editValue when value prop changes (but only when not editing)
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
      isInitializedRef.current = false;
    }
  }, [value, isEditing]);

  // Initialize editor content only once when entering edit mode
  useEffect(() => {
    if (isEditing && editorRef.current && !isInitializedRef.current) {
      // Clean the value before setting it to prevent browser from adding extra wrappers
      let cleanValue = value || '';
      
      // Remove leading/trailing empty paragraphs and breaks
      cleanValue = cleanValue.replace(/^(<p><\/p>|<br\s*\/?>|\s)+/gi, '');
      cleanValue = cleanValue.replace(/(<p><\/p>|<br\s*\/?>|\s)+$/gi, '');
      
      // If empty, set to empty string (not empty paragraph)
      if (!cleanValue.trim()) {
        cleanValue = '';
      }
      
      editorRef.current.innerHTML = cleanValue;
      isInitializedRef.current = true;
      
      // Set default paragraph separator
      document.execCommand('defaultParagraphSeparator', false, 'p');
      
      // Focus and position cursor at end
      editorRef.current.focus();
      
      // Move cursor to end of content
      const range = document.createRange();
      const selection = window.getSelection();
      if (selection && editorRef.current) {
        if (editorRef.current.childNodes.length > 0) {
          range.selectNodeContents(editorRef.current);
          range.collapse(false); // Collapse to end
        } else {
          // If empty, set cursor at the start
          range.setStart(editorRef.current, 0);
          range.collapse(true);
        }
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  }, [isEditing, value]);

  const handleStartEditing = () => {
    if (isEditing) return;
    setIsEditing(true);
    setEditValue(value);
  };

  const handleSave = async () => {
    if (saving || !editorRef.current) return;

    // Normalize and sanitize HTML
    let newValue = editorRef.current.innerHTML;
    debugLog('📝 Before sanitization:', newValue);
    
    // Convert divs to paragraphs first
    newValue = newValue.replace(/<div>/gi, '<p>').replace(/<\/div>/gi, '</p>');
    
    // Remove leading/trailing empty paragraphs and breaks
    // This prevents extra line breaks at top and bottom
    newValue = newValue.replace(/^(<p><\/p>|<br\s*\/?>|\s)+/gi, '');
    newValue = newValue.replace(/(<p><\/p>|<br\s*\/?>|\s)+$/gi, '');
    
    // Convert remaining empty paragraphs to breaks (but not at start/end)
    newValue = newValue.replace(/<p><\/p>/gi, '<br>');
    
    // Sanitize the HTML
    newValue = sanitizeHTML(newValue);
    
    // Final trim of leading/trailing breaks and whitespace
    newValue = newValue.replace(/^(<br\s*\/?>|\s)+/gi, '');
    newValue = newValue.replace(/(<br\s*\/?>|\s)+$/gi, '');
    
    debugLog('✅ After sanitization:', newValue);
    
    // Check if links have target="_blank"
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = newValue;
    const links = tempDiv.querySelectorAll('a');
    links.forEach((link, i) => {
      debugLog(`🔗 Link ${i + 1}:`, {
        href: link.getAttribute('href'),
        target: link.getAttribute('target'),
        rel: link.getAttribute('rel')
      });
    });

    setSaving(true);
    try {
      const success = await onSave(newValue);
      if (success) {
        setEditValue(newValue);
        setIsEditing(false);
        isInitializedRef.current = false;
        // The parent component (WelcomeMessage) will dispatch 'document-updated' event
        // which triggers useDocumentConfig to refetch, and the new value prop will update this component
      }
    } catch (error) {
      console.error('Failed to save:', error);
      alert(`Failed to save changes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
    isInitializedRef.current = false;
    if (editorRef.current) {
      editorRef.current.innerHTML = value;
    }
  };

  const execCommand = (command: string, value?: string) => {
    editorRef.current?.focus();
    if (command === 'createLink') {
      const url = prompt('Enter URL:');
      if (url) {
        document.execCommand('createLink', false, url);
        
        // After creating the link, add target="_blank" and rel="noopener noreferrer"
        // Use requestAnimationFrame instead of setTimeout to avoid async issues
        requestAnimationFrame(() => {
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            let anchor: HTMLAnchorElement | null = null;
            
            // Try to find the anchor in various ways
            // 1. Check if the range's common ancestor is an anchor
            const commonAncestor = range.commonAncestorContainer;
            if (commonAncestor.nodeType === Node.ELEMENT_NODE && (commonAncestor as Element).tagName === 'A') {
              anchor = commonAncestor as HTMLAnchorElement;
            } 
            // 2. Check if parent is an anchor
            else if (commonAncestor.parentElement?.tagName === 'A') {
              anchor = commonAncestor.parentElement as HTMLAnchorElement;
            }
            // 3. Search within the editor for the link with this URL
            else if (editorRef.current) {
              const links = editorRef.current.querySelectorAll('a');
              // Find the most recently added link (last one) that matches our URL
              // Compare both href attribute and the resolved href property
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

  // Handle keyboard events
  useEffect(() => {
    if (!isEditing || !editorRef.current) return;

    const handleKeyDown = (e: Event) => {
      const keyEvent = e as KeyboardEvent;
      if (keyEvent.key === 'Escape') {
        keyEvent.preventDefault();
        handleCancel();
      }
    };

    editorRef.current.addEventListener('keydown', handleKeyDown);
    return () => {
      editorRef.current?.removeEventListener('keydown', handleKeyDown);
    };
  }, [isEditing, value]);

  // Modal editing view
  if (isEditing) {
    return (
      <>
        {/* Modal for editing */}
        <Modal
          isOpen={isEditing}
          onClose={handleCancel}
          title="Edit Intro Message"
          size="lg"
          flexColumn={true}
        >
          <div className="flex flex-col h-full">
            {/* Style to match final rendered output */}
            <style>{`
              #${id || 'wysiwyg-editor'}-editor {
                line-height: 1.7;
                color: #212529;
              }
              #${id || 'wysiwyg-editor'}-editor p {
                margin: 10px 0;
                line-height: 1.7;
              }
              #${id || 'wysiwyg-editor'}-editor p:first-child {
                margin-top: 0;
              }
              #${id || 'wysiwyg-editor'}-editor p:last-child {
                margin-bottom: 0;
              }
              #${id || 'wysiwyg-editor'}-editor ul,
              #${id || 'wysiwyg-editor'}-editor ol {
                margin: 8px 0;
                padding-left: 30px;
              }
              #${id || 'wysiwyg-editor'}-editor ul {
                list-style: disc;
              }
              #${id || 'wysiwyg-editor'}-editor ol {
                list-style: auto;
              }
              #${id || 'wysiwyg-editor'}-editor li {
                margin: 5px 0;
                line-height: 1.7;
              }
              #${id || 'wysiwyg-editor'}-editor strong {
                font-weight: 600;
                color: #333;
              }
              #${id || 'wysiwyg-editor'}-editor em {
                font-style: italic;
                color: #666;
                font-size: 0.95em;
              }
              #${id || 'wysiwyg-editor'}-editor a {
                font-weight: bold;
                color: #007bff;
                text-decoration: underline;
              }
              #${id || 'wysiwyg-editor'}-editor a:hover {
                color: #0056b3;
              }
            `}</style>
            {/* Toolbar */}
            <div ref={toolbarRef} className="inline-editor-toolbar mb-4 flex-shrink-0">
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
            <div className="flex-1 min-h-0 flex flex-col">
              <div
                ref={editorRef}
                contentEditable
                className={`inline-editor-active ${className} flex-1 overflow-y-auto border border-gray-300 rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                id={`${id}-editor`}
                style={{ minHeight: '300px', maxHeight: '500px' }}
                onInput={(e) => {
                  setEditValue(e.currentTarget.innerHTML);
                }}
              />
            </div>
            
            {/* Action buttons */}
            <div className="flex justify-end gap-3 pt-4 mt-4 border-t flex-shrink-0">
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="flex-1 md:flex-none px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 md:flex-none px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  'Save'
                )}
              </button>
            </div>
          </div>
        </Modal>
      </>
    );
  }

  return (
    <div
      className={`inline-editor-wrapper ${className}`}
      style={{ position: 'relative', display: 'block' }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div
        id={id}
        className={className}
        style={{ position: 'relative' }}
        dangerouslySetInnerHTML={{ __html: value }}
      />
      {/* Edit icon - only this should be clickable */}
      <button
        type="button"
        className="inline-edit-icon"
        onClick={handleStartEditing}
        title="Click to edit"
        style={{
          position: 'absolute',
          top: '-8px',
          right: '4px',
          background: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          padding: '4px 8px',
          cursor: 'pointer',
          fontSize: '12px',
          zIndex: 100,
          opacity: isHovering ? 1 : 0,
          transition: 'opacity 0.2s',
          pointerEvents: isHovering ? 'auto' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Pencil size={12} />
      </button>
    </div>
  );
}

