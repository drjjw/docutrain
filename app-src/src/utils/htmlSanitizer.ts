/**
 * HTML Sanitization Utility
 * Sanitizes HTML to allow only safe tags and attributes for intro messages
 * Prevents XSS attacks while preserving basic formatting
 */

/**
 * Strip HTML comments and Word-specific metadata
 * Removes <!-- ... --> comments which often contain Word styles and formatting
 */
function stripCommentsAndMetadata(html: string): string {
  if (!html) return '';
  
  // STRATEGIC WORD METADATA REMOVAL
  // Word often pastes CSS definitions as visible text, not actual HTML comments
  // We need to be surgical: remove metadata but preserve actual content
  
  // Step 1: Remove large blocks of Word metadata by looking for specific markers
  // Remove everything from "/* Font Definitions */" up to the first real content
  // Look for the end marker which is usually before actual document content starts
  html = html.replace(/\/\*\s*Font\s+Definitions\s*\*\/[\s\S]*?(?=<[^!@]|[A-Z][a-z]{3,})/i, '');
  
  // Remove "/* Style Definitions */" blocks
  html = html.replace(/\/\*\s*Style\s+Definitions\s*\*\/[\s\S]*?(?=<[^!@]|[A-Z][a-z]{3,})/i, '');
  
  // Remove "/* List Definitions */" blocks
  html = html.replace(/\/\*\s*List\s+Definitions\s*\*\/[\s\S]*?(?=<[^!@]|[A-Z][a-z]{3,})/i, '');
  
  // Step 2: Remove specific Word CSS patterns
  // Remove @-rules (@font-face, @list, @page) - these are always metadata
  html = html.replace(/@(font-face|list|page)\s*[^{]*\{[^}]*\}/gi, '');
  
  // Remove Word CSS class definitions (but be careful not to remove content)
  // Only match if it has typical CSS syntax: selector { properties }
  html = html.replace(/\b(p\.MsoNormal|li\.MsoNormal|div\.MsoNormal|\.MsoChpDefault|\.MsoPapDefault|div\.WordSection\d+)\s*\{[^}]*\}/gi, '');
  
  // Remove standalone Mso class references without content
  html = html.replace(/\b(MsoNormal|MsoChpDefault|MsoPapDefault|WordSection\d+)\s*\{[^}]*\}/gi, '');
  
  // Step 3: Handle HTML comments
  html = html.replace(/<!--\s*\/\*\s*(Font|Style|List)\s+Definitions\s*\*\/[\s\S]*?-->/gi, '');
  html = html.replace(/<!--[\s\S]*?-->/g, '');
  html = html.replace(/<!--[\s\S]*$/g, '');
  
  // Step 4: Remove HTML tags and attributes
  html = html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  html = html.replace(/<\/?div[^>]*WordSection[^>]*>/gi, '');
  html = html.replace(/\s*style\s*=\s*["'][^"']*["']/gi, '');
  html = html.replace(/\s*class\s*=\s*["'][^"']*["']/gi, '');
  html = html.replace(/\s*lang\s*=\s*["'][^"']*["']/gi, '');
  html = html.replace(/\s*xmlns\s*[^>]*/gi, '');
  html = html.replace(/<meta\b[^>]*>/gi, '');
  html = html.replace(/<link\b[^>]*>/gi, '');
  html = html.replace(/<\/?(o|w|m|v):[^>]*>/gi, '');
  html = html.replace(/<\/?span[^>]*>/gi, '');
  html = html.replace(/<\/?font[^>]*>/gi, '');
  html = html.replace(/\s*mso-[^:;'"]*:[^;'"]*;?/gi, '');
  html = html.replace(/\s*data-[^=]*=\s*["'][^"']*["']/gi, '');
  
  // Step 5: Clean up any remaining isolated CSS fragments
  // Only remove curly braces if they contain CSS-like properties (with colons and semicolons)
  html = html.replace(/\{[^}]*:[^}]*;[^}]*\}/g, '');
  
  // Remove CSS properties ONLY if they match common Word patterns
  // Match things like "margin-top:0cm;" or "font-family:Aptos" but not normal text
  html = html.replace(/\b(margin|padding|font|line-height|text-indent|panose)[-\w]*:\s*[^;]+;/gi, '');
  
  return html;
}

/**
 * Normalize line breaks in HTML
 * Converts <div> tags to <p> tags and handles empty paragraphs
 */
function normalizeLineBreaks(html: string): string {
  if (!html) return '';
  
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  // Convert all <div> tags to <p> tags
  const divs = tempDiv.querySelectorAll('div');
  divs.forEach(div => {
    const p = document.createElement('p');
    while (div.firstChild) {
      p.appendChild(div.firstChild);
    }
    div.parentNode?.replaceChild(p, div);
  });
  
  // Convert empty <p> tags to <br> tags (but preserve structure)
  const emptyPs = tempDiv.querySelectorAll('p:empty');
  emptyPs.forEach(p => {
    const br = document.createElement('br');
    p.parentNode?.replaceChild(br, p);
  });
  
  let result = tempDiv.innerHTML;
  
  // Remove leading/trailing empty paragraphs and breaks
  result = result.replace(/^(<p><\/p>|<br\s*\/?>|\s)+/gi, '');
  result = result.replace(/(<p><\/p>|<br\s*\/?>|\s)+$/gi, '');
  
  return result;
}

