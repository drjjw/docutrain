import React, { useRef, useCallback } from 'react';
import ContentEditable from 'react-contenteditable';

interface WysiwygEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function WysiwygEditor({ value, onChange, placeholder, className = '' }: WysiwygEditorProps) {
  const contentEditableRef = useRef<HTMLDivElement>(null);

  const handleChange = useCallback((evt: any) => {
    onChange(evt.target.value);
  }, [onChange]);

  const executeCommand = useCallback((command: string, value: string = '') => {
    document.execCommand(command, false, value);
    contentEditableRef.current?.focus();
  }, []);

  const isCommandActive = useCallback((command: string) => {
    return document.queryCommandState(command);
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const clipboardData = e.clipboardData || (window as any).clipboardData;
    const pastedText = clipboardData.getData('text/plain');

    if (!pastedText) return;

    // Convert line breaks to <br> tags, preserving structure
    const textWithBreaks = pastedText
      .replace(/\r\n/g, '\n') // Normalize Windows line breaks
      .replace(/\r/g, '\n')    // Normalize Mac line breaks
      .split('\n')
      .map((line, index, array) => {
        // Escape HTML entities in the text
        const escapedLine = line
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        // Add <br> after each line except the last (or if last is empty)
        return index < array.length - 1 ? `${escapedLine}<br>` : escapedLine;
      })
      .join('');

    // Insert the cleaned text at the cursor position
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && contentEditableRef.current) {
      const range = selection.getRangeAt(0);
      
      // Ensure the range is within our contentEditable element
      if (!contentEditableRef.current.contains(range.commonAncestorContainer)) {
        range.selectNodeContents(contentEditableRef.current);
        range.collapse(false);
      }
      
      range.deleteContents();
      
      // Create a temporary container to parse the HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = textWithBreaks;
      
      // Track the last node before moving to fragment
      let lastNode: Node | null = null;
      
      // Create a document fragment and move all nodes to it
      const fragment = document.createDocumentFragment();
      while (tempDiv.firstChild) {
        lastNode = tempDiv.firstChild;
        fragment.appendChild(lastNode);
      }
      
      // Insert the fragment (all nodes at once)
      range.insertNode(fragment);
      
      // Move cursor to end of inserted content
      // After insertion, lastNode is now in the DOM
      if (lastNode) {
        range.setStartAfter(lastNode);
        range.collapse(true);
      } else {
        // If no nodes were inserted, position at insertion point
        range.collapse(true);
      }
      selection.removeAllRanges();
      selection.addRange(range);
      
      // Update the content by reading from the DOM
      onChange(contentEditableRef.current.innerHTML);
    } else if (contentEditableRef.current) {
      // Fallback: if no selection, append to the end
      const currentHtml = contentEditableRef.current.innerHTML;
      const newHtml = currentHtml + textWithBreaks;
      onChange(newHtml);
      
      // Set cursor to end
      setTimeout(() => {
        const range = document.createRange();
        const sel = window.getSelection();
        if (contentEditableRef.current && sel) {
          range.selectNodeContents(contentEditableRef.current);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }, 0);
    }
  }, [onChange]);

  const formatButtons = [
    { command: 'bold', icon: 'B', label: 'Bold', className: 'font-bold' },
    { command: 'italic', icon: 'I', label: 'Italic', className: 'italic' },
    { command: 'underline', icon: 'U', label: 'Underline', className: 'underline' },
    { command: 'insertUnorderedList', icon: '•', label: 'Bullet List' },
    { command: 'insertOrderedList', icon: '1.', label: 'Numbered List' },
    { command: 'createLink', icon: '🔗', label: 'Link' },
  ];

  return (
    <div className={`border border-gray-300 rounded-md ${className}`}>
      <style>{`
        .wysiwyg-editor ul {
          list-style-type: disc;
          margin-left: 1.5rem;
          margin-top: 0.5rem;
          margin-bottom: 0.5rem;
        }
        .wysiwyg-editor ol {
          list-style-type: decimal;
          margin-left: 1.5rem;
          margin-top: 0.5rem;
          margin-bottom: 0.5rem;
        }
        .wysiwyg-editor li {
          margin-top: 0.25rem;
          margin-bottom: 0.25rem;
        }
      `}</style>
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b border-gray-300 bg-gray-50">
        {formatButtons.map((button) => (
          <button
            key={button.command}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              if (button.command === 'createLink') {
                const url = prompt('Enter URL:');
                if (url) {
                  executeCommand('createLink', url);
                }
              } else {
                executeCommand(button.command);
              }
            }}
            className={`px-2 py-1 text-xs rounded hover:bg-gray-200 transition-colors ${
              isCommandActive(button.command) ? 'bg-blue-100 text-blue-700' : 'text-gray-700'
            }`}
            title={button.label}
          >
            <span className={button.className}>{button.icon}</span>
          </button>
        ))}
        <div className="ml-auto text-xs text-gray-500">
          Basic HTML: p, strong, em, br, ul, ol, li, a
        </div>
      </div>

      {/* Editor */}
      <ContentEditable
        innerRef={contentEditableRef}
        html={value}
        onChange={handleChange}
        onPaste={handlePaste}
        className="wysiwyg-editor px-3 py-2 min-h-[80px] focus:outline-none prose prose-sm max-w-none"
        placeholder={placeholder}
        style={{
          minHeight: '80px',
          outline: 'none'
        }}
      />
    </div>
  );
}
