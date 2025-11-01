# Storage Cascade Delete Implementation

**Date:** 2025-10-29  
**Status:** ✅ Implemented

## Overview

Implemented automatic storage file cleanup when documents are deleted from the database. This ensures that storage files (PDFs, downloads, cover images) are automatically deleted when their associated database records are removed, preventing orphaned files.

## Problem Statement

Previously, when deleting documents from the dashboard (`/app/dashboard`), only the database records were deleted:
- ✅ Database record in `documents` table was deleted
- ✅ Embeddings in `document_chunks` and `document_chunks_local` were cascade deleted (via foreign key)
- ❌ PDF files in storage were NOT deleted (orphaned)
- ❌ Download files in storage were NOT deleted (orphaned)
- ❌ Cover images in storage were NOT deleted (orphaned)

## Solution

Created PostgreSQL trigger functions that automatically delete associated storage files when database records are deleted.

### 1. Documents Table Cleanup

**Trigger:** `cleanup_document_storage_trigger`  
**Function:** `cleanup_document_storage()`  
**Fires:** BEFORE DELETE on `documents` table

**What it deletes:**
1. **Main PDF file** - If `pdf_subdirectory = 'user-uploads'`
   - Bucket: `user-documents`
   - Path: `{pdf_subdirectory}/{pdf_filename}`

2. **Cover image** - If `cover` field contains a Supabase storage URL
   - Bucket: `thumbs`
   - Path extracted from URL: `/thumbs/{path}`

3. **Download files** - All files in the `downloads` JSONB array
   - Bucket: `downloads`
   - Path extracted from URL: `/downloads/{path}`

### 2. User Documents Table Cleanup

**Trigger:** `cleanup_user_document_storage_trigger`  
**Function:** `cleanup_user_document_storage()`  
**Fires:** BEFORE DELETE on `user_documents` table

**What it deletes:**
1. **User-uploaded PDF file**
   - Bucket: `user-documents`
   - Path: `{file_path}` (e.g., `{user_id}/{timestamp}-{filename}`)

## Database Cascade Relationships

### Foreign Key Cascades (Already Existed)
```
documents (parent)
├── document_chunks → ON DELETE CASCADE
└── document_chunks_local → ON DELETE CASCADE
```

### Storage Cascades (New Implementation)
```
documents (parent)
├── document_chunks → ON DELETE CASCADE (FK)
├── document_chunks_local → ON DELETE CASCADE (FK)
├── user-documents/{pdf_subdirectory}/{pdf_filename} → BEFORE DELETE Trigger
├── thumbs/{cover_image_path} → BEFORE DELETE Trigger
├── downloads/{download_file_path} → BEFORE DELETE Trigger (for each download)
└── user_documents (matching record) → AFTER DELETE Trigger

user_documents (parent)
├── user-documents/{file_path} → BEFORE DELETE Trigger
└── document_processing_logs.user_document_id → SET NULL (FK, preserves audit trail)
```

## Security Considerations

### SECURITY DEFINER
Both functions use `SECURITY DEFINER` to allow deletion from `storage.objects` table even when called by users who don't have direct access to that table.

### Search Path
Both functions explicitly set `search_path = public, storage` to prevent security vulnerabilities (as recommended by Supabase linter).

### RLS Bypass
The triggers bypass Row Level Security (RLS) policies on storage buckets because they run with elevated privileges. This is intentional and necessary for cleanup.

## Testing

### Manual Test Steps

1. **Test Document with User-Uploaded PDF:**
   ```sql
   -- Find a document with user-uploaded PDF
   SELECT id, slug, title, pdf_filename, pdf_subdirectory 
   FROM documents 
   WHERE pdf_subdirectory = 'user-uploads' 
   LIMIT 1;
   
   -- Check if file exists in storage
   SELECT name FROM storage.objects 
   WHERE bucket_id = 'user-documents' 
     AND name LIKE '%{pdf_filename}%';
   
   -- Delete the document
   DELETE FROM documents WHERE id = '{document_id}';
   
   -- Verify file is gone
   SELECT name FROM storage.objects 
   WHERE bucket_id = 'user-documents' 
     AND name LIKE '%{pdf_filename}%';
   -- Should return 0 rows
   ```

