# Word Document Paste Sanitization Fix

**Date:** November 12, 2025  
**Issue:** Pasting content from Microsoft Word documents resulted in massive amounts of MSO (Microsoft Office) formatting metadata, font definitions, and style sheets being inserted into the editor.

## Problem

When users pasted content from Word documents into the intro message editor or inline WYSIWYG editor, they would get:
- HTML comments containing extensive font definitions (@font-face)
- Microsoft Office style definitions (MsoNormal, MsoChpDefault, etc.)
- Word-specific XML namespaces and tags (o:p, w:*, m:*, v:*)
- Inline style attributes with mso-* properties
- Span and font tags with complex formatting
- List definitions (@list l0, @list l1, etc.)
- Page section definitions (WordSection1, etc.)

Example of what was being pasted:
```html
<!-- /* Font Definitions */ @font-face {font-family:Wingdings; ...} 
@font-face {font-family:"Cambria Math"; ...} 
/* Style Definitions */ p.MsoNormal, li.MsoNormal, div.MsoNormal {...} 
/* List Definitions */ @list l0 {mso-list-id:1049494222; ...} -->
```

This made the HTML bloated, difficult to read, and potentially caused rendering issues.

## Solution

Enhanced the `htmlSanitizer.ts` utility to be more aggressive in stripping Word-specific formatting:

### Changes to `stripCommentsAndMetadata()` function:

1. **Reordered operations** - Style tags must be removed before style attributes to prevent partial matches
2. **Added Word-specific tag removal** - Removes `<o:*>`, `<w:*>`, `<m:*>`, `<v:*>` tags
3. **Added span tag removal** - Word uses spans heavily for formatting
4. **Added font tag removal** - Removes deprecated `<font>` tags
5. **Enhanced MSO attribute removal** - Strips all `mso-*` CSS properties
6. **Added data-* attribute removal** - Removes data attributes that Word sometimes adds

### Files Modified

- `/app-src/src/utils/htmlSanitizer.ts` - Enhanced `stripCommentsAndMetadata()` function

### How It Works

The sanitization happens in two places:

1. **WysiwygEditor** (`/app-src/src/components/UI/WysiwygEditor.tsx`)
   - Intercepts paste events via `onPaste` handler
   - Calls `sanitizePastedContent()` which internally calls `sanitizeHTML()`
   - Inserts only clean HTML at cursor position

2. **InlineWysiwygEditor** (`/app-src/src/components/Chat/InlineWysiwygEditor.tsx`)
   - Same paste interception mechanism
   - Used for editing intro messages in document config
   - Also calls `sanitizePastedContent()` for consistent behavior

### Sanitization Flow

```
Paste Event
    ↓
Get clipboard data (HTML or plain text)
    ↓
sanitizePastedContent()
    ↓
sanitizeHTML()
    ↓
stripCommentsAndMetadata() ← Enhanced with Word-specific rules
    ↓
normalizeLineBreaks()
    ↓
cleanNode() - Whitelist only allowed tags
    ↓
Clean HTML inserted into editor
```

### Allowed HTML Tags

The sanitizer only allows these safe tags:
- `<p>` - Paragraphs
- `<b>`, `<strong>` - Bold text
- `<i>`, `<em>` - Italic text
- `<u>` - Underlined text
- `<br>` - Line breaks
- `<ul>`, `<ol>`, `<li>` - Lists
- `<a>` - Links (with href, title, target, rel attributes only)

All other tags are stripped, preserving only their text content.

### Security Benefits

This fix also improves security by:
- Removing all inline styles (prevents style injection)
- Removing all class names (prevents CSS-based attacks)
- Stripping javascript: and data: URLs from links
- Ensuring all external links have `target="_blank"` and `rel="noopener noreferrer"`
- Removing all data-* attributes that could contain malicious content

## Testing

To test the fix:

1. Copy formatted content from a Word document (with bullets, bold, italics, etc.)
2. Paste into the intro message editor or inline editor
3. Verify that:
   - Only the actual text content and basic formatting (bold, italic, lists) is preserved
   - No HTML comments appear
   - No style definitions appear
   - No mso-* attributes appear
   - No Word-specific tags appear

## Impact

- **User Experience:** Users can now safely paste from Word without polluting their content
- **Performance:** Smaller HTML payloads mean faster loading and rendering
- **Maintainability:** Clean HTML is easier to debug and modify
- **Security:** Enhanced XSS protection through aggressive sanitization

## Related Files

- `/app-src/src/utils/htmlSanitizer.ts` - Core sanitization logic
- `/app-src/src/components/UI/WysiwygEditor.tsx` - Document config editor
- `/app-src/src/components/Chat/InlineWysiwygEditor.tsx` - Inline intro message editor

## Notes

- The sanitizer preserves the semantic meaning of the content while removing all formatting metadata
- Plain text paste is also supported and will be converted to HTML with proper line breaks
- The sanitization is applied on paste, not on save, so users can see the clean result immediately
- Build completed successfully with no linter errors

