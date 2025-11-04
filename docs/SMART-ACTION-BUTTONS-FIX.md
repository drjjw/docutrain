# Smart Action Buttons Fix

**Date:** November 1, 2025  
**Issue:** Action buttons showing inappropriately during active processing

## Problems Identified

### Problem 1: "Force Retry" Showing Too Early

**Before:** The "Force Retry" button appeared immediately when a document entered "processing" status, even if it just started 5 seconds ago.

**User Confusion:** 
- User uploads document
- Processing starts (status: "processing")
- Immediately sees "Force Retry" button
- Thinks something is wrong when processing is actually working fine

### Problem 2: Delete Button Ambiguity

**Before:** Delete button was available during active processing with no warning about consequences.

**Issue:** Clicking delete removes the database record, but the background processing job continues running and will likely fail when it tries to update the status.

## Solution

### 1. Smart "Force Retry" Button Logic

**New Behavior:**
- ✅ Show "Retry" for `error` status (always)
- ✅ Show "Retry" for `pending` status (always)
- ✅ Show "Force Retry" for `processing` status **ONLY if stuck >5 minutes**
- ❌ Hide retry button for `processing` status if <5 minutes (actively processing)

**Implementation:**
```typescript
// Helper function to check if document is stuck
const isDocumentStuck = (doc: UserDocument): boolean => {
  if (doc.status !== 'processing') return false;
  const updatedAt = new Date(doc.updated_at);
  const now = new Date();
  const minutesSinceUpdate = (now.getTime() - updatedAt.getTime()) / 1000 / 60;
  return minutesSinceUpdate > 5;
};

// Only show retry button if error, pending, or stuck processing
{(doc.status === 'error' || 
  doc.status === 'pending' || 
  (doc.status === 'processing' && isDocumentStuck(doc))) && (
  <Button onClick={handleRetryProcessing}>
    {isDocumentStuck(doc) ? 'Force Retry' : 'Retry'}
  </Button>
)}
```

### 2. Delete Button Warning

**New Behavior:**
- ✅ Always show delete button for non-ready documents
- ⚠️ Add warning tooltip for active processing documents
- ℹ️ Normal tooltip for stuck/error/pending documents

**Implementation:**
```typescript
<Button
  variant="danger"
  onClick={handleDelete}
  title={doc.status === 'processing' && !isDocumentStuck(doc) 
    ? 'Delete (warning: processing will continue in background)' 
    : 'Delete this document'}
>
  Delete
</Button>
```

## User Experience Comparison

### Scenario 1: Fresh Upload (Processing for 30 seconds)

**Before:**
| Status | Actions Available |
|--------|------------------|
| `processing` | ❌ Force Retry, Delete |

User sees "Force Retry" and thinks something is wrong.

**After:**
| Status | Actions Available |
|--------|------------------|
| `processing` | ✅ Delete only (with warning) |

User sees processing badge with spinner, no retry button. Clean UX.

### Scenario 2: Stuck Document (Processing for 10 minutes)

**Before:**
| Status | Actions Available |
|--------|------------------|
| `processing` | ✅ Force Retry, Delete |

Same as fresh upload - no distinction.

**After:**
| Status | Actions Available |
|--------|------------------|
| `processing` | ✅ Force Retry, Delete |

"Force Retry" appears after 5 minutes, signaling something is wrong.

### Scenario 3: Error Status

**Before & After (No Change):**
| Status | Actions Available |
|--------|------------------|
| `error` | ✅ Retry, Delete |

Always shows retry button for errors.

## Visual Timeline

```
Upload → Processing Starts
  ↓
0-5 minutes: [Processing ⟳] [Delete]
  ↓ (if stuck)
5+ minutes: [Processing ⟳] [Force Retry] [Delete]
  ↓ (if completes)
Complete: (hidden from table)
  ↓ (if errors)
Error: [Error ✕] [Retry] [Delete]
```

## Benefits

