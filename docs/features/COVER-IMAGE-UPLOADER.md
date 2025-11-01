# Cover Image Uploader Feature

## Overview
Added a proper file upload UI for document cover images in the edit document modal at `/app/dashboard`. Previously, users could only enter a URL manually in a text field. Now they can upload images directly or enter URLs.

## Changes Made

### 1. New Component: CoverImageUploader
**File**: `app-src/src/components/Admin/CoverImageUploader.tsx`

Features:
- **Image Upload**: Drag and drop or click to upload image files
- **File Validation**: 
  - Only accepts image files (PNG, JPG, GIF, WebP)
  - Max file size: 5MB
  - Recommended size: 1200x630px
- **Preview**: Shows uploaded image with hover-to-delete functionality
- **Manual URL Entry**: Alternative option to enter image URL directly
- **Storage Integration**: Uploads to Supabase `thumbs` bucket
- **Error Handling**: Clear error messages for upload failures

### 2. Updated DocumentEditorModal
**File**: `app-src/src/components/Admin/DocumentEditorModal.tsx`

- Imported `CoverImageUploader` component
- Replaced simple text input with full-featured uploader
- Cover field now shows at line 364-371

### 3. Storage Bucket Configuration
**Bucket**: `thumbs` (existing public bucket)

Created RLS policies for authenticated users:
- ✅ Public read access (SELECT)
- ✅ Authenticated upload (INSERT)
- ✅ Authenticated update (UPDATE)
- ✅ Authenticated delete (DELETE)

**Migration**: `add_thumbs_bucket_policies`

## User Workflow

### Uploading a Cover Image
1. Navigate to `/app/dashboard`
2. Click "Edit" on any document
3. Scroll to "File & Technical Details" section
4. Under "Cover Image":
   - Click "Upload Image" button
   - Select an image file (PNG, JPG, GIF, WebP)
   - Image is uploaded to Supabase storage
   - Public URL is automatically generated and saved

### Changing a Cover Image
1. Hover over existing cover preview
2. Click the red delete button
3. Upload a new image

### Using a Manual URL
1. Instead of uploading, enter a URL in the text field
2. Preview will update automatically
3. Save changes to apply

## Storage Structure

Files are organized in the `thumbs` bucket:
```
thumbs/
  └── {documentId}/
      └── {timestamp}-{sanitized-filename}
```

Example:
```
thumbs/123e4567-e89b-12d3-a456-426614174000/1730000000000-cover-image.jpg
```

## Technical Details

### File Upload Process
1. User selects image file
2. File is validated (type and size)
3. Unique filename generated with timestamp
4. File uploaded to `thumbs/{documentId}/` path
5. Public URL retrieved from Supabase
6. URL stored in `documents.cover` field

### File Deletion Process
1. User clicks delete button
2. File path extracted from URL
3. File removed from storage bucket
4. Cover field cleared in database

### Security
- Only authenticated users can upload/delete
- Public read access for displaying images
- File size limited to 5MB
- Only image MIME types accepted

## RLS Considerations

When making changes to cover image functionality:
- ✅ Verify public users can still view cover images
- ✅ Ensure authenticated users can upload covers
- ✅ Check that old cover URLs still work
- ✅ Test deletion removes files from storage
- ✅ Confirm document updates save cover URL correctly

## Benefits

1. **Better UX**: Visual upload interface vs. manual URL entry
2. **Direct Upload**: No need to host images elsewhere
3. **Preview**: See image before saving
4. **Validation**: Built-in checks for file type and size
5. **Storage Integration**: Automatic cleanup when deleting
6. **Flexibility**: Can still use external URLs if preferred

## Next Steps

Future enhancements could include:
- Image cropping/resizing before upload
- Batch upload for multiple documents
- Default cover templates
- Image optimization (compression)
- Drag-and-drop directly onto preview area


