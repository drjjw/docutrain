/**
 * InlineWysiwygEditor - React component for inline editing of rich text fields (intro message)
 * Ported from vanilla JS inline-editor.js
 */

import { useState, useRef, useEffect } from 'react';

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
  
  // Convert empty <p> tags to <br> tags
  const emptyPs = tempDiv.querySelectorAll('p:empty');
  emptyPs.forEach(p => {
    const br = document.createElement('br');
    p.parentNode?.replaceChild(br, p);
  });
  
  return tempDiv.innerHTML;
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
    'strong': [],
    'em': [],
    'u': [],
    'br': [],
    'ul': [],
    'ol': [],
    'li': [],
    'a': ['href', 'title', 'target']
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

  // Update editValue when value prop changes
  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const handleStartEditing = () => {
    if (isEditing) return;
    setIsEditing(true);
    setEditValue(value);
    
    // Set default paragraph separator
    setTimeout(() => {
      document.execCommand('defaultParagraphSeparator', false, 'p');
      editorRef.current?.focus();
      
      // Select all text if element is empty
      if (!editorRef.current?.textContent?.trim()) {
        const range = document.createRange();
        range.selectNodeContents(editorRef.current!);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    }, 0);
  };

  const handleSave = async () => {
    if (saving || !editorRef.current) return;

    // Normalize and sanitize HTML
    let newValue = editorRef.current.innerHTML;
    newValue = newValue.replace(/<div>/gi, '<p>').replace(/<\/div>/gi, '</p>');
    newValue = newValue.replace(/<p><\/p>/gi, '<br>');
    newValue = sanitizeHTML(newValue);

    setSaving(true);
    try {
      const success = await onSave(newValue);
      if (success) {
        setIsEditing(false);
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
      }
    } else {
      document.execCommand(command, false, value);
    }
  };

  // Handle keyboard events
  useEffect(() => {
    if (!isEditing || !editorRef.current) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    };

    editorRef.current.addEventListener('keydown', handleKeyDown);
    return () => {
      editorRef.current?.removeEventListener('keydown', handleKeyDown);
    };
  }, [isEditing, value]);

  if (isEditing) {
    return (
      <div className="inline-wysiwyg-editor">
        {/* Toolbar */}
        <div ref={toolbarRef} className="inline-editor-toolbar">
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
            title="Link"
          >
            🔗
          </button>
          <div className="inline-editor-toolbar-actions">
            <button
              type="button"
              className="inline-editor-save-btn"
              onClick={handleSave}
              disabled={saving}
              style={{ 
                color: 'white',
                backgroundColor: '#007bff',
                borderColor: '#007bff'
              }}
            >
              Save
            </button>
            <button
              type="button"
              className="inline-editor-cancel-btn"
              onClick={handleCancel}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </div>
        
        {/* Editor */}
        <div
          ref={editorRef}
          contentEditable
          className={`inline-editor-active ${className}`}
          id={id}
          dangerouslySetInnerHTML={{ __html: editValue }}
          onInput={(e) => {
            setEditValue(e.currentTarget.innerHTML);
          }}
        />
      </div>
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
        style={{ cursor: 'pointer', position: 'relative' }}
        onClick={handleStartEditing}
        dangerouslySetInnerHTML={{ __html: value }}
      />
      {/* Always render icon but control visibility with opacity to prevent layout shift */}
      <button
        type="button"
        className="inline-edit-icon"
        onClick={(e) => {
          e.stopPropagation();
          handleStartEditing();
        }}
        title="Click to edit"
        style={{
          position: 'absolute',
          top: '4px',
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
        }}
      >
        ✏️
      </button>
    </div>
  );
}