### 1. Clearer User Intent
- ✅ No confusing "Force Retry" during normal processing
- ✅ "Force Retry" only appears when actually needed
- ✅ User knows something is wrong when they see "Force Retry"

### 2. Prevents Premature Intervention
- ✅ Users won't interrupt processing that's working fine
- ✅ Reduces unnecessary API calls
- ✅ Reduces server load from premature retries

### 3. Better Communication
- ✅ Delete button tooltip warns about background processing
- ✅ "Force Retry" tooltip explains it's for stuck documents (>5 min)
- ✅ Clear distinction between normal retry and force retry

### 4. Matches Backend Logic
- ✅ Frontend 5-minute threshold matches backend's stuck detection
- ✅ Consistent behavior across frontend and backend
- ✅ Backend will accept force retry after 5 minutes

## Technical Details

### Files Modified
- `app-src/src/components/Admin/UserDocumentsTable.tsx`
  - Added `isDocumentStuck()` helper function (lines 20-27)
  - Updated desktop table actions (lines 383-415)
  - Updated mobile card actions (lines 457-490)

### Key Logic

**Stuck Detection:**
```typescript
const minutesSinceUpdate = (now.getTime() - updatedAt.getTime()) / 1000 / 60;
return minutesSinceUpdate > 5;
```

**Retry Button Condition:**
```typescript
(doc.status === 'error' || 
 doc.status === 'pending' || 
 (doc.status === 'processing' && isDocumentStuck(doc)))
```

**Delete Button Tooltip:**
```typescript
title={doc.status === 'processing' && !isDocumentStuck(doc) 
  ? 'Delete (warning: processing will continue in background)' 
  : 'Delete this document'}
```

## Testing

### Test Case 1: Fresh Upload
1. Upload a new document
2. Verify status shows "Processing" with spinner
3. Verify **no retry button** appears
4. Verify **only delete button** shows (with warning tooltip)
5. Wait for processing to complete
6. Verify document moves to "ready" and disappears from table

### Test Case 2: Stuck Document
1. Find or create a document stuck in processing >5 minutes
2. Verify "Force Retry" button appears
3. Verify tooltip says "Force retry (document stuck for >5 minutes)"
4. Click "Force Retry"
5. Verify backend accepts the retry (resets to pending)

### Test Case 3: Delete During Processing
1. Upload a document
2. Immediately try to hover over delete button
3. Verify tooltip warns: "Delete (warning: processing will continue in background)"
4. Optionally test deletion to verify warning is accurate

### Test Case 4: Error Status
1. Find a document with error status
2. Verify "Retry" button shows (not "Force Retry")
3. Verify delete button shows with normal tooltip

## Edge Cases Handled

1. **Clock Skew:** Uses client-side time calculation, so server/client time differences don't affect the 5-minute threshold
2. **Rapid Polling:** `updated_at` is checked on every render, so button appears/disappears dynamically
3. **Multiple Documents:** Each document independently checks its own stuck status
4. **Mobile vs Desktop:** Both views use the same `isDocumentStuck()` logic

## Future Improvements

1. **Visual Indicator:** Add a "stuck" badge or warning icon after 5 minutes
2. **Configurable Threshold:** Make 5-minute threshold configurable via settings
3. **Auto-Retry:** Automatically trigger retry after X minutes of being stuck
4. **Cancel Processing:** Add a proper "Cancel" button that actually stops the background job
5. **Progress Indicator:** Show processing progress (e.g., "Extracting text... 50%")

## Related Work

This fix complements:
- **Stuck Document Recovery** - Backend logic to detect and reset stuck documents
- **Optimistic UI Update** - Immediate status change on retry click
- **Foreign Key Constraint Fix** - Ensures processing completes successfully

## Notes

- The 5-minute threshold is intentionally conservative to avoid false positives
- Most documents process in 10-60 seconds, so 5 minutes is a safe buffer
- The delete button warning is informational only - it doesn't prevent deletion
- Consider adding a confirmation dialog for deleting processing documents in the future




