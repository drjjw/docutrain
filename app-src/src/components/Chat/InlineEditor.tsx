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
  const [displayValue, setDisplayValue] = useState(value); // Optimistic display value
  const [justSaved, setJustSaved] = useState(false); // Track if we just saved to prevent immediate overwrite
  const [savedValue, setSavedValue] = useState<string | null>(null); // Track what we just saved
  const elementRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);

  // Update editValue and displayValue when value prop changes (but only when not editing)
  // Don't overwrite displayValue if we just saved (optimistic update is showing)
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
      // If we just saved, don't update displayValue from prop unless it matches what we saved
      // This prevents stale cached data from overwriting our optimistic update
      if (!justSaved) {
        // Normal case: update displayValue when prop changes
        setDisplayValue(value);
      } else if (savedValue !== null && value === savedValue) {
        // Refetch completed successfully - the prop matches what we saved
        setDisplayValue(value);
        setJustSaved(false);
        setSavedValue(null);
      }
      // If justSaved is true and value doesn't match savedValue, ignore the prop update
      // (it's stale cached data - keep the optimistic value)
    }
  }, [value, isEditing, justSaved, savedValue]);

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
    setEditValue(displayValue);
    
    // Focus input after state update
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  };

  const handleFinishEditing = async () => {
    if (saving) return;

    const trimmedValue = editValue.trim();
    
    if (trimmedValue !== displayValue.trim()) {
      setSaving(true);
      try {
        const success = await onSave(trimmedValue);
        if (success) {
          // Update display value optimistically with saved value
          setDisplayValue(trimmedValue);
          setEditValue(trimmedValue);
          setJustSaved(true); // Mark that we just saved
          setSavedValue(trimmedValue); // Remember what we saved
          setIsEditing(false);
          // Reset justSaved flag after a delay to allow refetch to complete
          // If refetch completes with matching value, it will clear the flag earlier
          setTimeout(() => {
            if (justSaved) {
              setJustSaved(false);
              setSavedValue(null);
            }
          }, 2000); // Fallback timeout - clear after 2 seconds
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
    setEditValue(displayValue);
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
  // welcomeTitle should be h2 (not h1) to avoid duplicate h1 tags - headerTitle is the page h1
  const Element = isHeaderTitle ? 'h1' : (isWelcomeTitle ? 'h2' : (isTitle ? 'h1' : (isSubtitle ? 'p' : 'span')));

  // For headerTitle, welcomeTitle, and headerSubtitle, use inline positioning (beside text)
  // For others, use absolute positioning
  const useInlinePositioning = isHeaderTitle || isWelcomeTitle || isHeaderSubtitle;

  if (useInlinePositioning) {
    // For titles and subtitles, use flex wrapper with icon beside the text
    // Use absolute positioning for edit button to keep title centered
    const wrapperClassName = isHeaderTitle 
      ? 'header-title-wrapper' 
      : (isWelcomeTitle ? 'welcome-title-wrapper' : '');
    
    return (
      <div
        className={wrapperClassName}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
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
          {displayValue}
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
            right: '0',
            top: '50%',
            transform: 'translateY(-50%)',
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
        {displayValue}
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

