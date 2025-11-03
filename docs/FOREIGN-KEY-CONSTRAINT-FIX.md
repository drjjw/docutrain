# Foreign Key Constraint Bug Fix

**Date:** November 1, 2025  
**Severity:** 🔴 **CRITICAL** - Broke all document processing  
**Issue:** Documents failing with foreign key constraint violation

## Problem

All document processing was failing at the final step with this error:

```
Failed to insert batch: insert or update on table "document_chunks" 
violates foreign key constraint "document_chunks_document_slug_fkey"
```

### Root Cause

The `processUserDocument` function was trying to store chunks **BEFORE** creating the document record in the `documents` table:

**Incorrect Order:**
1. ✅ Extract text from PDF
2. ✅ Generate chunks
3. ✅ Generate abstract & keywords
4. ✅ Generate embeddings
5. ❌ **Store chunks** (tries to insert into `document_chunks`)
6. ❌ **Create document record** (too late!)

The `document_chunks` table has a foreign key constraint:
```sql
FOREIGN KEY (document_slug) REFERENCES documents(slug)
```

Since the document didn't exist yet in step 5, the foreign key constraint failed.

### How This Happened

Looking at the code comments and git history, this appears to be an intentional design decision that went wrong:

```javascript
// Comment at line 639:
// 6. Generate document slug (but don't create record yet - wait until processing is complete)

// Comment at line 688:
// 9. Create document record NOW (after all processing is complete)
```

The intention was to create the document record **after** all processing was complete to ensure data integrity. However, the chunks need to be stored **before** marking processing as complete, creating a chicken-and-egg problem.

## Solution

Reordered the operations to create the document record **BEFORE** storing chunks:

**Correct Order:**
1. ✅ Extract text from PDF
2. ✅ Generate chunks
3. ✅ Generate abstract & keywords
4. ✅ Generate embeddings
5. ✅ **Create document record** (document now exists in DB)
6. ✅ **Store chunks** (foreign key constraint satisfied)
7. ✅ Mark user_document as 'ready'

### Code Changes

**File:** `lib/document-processor.js`

**Before (lines 673-689):**
```javascript
await logger.completed(supabase, userDocId, documentSlug, logger.STAGES.EMBED, 'Embeddings generated', {
    total: chunks.length,
    successful: successfulEmbeddings,
    failed: chunks.length - successfulEmbeddings
});

// 8. Store chunks in database
await logger.started(supabase, userDocId, logger.STAGES.STORE, 'Storing chunks in database');

const inserted = await storeChunks(supabase, documentSlug, userDoc.title, allEmbeddings);

await logger.completed(supabase, userDocId, documentSlug, logger.STAGES.STORE, 'Chunks stored successfully', {
    chunks_stored: inserted
});

// 9. Create document record NOW (after all processing is complete)
await logger.started(supabase, userDocId, logger.STAGES.COMPLETE, 'Creating document record');
```

**After (lines 673-680):**
```javascript
await logger.completed(supabase, userDocId, documentSlug, logger.STAGES.EMBED, 'Embeddings generated', {
    total: chunks.length,
    successful: successfulEmbeddings,
    failed: chunks.length - successfulEmbeddings
});

// 8. Create document record FIRST (before storing chunks that reference it)
await logger.started(supabase, userDocId, logger.STAGES.COMPLETE, 'Creating document record');

// ... document creation code ...

// 9. Store chunks in database (AFTER document record exists)
await logger.started(supabase, userDocId, logger.STAGES.STORE, 'Storing chunks in database');

const inserted = await storeChunks(supabase, documentSlug, userDoc.title, allEmbeddings);

await logger.completed(supabase, userDocId, documentSlug, logger.STAGES.STORE, 'Chunks stored successfully', {
    chunks_stored: inserted
});
```

## Impact

### Before Fix
- ❌ **100% failure rate** for all new document uploads
- ❌ Documents stuck in "processing" status
- ❌ Embeddings generated but wasted (couldn't be stored)
- ❌ OpenAI API calls made but results discarded
- ❌ Poor user experience - no clear error message

### After Fix
- ✅ Documents process successfully
- ✅ Chunks stored correctly with valid foreign key references
- ✅ No wasted API calls or processing
- ✅ Clean data integrity maintained

## Testing

### Test Case 1: New Document Upload
1. Upload a new PDF document
2. Wait for processing to complete
3. Verify document status changes to "ready"
4. Verify chunks are stored in `document_chunks` table
5. Verify document record exists in `documents` table

### Test Case 2: Stuck Document Retry
1. Find document stuck in "error" status with foreign key error
2. Click "Retry" button
3. Verify document processes successfully
4. Verify chunks and document record are created

### Test Case 3: Database Integrity
```sql
-- Verify all chunks have valid document references
SELECT dc.document_slug, d.slug
FROM document_chunks dc
LEFT JOIN documents d ON dc.document_slug = d.slug
WHERE d.slug IS NULL;
-- Should return 0 rows
```

## Related Issues

This bug was discovered while investigating why "Hyperparathyroidism Controversies" document was stuck in processing:

1. **Initial Issue:** Document stuck in "processing" status (server crash)
2. **Manual Reset:** Reset document to "pending" via database
3. **Retry Attempt:** User clicked retry button
4. **Foreign Key Error:** Processing failed at chunk storage step
5. **Root Cause Found:** Document record created too late
6. **Fix Applied:** Reordered operations

## Prevention

### Why This Wasn't Caught Earlier

1. **Recent Change:** This may have been introduced in a recent refactoring
2. **No Test Coverage:** No automated tests for the full processing pipeline
3. **Development vs Production:** May have worked in dev with different data state

### Recommendations

1. ✅ **Add Integration Tests** - Test full document processing pipeline
2. ✅ **Database Constraints** - Keep foreign key constraints (they caught this bug!)
3. ✅ **Better Error Messages** - Surface constraint violations to users
4. ✅ **Rollback on Error** - Clean up partial data on processing failure
5. ✅ **Staging Environment** - Test changes before production deployment

## Database Schema Reference

**documents table:**
```sql
CREATE TABLE documents (
    id UUID PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    -- ... other fields
);
```

**document_chunks table:**
```sql
CREATE TABLE document_chunks (
    id BIGSERIAL PRIMARY KEY,
    document_slug TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    -- ... other fields
    FOREIGN KEY (document_slug) REFERENCES documents(slug) ON DELETE CASCADE
);
```

The `ON DELETE CASCADE` means if we delete a document, all its chunks are automatically deleted - but we need the document to exist **first** before inserting chunks!

## Notes

- The `reprocessDocument` function was NOT affected (it already has the document record)
- Only `processUserDocument` (new uploads) was broken
- The fix maintains the same data integrity guarantees
- No data migration needed - just code fix
- Existing failed documents can be retried successfully now

## Lessons Learned

1. **Foreign keys are your friend** - They prevent data corruption
2. **Order matters** - Always create parent records before children
3. **Test the unhappy path** - Constraint violations should be tested
4. **Comments can lie** - Code comments said "after processing complete" but chunks needed document first
5. **Monitoring is critical** - This would have been caught immediately with proper error tracking


