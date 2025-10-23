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
        className="px-3 py-2 min-h-[80px] focus:outline-none prose prose-sm max-w-none"
        placeholder={placeholder}
        style={{
          minHeight: '80px',
          outline: 'none'
        }}
      />
    </div>
  );
}
