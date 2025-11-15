# Temporary PDF Storage for Fair Use Compliance

**Date:** January 2025  
**Status:** ✅ Implemented

## Overview

PDFs are now stored temporarily during processing only, then automatically deleted after successful processing. This strengthens the fair use argument by demonstrating that PDFs are only stored for the purpose of processing, not for indefinite reproduction or distribution.

## Implementation

### What Gets Deleted

- **PDF files** uploaded by users (after successful processing)
- **Audio files** uploaded by users (after successful processing)
- **NOT deleted:** Text uploads (no file to delete)
- **NOT deleted:** Processed chunks (necessary for the service)

### When Deletion Happens

1. **After chunks are successfully stored** in the database
2. **Before** status is set to 'ready'
3. **Only** if processing completed successfully
4. **Non-critical:** If deletion fails, processing still succeeds (logged as warning)

### Implementation Locations

1. **Edge Function** (`supabase/functions/process-document/index.ts`)
   - Deletes PDFs after successful chunk storage
   - Logs deletion status to processing logs

2. **VPS Processor** (`lib/document-processor.js`)
   - Same deletion logic for VPS-based processing
   - Consistent behavior across processing methods

3. **Download Endpoint** (`lib/handlers/document-query-handlers.js`)
   - Gracefully handles deleted PDFs
   - Returns informative error message explaining temporary storage

## Fair Use Benefits

### Before (Indefinite Storage)
- ❌ PDFs stored indefinitely
- ❌ Could be downloaded anytime
- ❌ Weaker fair use argument (permanent reproduction)

### After (Temporary Storage)
- ✅ PDFs stored only during processing
- ✅ Deleted after successful processing
- ✅ Stronger fair use argument (temporary storage for transformative use)
- ✅ Similar to AI training: process once, extract what you need, delete original

## User Impact

### What Users Can Still Do
- ✅ Chat with documents (uses chunks, not PDFs)
- ✅ Generate quizzes (uses chunks, not PDFs)
- ✅ All AI features work normally

### What Changed
- ❌ PDFs cannot be downloaded after processing
- ❌ Reprocessing requires re-upload (if PDF was deleted)
- ✅ Users should keep their own copies of PDFs

### Error Handling

If a user tries to download a deleted PDF:
```json
{
  "success": false,
  "error": "PDF file no longer available",
  "message": "PDFs are stored temporarily during processing only. The original file has been deleted after successful processing to comply with fair use principles. Only the processed chunks (used for AI responses) are retained.",
  "deleted_after_processing": true
}
```

## Technical Details

### Deletion Logic

```typescript
// Only delete if:
// 1. Not a text upload
// 2. File path exists
// 3. File path is not a placeholder ('text-upload', 'text-retrain')

if (!isTextUpload && userDoc.file_path && 
    userDoc.file_path !== 'text-upload' && 
    userDoc.file_path !== 'text-retrain') {
  // Delete PDF from storage
  await supabase.storage
    .from('user-documents')
    .remove([userDoc.file_path]);
}
```

### Processing Flow

1. Upload PDF → Store in `user-documents` bucket
2. Download PDF → Extract text → Create chunks
3. Generate embeddings → Store chunks in database
4. **Delete PDF** ← New step
5. Mark document as 'ready'

## Legal Rationale

This change strengthens the fair use argument by:

1. **Temporary Storage**: PDFs are only stored during processing, not indefinitely
2. **Transformative Use**: Only processed chunks (for AI responses) are retained
3. **No Distribution**: Original PDFs are not available for download after processing
4. **Similar to AI Training**: Process content once, extract what you need, delete original

## Migration Notes

- **Existing PDFs**: Already processed PDFs remain in storage (grandfathered)
- **New Uploads**: All new PDFs will be deleted after processing
- **Reprocessing**: Users will need to re-upload if PDF was deleted

## Future Considerations

- Could add a grace period (e.g., 24 hours) before deletion
- Could allow users to opt-in to keep PDFs (with clear copyright warnings)
- Could add a "reprocess" feature that requires re-upload

## Related Documentation

- [User Document Processing](./user-document-processing.md)
- [Copyright Disclaimer Modal](../../app-src/src/components/Admin/CopyrightDisclaimerModal.tsx)
- [Terms of Service](../../app-src/src/components/Auth/TermsOfServiceModal.tsx)



