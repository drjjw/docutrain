# HTML Intro Messages Feature

**Implementation Date:** October 20, 2025
**Last Updated:** October 20, 2025 (Welcome Message HTML Support)
**Status:** ✅ Complete

## Overview

This feature replaces the hard-coded intro message with database-driven HTML intro messages. It supports owner-level defaults and document-level overrides with basic HTML sanitization for security.

### Welcome Message HTML Support

The `welcome_message` field in the documents table now supports basic HTML formatting for enhanced visual presentation of document titles and branding.

## Database Changes

### New Columns

1. **`owners.intro_message`** (text, nullable)
   - Default HTML intro message for all documents owned by this owner
   - Supports basic HTML tags
   - Comment: "Default HTML intro message for all documents owned by this owner. Supports basic HTML tags."

2. **`documents.intro_message`** (text, nullable)
   - HTML intro message for this specific document
   - Overrides owner default when set
   - Supports basic HTML tags
   - Comment: "HTML intro message for this specific document. Overrides owner default when set. Supports basic HTML tags."

### Migration Applied

```sql
-- Migration: add_intro_message_columns
ALTER TABLE owners 
ADD COLUMN intro_message text;

ALTER TABLE documents 
ADD COLUMN intro_message text;
```

## Welcome Message HTML Support

### Implementation Details

The `welcome_message` field now supports basic HTML tags for visual formatting. This affects how document titles appear in:

1. **Header title** - The main document title in the page header
2. **About tooltip** - The document name shown in the info tooltip
3. **Welcome sections** - Document titles in welcome messages and covers

### Supported HTML Tags

- `<strong>`, `<b>` - Bold text
- `<em>`, `<i>` - Italic text
- `<span>` - Inline styling (with style attribute)
- `<br>` - Line breaks

### Frontend Changes

**File: `public/js/ui.js`**

- **Line 333:** Changed `welcomeTitleElement.textContent` to `welcomeTitleElement.innerHTML`
- **Line 371:** Changed `regularWelcomeTitleElement.textContent` to `regularWelcomeTitleElement.innerHTML`

These changes enable HTML rendering in welcome message displays while maintaining text-only rendering for the about tooltip (for safety).

### Usage Examples

```sql
-- Basic HTML formatting
UPDATE documents
SET welcome_message = '<strong>KDIGO</strong> <em>Guidelines</em> 2024'
WHERE slug = 'kdigo-ckd-2024';

-- With inline styling
UPDATE documents
SET welcome_message = '<strong>SMH</strong> <span style="color: #007acc;">Manual</span>'
WHERE slug = 'smh';
```

### Security Notes

- HTML is rendered directly (no sanitization like intro messages)
- Only use trusted HTML as this field is administrator-controlled
- Avoid `<script>`, event handlers, or external links

## Message Priority Logic

The system uses the following priority order:

1. **Document-level intro** (`documents.intro_message`) - highest priority
2. **Owner-level intro** (`owners.intro_message`) - fallback
3. **NULL** - no intro message displayed

For multi-document queries:
- If all documents have the same intro message, display it
- If documents have different intro messages, display nothing

## HTML Sanitization

All intro messages are sanitized to prevent XSS attacks while allowing safe formatting.

### Allowed HTML Tags
- `<strong>`, `<em>`, `<b>`, `<i>` - text formatting
- `<br>` - line breaks
- `<ul>`, `<ol>`, `<li>` - lists
- `<a>` - links (href attribute only)
- `<p>`, `<span>`, `<div>` - structure

### Security Features
- Strips `<script>` tags and content
- Removes event handlers (onclick, onerror, etc.)
- Removes `javascript:` protocol from links
- Removes style attributes (prevents CSS injection)
- Removes all non-whitelisted tags

### Sanitization Implementation

The `sanitizeIntroHTML()` function is implemented in:
- `/lib/document-registry.js` (lines 17-56)
- `/server.js` (lines 123-162)
- `/dist/lib/document-registry.js` (lines 17-56)
- `/dist/server.js` (lines 123-162)

## Backend Changes

### Document Registry (`lib/document-registry.js`)

1. **Database Query Enhancement** (lines 45-57)
   - Joins `documents` with `owners` table
   - Fetches `owners.intro_message`, `slug`, and `name`
   - Flattens owner data into document object

2. **API Response** (`getDocumentsForAPI()`, lines 344-377)
   - Determines intro message using priority logic
   - Sanitizes HTML before sending to frontend
   - Returns `introMessage` field in document config

### Example API Response

```json
{
  "slug": "smh",
  "title": "SMH Housestaff Manual",
  "introMessage": "This AI-powered assistant provides <strong>intelligent answers</strong> to your nephrology questions.<br><br><strong>Example questions:</strong><br>• What are the indications for urgent dialysis?",
  "embeddingType": "openai",
  ...
}
```

## Frontend Changes

### HTML Structure (`public/index.html`)

**Before:**
```html
<div class="message assistant" id="regularWelcomeMessage">
    <div class="message-content">
        <strong id="regularWelcomeTitle" class="loading-text">NEPHROLOGY AI ASSISTANT</strong>
        <br><br>
        This AI-powered assistant provides intelligent answers...
        [hard-coded content]
    </div>
</div>
```

**After:**
```html
<div class="message assistant" id="regularWelcomeMessage" style="display: none;">
    <div class="message-content">
        <strong id="regularWelcomeTitle" class="loading-text"></strong>
        <div id="regularWelcomeContent"></div>
    </div>
</div>
```

