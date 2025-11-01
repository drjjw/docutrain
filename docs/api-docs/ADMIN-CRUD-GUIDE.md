# Documents CRUD Admin Guide

## Overview

The Documents CRUD Admin interface allows authorized users (Super Admins and Owner Admins) to manage all documents in the Supabase `documents` table directly from the web dashboard.

## Access Control

### Super Admins
- Can view and edit **all documents** across all owner groups
- Have full access to every field in the documents table
- Global system-wide permissions

### Owner Admins
- Can view and edit **only documents** belonging to their assigned owner group(s)
- Documents are filtered by `owner_id` matching their permissions
- Same editing capabilities as Super Admins, but scoped to their owner groups

### Regular Users
- Do not have access to the Admin interface
- Attempting to access `/app/admin/documents` will show an access denied message

## Features

### 1. Main Table View
The admin interface displays a comprehensive table with key document fields:
- **Slug**: URL-friendly identifier
- **Title**: Document title
- **Owner**: Owner group name
- **Active**: Whether document is active
- **Public**: Whether document is publicly accessible
- **Requires Auth**: Whether authentication is required
- **Downloads**: Number of download links
- **Actions**: Expand details and delete

### 2. Inline Editing
Each cell in the table can be edited individually:
- Click on any cell to enter edit mode
- Edit the value using the appropriate input type
- Save or Cancel the edit

#### Input Types by Field
- **Text fields**: Standard text input (slug, title, subtitle, etc.)
- **Boolean fields**: Checkbox toggle (active, is_public, requires_auth, show_document_selector)
- **Select fields**:
  - `embedding_type`: OpenAI or Local
  - `owner_id`: Dropdown of all available owners
- **Number fields**: Number input with min/max validation (chunk_limit_override: 1-200)
- **Textarea fields**: Multi-line text (welcome_message, intro_message)

### 3. Expandable Details View
Click "Show All" to view and edit all document fields:

#### Basic Info Section
- ID (read-only)
- Subtitle
- Category
- Year
- Back Link

#### File Info Section
- PDF Filename
- PDF Subdirectory
- Embedding Type
- Cover Image URL

#### Settings Section
- Chunk Limit Override
- Show Document Selector

#### Messages Section
- Welcome Message (displayed on document page)
- Intro Message (HTML intro message)

#### Metadata Section
- JSON metadata (read-only formatted display)

#### Timestamps
- Created timestamp
- Updated timestamp

### 4. Downloads Editor
Special modal interface for managing the JSONB `downloads` array:

#### Features
- Add new download links
- Edit existing downloads (URL and Title)
- Remove downloads
- Automatic validation:
  - URLs must start with http:// or https://
  - Both URL and Title are required
  - Invalid entries prevent saving

#### Download Format
The `downloads` column stores an array of objects:
```json
[
  {
    "url": "https://example.com/file1.pdf",
    "title": "Download PDF"
  },
  {
    "url": "https://example.com/file2.pdf",
    "title": "Download Slides"
  }
]
```

### 5. Delete Functionality
- Click "Delete" button for a document
- Confirmation step: "Confirm" or "Cancel"
- Permanent deletion from the database
- Automatically clears document cache

## Navigation

### Accessing the Admin Interface
1. Log in to the dashboard at `/app/login`
2. Look for the "Admin" button in the header (only visible to admins)
3. Click "Admin" to navigate to `/app/admin/documents`

### Header Navigation
The dashboard header shows:
- **Home**: Return to dashboard
- **Admin**: Access document administration (admins only)
- **Profile**: View/edit user profile
- **Sign Out**: Log out

Active page is highlighted with primary button styling.

## Security & Permissions

### Row-Level Security (RLS)
The admin interface relies on Supabase RLS policies to enforce permissions:
- Super admins have unrestricted access
- Owner admins are filtered by their `owner_id` associations
- All mutations are validated server-side

### Cache Management
After any document update or deletion:
- The `ukidney-documents-cache` localStorage key is cleared
- This ensures the public-facing document list reflects changes

### Permission Checks
Multiple layers of permission checking:
1. **Route Protection**: ProtectedRoute requires authentication
2. **Component-Level**: AdminPage checks for admin access before rendering
3. **Data-Level**: API functions filter documents based on user permissions
4. **Database-Level**: RLS policies enforce final security

## Important RLS Considerations

When making changes to documents via this admin interface, be aware of potential impacts:

