/**
 * HTML Manipulation Utilities
 * Functions for processing HTML content and DOM elements
 */

import { REFERENCE_HEADINGS } from './markdownUtils';

/**
 * Helper function to remove references from a cloned DOM element
 */
export function removeReferencesFromClone(element: HTMLElement): void {
  // 1. Remove all reference containers (this removes everything inside them including .references-content, .reference-item, etc.)
  const referencesContainers = element.querySelectorAll('.references-container');
  referencesContainers.forEach(container => {
    container.remove();
  });
  
  // 2. Remove reference separator horizontal rules
  const referenceSeparators = element.querySelectorAll('.references-separator');
  referenceSeparators.forEach(hr => {
    hr.remove();
  });
  
  // 3. Remove any remaining reference items, headings, and wrappers that might exist outside containers
  const referenceItems = element.querySelectorAll('.reference-item, .references-heading, .references-heading-wrapper, .references-content');
  referenceItems.forEach(item => {
    item.remove();
  });
  
  // 4. Remove citation spans (inline citations like [1])
  const citationSpans = element.querySelectorAll('.reference-citation');
  citationSpans.forEach(span => {
    span.remove();
  });
  
  // 5. Remove any paragraphs/list items that look like references (but weren't styled yet)
  // Use Array.from to get a snapshot before iterating (since we're removing elements)
  const allElements = Array.from(element.querySelectorAll('p, li'));
  
  // Helper to check if text is a reference heading in any language
  const isReferenceHeading = (text: string, html: string, strongText: string): boolean => {
    const normalizedText = text.toLowerCase().trim();
    const normalizedHtml = html.toLowerCase();
    const normalizedStrong = strongText.toLowerCase();
    
    // Check exact matches
    if (REFERENCE_HEADINGS.has(normalizedText) || REFERENCE_HEADINGS.has(normalizedStrong)) {
      return true;
    }
    
    // Check if HTML contains reference heading (with markdown formatting removed)
    const htmlWithoutMarkdown = normalizedHtml
      .replace(/<strong>/g, '')
      .replace(/<\/strong>/g, '')
      .replace(/\*\*/g, '')
      .replace(/#+\s*/g, '')
      .trim();
    
    if (REFERENCE_HEADINGS.has(htmlWithoutMarkdown)) {
      return true;
    }
    
    // Check for English "References" (fallback)
    if (normalizedText === 'references' || 
        normalizedStrong === 'references' ||
        normalizedHtml.includes('<strong>references</strong>') ||
        normalizedHtml.includes('**references**')) {
      return true;
    }
    
    return false;
  };
  
  allElements.forEach(el => {
    const text = el.textContent?.trim() || '';
    const html = el.innerHTML.toLowerCase();
    const hasStrong = el.querySelector('strong');
    const strongText = hasStrong?.textContent?.trim().toLowerCase() || '';
    
    // Check if element contains "References" heading (any language, various formats)
    const isRefHeading = isReferenceHeading(text, html, strongText);
    
    // Check if element starts with [number] pattern (reference item)
    // Also check if it's mostly just a reference (contains [number] and is short)
    const startsWithReference = /^\[\d+\]/.test(text);
    const isReferenceLike = /^\[\d+\]/.test(text) && text.length < 200; // Reference items are usually short
    
    // Remove if it's a references heading or looks like a reference item
    if (isRefHeading || startsWithReference || isReferenceLike) {
      el.remove();
    }
  });
  
  // 6. Remove inline citations [1], [2], etc. from remaining HTML content
  // This must be done after removing citation spans, as they might contain the pattern
  const textElements = element.querySelectorAll('p, li, span, div, strong, em, h1, h2, h3, h4, h5, h6');
  textElements.forEach(el => {
    const html = el.innerHTML;
    if (html.includes('[')) {
      // Remove citation patterns like [1], [2], etc. but preserve other brackets
      // Match [ followed by one or more digits followed by ]
      const newHtml = html.replace(/\[\d+\]/g, '');
      if (newHtml !== html) {
        el.innerHTML = newHtml;
      }
    }
  });
  
  // 7. Clean up any empty paragraphs or list items that might remain
  const emptyElements = Array.from(element.querySelectorAll('p, li'));
  emptyElements.forEach(el => {
    const text = el.textContent?.trim() || '';
    const html = el.innerHTML.trim();
    // Remove if empty or only contains whitespace/line breaks
    if (!text && (!html || html === '<br>' || html === '<br/>')) {
      el.remove();
    }
  });
}

/**
 * Helper function to convert HTML to formatted plain text
 * Preserves markdown-like formatting for better readability
 */
export function htmlToText(html: string): string {
  // Create a temporary div to parse HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  // Function to recursively process nodes and preserve formatting
  const processNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }
    
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      const tagName = element.tagName.toLowerCase();
      const children = Array.from(element.childNodes)
        .map(processNode)
        .join('');
      
      // Handle different HTML elements
      switch (tagName) {
        case 'h1':
        case 'h2':
        case 'h3':
        case 'h4':
        case 'h5':
        case 'h6':
          return `\n${children}\n`;
        case 'p':
          return `${children}\n\n`;
        case 'br':
          return '\n';
        case 'li':
          return `• ${children}\n`;
        case 'strong':
        case 'b':
          return `**${children}**`;
        case 'em':
        case 'i':
          return `*${children}*`;
        case 'code':
          return `\`${children}\``;
        case 'pre':
          return `\n${children}\n`;
        case 'blockquote':
          return `> ${children}\n`;
        case 'hr':
          return '\n---\n';
        case 'table':
          // Extract table content
          const rows: string[] = [];
          const tableRows = element.querySelectorAll('tr');
          tableRows.forEach(row => {
            const cells = Array.from(row.querySelectorAll('td, th'))
              .map(cell => processNode(cell).trim())
              .join(' | ');
            rows.push(`| ${cells} |`);
          });
          return `\n${rows.join('\n')}\n`;
        case 'a':
          const href = element.getAttribute('href');
          return href ? `[${children}](${href})` : children;
        default:
          return children;
      }
    }
    
    return '';
  };
  
  // Process all nodes and clean up extra whitespace
  let text = processNode(tempDiv);
  
  // Clean up excessive newlines (more than 2 consecutive)
  text = text.replace(/\n{3,}/g, '\n\n');
  
  // Trim leading/trailing whitespace
  return text.trim();
}

