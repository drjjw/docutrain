# Realtime Auto-Refresh Fix

**Date**: November 1, 2025  
**Issue**: User documents table not auto-refreshing when processing completes

## Problem Description

When a document finished processing, the UI showed it as still "processing" until the user manually refreshed the page. The document would complete successfully in the backend, but the frontend wouldn't update automatically.

### Symptoms
- Document completes processing (visible in logs)
- UI still shows "Processing..." status
- Manual page refresh required to see "Ready" status
- This used to work automatically

## Root Cause

The `user_documents` table was **not enabled for Supabase Realtime**. 

The frontend code had two mechanisms for updates:
1. **Realtime subscription** - Should trigger instantly when database changes
2. **Polling** - Checks every 5 seconds while documents are "processing"

The realtime subscription wasn't working because the table wasn't added to the `supabase_realtime` publication. The polling would stop as soon as the status changed to "ready" (because it only polls while `status === 'processing'`), but if the UI hadn't fetched the final status yet, it would remain stuck showing "processing".

### Why Realtime Wasn't Working

```sql
-- Before fix: No tables in realtime publication
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
-- Result: Empty!

-- After fix: user_documents added
ALTER PUBLICATION supabase_realtime ADD TABLE user_documents;
```

## Solution

Enabled Supabase Realtime for the `user_documents` table by adding it to the realtime publication.

### Migration Applied

```sql
-- Enable realtime for user_documents table
ALTER PUBLICATION supabase_realtime ADD TABLE user_documents;
```

### How It Works Now

1. **Document processing completes** → Status updated to "ready" in database
2. **Supabase Realtime** → Broadcasts change event to subscribed clients
3. **Frontend receives event** → Console log: "📡 Realtime update received"
4. **UI auto-refreshes** → Document status updates to "Ready" instantly
5. **Polling as backup** → Still polls every 5s while processing (belt and suspenders)

## Files Modified

1. ✅ `/migrations/enable_realtime_user_documents.sql` - Migration to enable realtime
2. ✅ Applied directly to database via Supabase MCP

## Frontend Code (Already Correct)

The frontend subscription code was already correct in `UserDocumentsTable.tsx`:

```typescript
// Set up realtime subscription for document changes
const channel = supabase
  .channel('user_documents_changes')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'user_documents',
      filter: user ? `user_id=eq.${user.id}` : undefined,
    },
    (payload) => {
      console.log('📡 Realtime update received:', payload);
      loadDocuments(false).then(() => {
        if (onStatusChange) {
          onStatusChange();
        }
      });
    }
  )
  .subscribe();
```

The subscription was set up correctly, but it wasn't receiving events because the table wasn't in the publication.

## Testing

To verify the fix works:

1. **Upload a new document**
2. **Watch the UI** - Should show "Processing..." with progress
3. **Wait for completion** - Status should automatically change to "Ready" without manual refresh
4. **Check browser console** - Should see: `📡 Realtime update received: {...}`

### Expected Console Logs

```
🔄 Polling: Found processing documents, refreshing...
🔄 Polling: Found processing documents, refreshing...
📡 Realtime update received: { eventType: 'UPDATE', new: { status: 'ready', ... } }
```

## Dual Update Mechanisms

The system now has two ways to detect status changes:

### 1. Realtime Subscription (Primary)
- **Speed**: Instant (< 1 second)
- **Reliability**: High (when enabled)
- **Use case**: Normal operation

### 2. Polling (Fallback)
- **Speed**: Up to 5 seconds delay
- **Reliability**: Always works
- **Use case**: Backup if realtime fails

This redundancy ensures the UI always updates, even if one mechanism fails.

## Other Tables That Might Need Realtime

Consider enabling realtime for other tables if they need instant UI updates:

```sql
-- Documents table (for admin panel)
ALTER PUBLICATION supabase_realtime ADD TABLE documents;

-- Document chunks (if showing real-time chunk counts)
ALTER PUBLICATION supabase_realtime ADD TABLE document_chunks;
ALTER PUBLICATION supabase_realtime ADD TABLE document_chunks_local;

-- Processing logs (for real-time progress tracking)
ALTER PUBLICATION supabase_realtime ADD TABLE document_processing_logs;
```

**Note**: Only enable realtime for tables that actually need it. Each table adds overhead to the realtime system.

## RLS Considerations

✅ **RLS is properly configured** for realtime:
- The subscription includes `filter: user_id=eq.${user.id}`
- This ensures users only receive updates for their own documents
- RLS policies on `user_documents` are enforced
- No security concerns with enabling realtime

### Important: RLS and Realtime

When enabling realtime for a table with RLS:
1. ✅ Realtime respects RLS policies
2. ✅ Users only receive events for rows they can access
3. ✅ The `filter` parameter adds an additional client-side filter
4. ✅ Both server-side (RLS) and client-side (filter) protection are in place

## Performance Impact

- **Minimal**: Realtime uses WebSocket connections (efficient)
- **Scalability**: Supabase Realtime is designed for this use case
- **Database load**: No additional queries (uses PostgreSQL's logical replication)

## Troubleshooting

If realtime still doesn't work after this fix:

### 1. Check if realtime is enabled
```sql
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
```

### 2. Check browser console for subscription errors
```javascript
// Should see successful subscription
console.log('Subscribed to user_documents_changes');
```

### 3. Test with a simple update
```sql
-- Manually update a document to trigger realtime
UPDATE user_documents 
SET updated_at = NOW() 
WHERE id = '<your-document-id>';
```

### 4. Verify WebSocket connection
- Open browser DevTools → Network tab
- Filter by "WS" (WebSocket)
- Should see active connection to Supabase

## Related Issues

- **Polling still works**: Even if realtime fails, polling provides 5-second updates
- **Page refresh always works**: Manual refresh is always an option
- **No breaking changes**: This is purely an enhancement

## Future Improvements

1. **Add connection status indicator**: Show if realtime is connected
2. **Retry logic**: Auto-reconnect if WebSocket drops
3. **Optimistic updates**: Update UI immediately, then sync with server
4. **Progress streaming**: Stream processing logs in real-time (would need `document_processing_logs` in realtime)

---

**Summary**: Enabled Supabase Realtime for `user_documents` table. UI now auto-refreshes instantly when document processing completes. No code changes needed - just database configuration.

