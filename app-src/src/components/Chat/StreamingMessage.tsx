import React, { useEffect, useRef } from 'react';
import { marked } from 'marked';
import { Message } from './Message';

interface StreamingMessageProps {
  initialContent?: string;
  onComplete?: (content: string) => void;
}

export function StreamingMessage({ initialContent = '', onComplete }: StreamingMessageProps) {
  const [content, setContent] = useState(initialContent);
  const contentRef = useRef<HTMLDivElement>(null);

  // This component will be updated externally via ref
  const updateContent = (newContent: string) => {
    setContent(newContent);
  };

  useEffect(() => {
    if (contentRef.current) {
      // Apply styling after content updates
      applyMessageStyling(contentRef.current);
    }
  }, [content]);

  const applyMessageStyling = (contentDiv: HTMLDivElement) => {
    // Wrap tables
    const tables = contentDiv.querySelectorAll('table');
    tables.forEach(table => {
      if (!table.parentElement?.classList.contains('table-wrapper')) {
        const wrapper = document.createElement('div');
        wrapper.className = 'table-wrapper';
        table.parentNode?.insertBefore(wrapper, table);
        wrapper.appendChild(table);
      }
    });

    // Style references and drug conversions
    // (Similar to Message component - can extract to shared utility)
    styleReferences(contentDiv);
    wrapDrugConversionContent(contentDiv);
  };

  const styleReferences = (contentDiv: HTMLDivElement) => {
    // Simplified version - full implementation in Message component
    const allParagraphs = contentDiv.querySelectorAll('p');
    allParagraphs.forEach(p => {
      if (!p.classList.contains('reference-item')) {
        const html = p.innerHTML;
        const styledHtml = html.replace(/\[(\d+)\]/g, '<span class="reference-citation">[$1]</span>');
        if (html !== styledHtml) {
          p.innerHTML = styledHtml;
        }
      }
    });
  };

  const wrapDrugConversionContent = (contentDiv: HTMLDivElement) => {
    const conversionCalculationPattern = /\d+\s*(mg|mcg|units|iu)\s*[×x]\s*[\d.]+\s*=\s*\d+/i;
    const paragraphs = contentDiv.querySelectorAll('p');
    const conversionElements: HTMLParagraphElement[] = [];
    
    paragraphs.forEach((p) => {
      const text = p.textContent || '';
      if (conversionCalculationPattern.test(text)) {
        conversionElements.push(p);
      }
    });
    
    if (conversionElements.length > 0) {
      const wrapper = document.createElement('div');
      wrapper.className = 'drug-conversion-response';
      const firstElement = conversionElements[0];
      firstElement.parentNode?.insertBefore(wrapper, firstElement);
      conversionElements.forEach(el => wrapper.appendChild(el));
    }
  };

  // Expose update method via ref (for external use)
  React.useImperativeHandle(contentRef, () => ({
    updateContent
  }));

  return (
    <Message
      content={content}
      role="assistant"
    />
  );
}