### UI Logic (`public/js/ui.js`)

**Key Changes in `updateDocumentUI()` function:**

1. **Intro Message Determination** (lines 299-312)
   - Single document: uses `config.introMessage`
   - Multi-document: checks if all have same intro
   - Falls back to NULL if no match

2. **Cover Layout Rendering** (lines 317-367)
   - Creates dynamic `#welcomeIntroContent` container
   - Uses `innerHTML` to render sanitized HTML
   - Handles empty intro gracefully

3. **Regular Welcome Rendering** (lines 368-393)
   - Shows welcome only if intro message exists
   - Hides welcome entirely if no intro
   - Updates title and content dynamically

## Usage Examples

### Setting Owner Default Intro

```sql
UPDATE owners 
SET intro_message = 'This AI assistant helps with <strong>nephrology questions</strong>.<br><br><strong>Example questions:</strong><br>• What are the indications for dialysis?<br>• How do you manage hyperkalemia?'
WHERE slug = 'ukidney';
```

### Setting Document-Specific Intro (Override)

```sql
UPDATE documents 
SET intro_message = 'Welcome to the <strong>SMH Housestaff Manual</strong>.<br><br>This manual covers essential nephrology topics for residents and fellows.'
WHERE slug = 'smh';
```

### Clearing Intro Message

```sql
-- Clear document override (falls back to owner default)
UPDATE documents SET intro_message = NULL WHERE slug = 'smh';

-- Clear owner default (documents with NULL intro will show nothing)
UPDATE owners SET intro_message = NULL WHERE slug = 'ukidney';
```

## Testing Checklist

- [x] Database migration applied successfully
- [x] HTML sanitization prevents XSS attacks
- [x] Document override takes precedence over owner default
- [x] NULL intro messages hide welcome section
- [x] Multi-document mode handles mixed intros correctly
- [x] Cover layout displays intro correctly
- [x] Regular welcome layout displays intro correctly
- [x] No linter errors in modified files
- [x] Welcome message HTML support works in header titles
- [x] Welcome message HTML support works in welcome sections
- [x] About tooltip remains text-only for safety

## Security Considerations

### XSS Protection
The sanitization function provides defense-in-depth against XSS attacks:
1. Removes script tags and content
2. Strips event handlers
3. Blocks javascript: URLs
4. Removes style attributes
5. Whitelists safe tags only

### Trust Model
- Database content is sanitized before rendering
- Only administrators with database access can set intro messages
- No user-generated content is accepted for intro messages

## RLS Considerations

**Important:** When making changes to intro messages via the database:

1. **Check affected documents:** After updating `owners.intro_message`, verify all documents owned by that owner display correctly
2. **Test multi-document queries:** Ensure mixed intro messages don't break multi-doc mode
3. **Cache invalidation:** The document registry cache refreshes every 5 minutes, or you can force refresh via `/api/refresh-registry`
4. **Browser cache:** Users may need to clear localStorage key `ukidney-documents-cache` to see changes immediately

## Files Modified

### Database
- Migration: `add_intro_message_columns`

### Backend
- `/server.js` - Added `sanitizeIntroHTML()` function
- `/lib/document-registry.js` - Updated query and API response
- `/dist/server.js` - Synced with main server.js
- `/dist/lib/document-registry.js` - Synced with main

### Frontend
- `/public/index.html` - Removed hard-coded intro
- `/public/js/ui.js` - Dynamic intro rendering, welcome message HTML support
- `/dist/public/index.html` - Synced with main
- `/dist/public/js/ui.js` - Synced with main

## Future Enhancements

Potential improvements for future consideration:

1. **Rich Text Editor:** Admin UI for editing intro messages with WYSIWYG
2. **Template Variables:** Support for `{{documentTitle}}`, `{{ownerName}}` placeholders
3. **Markdown Support:** Allow Markdown syntax in addition to HTML
4. **Localization:** Multi-language intro messages
5. **A/B Testing:** Track engagement with different intro messages

## Rollback Instructions

If needed, the feature can be rolled back:

```sql
-- Remove columns (data will be lost)
ALTER TABLE documents DROP COLUMN intro_message;
ALTER TABLE owners DROP COLUMN intro_message;
```

Then restore the hard-coded intro message in `public/index.html` and revert the UI.js changes.

---

## Cache Management

After updating intro messages, changes may not appear immediately due to caching. See:
- **[Cache Management Guide](./CACHE-MANAGEMENT.md)** - Complete caching documentation
- **[Cache Quick Reference](./CACHE-QUICK-REFERENCE.md)** - Quick commands and cheat sheet

**Quick summary:**
- Server cache: Auto-refreshes every 2 minutes
- Browser cache: Expires after 5 minutes
- For immediate updates: Bump cache version in `config.js`

---

## Related Documentation

- [HTML Intro Messages Quickstart](./HTML-INTRO-MESSAGES-QUICKSTART.md) - Quick start guide
- [Cache Management Guide](./CACHE-MANAGEMENT.md) - Detailed caching documentation
- [Cache Quick Reference](./CACHE-QUICK-REFERENCE.md) - Quick commands
- [Deployment Guide](./DEPLOYMENT-REFACTORED-APP.md) - Deployment instructions

---

**Implementation completed successfully with no linter errors.**

