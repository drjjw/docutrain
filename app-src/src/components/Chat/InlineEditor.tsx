/**
 * InlineEditor - React component for inline editing of text fields
 * Ported from vanilla JS inline-editor.js
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';

interface InlineEditorProps {
  value: string;
  field: string;
  documentSlug: string;
  type?: 'text' | 'textarea';
  onSave: (value: string) => Promise<boolean>;
  className?: string;
  id?: string;
  style?: React.CSSProperties;
}

export function InlineEditor({
  value,
  field,
  documentSlug,
  type = 'text',
  onSave,
  className = '',
  id,
  style,
}: InlineEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [saving, setSaving] = useState(false);
  const elementRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);

  // Update editValue when value prop changes
  useEffect(() => {
    setEditValue(value);
  }, [value]);

  // Calculate input width based on content (for title fields)
  const calculateInputWidth = useCallback((text: string): string => {
    if (!measureRef.current || (!id?.includes('Title') && !id?.includes('Subtitle'))) {
      return '100%';
    }

    if (!elementRef.current) {
      return '200px';
    }

    const computedStyle = window.getComputedStyle(elementRef.current);
    measureRef.current.style.fontSize = computedStyle.fontSize;
    measureRef.current.style.fontFamily = computedStyle.fontFamily;
    measureRef.current.style.fontWeight = computedStyle.fontWeight;
    measureRef.current.style.letterSpacing = computedStyle.letterSpacing;
    
    measureRef.current.textContent = text || ' ';
    const measuredWidth = measureRef.current.offsetWidth;
    const minWidth = 200;
    const calculatedWidth = Math.max(measuredWidth + 60, minWidth);
    return `${calculatedWidth}px`;
  }, [id]);

  // Auto-resize input width as user types (for title fields)
  useEffect(() => {
    if (!isEditing || !inputRef.current) return;

    const updateWidth = () => {
      if (inputRef.current) {
        const newWidth = calculateInputWidth(inputRef.current.value);
        inputRef.current.style.width = newWidth;
      }
    };

    inputRef.current.addEventListener('input', updateWidth);
    return () => {
      inputRef.current?.removeEventListener('input', updateWidth);
    };
  }, [isEditing, calculateInputWidth]);

  const handleStartEditing = () => {
    if (isEditing) return;
    setIsEditing(true);
    setEditValue(value);
    
    // Focus input after state update
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  };

  const handleFinishEditing = async () => {
    if (saving) return;

    const trimmedValue = editValue.trim();
    
    if (trimmedValue !== value.trim()) {
      setSaving(true);
      try {
        const success = await onSave(trimmedValue);
        if (success) {
          setIsEditing(false);
        }
      } catch (error) {
        console.error('Failed to save:', error);
        alert(`Failed to save changes: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setSaving(false);
      }
    } else {
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  // Handle keyboard events
  useEffect(() => {
    if (!isEditing || !inputRef.current) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && type === 'text') {
        e.preventDefault();
        handleFinishEditing();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    };

    const input = inputRef.current;
    input.addEventListener('keydown', handleKeyDown);
    input.addEventListener('blur', handleFinishEditing);

    return () => {
      input.removeEventListener('keydown', handleKeyDown);
      input.removeEventListener('blur', handleFinishEditing);
    };
  }, [isEditing, type, editValue, value]);

  // Get computed styles for matching appearance
  const getInputStyles = (): React.CSSProperties => {
    if (!elementRef.current) {
      return {};
    }

    const computedStyle = window.getComputedStyle(elementRef.current);
    const isHeaderTitle = id?.includes('headerTitle') || id?.includes('welcomeTitle');
    
    const baseStyles: React.CSSProperties = {
      border: '2px solid #007bff',
      borderRadius: '6px',
      padding: '8px 12px',
      fontSize: computedStyle.fontSize,
      fontFamily: computedStyle.fontFamily,
      fontWeight: computedStyle.fontWeight,
      letterSpacing: computedStyle.letterSpacing,
      background: 'white',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      transition: 'all 0.2s ease',
      minWidth: '200px',
      width: isHeaderTitle ? calculateInputWidth(editValue) : '100%',
    };

    if (type === 'textarea') {
      baseStyles.minHeight = '60px';
      baseStyles.resize = 'vertical';
    }

    return baseStyles;
  };

  if (isEditing) {
    const InputComponent = type === 'textarea' ? 'textarea' : 'input';
    
    return (
      <div style={{ position: 'relative' }}>
        {/* Hidden span for measuring text width */}
        {(id?.includes('Title') || id?.includes('Subtitle')) && (
          <span
            ref={measureRef}
            style={{
              position: 'absolute',
              visibility: 'hidden',
              whiteSpace: 'pre',
              padding: 0,
              margin: 0,
              font: getComputedStyle(document.body).font,
            }}
            aria-hidden="true"
          />
        )}
        <InputComponent
          ref={inputRef as any}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          disabled={saving}
          className="inline-editor-input"
          style={getInputStyles()}
        />
      </div>
    );
  }

  // Determine the element type based on ID
  const isTitle = id?.includes('Title');
  const isSubtitle = id?.includes('Subtitle');
  const isHeaderTitle = id === 'headerTitle';
  const isWelcomeTitle = id === 'welcomeTitle';
  const isHeaderSubtitle = id === 'headerSubtitle';
  const Element = isTitle ? 'h1' : (isSubtitle ? 'p' : 'span');

  // For headerTitle, welcomeTitle, and headerSubtitle, use inline positioning (beside text)
  // For others, use absolute positioning
  const useInlinePositioning = isHeaderTitle || isWelcomeTitle || isHeaderSubtitle;

  if (useInlinePositioning) {
    // For titles and subtitles, use flex wrapper with icon beside the text
    // Always render icon but control visibility with opacity to prevent layout shift
    const wrapperClassName = isWelcomeTitle ? 'welcome-title-wrapper' : '';
    
    return (
      <div
        className={wrapperClassName}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: isWelcomeTitle ? '12px' : '0',
        }}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        <Element
          ref={elementRef as any}
          id={id}
          className={className}
          style={{ cursor: 'pointer', margin: 0, ...style }}
          onClick={handleStartEditing}
        >
          {value}
        </Element>
        <button
          type="button"
          className="inline-edit-icon"
          onClick={(e) => {
            e.stopPropagation();
            handleStartEditing();
          }}
          title="Click to edit"
          style={{
            position: 'static',
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
            flexShrink: 0,
            alignSelf: 'center',
            visibility: 'visible', // Keep in layout but hidden
          }}
        >
          ✏️
        </button>
      </div>
    );
  }

  // For subtitle and other elements, use absolute positioning
  // Always render icon but control visibility with opacity to prevent layout shift
  return (
    <div
      className={`inline-editor-wrapper ${className}`}
      style={{ position: 'relative', display: 'inline-block', ...style }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <Element
        ref={elementRef as any}
        id={id}
        className={className}
        style={{ cursor: 'pointer', ...style }}
        onClick={handleStartEditing}
      >
        {value}
      </Element>
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

