/**
 * SelectionPrompt - Shows a prompt when text is selected in chat
 * Allows user to ask about the selected text
 */

import { useEffect, useRef } from 'react';

interface SelectionPromptProps {
  selectedText: string;
  position: { top: number; left: number };
  onConfirm: () => void;
  onCancel: () => void;
}

export function SelectionPrompt({ selectedText, position, onConfirm, onCancel }: SelectionPromptProps) {
  const promptRef = useRef<HTMLDivElement>(null);

  // Position the prompt near the selection
  useEffect(() => {
    if (promptRef.current) {
      // Adjust position to keep prompt visible
      const promptHeight = promptRef.current.offsetHeight;
      const promptWidth = promptRef.current.offsetWidth;
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      let top = position.top - promptHeight - 10; // 10px above selection
      let left = position.left;

      // Ensure prompt stays within viewport
      if (top < 10) {
        top = position.top + 30; // Show below selection instead
      }
      if (left + promptWidth > viewportWidth - 10) {
        left = viewportWidth - promptWidth - 10;
      }
      if (left < 10) {
        left = 10;
      }

      promptRef.current.style.top = `${top}px`;
      promptRef.current.style.left = `${left}px`;
    }
  }, [position]);

  // Handle escape key to cancel
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onCancel]);

  // Truncate selected text if too long
  const displayText = selectedText.length > 50 
    ? `${selectedText.substring(0, 50)}...` 
    : selectedText;

  return (
    <div
      ref={promptRef}
      className="selection-prompt"
      style={{
        position: 'fixed',
        zIndex: 10000,
        backgroundColor: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '12px 16px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontSize: '14px',
        maxWidth: '300px',
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 500, marginBottom: '4px', color: '#111827' }}>
          Ask about selection?
        </div>
        <div style={{ color: '#6b7280', fontSize: '12px', wordBreak: 'break-word' }}>
          "{displayText}"
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={onConfirm}
          style={{
            padding: '6px 12px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 500,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#2563eb';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#3b82f6';
          }}
        >
          Yes
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: '6px 12px',
            backgroundColor: '#f3f4f6',
            color: '#374151',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 500,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#e5e7eb';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#f3f4f6';
          }}
        >
          No
        </button>
      </div>
    </div>
  );
}

