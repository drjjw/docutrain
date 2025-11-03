# Stuck Document Recovery Feature

**Date:** November 1, 2025  
**Issue:** Documents stuck in "processing" status had no user-facing recovery options

## Problem

When a document processing job crashed or stalled (e.g., server restart, hung process, uncaught error), the document would remain stuck in "processing" status indefinitely with:

❌ **No retry button** - Only error status documents had retry  
❌ **No delete button** - Only error status documents had delete  
❌ **No way to recover** - User had to contact admin to manually reset via database

### Example Scenario

1. User uploads "Hyperparathyroidism Controversies.pdf"
2. Processing starts, downloads PDF successfully
3. Server crashes during text extraction
4. Document stuck in "processing" status forever
5. User sees spinning "Processing" badge but **no actions available**

## Solution

### 1. Frontend - Actions for All Non-Ready Documents

**Before:**
```typescript
// Only showed actions for error status
{doc.status === 'error' && (
  <>
    <Button onClick={handleRetryProcessing}>Retry</Button>
    <Button onClick={handleDelete}>Delete</Button>
  </>
)}
```

**After:**
```typescript
// Shows actions for ALL non-ready documents (pending, processing, error)
{doc.status !== 'ready' && (
  <>
    {(doc.status === 'error' || doc.status === 'pending' || doc.status === 'processing') && (
      <Button onClick={handleRetryProcessing}>
        {doc.status === 'processing' ? 'Force Retry' : 'Retry'}
      </Button>
    )}
    <Button onClick={handleDelete}>Delete</Button>
  </>
)}
```

### 2. Backend - Smart Force Retry Logic

Added automatic detection of stuck documents in `/api/process-document`:

```javascript
if (userDoc.status === 'processing') {
    // Check if document is stuck (>5 minutes since last update)
    const minutesSinceUpdate = (now - updatedAt) / 1000 / 60;
    
    if (minutesSinceUpdate > 5) {
        // Document is stuck - allow force retry by resetting to pending
        console.log(`⚠️  Document stuck for ${minutesSinceUpdate.toFixed(1)} minutes - allowing force retry`);
        
        await userSupabase
            .from('user_documents')
            .update({ 
                status: 'pending',
                error_message: `Processing stalled - reset by user after ${minutesSinceUpdate.toFixed(1)} minutes`
            })
            .eq('id', user_document_id);
        
        // Proceed with processing
    } else {
        // Document is actively processing (updated recently)
        return res.status(409).json({
            error: 'Document is currently being processed. Please wait or try again in a few minutes.'
        });
    }
}
```

## User Experience

### Before (Stuck Forever)

| Status | Actions Available |
|--------|------------------|
| `pending` | ❌ None |
| `processing` | ❌ None |
| `error` | ✅ Retry, Delete |
| `ready` | N/A (hidden from table) |

### After (Full Recovery Options)

| Status | Actions Available | Button Label |
|--------|------------------|--------------|
| `pending` | ✅ Retry, Delete | "Retry" |
| `processing` | ✅ Force Retry, Delete | "Force Retry" |
| `error` | ✅ Retry, Delete | "Retry" |
| `ready` | N/A (hidden from table) | N/A |

## How It Works

### Scenario 1: Document Stuck >5 Minutes

1. User sees document with "Processing" badge for 10 minutes
2. User clicks **"Force Retry"** button
3. Backend checks: `updated_at` was 10 minutes ago → **stuck!**
4. Backend resets status: `processing` → `pending`
5. Backend adds error message: "Processing stalled - reset by user after 10.0 minutes"
6. Backend proceeds with fresh processing attempt
7. Document processes successfully

### Scenario 2: Document Actively Processing

1. User sees document with "Processing" badge for 2 minutes
2. User clicks **"Force Retry"** button
3. Backend checks: `updated_at` was 2 minutes ago → **active!**
4. Backend returns 409 error: "Document is currently being processed. Please wait..."
5. User sees alert, waits for processing to complete

### Scenario 3: User Wants to Delete Stuck Document

1. User sees stuck document
2. User clicks **"Delete"** button
3. Confirms deletion
4. Document and all associated data deleted
5. User can re-upload if needed

## Benefits

1. ✅ **Self-Service Recovery** - Users can fix stuck documents themselves
2. ✅ **No Admin Intervention** - No need to manually reset via database
3. ✅ **Smart Detection** - Prevents interrupting active processing (5-minute threshold)
4. ✅ **Clear Feedback** - "Force Retry" label indicates it will reset stuck jobs
5. ✅ **Audit Trail** - Error message records when and why document was reset
6. ✅ **Delete Option** - Users can remove stuck documents and start over

## Technical Details

### Files Modified

**Frontend:**
- `app-src/src/components/Admin/UserDocumentsTable.tsx`
  - Updated desktop table actions (lines 358-388)
  - Updated mobile card actions (lines 430-458)
  - Changed condition from `doc.status === 'error'` to `doc.status !== 'ready'`
  - Added dynamic button label: "Force Retry" vs "Retry"

**Backend:**
- `lib/routes/processing.js`
  - Added stuck document detection logic (lines 204-238)
  - 5-minute threshold for considering document stuck
  - Automatic reset to pending status
  - Preserves audit trail with error message

### Safety Features

1. **5-Minute Threshold** - Prevents interrupting legitimate processing
2. **Recent Update Check** - Only resets if `updated_at` is stale
3. **User Ownership Verification** - Can only retry own documents
4. **Error Logging** - Records why document was reset
5. **409 Response** - Prevents force retry on active jobs

## Testing

### Test Case 1: Stuck Document Recovery
1. Manually set a document to "processing" in database
2. Set `updated_at` to 10 minutes ago
3. Refresh dashboard - see "Force Retry" button
4. Click "Force Retry"
5. Verify document resets to pending and reprocesses

### Test Case 2: Active Processing Protection
1. Upload a new document (starts processing)
2. Immediately try to click "Force Retry"
3. Should see: "Document is currently being processed. Please wait..."
4. Wait 5+ minutes, then retry should work

### Test Case 3: Delete Stuck Document
1. Find stuck document
2. Click "Delete" button
3. Confirm deletion
4. Verify document removed from database and storage

## Related Issues

- **500 Error Race Condition** - Fixed in separate commit
- **Concurrency Improvements** - Backend retry logic and adaptive delays
- **Automatic Retry Feature** - Frontend automatic retry on 503 errors

## Notes

- The 5-minute threshold is hardcoded but could be made configurable
- Consider adding a "Last Activity" timestamp for more accurate stuck detection
- Could add automatic stuck document detection/notification in the future
- The "Force Retry" button is intentionally labeled differently to indicate it will reset the job



