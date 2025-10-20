# Document Selector Feature

## Overview
Added a beautiful, responsive document selector UI component that allows users to navigate between documents when enabled via URL parameter. This feature provides an elegant dropdown interface for document selection with search functionality.

## Implementation Date
October 19, 2025

## Last Updated
October 20, 2025 - Changed to URL parameter control (removed database dependency)

## Database Changes

### 1. Removed `document_selector` Column from `owners` Table (Deprecated)
```sql
-- Column removed - no longer needed since control moved to URL parameters
ALTER TABLE owners DROP COLUMN document_selector;
```

**Migration:** `remove_document_selector_from_owners` ✅ **Applied**

### Previous Status (Before URL Parameter Control)
- **default** owner: `document_selector = false`
- **maker-pizza** owner: `document_selector = true` ✓
- **ukidney** owner: `document_selector = false`

## Backend Changes

### 1. Updated `lib/document-registry.js`
Modified the `getDocumentsForAPI()` function to:
- Fetch owner information including the `document_selector` flag
- Include `ownerInfo` object in the API response with:
  - `slug`: Owner slug
  - `name`: Owner name
  - `documentSelector`: Boolean flag

**Example API Response:**
```json
{
  "documents": [
    {
      "slug": "maker-foh",
      "title": "FOH Training Guide",
      "subtitle": "Front of House Operations",
      "owner": "maker",
      "ownerInfo": {
        "slug": "maker-pizza",
        "name": "Maker Pizza",
        "documentSelector": true
      }
    }
  ]
}
```

## Frontend Changes

### 1. HTML Structure (`public/index.html`)
Added document selector UI to the header:
- **Container**: `#documentSelectorContainer` - Hidden by default
- **Button**: `#documentSelectorBtn` - Shows current document
- **Dropdown**: `#documentSelectorDropdown` - Contains document list
- **Search**: `#documentSearch` - Filter documents by name
- **Overlay**: `#documentSelectorOverlay` - Mobile backdrop

### 2. CSS Styles (`public/css/styles.css`)
Added comprehensive styling for:
- **Desktop Layout**: Dropdown positioned below button
- **Mobile Layout**: Bottom sheet with overlay
- **Animations**: Smooth transitions and hover effects
- **Responsive Design**: Adapts to screen size
- **Visual Polish**: Icons, shadows, and modern design

Key Features:
- Hover effects with color changes
- Active state highlighting
- Search input with icon
- Scrollable document list
- Truncated text with ellipsis
- Mobile-friendly touch targets

### 3. JavaScript Module (`public/js/document-selector.js`)
Created a new ES6 module that:
- **Initializes** on page load
- **Fetches** documents from `/api/documents`
- **Checks** if current document's owner has `documentSelector` enabled
- **Shows/Hides** the selector based on owner settings
- **Renders** document list filtered by owner
- **Handles** search functionality
- **Navigates** to selected document by updating URL

**Key Methods:**
- `loadDocuments()` - Fetch and check if selector should be shown
- `renderDocuments(searchTerm)` - Display filtered document list
- `navigateToDocument(slug)` - Navigate to selected document
- `open()` / `close()` - Toggle dropdown visibility

### 4. Build Configuration (`build.js`)
Added `public/js/document-selector.js` to the build process for hashing and deployment.

## User Experience

### Desktop
1. Document selector appears in header when enabled
2. Click button to open dropdown
3. Search or scroll through documents
4. Click document to navigate
5. Close with X button or click outside

### Mobile
1. Document selector appears in header when enabled
2. Tap button to open bottom sheet
3. Search or scroll through documents
4. Tap document to navigate
5. Close with X button or tap overlay

## Features

### ✅ Owner-Based Visibility
- Only shown when `owner.document_selector = true`
- Automatically hidden for other owners
- No configuration needed in frontend

### ✅ Smart Filtering
- Only shows documents from the same owner
- Prevents cross-owner navigation
- Maintains owner context

### ✅ Search Functionality
- Real-time search as you type
- Searches both title and subtitle
- Case-insensitive matching

### ✅ Visual Feedback
- Current document highlighted
- Hover effects on items
- Active states for buttons
- Smooth animations

### ✅ Responsive Design
- Desktop: Dropdown below button
- Mobile: Bottom sheet with overlay
- Touch-friendly tap targets
- Optimized for all screen sizes

## Enabling for Other Owners

To enable the document selector for another owner:

```sql
UPDATE owners 
SET document_selector = true 
WHERE slug = 'owner-slug-here';
```

The feature will automatically appear for all documents belonging to that owner.

## Technical Details

### API Endpoint
- **URL**: `/api/documents`
- **Method**: GET
- **Response**: Array of documents with `ownerInfo`

### URL Parameter Control
- Documents are selected via `?doc=<slug>` parameter
- Selector is enabled via `?document_selector=true` parameter
- Selector updates URL and reloads page on selection
- Maintains other URL parameters

**Example URLs:**
- `/?doc=maker-menu-deck&document_selector=true` - Shows selector for Maker documents
- `/?doc=smh` - Hides selector (default behavior)

### Caching
- Document registry uses 5-minute cache
- Owner information fetched with documents
- No additional database queries per request

## Files Modified

### Backend
- ✅ `lib/document-registry.js` - Added owner info to API
- ✅ `dist/lib/document-registry.js` - Updated dist version

### Frontend
- ✅ `public/index.html` - Added selector HTML
- ✅ `public/css/styles.css` - Added selector styles
- ✅ `public/js/document-selector.js` - Created new module

### Build
- ✅ `build.js` - Added new JS file to build process

### Database
- ✅ Migration: `add_document_selector_to_owners`

## Testing Checklist

- [x] Removed `document_selector` column from owners table
- [x] Updated to URL parameter control (`?document_selector=true`)
- [ ] Verify selector appears with `?document_selector=true`
- [ ] Verify selector hidden without URL parameter (default)
- [ ] Test search functionality
- [ ] Test document navigation
- [ ] Test mobile responsive layout
- [ ] Test desktop dropdown layout
- [ ] Test keyboard navigation (Escape to close)
- [ ] Test overlay click to close
- [ ] Verify current document is highlighted
- [ ] Test with multiple documents from same owner

## Future Enhancements

Potential improvements:
1. **Keyboard Navigation**: Arrow keys to navigate list
2. **Recent Documents**: Show recently accessed documents
3. **Favorites**: Allow users to favorite documents
4. **Categories**: Group documents by category
5. **Thumbnails**: Add document preview images
6. **Multi-Select**: Allow comparing multiple documents

## Notes

- The `owner` field in documents table is a text field (legacy)
- The `owner_id` field links to the `owners` table (new)
- Both fields are currently maintained for compatibility
- The selector uses `owner_id` for owner information lookup

## Support

For issues or questions about the document selector feature:
1. Check browser console for JavaScript errors
2. Verify URL contains `?document_selector=true` parameter
3. Ensure documents have valid `owner_id` foreign key
4. Check that `/api/documents` returns `ownerInfo` object

