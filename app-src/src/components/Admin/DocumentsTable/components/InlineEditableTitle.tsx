import React, { useState, useRef, useEffect } from 'react';
import { Pencil } from 'lucide-react';

interface InlineEditableTitleProps {
  title: string;
  isUpdating: boolean;
  onUpdate: (newTitle: string) => Promise<void>;
}

export function InlineEditableTitle({
  title,
  isUpdating,
  onUpdate,
}: InlineEditableTitleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [inputValue, setInputValue] = useState(title || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setInputValue(title || '');
  }, [title]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isUpdating && !isSaving) {
      setIsEditing(true);
      setInputValue(title || '');
    }
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmedValue = inputValue.trim();
      if (trimmedValue !== title) {
        setIsSaving(true);
        try {
          await onUpdate(trimmedValue);
          setIsEditing(false);
        } catch (error) {
          console.error('Failed to update title:', error);
        } finally {
          setIsSaving(false);
        }
      } else {
        setIsEditing(false);
      }
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setInputValue(title || '');
    }
  };

  const handleBlur = async () => {
    const trimmedValue = inputValue.trim();
    if (trimmedValue !== title) {
      setIsSaving(true);
      try {
        await onUpdate(trimmedValue);
      } catch (error) {
        console.error('Failed to update title:', error);
      } finally {
        setIsSaving(false);
      }
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className="w-full font-bold text-gray-900 text-base border-2 border-docutrain-light rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-docutrain-light/20 bg-white"
        onClick={(e) => e.stopPropagation()}
        placeholder="Enter title"
        autoFocus
      />
    );
  }

  return (
    <div
      className="relative inline-block w-full"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <span
        onClick={handleClick}
        className={`font-bold text-gray-900 text-base break-words cursor-pointer transition-opacity inline ${isUpdating || isSaving ? 'opacity-50' : 'hover:opacity-80'}`}
        style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
        title="Click to edit"
      >
        {title || 'Untitled Document'}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleClick(e);
        }}
        className="ml-1.5 inline-flex items-center justify-center bg-gray-800/80 hover:bg-gray-800 text-white border-none rounded px-1.5 py-0.5 cursor-pointer transition-opacity align-middle"
        style={{
          opacity: isHovering ? 1 : 0,
          pointerEvents: isHovering ? 'auto' : 'none',
          transition: 'opacity 0.2s',
        }}
        title="Click to edit"
      >
        <Pencil size={12} />
      </button>
    </div>
  );
}

