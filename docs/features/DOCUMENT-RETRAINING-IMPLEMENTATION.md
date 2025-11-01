# Document Retraining Feature - Implementation Summary

**Date:** October 31, 2025  
**Status:** ✅ Implemented

## Overview

Added comprehensive document retraining functionality that allows users to upload a new PDF to replace existing document content while preserving the document's slug, metadata, and database record.

## Features Implemented

### 1. Backend API Endpoint

**File:** `lib/routes/processing.js`

- Added `POST /api/retrain-document` endpoint with multer file upload middleware
- Accepts `document_id`, `file` (PDF), and `use_edge_function` parameters
- Validates user permissions (owner or admin)
- Handles both user-uploaded documents (with storage) and legacy documents (chunks only)
- Deletes existing chunks before reprocessing
- Replaces PDF in storage or creates new user_documents record if needed
- Supports both Edge Function and VPS processing modes
- Returns immediately with processing status (async processing)

**Key Features:**
- Permission checks via `user_roles` table
- Preserves document slug throughout retraining
- Updates `user_documents` status to 'processing'
- Handles legacy documents without storage by creating new records
- Automatic fallback to VPS for slug preservation

### 2. Document Reprocessing Function

**File:** `lib/document-processor.js`

- Added `reprocessDocument()` function
- Similar to `processUserDocument()` but updates existing document instead of creating new one
- Preserves document slug, title, and all metadata
- Updates only: `intro_message` (with new abstract), `metadata.keywords`, `updated_at`
- Generates new AI abstract and keywords from new content
- Deletes and recreates all chunks with new embeddings
- Maintains full processing pipeline with logging

**Processing Pipeline:**
1. Download PDF from storage
2. Extract text with page markers
3. Chunk text (500 tokens, 100 overlap)
4. Generate AI abstract and keywords
5. Update existing document record
6. Generate OpenAI embeddings (batches of 50)
7. Store new chunks in database
8. Update user_documents status to 'ready'

### 3. Frontend API Functions

**File:** `app-src/src/lib/supabase/admin.ts`

Added two new functions:

**`retrainDocument(documentId, file, useEdgeFunction)`**
- Uploads PDF via FormData
- Triggers retraining via `/api/retrain-document`
- Returns `user_document_id` for status polling
- Clears localStorage cache

**`getRetrainingStatus(userDocumentId)`**
- Polls `/api/processing-status/:id` endpoint
- Returns document status and processing logs
- Used for real-time progress tracking

### 4. DocumentRetrainer Component

**File:** `app-src/src/components/Admin/DocumentRetrainer.tsx`

Reusable React component with:
- File upload dropzone (PDF only, 50MB limit)
- Real-time progress tracking with status polling
- Visual progress bar with stage-based updates
- Success/error alerts
- Callbacks: `onRetrainStart`, `onRetrainSuccess`, `onRetrainError`
- Amber/orange color scheme to differentiate from regular uploads

**Progress Tracking:**
- Polls processing status every 2 seconds
- Updates progress based on completed stages
- Shows current processing stage message
- Completes at 100% when status is 'ready'

### 5. DocumentEditorModal Integration

**File:** `app-src/src/components/Admin/DocumentEditorModal.tsx`

Added collapsible "Retrain Document" section:
- Appears after Document Overview section
- Only shown if document has a slug
- Collapsible with expand/collapse animation
- Warning message about chunk replacement
- Lists preserved elements (slug, metadata, settings)
- Disables "Save Changes" button during retraining
- Auto-closes section on successful retraining
- Refreshes document list after completion

**UI Features:**
- Amber/orange gradient styling for warnings
- Clear information about what will be replaced
- Shows document slug that will be preserved
- Integrated error handling

## Technical Details

### Dependencies Added

**`package.json`:**
- Added `multer@^1.4.5-lts.1` for file uploads

### File Upload Configuration

```javascript
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed'));
        }
    }
});
```

### Permission Model

Users can retrain a document if:
1. They are the document owner (via `metadata.user_id`)
2. They have admin or superadmin role (via `user_roles` table)

### Storage Handling

**For documents with existing storage:**
- Replaces PDF at same path using `storage.update()`
- Updates `user_documents` record with new file size
- Preserves file path for consistency

**For legacy documents (no storage):**
- Creates new `user_documents` record
- Uploads PDF to `user-documents` bucket
- Updates document metadata with `user_document_id`
- Sets `pdf_subdirectory` to 'user-uploads'

### Processing Method

**VPS Processing (Default for Retraining):**
- Uses `reprocessDocument()` function
- Preserves document slug
- Updates existing document record
- Recommended for all retraining operations

**Edge Function:**
- Not currently used for retraining
- Would create new slug (not desired)
- Automatic fallback to VPS implemented

## Database Changes

### Documents Table Updates

When retraining:
- `intro_message` - Updated with new AI-generated abstract
- `updated_at` - Set to current timestamp
- `metadata.has_ai_abstract` - Updated based on new content
- `metadata.keywords` - Updated with new keywords
- `metadata.reprocessed_at` - Added timestamp of retraining
- `metadata.retraining` - Set to true during processing

### User Documents Table

- Status transitions: `pending` → `processing` → `ready` (or `error`)
- `file_size` updated with new PDF size
- `updated_at` timestamp refreshed
- `error_message` cleared on new attempt

### Document Chunks

- All existing chunks deleted before reprocessing
- New chunks created with fresh embeddings
- Maintains same `document_slug` for continuity