### ✅ Always Check After Changes:
1. **Public Access**: Ensure documents with `is_public=true` remain accessible to anonymous users
2. **Owner Group Access**: Verify authenticated users can still access documents matching their owner groups
3. **Auth Requirements**: Test that `requires_auth=true` properly blocks unauthenticated access
4. **Chunk Retrieval**: Confirm that chunk retrieval still works after document updates (foreign keys to `document_chunks` and `document_chunks_local` tables)

### Common Scenarios to Test:
- Changing `is_public` from true to false
- Changing `requires_auth` from false to true
- Changing `owner_id` to a different owner
- Changing `slug` (impacts URL routing and chunk foreign keys)
- Changing `active` status

## Technical Implementation

### Files Created
```
app-src/src/
├── types/
│   └── admin.ts                    # TypeScript interfaces
├── lib/supabase/
│   └── admin.ts                    # Database/API functions
├── components/Admin/
│   ├── DocumentsTable.tsx          # Main CRUD table
│   └── DownloadsEditor.tsx         # Downloads modal editor
├── pages/
│   └── AdminPage.tsx               # Admin page wrapper
└── routes/
    └── AppRouter.tsx               # Updated routing
```

### Key Functions

#### `getDocuments(userId: string)`
Fetches documents based on user permissions:
- Super admin: All documents
- Owner admin: Filtered by owner_id

#### `updateDocument(id: string, updates: Partial<Document>)`
Updates a single document field or multiple fields:
- Validates updates
- Clears cache
- Returns updated document

#### `deleteDocument(id: string)`
Permanently deletes a document:
- Clears cache
- Triggers RLS policies

#### `getOwners()`
Fetches all owner groups for dropdown selections

## Usage Examples

### Example 1: Updating Document Title
1. Navigate to Admin → Documents
2. Find the document in the table
3. Click on the Title cell
4. Edit the text
5. Click "Save"
6. Cache is automatically cleared

### Example 2: Adding Download Links
1. Find document in table
2. Click "Edit" in Downloads column
3. In modal, click "+ Add Download"
4. Enter Title: "Download PDF"
5. Enter URL: "https://example.com/file.pdf"
6. Click "Save Changes"
7. Downloads are now available on the public document page

### Example 3: Changing Owner Group
1. Expand document details (Show All)
2. Click on Owner dropdown cell
3. Select new owner from list
4. Click "Save"
5. Document is now associated with new owner group

### Example 4: Making Document Private
1. Click on "Public" cell (shows ✓)
2. Uncheck the checkbox
3. Click "Save"
4. Document now requires authentication/owner access

## Troubleshooting

### Issue: "No documents found"
**Possible causes:**
- No documents in database
- User doesn't have access to any owner groups (owner admin)
- RLS policies blocking access

**Solution:**
- Check user_roles table for correct permissions
- Verify owner_id associations
- Confirm documents exist in database

### Issue: "Failed to save changes"
**Possible causes:**
- RLS policy rejection
- Invalid data (constraint violation)
- Network/connection error

**Solution:**
- Check browser console for detailed error
- Verify field constraints (e.g., chunk_limit 1-200)
- Ensure user has permission to edit that document

### Issue: Admin button not visible
**Possible causes:**
- User is not super_admin or owner_admin
- Permissions not loading correctly

**Solution:**
- Check user_roles table
- Verify user_permissions_summary view
- Log out and log back in

### Issue: Changes not reflected immediately
**Possible causes:**
- Frontend cache not cleared
- Browser cache

**Solution:**
- Hard refresh (Cmd/Ctrl + Shift + R)
- Clear localStorage manually
- Check Network tab for API responses

## Development Notes

### Adding New Fields
To add a new editable field to the table:

1. Update `Document` interface in `types/admin.ts`
2. Add column to main table in `DocumentsTable.tsx`
3. Add field to expandable section if needed
4. Add appropriate input handler in `renderEditInput()`
5. Add display formatter in `renderDisplayValue()`

### Styling Guidelines
- Uses Tailwind CSS utility classes
- Follows existing component patterns
- Hover states for interactive elements
- Responsive design for mobile/tablet

### Performance Considerations
- Documents loaded once on mount
- Inline edits update local state optimistically
- Only modified fields sent to server
- Owner list cached in component state

## Future Enhancements

Potential improvements for future versions:

1. **Bulk Operations**: Select multiple documents and apply changes
2. **Search/Filter**: Filter documents by owner, status, or text search
3. **Sorting**: Sort columns by clicking headers
4. **Pagination**: Handle large document lists
5. **Export**: Export document list to CSV/JSON
6. **History**: Track document changes and allow rollback
7. **Validation**: More comprehensive field validation
8. **Document Creation**: Add new documents via UI
9. **Metadata Editor**: Structured editor for metadata JSONB field
10. **Preview**: Preview document changes before saving

