/**
 * useTextSelection Hook
 * 
 * Handles text selection detection in chat messages and displays a prompt
 * to search for the selected text. Supports mouse, touch, and keyboard selection.
 */

import { useState, useRef, useEffect, RefObject } from 'react';

interface SelectionPrompt {
  text: string;
  position: { top: number; left: number };
}

interface UseTextSelectionProps {
  chatContainerRef: RefObject<HTMLDivElement | null>;
  inputRef: RefObject<HTMLInputElement | null>;
  setInputValue: (value: string) => void;
}

interface UseTextSelectionReturn {
  selectionPrompt: SelectionPrompt | null;
  handleSelectionConfirm: () => void;
  handleSelectionCancel: () => void;
}

export function useTextSelection({
  chatContainerRef,
  inputRef,
  setInputValue,
}: UseTextSelectionProps): UseTextSelectionReturn {
  const [selectionPrompt, setSelectionPrompt] = useState<SelectionPrompt | null>(null);
  const lastMouseDownRef = useRef<number>(0);
  const selectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSelectingRef = useRef<boolean>(false);

  useEffect(() => {
    const handleMouseDown = () => {
      // Track when mouse is pressed to differentiate keyboard vs mouse selection
      lastMouseDownRef.current = Date.now();
      isSelectingRef.current = true;
    };

    const handleMouseUp = () => {
      isSelectingRef.current = false;

      // After mouse up, check if there's a selection (but wait a bit for selection to settle)
      setTimeout(() => {
        checkSelection();
      }, 50);
    };

    // Touch event handlers for mobile devices
    const handleTouchStart = () => {
      // Track when touch starts to differentiate keyboard vs touch selection
      lastMouseDownRef.current = Date.now();
      isSelectingRef.current = true;
    };

    const handleTouchEnd = () => {
      isSelectingRef.current = false;

      // After touch end, check if there's a selection (but wait a bit for selection to settle)
      setTimeout(() => {
        checkSelection();
      }, 50);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Track keyboard selection (Shift + Arrow keys)
      if (e.shiftKey && (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End')) {
        isSelectingRef.current = true;
        // Clear any existing timeout when user starts selecting again
        if (selectionTimeoutRef.current) {
          clearTimeout(selectionTimeoutRef.current);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // When arrow keys or Shift are released, selection might be complete
      if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End' || e.key === 'Shift') {
        // Wait a bit to see if user continues selecting
        setTimeout(() => {
          // Check if shift is still pressed by checking current keyboard state
          // We can't rely on e.shiftKey after the event, so we check after a delay
          isSelectingRef.current = false;
          checkSelection();
        }, 150);
      }
    };

    const checkSelection = () => {
      // Clear any existing timeout
      if (selectionTimeoutRef.current) {
        clearTimeout(selectionTimeoutRef.current);
      }

      // Check if there's a selection
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        setSelectionPrompt(null);
        return;
      }

      // Clone the range to avoid interfering with the actual selection
      const range = selection.getRangeAt(0).cloneRange();
      const selectedText = range.toString().trim();

      // Only show prompt if there's actual text selected
      if (!selectedText || selectedText.length === 0) {
        setSelectionPrompt(null);
        return;
      }

      // Check if selection is within chat container
      if (!chatContainerRef.current) {
        setSelectionPrompt(null);
        return;
      }

      const selectionNode = range.commonAncestorContainer;
      const isWithinChatContainer = chatContainerRef.current.contains(
        selectionNode.nodeType === Node.TEXT_NODE
          ? selectionNode.parentElement
          : (selectionNode as Element)
      );

      if (!isWithinChatContainer) {
        setSelectionPrompt(null);
        return;
      }

      // Check if selection is within input field (don't show prompt for input selections)
      if (inputRef.current && inputRef.current.contains(selectionNode.nodeType === Node.TEXT_NODE ? selectionNode.parentElement : (selectionNode as Element))) {
        setSelectionPrompt(null);
        return;
      }

      // Check if selection is within any contentEditable element (like inline WYSIWYG editor)
      const element = selectionNode.nodeType === Node.TEXT_NODE ? selectionNode.parentElement : (selectionNode as Element);
      if (element && element.closest('[contenteditable="true"]')) {
        setSelectionPrompt(null);
        return;
      }

      // Only show prompt after selection is complete (not while actively selecting)
      if (isSelectingRef.current) {
        // User is still selecting, wait until they're done
        selectionTimeoutRef.current = setTimeout(() => {
          checkSelection();
        }, 150);
        return;
      }

      // Selection is complete, show prompt
      // Use requestAnimationFrame to ensure DOM is ready before getting bounds
      requestAnimationFrame(() => {
        // Get fresh selection in case it changed
        const freshSelection = window.getSelection();
        if (!freshSelection || freshSelection.rangeCount === 0) {
          setSelectionPrompt(null);
          return;
        }

        // Clone the range to avoid any interference with the actual selection
        const freshRange = freshSelection.getRangeAt(0).cloneRange();
        const freshText = freshRange.toString().trim();
        
        if (!freshText || freshText.length === 0) {
          setSelectionPrompt(null);
          return;
        }

        // Get bounding rect from the cloned range (doesn't interfere with selection)
        const rect = freshRange.getBoundingClientRect();
        setSelectionPrompt({
          text: freshText,
          position: {
            top: rect.bottom,
            left: rect.left + rect.width / 2,
          },
        });
      });
    };

    // Track mouse events
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);

    // Track touch events for mobile devices
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    // Track keyboard events for selection
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    // Also listen for selection changes, but only to clear prompt when selection is cleared
    // This won't interfere with selection since we're only reading, not modifying
    const handleSelectionChange = () => {
      // Only clear prompt if selection is actually cleared (not while selecting)
      if (!isSelectingRef.current) {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.toString().trim().length === 0) {
          setSelectionPrompt(null);
        }
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('selectionchange', handleSelectionChange);
      if (selectionTimeoutRef.current) {
        clearTimeout(selectionTimeoutRef.current);
      }
    };
  }, [chatContainerRef, inputRef]);

  // Handle selection prompt confirm
  const handleSelectionConfirm = () => {
    if (selectionPrompt) {
      setInputValue(`Tell me about ${selectionPrompt.text}`);
      // Clear selection
      window.getSelection()?.removeAllRanges();
      setSelectionPrompt(null);
      // Focus input after state update
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  };

  // Handle selection prompt cancel
  const handleSelectionCancel = () => {
    // Clear the text selection first to prevent re-triggering
    window.getSelection()?.removeAllRanges();
    setSelectionPrompt(null);
  };

  return {
    selectionPrompt,
    handleSelectionConfirm,
    handleSelectionCancel,
  };
}

