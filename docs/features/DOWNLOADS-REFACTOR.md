# Downloads Functionality Refactor

## Summary
Moved the downloads management functionality from the DocumentsTable actions menu into the DocumentEditorModal, and added a new file upload component that allows users to upload files directly to Supabase storage.

## Changes Made

### 1. New Component: FileUploadManager
**File:** `/app-src/src/components/Admin/FileUploadManager.tsx`

A comprehensive file upload and URL management component that:
- **Upload to Supabase Storage**: Users can upload files directly to the `downloads` bucket in Supabase storage
- **Manual URL Entry**: Users can also manually add external URLs for downloads
- **File Management**: Edit titles, remove files, and view all download links
- **Storage Integration**: Automatically handles file uploads and deletions from Supabase storage
- **Validation**: Ensures URLs are valid and all required fields are filled

**Features:**
- Drag-and-drop style upload interface
- Real-time error handling
- Edit mode for changing titles and URLs
- Automatic public URL generation for uploaded files
- Delete files from both the database and storage

### 2. Updated DocumentEditorModal
**File:** `/app-src/src/components/Admin/DocumentEditorModal.tsx`

Added a new "Downloadable Files" section that:
- Displays after the "Content Messages" section
- Uses the new FileUploadManager component
- Saves downloads as part of the document update
- Includes the downloads field in the editing state

### 3. Updated DocumentsTable
**File:** `/app-src/src/components/Admin/DocumentsTable.tsx`

Removed:
- The "Downloads" button from the action menu
- The separate DownloadsEditor modal
- The `handleSaveDownloads` function
- The `downloadsModalDoc` state
- Import of DownloadsEditor component
- Import of DownloadLink type (no longer needed in this file)
- Import of updateDocument function (no longer needed in this file)

The table now has a cleaner action menu with just:
- View
- Copy Link
- Edit (which now includes downloads management)
- Delete

### 4. Storage Configuration
The component uses the `downloads` bucket in Supabase storage. Files are organized by document ID:
```
downloads/
  └── {documentId}/
      └── {timestamp}-{sanitized-filename}
```

## User Workflow

### Uploading Files
1. Open a document in the edit modal
2. Scroll to the "Downloadable Files" section
3. Click "Upload File" or drag and drop
4. File is uploaded to Supabase storage
5. Public URL is automatically generated and added to downloads array

### Adding Manual URLs
1. Click "Or add manual URL"
2. Enter title and URL
3. Click "Done" to save

### Managing Downloads
1. Each download shows title and URL
2. Click edit icon to modify title or URL
3. Click delete icon to remove (also deletes from storage if applicable)
4. All changes are saved when you click "Save Changes" in the modal

## Technical Details

### Supabase Storage Integration
- **Bucket**: `downloads`
- **Path Format**: `{documentId}/{timestamp}-{sanitized-filename}`
- **Access**: Public URLs (files are publicly accessible)
- **Deletion**: Files are removed from storage when deleted from the UI

### Data Format
Downloads are stored in the `documents` table as a JSONB array:
```json
[
  {
    "url": "https://mlxctdgnojvkgfqldaob.supabase.co/storage/v1/object/public/downloads/doc-id/file.pdf",
    "title": "Download Slides"
  }
]
```

## Benefits

1. **Centralized Management**: All document properties, including downloads, are managed in one place
2. **Direct Upload**: No need to manually upload files elsewhere and copy URLs
3. **Storage Integration**: Files are properly stored in Supabase with automatic URL generation
4. **Better UX**: Cleaner table interface with fewer action buttons
5. **Validation**: Built-in validation ensures URLs are properly formatted
6. **Cleanup**: Deleting downloads also removes files from storage

## Things to Check (RLS Considerations)

When making changes to the downloads functionality or RLS policies:

1. **Storage Bucket Policies**: The `downloads` bucket has the following RLS policies (applied 2025-10-27):
   - ✅ **Upload**: Any authenticated user can upload files
   - ✅ **View**: Public users can view/download files
   - ✅ **Delete**: Any authenticated user can delete files
   
   **⚠️ SECURITY CONSIDERATION**: Currently, any authenticated user can delete ANY file in the downloads bucket. In production, you may want to restrict this to:
   - Only the user who uploaded the file
   - Only owner_admins and super_admins
   - Only users who have permission to edit the associated document

2. **Document Update Permissions**: Verify that users can update the `downloads` column
   - Check RLS policies on the `documents` table
   - Ensure owner_admins and super_admins can modify downloads
   - Test that regular users cannot modify downloads on documents they don't own

3. **File Orphaning**: Be aware that if a document is deleted, associated files in storage may remain
   - Consider implementing a cleanup function for orphaned files
   - Or add a database trigger to delete storage files when a document is deleted
   - The FileUploadManager component attempts to delete files from storage when removed from the UI

4. **Storage Quotas**: Monitor storage usage as users upload files
   - The bucket currently has no file size limit set
   - Consider setting a file size limit (e.g., 50MB per file)
   - Consider implementing file type restrictions via `allowed_mime_types`

## Future Enhancements

Potential improvements for the future:
- File size limits and validation
- File type restrictions (e.g., only PDFs, images)
- Thumbnail generation for images
- Bulk upload support
- Progress indicators for large file uploads
- Storage usage analytics
- Automatic cleanup of orphaned files

