/**
 * Markdown Processing Utilities
 * Functions for preprocessing markdown content before rendering
 */

/**
 * Common translations of "References" in various languages
 * These are normalized to lowercase for case-insensitive matching
 */
export const REFERENCE_HEADINGS = new Set([
  'references', 'referencias', 'références', 'referenzen', 'riferimenti',
  'referências', 'справочники', '参考文献', '참고문헌', 'संदर्भ',
  'المراجع', 'referenser', 'referenser', 'viitteet', 'referanslar'
]);

/**
 * Preprocess markdown to prevent false blockquote detection
 * Escapes ">" characters that appear after list markers but are actually comparison operators
 * Example: "- >50 kg: 1" should not be a blockquote, but "- If patient >50 kg" is fine
 * Also removes strikethrough markdown (~~text~~) as it's not useful for medical responses
 */
export function preprocessMarkdown(markdown: string): string {
  // Remove strikethrough markdown (~~text~~) - not useful for medical information
  // This handles both inline and multiline strikethrough, including malformed cases
  // Use a more robust pattern that handles edge cases:
  // 1. Match ~~ followed by content (non-greedy) followed by ~~
  // 2. Handle cases where strikethrough spans multiple lines
  // 3. Handle malformed strikethrough with extra whitespace
  
  // First pass: Remove complete strikethrough blocks (~~text~~)
  // Use [\s\S] instead of . to match newlines, and *? for non-greedy matching
  markdown = markdown.replace(/~~[\s\S]*?~~/g, (match) => {
    // Extract the content inside the strikethrough and return it without the markers
    // Trim whitespace that might have been added by the strikethrough markers
    const content = match.replace(/^~~\s*/, '').replace(/\s*~~$/, '');
    return content;
  });
  
  // Second pass: Remove any remaining orphaned strikethrough markers
  // This handles malformed strikethrough that might have been cut off or incomplete
  // Match any remaining ~~ patterns (could be single or double)
  markdown = markdown.replace(/~{1,2}/g, '');
  
  // Split into lines to process line by line
  return markdown.split('\n').map(line => {
    // Check if line starts with a list marker (bullet or numbered) followed immediately by " >"
    // This pattern is likely a false blockquote (e.g., "- >50 kg: 1" or "- > 50 kg: 1")
    // Pattern matches: optional indent, list marker, whitespace, ">", optional space, then number/letter
    const listMarkerPattern = /^(\s*)([-*+]|\d+\.)\s+>\s*(\d+|[A-Za-z])/;
    
    if (listMarkerPattern.test(line)) {
      // Escape the ">" by replacing it with HTML entity "&gt;"
      // This preserves the visual ">" but prevents markdown blockquote parsing
      // Only replace the first occurrence after the list marker
      return line.replace(/^(\s*)([-*+]|\d+\.)\s+>\s*/, '$1$2 &gt;');
    }
    
    return line;
  }).join('\n');
}

/**
 * Remove references from markdown content before parsing
 * This prevents references from appearing in the DOM at all when showReferences is false
 * 
 * This function detects reference sections regardless of language by:
 * 1. Looking for common translations of "References" heading
 * 2. Detecting reference sections by pattern: consecutive lines starting with [number]
 */
export function removeReferencesFromMarkdown(markdown: string): string {
  const lines = markdown.split('\n');
  const cleanedLines: string[] = [];
  let inReferencesSection = false;
  
  // Pattern to detect reference headings with markdown formatting
  // Matches: "References", "# References", "## References", "**References**", etc.
  const isReferenceHeading = (line: string): boolean => {
    const trimmed = line.trim().toLowerCase();
    
    // Remove markdown formatting for comparison
    const withoutMarkdown = trimmed
      .replace(/^\*\*/g, '')  // Remove **bold**
      .replace(/\*\*$/g, '')
      .replace(/^#+\s*/g, '')  // Remove # headings
      .trim();
    
    // Check if it matches any reference heading translation
    if (REFERENCE_HEADINGS.has(withoutMarkdown)) {
      return true;
    }
    
    // Also check if it contains "reference" (English) as fallback
    if (withoutMarkdown === 'reference' || withoutMarkdown === 'reference' + 's') {
      return true;
    }
    
    return false;
  };
  
  for (let i = 0; i < lines.length; i++) {
    const originalLine = lines[i];
    const trimmed = originalLine.trim();
    
    // Check if this line starts a references section (any language)
    if (isReferenceHeading(trimmed)) {
      inReferencesSection = true;
      continue; // Skip the references heading
    }
    
    // Detect reference section by pattern: if we see a line starting with [number]
    // after an empty line or heading-like line, we're likely entering references
    // This catches cases where the heading might be in an unexpected language
    if (!inReferencesSection && i > 0) {
      const prevLine = lines[i - 1].trim();
      const isAfterEmptyOrHeading = !prevLine || /^#+\s/.test(prevLine) || /^\*\*/.test(prevLine);
      
      // If we see a [number] pattern after empty/heading line, likely entering references
      if (isAfterEmptyOrHeading && /^\[\d+\]/.test(trimmed)) {
        inReferencesSection = true;
        continue; // Skip this reference item
      }
    }
    
    // If we're in references section
    if (inReferencesSection) {
      // Check if this line is a reference item (starts with [number])
      if (/^\[\d+\]/.test(trimmed)) {
        continue; // Skip reference items
      }
      
      // Check if this is an empty line or whitespace
      if (!trimmed) {
        // Keep empty lines but they won't end the section yet
        // We'll continue until we find non-reference content
        continue;
      }
      
      // Check if this line looks like it's still part of references
      // (e.g., continuation lines, numbered lists that might be references)
      if (/^\d+\.\s*\[/.test(trimmed)) {
        continue; // Skip numbered list references
      }
      
      // If we get here and the line has substantial content, we've likely left the references section
      // Reset the flag and include this line (it's probably new content)
      // Check for reference-related words in multiple languages
      const lowerTrimmed = trimmed.toLowerCase();
      const hasReferenceWord = lowerTrimmed.includes('reference') ||
                               lowerTrimmed.includes('referencia') ||
                               lowerTrimmed.includes('référence') ||
                               lowerTrimmed.includes('referenz') ||
                               lowerTrimmed.includes('riferimento') ||
                               lowerTrimmed.includes('referência');
      
      if (trimmed.length > 20 && !hasReferenceWord) {
        inReferencesSection = false;
        // Include this line after removing inline citations
        cleanedLines.push(originalLine.replace(/\[\d+\]/g, ''));
      } else {
        // Still might be a reference, skip it
        continue;
      }
    } else {
      // Not in references section - include the line but remove inline citations
      cleanedLines.push(originalLine.replace(/\[\d+\]/g, ''));
    }
  }
  
  // Join and clean up excessive blank lines
  let result = cleanedLines.join('\n');
  // Remove more than 2 consecutive newlines
  result = result.replace(/\n{3,}/g, '\n\n');
  
  return result;
}

