# Automatic Retry Feature for Document Processing

## Overview
Added automatic retry logic to handle server busy (503) errors during peak times. Users no longer need to manually retry when the server is at capacity - the system automatically retries with exponential backoff.

## Problem Solved

**Before:**
- User uploads document during peak time
- Server returns 503 (at capacity)
- Document stays in "pending" status forever
- User must manually click "Retry Processing" button
- If user closes browser, document never processes

**After:**
- User uploads document during peak time
- Server returns 503 (at capacity)
- System automatically retries: 30s → 60s → 120s → 240s
- User sees friendly message: "Server busy. Retrying in 30 seconds..."
- Processing starts automatically when server has capacity
- Works even if user keeps browser open

## Changes Made

### 1. ✅ Backend: Concurrency Limiter
**Location:** `lib/routes/processing.js`

- Limits concurrent processing to 5 jobs (configurable)
- Returns 503 with `retry_after` when at capacity
- Provides load information in response

```javascript
{
  "success": false,
  "error": "Server is currently processing the maximum number of documents...",
  "retry_after": 30,
  "load": {
    "active": 5,
    "max": 5,
    "available": 0,
    "utilizationPercent": 100
  }
}
```

### 2. ✅ Frontend: Automatic Retry Hook
**Location:** `app-src/src/hooks/useUpload.ts`

**New Features:**
- `retryProcessing()` function with exponential backoff
- Automatically retries on 503 errors (up to 4 attempts)
- Delays: 30s, 60s, 120s, 240s
- Respects server's `retry_after` header
- New state: `retryingProcessing`, `retryMessage`

**Retry Logic:**
```typescript
// Exponential backoff
const delay = Math.min(30000 * Math.pow(2, attempt - 1), 240000);

// Retry on 503
if (response.status === 503) {
  retryProcessing(documentId, attempt + 1);
}
```

### 3. ✅ UI: Retry Status Display
**Location:** `app-src/src/components/Upload/UploadZone.tsx`

Shows friendly message during automatic retry:

```
🔄 Server busy. Retrying in 30 seconds... (attempt 1/4)
```

### 4. ✅ Manual Retry Enhancement
**Location:** `app-src/src/components/Admin/UserDocumentsTable.tsx`

Manual "Retry Processing" button now also:
- Detects 503 errors
- Shows alert: "Server is busy... Will automatically retry in 30 seconds..."
- Retries once automatically after delay

## User Experience

### Scenario 1: Upload During Peak Time

**User Action:**
1. Upload PDF file
2. Click "Upload" button

**System Response:**
```
✅ Upload successful!
🔄 Server busy. Retrying in 30 seconds... (attempt 1/4)
⏳ [30 seconds pass]
🔄 Attempting to start processing... (attempt 1/4)
✅ Processing started!
```

**User sees:**
- Blue info alert with spinning icon
- Clear countdown message
- No manual action required

### Scenario 2: Manual Retry During Peak Time

**User Action:**
1. Click "Retry Processing" button on pending document

**System Response:**
```
Alert: "Server is busy processing other documents. 
        Will automatically retry in 30 seconds..."
⏳ [30 seconds pass]
✅ Processing started!
```

### Scenario 3: All Retries Exhausted

**After 4 failed attempts:**
```
⚠️ Server is busy. Please try again later.
```

User can still manually retry later.

## Configuration

### Backend (Environment Variables)

```bash
# Maximum concurrent processing jobs
MAX_CONCURRENT_PROCESSING=5  # Default: 5

# Adjust based on your OpenAI tier:
# Free Tier: 2
# Tier 1: 3
# Tier 2: 5
# Tier 3+: 10
```

### Frontend (Hardcoded)

```typescript
// In useUpload.ts
const maxAttempts = 4;  // Total retry attempts
const delays = [30s, 60s, 120s, 240s];  // Exponential backoff
```

## Benefits

1. **Better UX**: No manual intervention needed during peak times
2. **Higher Success Rate**: Documents eventually process instead of staying pending
3. **Clear Communication**: Users know what's happening and when
4. **Graceful Degradation**: Falls back to manual retry if all attempts fail
5. **Works Offline**: If user closes browser, they can manually retry later

## Testing

### Test Case 1: Automatic Retry Success

1. Set `MAX_CONCURRENT_PROCESSING=1` in .env
2. Upload first document (starts processing)
3. Upload second document (should get 503)
4. **Expected:** See retry message, wait 30s, processing starts
5. **Result:** ✅ Second document processes automatically

### Test Case 2: Multiple Retries

1. Set `MAX_CONCURRENT_PROCESSING=1`
2. Upload 3 documents quickly
3. **Expected:** 
   - First: Processes immediately
   - Second: Retries at 30s, succeeds
   - Third: Retries at 30s, 60s, succeeds
4. **Result:** ✅ All documents eventually process

### Test Case 3: Manual Retry

1. Set `MAX_CONCURRENT_PROCESSING=1`
2. Upload document during processing
3. Wait for it to stay "pending"
4. Click "Retry Processing"
5. **Expected:** Alert shows, auto-retries after 30s
6. **Result:** ✅ Processing starts automatically

## Monitoring

### Console Logs

**Upload with retry:**
```
⚠️  Server busy (503), starting automatic retry...
⏳ Waiting 30s before retry attempt 1/4
🔄 Attempting to start processing... (attempt 1/4)
✅ Processing started successfully on attempt 1
```

**Backend logs:**
```
⚠️  Processing limit reached (5/5)
   Rejecting new processing request for document abc123
```

### User Feedback

Users will see:
- **Info alert** with spinning icon during retry
- **Countdown timer** showing seconds until next attempt
- **Attempt number** (1/4, 2/4, etc.)
- **Success message** when processing starts
- **Error message** if all attempts fail

## Limitations

1. **Browser Must Stay Open**: Automatic retry only works while browser is open
   - If user closes browser, document stays pending
   - Solution: User can manually retry later

2. **Max 4 Attempts**: After 4 failed attempts, user must manually retry
   - Total wait time: 30s + 60s + 120s + 240s = 7.5 minutes
   - This prevents infinite retry loops

3. **No Queue System**: Documents aren't queued, just retried
   - Future enhancement: Implement proper queue with "queued" status

## Future Enhancements

1. **Persistent Retry**: Store retry state in database
   - Documents auto-retry even after browser close
   - Requires background job system

2. **Queue System**: Add "queued" status
   - Documents wait in queue instead of retrying
   - Process queue when slots open

3. **Priority Queue**: Admin uploads get priority
   - Regular users wait longer during peak times

4. **Email Notifications**: Notify user when processing starts
   - Useful for long retry delays

## Rollback

If issues occur:

1. Revert frontend changes:
   ```bash
   git revert HEAD
   npm run build
   ```

2. Backend concurrency limiter stays (it's beneficial)
3. Users fall back to manual retry (original behavior)

## Summary

✅ **Automatic retry with exponential backoff**
✅ **Clear user feedback during retry**  
✅ **Works for both upload and manual retry**
✅ **Graceful fallback to manual retry**
✅ **Zero breaking changes**

**Result:** Users experience smooth uploads even during peak times, with minimal manual intervention required.



