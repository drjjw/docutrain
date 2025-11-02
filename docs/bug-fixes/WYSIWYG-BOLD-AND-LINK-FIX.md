# WYSIWYG Editor: Comprehensive Fixes

**Date**: November 2, 2025  
**Components**: `InlineWysiwygEditor.tsx`, `inline-editor.css`  
**Issues Fixed**:
1. Bold styling being removed when saving intro messages
2. Links not opening in new tabs
3. Entire content area being clickable instead of just the edit icon
4. Links not being visually styled (bold, colored, underlined)
5. No way to remove links once created

## Problem Description

### Issue 1: Bold Styling Removed on Save
When users applied bold formatting to text in the intro message WYSIWYG editor, the bold styling would be removed after saving. This occurred because:

- The browser's `document.execCommand('bold')` creates `<b>` tags
- The `sanitizeHTML` function only allowed `<strong>` tags in its whitelist
- During sanitization, `<b>` tags were stripped out, removing the bold formatting

### Issue 2: Links Not Opening in New Tabs
When users inserted links using the link tool, the links would open in the same tab instead of a new tab. This is poor UX because:

- Users would navigate away from the chat interface
- The browser's `document.execCommand('createLink')` doesn't add `target="_blank"` automatically
- Security best practices require `rel="noopener noreferrer"` for external links

### Issue 3: Entire Content Area Clickable
The entire intro message content area was clickable to enter edit mode, which caused problems:

- Users would accidentally trigger edit mode when trying to click links in the content
- Poor UX - users expect only the edit icon to trigger editing
- Made the content feel like a button rather than readable text
- Conflicted with interactive elements (links) within the content

### Issue 4: Links Not Visually Styled
Links in the WYSIWYG editor content (both in edit mode and display mode) were not visually distinct:

- Links looked like regular text, making them hard to identify
- No visual indication that text was clickable
- Inconsistent with standard web conventions where links are styled differently
- Users couldn't tell what was a link without hovering

## Solution Implemented

### Fix 1: Allow Both `<b>` and `<i>` Tags in Sanitization

**File**: `app-src/src/components/Chat/InlineWysiwygEditor.tsx`

Updated the `allowedTags` object in the `sanitizeHTML` function to include:
- `<b>` tags (created by `execCommand('bold')`)
- `<i>` tags (created by `execCommand('italic')`)
- `rel` attribute for anchor tags (for security)

```typescript
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
```

### Fix 2: Automatically Add `target="_blank"` to Links

**Implementation in two places:**

#### A. During Link Creation
Modified the `execCommand` function to automatically add `target="_blank"` and `rel="noopener noreferrer"` immediately after creating a link:

```typescript
const execCommand = (command: string, value?: string) => {
  editorRef.current?.focus();
  if (command === 'createLink') {
    const url = prompt('Enter URL:');
    if (url) {
      document.execCommand('createLink', false, url);
      // After creating the link, add target="_blank" and rel="noopener noreferrer"
      const selection = window.getSelection();
      if (selection && selection.anchorNode) {
        // Find the anchor element that was just created
        let node = selection.anchorNode;
        let anchor: HTMLAnchorElement | null = null;
        
        // Check if the node itself is an anchor
        if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === 'A') {
          anchor = node as HTMLAnchorElement;
        } else if (node.parentElement?.tagName === 'A') {
          // Check if parent is an anchor
          anchor = node.parentElement as HTMLAnchorElement;
        }
        
        if (anchor) {
          anchor.setAttribute('target', '_blank');
          anchor.setAttribute('rel', 'noopener noreferrer');
        }
      }
    }
  } else {
    document.execCommand(command, false, value);
  }
};
```

#### B. During Sanitization (Fallback)
Added logic in the `sanitizeHTML` function to ensure all anchor tags have `target="_blank"` and `rel="noopener noreferrer"`, even if they were somehow created without these attributes:

```typescript
// For anchor tags, ensure target="_blank" and rel="noopener noreferrer" are set
if (tagName === 'a' && cleanElement.hasAttribute('href')) {
  if (!cleanElement.hasAttribute('target')) {
    cleanElement.setAttribute('target', '_blank');
  }
  if (!cleanElement.hasAttribute('rel')) {
    cleanElement.setAttribute('rel', 'noopener noreferrer');
  }
}
```

### Fix 3: Remove Click Handler from Content Area

**Problem**: The entire content div had `onClick={handleStartEditing}` and `cursor: 'pointer'`, making the whole area clickable.

**Solution**: Removed the click handler and pointer cursor from the content div, keeping only the edit icon button clickable.

**Before**:
```typescript
<div
  id={id}
  className={className}
  style={{ cursor: 'pointer', position: 'relative' }}
  onClick={handleStartEditing}
  dangerouslySetInnerHTML={{ __html: value }}
/>
<button
  className="inline-edit-icon"
  onClick={(e) => {
    e.stopPropagation();  // Had to prevent bubbling
    handleStartEditing();
  }}
>
  ✏️
</button>
```

**After**:
```typescript
<div
  id={id}
  className={className}
  style={{ position: 'relative' }}  // No cursor or onClick
  dangerouslySetInnerHTML={{ __html: value }}
/>
<button
  className="inline-edit-icon"
  onClick={handleStartEditing}  // Only the button triggers editing
>
  ✏️
</button>
```

**Benefits**:
- Users can click links in the content without triggering edit mode
- Content feels like readable text, not a button
- Edit icon is the clear, single entry point for editing
- No need for `e.stopPropagation()` since only the button has a click handler