## API Endpoints

### POST /api/retrain-document

**Request:**
```
Content-Type: multipart/form-data
Authorization: Bearer <token>

Fields:
- file: PDF file (required)
- document_id: UUID (required)
- use_edge_function: boolean (optional, default false)
```

**Response:**
```json
{
  "success": true,
  "message": "Document retraining started",
  "document_id": "uuid",
  "user_document_id": "uuid",
  "status": "processing",
  "method": "vps"
}
```

### GET /api/processing-status/:user_document_id

**Request:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "document": {
    "id": "uuid",
    "title": "Document Title",
    "status": "processing|ready|error",
    "error_message": "...",
    "created_at": "...",
    "updated_at": "..."
  },
  "logs": [...]
}
```

## Usage Instructions

### For Users

1. Navigate to Dashboard (`/app/dashboard`)
2. Click "Edit" on any document
3. Expand the "Retrain Document" section
4. Upload a new PDF file
5. Click "Start Retraining"
6. Monitor progress in real-time
7. Document will be available with new content once complete

### For Developers

**Trigger Retraining Programmatically:**
```typescript
import { retrainDocument } from '@/lib/supabase/admin';

const file = // File object
const result = await retrainDocument(documentId, file, false);
console.log('User document ID:', result.user_document_id);
```

**Poll Status:**
```typescript
import { getRetrainingStatus } from '@/lib/supabase/admin';

const status = await getRetrainingStatus(userDocumentId);
console.log('Status:', status.document.status);
console.log('Logs:', status.logs);
```

## Edge Cases Handled

1. **Legacy Documents (No Storage)**
   - Creates new `user_documents` record
   - Uploads PDF to storage
   - Links to existing document

2. **Processing Failures**
   - Sets status to 'error'
   - Preserves error message
   - Allows retry with new PDF

3. **Concurrent Operations**
   - Disables save button during retraining
   - Prevents conflicting updates

4. **Large Files**
   - 50MB upload limit
   - Automatic VPS processing
   - Progress tracking for long operations

5. **Permission Checks**
   - Validates ownership or admin status
   - Returns 403 if unauthorized
   - Checks user_roles table

## Testing Checklist

Before deploying, test the following scenarios:

- [ ] Retrain a user-uploaded document (with storage)
- [ ] Retrain a legacy document (no storage, chunks only)
- [ ] Verify slug preservation after retraining
- [ ] Check that metadata is preserved
- [ ] Confirm old chunks are deleted
- [ ] Verify new chunks are created
- [ ] Test permission checks (owner vs non-owner)
- [ ] Test admin override permissions
- [ ] Verify progress tracking updates correctly
- [ ] Test error handling (invalid file, network errors)
- [ ] Confirm UI disables save during retraining
- [ ] Verify document list refreshes after completion

## Installation Steps

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Verify multer is installed:**
   ```bash
   npm list multer
   ```

3. **Build React App:**
   ```bash
   npm run build:app
   ```

4. **Restart Server:**
   ```bash
   npm run dev
   ```

## Files Modified

### Backend
- `lib/routes/processing.js` - New endpoint and multer config
- `lib/document-processor.js` - New reprocessDocument function
- `package.json` - Added multer dependency

### Frontend
- `app-src/src/lib/supabase/admin.ts` - API functions
- `app-src/src/components/Admin/DocumentRetrainer.tsx` - New component
- `app-src/src/components/Admin/DocumentEditorModal.tsx` - Integration

## Performance Considerations

- **Async Processing:** Retraining happens asynchronously, API returns immediately
- **Status Polling:** Frontend polls every 2 seconds (minimal server load)
- **Batch Processing:** Embeddings generated in batches of 50
- **Memory Efficient:** Uses multer memory storage for temporary file handling
- **Chunk Deletion:** Old chunks deleted before new ones created (prevents duplicates)

## Security Considerations

- **Authentication Required:** All endpoints require valid JWT token
- **Permission Checks:** Validates ownership or admin status
- **File Type Validation:** Only PDF files accepted
- **File Size Limits:** 50MB maximum upload size
- **RLS Policies:** Respects Supabase Row Level Security
- **Storage Access:** Uses authenticated Supabase client

## Future Enhancements

Potential improvements for future iterations:

1. **Batch Retraining:** Retrain multiple documents at once
2. **Scheduled Retraining:** Auto-retrain on schedule
3. **Version History:** Keep previous versions of chunks
4. **Rollback Feature:** Revert to previous version if needed
5. **Diff View:** Show changes between old and new content
6. **Email Notifications:** Notify when retraining completes
7. **Edge Function Support:** Update Edge Function to support slug preservation

## Troubleshooting

### Common Issues

**Issue:** "Only PDF files are allowed"
- **Solution:** Ensure file has `.pdf` extension and correct MIME type

**Issue:** "Document not found or access denied"
- **Solution:** Verify user owns document or has admin role

**Issue:** "Failed to upload new PDF"
- **Solution:** Check Supabase storage permissions and bucket configuration

**Issue:** Processing stuck at "processing" status
- **Solution:** Check server logs for errors, verify OpenAI API key is valid

**Issue:** Chunks not deleted
- **Solution:** Verify RLS policies allow deletion for authenticated users

## Conclusion

The document retraining feature is fully implemented and ready for testing. It provides a seamless way to update document content while preserving all metadata, slugs, and settings. The feature supports both user-uploaded and legacy documents, with comprehensive error handling and real-time progress tracking.