2. **Test Document with Downloads:**
   ```sql
   -- Find a document with downloads
   SELECT id, slug, title, downloads 
   FROM documents 
   WHERE jsonb_array_length(downloads) > 0 
   LIMIT 1;
   
   -- Extract download paths
   SELECT jsonb_array_elements(downloads)->>'url' as url 
   FROM documents 
   WHERE id = '{document_id}';
   
   -- Check if files exist in storage
   SELECT name FROM storage.objects 
   WHERE bucket_id = 'downloads';
   
   -- Delete the document
   DELETE FROM documents WHERE id = '{document_id}';
   
   -- Verify files are gone
   SELECT name FROM storage.objects 
   WHERE bucket_id = 'downloads' 
     AND name LIKE '%{document_id}%';
   -- Should return 0 rows
   ```

3. **Test Document with Cover Image:**
   ```sql
   -- Find a document with cover image
   SELECT id, slug, title, cover 
   FROM documents 
   WHERE cover IS NOT NULL AND cover != '' 
   LIMIT 1;
   
   -- Check if file exists in storage
   SELECT name FROM storage.objects 
   WHERE bucket_id = 'thumbs';
   
   -- Delete the document
   DELETE FROM documents WHERE id = '{document_id}';
   
   -- Verify file is gone
   SELECT name FROM storage.objects 
   WHERE bucket_id = 'thumbs' 
     AND name LIKE '%{extracted_path}%';
   -- Should return 0 rows
   ```

4. **Test User Document:**
   ```sql
   -- Find a user document
   SELECT id, title, file_path 
   FROM user_documents 
   LIMIT 1;
   
   -- Check if file exists
   SELECT name FROM storage.objects 
   WHERE bucket_id = 'user-documents' 
     AND name = '{file_path}';
   
   -- Delete the user document
   DELETE FROM user_documents WHERE id = '{id}';
   
   -- Verify file is gone
   SELECT name FROM storage.objects 
   WHERE bucket_id = 'user-documents' 
     AND name = '{file_path}';
   -- Should return 0 rows
   ```

## Things to Check When Making RLS Changes

⚠️ **When modifying RLS policies or storage bucket policies, verify:**

1. **Storage Bucket Policies:**
   - Ensure the trigger functions can still delete from `storage.objects`
   - The `SECURITY DEFINER` should bypass RLS, but test to confirm

2. **Document Deletion Permissions:**
   - Verify that authorized users can still delete documents
   - Test with different user roles (super_admin, owner_admin, regular user)

3. **Shared Resources:**
   - If multiple documents share the same cover image, deleting one will delete the shared image
   - Consider implementing reference counting if this becomes an issue

4. **External URLs:**
   - The trigger only deletes files from Supabase storage
   - External URLs in `downloads` or `cover` fields are safely ignored

5. **Processing Logs:**
   - The `document_processing_logs` table has a foreign key to `user_documents`
   - Check if logs should be preserved or deleted (currently no cascade delete)

## Potential Side Effects

### ⚠️ Shared Cover Images
If multiple documents reference the same cover image URL, deleting one document will delete the shared image, breaking the other documents.

**Mitigation:** 
- Use unique cover images per document
- Or implement reference counting before deletion

### ⚠️ Deletion Latency
The trigger makes network calls to delete storage files, which adds latency to delete operations.

**Impact:** 
- Minimal for single document deletions
- Could be noticeable for bulk deletions

### ⚠️ Partial Failures
If storage deletion fails (network error, permission issue), the database record is still deleted.

**Behavior:** 
- The trigger logs errors via `RAISE NOTICE`
- Database deletion proceeds even if storage deletion fails
- Orphaned files may remain in storage

## Migrations Applied

1. `add_document_storage_cleanup_trigger.sql` - Initial implementation
2. `add_user_documents_storage_cleanup_trigger.sql` - User documents cleanup
3. `fix_storage_cleanup_functions_search_path.sql` - Security fix for search_path
4. `fix_document_storage_cleanup_path_matching.sql` - Fixed path matching for user-uploads
5. `cascade_delete_user_documents_keep_logs.sql` - Delete user_documents, preserve logs
6. `make_user_document_id_nullable_for_audit.sql` - Allow NULL for audit trail

## Related Files

- `/migrations/add_document_storage_cleanup_trigger.sql`
- `/migrations/add_user_documents_storage_cleanup_trigger.sql`
- `/migrations/fix_storage_cleanup_functions_search_path.sql`
- `/app-src/src/lib/supabase/admin.ts` - `deleteDocument()` function
- `/app-src/src/components/Admin/DocumentsTable.tsx` - UI for document deletion

## Future Enhancements

1. **Reference Counting:** Track how many documents use each storage file
2. **Batch Deletion:** Optimize for bulk deletions
3. **Deletion Queue:** Async deletion for better performance
4. **Audit Trail:** Log all storage deletions for compliance
5. **Rollback Support:** Soft delete with cleanup after retention period