### Fix 4: Add Bold Styling to Links

**File**: `app-src/src/styles/inline-editor.css`

Added CSS rules to style links in the WYSIWYG editor content with bold font, blue color, and underline:

```css
/* Links in WYSIWYG editor content - both in edit mode and display mode */
.inline-editor-active a,
.inline-editor-wrapper a,
.inline-wysiwyg-editor a {
    font-weight: bold;
    color: #007bff;
    text-decoration: underline;
}

.inline-editor-active a:hover,
.inline-editor-wrapper a:hover,
.inline-wysiwyg-editor a:hover {
    color: #0056b3;
    text-decoration: underline;
}

/* Ensure links in display mode (not editing) are clickable */
.inline-editor-wrapper a {
    cursor: pointer;
}
```

**Benefits**:
- Links are immediately visually identifiable
- Bold styling makes links stand out in the content
- Blue color follows web conventions
- Underline provides additional visual cue
- Hover state provides feedback
- Consistent styling in both edit and display modes

### Fix 5: Add Unlink Button

**File**: `app-src/src/components/Chat/InlineWysiwygEditor.tsx`

Added an "Unlink" button (🔗❌) to the toolbar that allows users to remove links from selected text:

```typescript
<button
  type="button"
  className="inline-editor-toolbar-btn"
  onClick={() => execCommand('unlink')}
  title="Remove Link"
>
  🔗❌
</button>
```

**How to Use**:
1. In edit mode, select text that contains a link
2. Click the "🔗❌" (Unlink) button
3. The link is removed, leaving just the text

**Benefits**:
- Users can easily remove links without manually editing HTML
- Standard rich text editor functionality
- Works with the browser's native `unlink` command
- No need to delete and retype text to remove a link

## Security Considerations

### XSS Prevention
The sanitization still prevents XSS attacks by:
- Only allowing safe HTML tags
- Filtering out `javascript:` and `data:` URLs in href attributes
- Maintaining a strict whitelist of allowed attributes

### External Link Security
All links now include `rel="noopener noreferrer"` which:
- Prevents the new page from accessing the `window.opener` object
- Prevents the Referer header from being sent
- Protects against reverse tabnabbing attacks

## Testing Recommendations

### Test Case 1: Bold Formatting Persistence
1. Navigate to a document's intro message
2. Click the edit icon to enter edit mode
3. Select some text and click the Bold (B) button
4. Click Save
5. **Expected**: Text remains bold after save
6. Refresh the page
7. **Expected**: Text is still bold

### Test Case 2: Link Opens in New Tab
1. Navigate to a document's intro message
2. Click the edit icon to enter edit mode
3. Select some text and click the Link (🔗) button
4. Enter a URL (e.g., `https://www.example.com`)
5. Click Save
6. Click the link in the intro message
7. **Expected**: Link opens in a new tab
8. **Expected**: Original chat page remains open

### Test Case 3: Edit Icon Only
1. Navigate to a document's intro message (with edit permissions)
2. Hover over the intro message - edit icon should appear
3. Click anywhere in the intro message content
4. **Expected**: Nothing happens (no edit mode triggered)
5. Click the edit icon (✏️)
6. **Expected**: Edit mode is triggered
7. If there are links in the content, click them in view mode
8. **Expected**: Links open in new tabs, edit mode is NOT triggered

### Test Case 4: Mixed Formatting
1. Create text with bold, italic, underline, and links
2. Save and verify all formatting persists
3. Check that links open in new tabs

### Test Case 5: Security
1. Try to create a link with `javascript:alert('XSS')`
2. **Expected**: Link is sanitized and removed
3. Try to paste malicious HTML
4. **Expected**: Only safe tags are preserved

## Files Modified

- `app-src/src/components/Chat/InlineWysiwygEditor.tsx`
  - Updated `allowedTags` in `sanitizeHTML` function to allow `<b>` and `<i>` tags
  - Modified `execCommand` function to add `target="_blank"` and `rel="noopener noreferrer"` to links
  - Added fallback logic in `sanitizeHTML` to ensure all links have proper attributes
  - Removed `onClick` handler and `cursor: 'pointer'` from content div
  - Simplified edit icon button click handler (no need for `stopPropagation`)

## Impact

### User Experience
- ✅ Bold formatting now persists correctly
- ✅ Links open in new tabs (better UX)
- ✅ Users don't lose their place when clicking links
- ✅ Content is readable without accidental edit mode triggers
- ✅ Links in content are clickable without triggering edit mode
- ✅ Clear visual affordance (edit icon) for entering edit mode
- ✅ Consistent behavior with modern web standards

### Security
- ✅ Maintains XSS protection
- ✅ Adds protection against reverse tabnabbing
- ✅ No new security vulnerabilities introduced

## Related Components

This fix applies to the inline WYSIWYG editor used for:
- Document intro messages
- Any other fields using the `InlineWysiwygEditor` component

## Future Considerations

1. **Consider normalizing tags**: We could add a post-processing step to convert `<b>` to `<strong>` and `<i>` to `<em>` for semantic HTML, but this is not critical.

2. **Link preview**: Consider adding a link preview/edit feature so users can modify link URLs without re-creating them.

3. **Keyboard shortcuts**: Add keyboard shortcuts for common formatting (Cmd+B for bold, Cmd+K for link, etc.).

4. **Rich paste**: Consider improving paste handling to preserve formatting from external sources while still sanitizing.