/**
 * Sanitize HTML to prevent XSS attacks
 * Allows only safe HTML tags and attributes
 * 
 * Allowed tags: p, b, strong, i, em, u, br, ul, ol, li, a
 * Allowed attributes for <a>: href, title, target, rel
 */
export function sanitizeHTML(html: string): string {
  if (!html) return '';
  
  // First, strip comments and Word metadata
  html = stripCommentsAndMetadata(html);
  
  html = normalizeLineBreaks(html);
  
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  const allowedTags = {
    'p': [],
    'b': [],      // Allow <b> tags (created by execCommand('bold'))
    'strong': [],
    'i': [],      // Allow <i> tags (created by execCommand('italic'))
    'em': [],
    'u': [],
    'br': [],
    'ul': [],
    'ol': [],
    'li': [],
    'a': ['href', 'title', 'target', 'rel']
  };
  
  function cleanNode(node: Node): Node | DocumentFragment | null {
    // Skip comment nodes entirely
    if (node.nodeType === Node.COMMENT_NODE) {
      return null;
    }
    
    if (node.nodeType === Node.TEXT_NODE) {
      return node.cloneNode(true);
    }
    
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      const tagName = element.tagName.toLowerCase();
      
      if (!allowedTags[tagName as keyof typeof allowedTags]) {
        if (element.childNodes.length > 0) {
          const fragment = document.createDocumentFragment();
          Array.from(element.childNodes).forEach((child, index) => {
            const cleaned = cleanNode(child);
            if (cleaned) {
              if (cleaned.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
                Array.from((cleaned as DocumentFragment).childNodes).forEach(c => {
                  fragment.appendChild(c.cloneNode(true));
                });
              } else {
                fragment.appendChild(cleaned.cloneNode(true));
              }
              if (index < element.childNodes.length - 1 && 
                  (element.tagName === 'DIV' || element.tagName === 'P')) {
                fragment.appendChild(document.createElement('br'));
              }
            }
          });
          return fragment;
        }
        return document.createTextNode(element.textContent || '');
      }
      
      const cleanElement = document.createElement(tagName);
      const allowedAttrs = allowedTags[tagName as keyof typeof allowedTags];
      
      Array.from(element.attributes).forEach(attr => {
        if (allowedAttrs.includes(attr.name)) {
          if (attr.name === 'href') {
            const href = attr.value.trim();
            // Block javascript: and data: protocols
            if (href && !href.startsWith('javascript:') && !href.startsWith('data:')) {
              cleanElement.setAttribute(attr.name, href);
            }
          } else {
            cleanElement.setAttribute(attr.name, attr.value);
          }
        }
      });
      
      // For anchor tags, ensure target="_blank" and rel="noopener noreferrer" are set
      if (tagName === 'a' && cleanElement.hasAttribute('href')) {
        if (!cleanElement.hasAttribute('target')) {
          cleanElement.setAttribute('target', '_blank');
        }
        if (!cleanElement.hasAttribute('rel')) {
          cleanElement.setAttribute('rel', 'noopener noreferrer');
        }
      }
      
      Array.from(element.childNodes).forEach(child => {
        const cleanedChild = cleanNode(child);
        if (cleanedChild) {
          if (cleanedChild.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
            Array.from((cleanedChild as DocumentFragment).childNodes).forEach(c => {
              cleanElement.appendChild(c.cloneNode(true));
            });
          } else {
            cleanElement.appendChild(cleanedChild);
          }
        }
      });
      
      return cleanElement;
    }
    
    return null;
  }
  
  // Remove any comment nodes that might have survived parsing
  const walker = document.createTreeWalker(
    tempDiv,
    NodeFilter.SHOW_COMMENT,
    { acceptNode: () => NodeFilter.FILTER_ACCEPT }
  );
  const commentsToRemove: Comment[] = [];
  let commentNode: Node | null;
  while ((commentNode = walker.nextNode())) {
    commentsToRemove.push(commentNode as Comment);
  }
  commentsToRemove.forEach(comment => comment.remove());
  
  const fragment = document.createDocumentFragment();
  Array.from(tempDiv.childNodes).forEach(node => {
    // Skip comment nodes
    if (node.nodeType === Node.COMMENT_NODE) {
      return;
    }
    
    const cleaned = cleanNode(node);
    if (cleaned) {
      if (cleaned.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
        Array.from((cleaned as DocumentFragment).childNodes).forEach(child => {
          fragment.appendChild(child.cloneNode(true));
        });
      } else {
        fragment.appendChild(cleaned);
      }
    }
  });
  
  const resultDiv = document.createElement('div');
  resultDiv.appendChild(fragment);
  return resultDiv.innerHTML;
}

/**
 * Sanitize pasted HTML content
 * Handles both HTML and plain text paste events
 * Returns sanitized HTML string
 */
export function sanitizePastedContent(
  clipboardData: DataTransfer,
  preferPlainText: boolean = false
): string {
  // Try to get HTML first if available and not preferring plain text
  let htmlContent = '';
  if (!preferPlainText) {
    htmlContent = clipboardData.getData('text/html');
  }
  
  // If we have HTML content, sanitize it
  // This will strip comments, Word metadata, and only keep allowed tags
  if (htmlContent) {
    return sanitizeHTML(htmlContent);
  }
  
  // Fall back to plain text
  const plainText = clipboardData.getData('text/plain');
  if (!plainText) return '';
  
  // Convert line breaks to <br> tags, preserving structure
  const textWithBreaks = plainText
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
  
  return textWithBreaks;
}

