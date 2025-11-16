/**
 * useCopyToClipboard Hook
 * Manages copy-to-clipboard functionality with fallback for older browsers
 */

import { useState, RefObject } from 'react';
import { htmlToText, removeReferencesFromClone } from '@/utils/htmlUtils';

interface UseCopyToClipboardReturn {
  isCopied: boolean;
  handleCopy: (
    contentRef: RefObject<HTMLDivElement | null>,
    showReferences: boolean,
    onAfterCopy?: () => void
  ) => Promise<void>;
}

/**
 * Hook for handling copy to clipboard functionality
 */
export function useCopyToClipboard(): UseCopyToClipboardReturn {
  const [isCopied, setIsCopied] = useState(false);

  /**
   * Handle copy to clipboard
   */
  const handleCopy = async (
    contentRef: RefObject<HTMLDivElement | null>,
    showReferences: boolean,
    onAfterCopy?: () => void
  ): Promise<void> => {
    if (!contentRef.current) {
      return;
    }
    
    try {
      // Clone the element to avoid modifying the original DOM
      const clonedElement = contentRef.current.cloneNode(true) as HTMLElement;
      
      // If references are disabled, they should already be removed from markdown before parsing
      // But as a safety net, remove any references that might have slipped through
      if (!showReferences) {
        removeReferencesFromClone(clonedElement);
      }
      
      // Get the HTML content from the cloned element
      const htmlContent = clonedElement.innerHTML;
      
      // Convert HTML to formatted plain text
      const textContent = htmlToText(htmlContent);
      
      // Copy to clipboard
      await navigator.clipboard.writeText(textContent);
      
      // Call optional callback after copying (e.g., to collapse references)
      if (onAfterCopy) {
        onAfterCopy();
      }
      
      // Show success feedback
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      try {
        // Clone the element for fallback as well
        const clonedElement = contentRef.current.cloneNode(true) as HTMLElement;
        
        // If references are disabled, they should already be removed from markdown before parsing
        // But as a safety net, remove any references that might have slipped through
        if (!showReferences) {
          removeReferencesFromClone(clonedElement);
        }
        
        const textContent = htmlToText(clonedElement.innerHTML);
        const textArea = document.createElement('textarea');
        textArea.value = textContent;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        // Call optional callback after copying (e.g., to collapse references)
        if (onAfterCopy) {
          onAfterCopy();
        }
        
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      } catch (fallbackErr) {
        console.error('Failed to copy to clipboard:', fallbackErr);
      }
    }
  };

  return {
    isCopied,
    handleCopy,
  };
}

