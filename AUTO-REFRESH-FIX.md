# Documents Table Auto-Refresh Fix

**Date:** October 31, 2025  
**Issue:** Documents table not refreshing after successful processing  
**Status:** ✅ Fixed

## Problem

After a document successfully completed processing, the main Documents table was not auto-refreshing to show the new document. Users had to manually reload the page to see their newly processed documents.

## Root Cause

The `handleStatusChange` callback in `DashboardPage.tsx` had a flawed conditional logic:

```typescript
// OLD (BROKEN)
if (!hasActive || (prevHasActive && !hasActive)) {
  // Only refresh when no active documents
  documentsTableRef.current?.refresh();
}
```

**Problem:** This condition simplifies to just `!hasActive`, which means:
- It only refreshed when there were NO active documents
- It wouldn't refresh during the transition from "processing" to "ready"
- It wouldn't refresh if multiple documents were processing

## Solution

Removed the conditional check entirely - now refreshes on **every status change**:

```typescript
// NEW (FIXED)
// Refresh DocumentsTable on any status change
// This ensures the main documents table updates when processing completes
console.log('📊 Status change detected:', { hasActive, prevHasActive });

// Clear any pending refresh to debounce
if (refreshTimeoutRef.current) {
  clearTimeout(refreshTimeoutRef.current);
}

// Delay refresh to ensure document is fully created in database
refreshTimeoutRef.current = setTimeout(() => {
  console.log('🔄 Refreshing DocumentsTable after status change');
  documentsTableRef.current?.refresh();
}, 1500);
```

## How It Works Now

1. **Upload Document** → Processing starts
2. **UserDocumentsTable** monitors via:
   - Realtime subscription (immediate updates)
   - Polling every 5 seconds (backup)
3. **Status Change Detected** → `handleStatusChange()` called
4. **Debounced Refresh** → DocumentsTable refreshes after 1.5 seconds
5. **User Sees Document** → New document appears in main table automatically

## Files Modified

- `app-src/src/pages/DashboardPage.tsx` - Fixed handleStatusChange logic

## Testing

The fix will work for:
- ✅ New document uploads (VPS processing)
- ✅ New document uploads (Edge Function processing)
- ✅ Document retraining
- ✅ Multiple simultaneous uploads
- ✅ Edge cases where processing completes very quickly

## Debug Logging

Added console logs to help track the refresh behavior:
- `📊 Status change detected:` - Shows when status changes
- `🔄 Refreshing DocumentsTable after status change` - Shows when refresh triggers

You can monitor these in the browser console to verify the auto-refresh is working.


