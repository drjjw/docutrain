# Embedding API Timeout Fix

**Date**: November 1, 2025  
**Issue**: Document processing hanging indefinitely during embedding generation

## Problem Description

Documents were getting stuck during the embedding generation phase, specifically at "Processing batch 1/2". The process would hang for 10+ minutes without completing or throwing an error.

### Symptoms
- Processing log shows: `[embed:progress] Processing batch 1/2`
- No further progress for 10+ minutes
- Document status remains "processing" indefinitely
- No error messages logged
- Server continues running but the specific job is stuck

### Example Case
- Document: "Evidence-to-Action_Obesity-Management" (96 pages, 63 chunks)
- Stuck at: 11:52:02 on batch 1/2
- Still stuck 12+ minutes later with no progress

## Root Cause

The OpenAI SDK's timeout parameter wasn't reliably preventing API calls from hanging:

```javascript
// OLD CODE - SDK timeout alone wasn't sufficient
const response = await openaiClient.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
    encoding_format: 'float'
}, {
    timeout: 30000 // This timeout wasn't always honored
});
```

**Why the SDK timeout failed:**
1. Network-level hangs (TCP connection issues)
2. DNS resolution delays
3. Proxy/firewall issues
4. OpenAI API infrastructure problems
5. The SDK timeout might not cover all phases of the request lifecycle

## Solution

Added a **hard timeout wrapper** using `Promise.race()` to guarantee the operation fails after a maximum time:

```javascript
// NEW CODE - Hard timeout with Promise.race
const embeddingPromise = openaiClient.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
    encoding_format: 'float'
}, {
    timeout: 30000 // SDK timeout (first line of defense)
});

const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
        reject(new Error('Hard timeout: OpenAI embedding API call exceeded 45 seconds'));
    }, 45000); // 45 second hard timeout (guaranteed to fire)
});

const response = await Promise.race([embeddingPromise, timeoutPromise]);
```

### How It Works

1. **SDK Timeout (30s)**: First line of defense - OpenAI SDK tries to timeout
2. **Hard Timeout (45s)**: Guaranteed fallback - Promise.race ensures we never wait longer than 45s
3. **15s Buffer**: Gives SDK timeout time to work, but guarantees we fail if it doesn't

### Timeout Hierarchy

```
0s ────────────────── 30s ──────────── 45s ──────────────→
     API Call           SDK Timeout      Hard Timeout
                        (may not fire)   (ALWAYS fires)
```

## Files Modified

1. ✅ `/lib/document-processor.js` - Added hard timeout to `generateEmbedding()`
2. ✅ Built and ready to deploy

## Error Handling

When timeout occurs:
1. Promise.race rejects with timeout error
2. Error caught by retry logic in `retryWithBackoff()`
3. Retries up to 3 times with exponential backoff
4. If all retries fail, chunk gets `embedding: null`
5. Processing continues with remaining chunks
6. Document status updated to show partial success/failure

## Recovery for Stuck Documents

If a document is already stuck:

### Manual Recovery
1. Check document status:
```sql
SELECT id, title, status, error_message, updated_at
FROM user_documents 
WHERE status = 'processing'
AND updated_at < NOW() - INTERVAL '5 minutes';
```

2. Mark as failed:
```sql
UPDATE user_documents 
SET 
  status = 'error',
  error_message = 'Processing timeout: Embedding generation hung. Please retry upload.',
  updated_at = NOW()
WHERE id = '<stuck-document-id>';
```

3. User can then retry the upload

### Automatic Recovery (Future Enhancement)
Could add a background job that:
- Checks for documents stuck in "processing" for >10 minutes
- Automatically marks them as failed
- Sends notification to user

## Testing

To verify the fix:

1. **Normal Case**: Upload a document and verify it completes successfully
2. **Timeout Case**: If OpenAI API is slow/unresponsive, verify:
   - Timeout error is logged after 45 seconds
   - Retry logic kicks in
   - Document eventually fails gracefully (not stuck forever)
   - User sees clear error message

## Impact on Processing Time

- **Normal documents**: No change (timeout never reached)
- **Slow API responses**: May fail faster (good - prevents indefinite hangs)
- **Transient issues**: Retry logic handles temporary slowdowns

## Related Configuration

Environment variables that affect timeouts:
- `OPENAI_API_KEY` - Required for embeddings
- `MAX_CONCURRENT_PROCESSING` - Limits simultaneous processing jobs (default: 5)
- No specific timeout env var (hardcoded to 30s SDK + 45s hard timeout)

## Future Improvements

1. **Configurable timeouts**: Add env vars for timeout values
2. **Automatic stuck job recovery**: Background process to detect and recover stuck jobs
3. **Better progress tracking**: Real-time progress updates during batch processing
4. **Partial success handling**: Save successfully embedded chunks even if some fail
5. **Circuit breaker**: Temporarily pause processing if OpenAI API is consistently failing

## Monitoring

Watch for these patterns in logs:

**Normal:**
```
[embed:started] Generating embeddings
[embed:progress] Processing batch 1/2
[embed:progress] Processing batch 2/2  ← Should appear within ~20s
[embed:completed] Embeddings generated
```

**Timeout (now handled):**
```
[embed:started] Generating embeddings
[embed:progress] Processing batch 1/2
ERROR: Hard timeout: OpenAI embedding API call exceeded 45 seconds
[embed:failed] Processing timeout
```

**Stuck (old behavior - should not happen anymore):**
```
[embed:started] Generating embeddings
[embed:progress] Processing batch 1/2
... nothing for 10+ minutes ...
```

## RLS Considerations

✅ **No RLS impact** - This is a processing/timeout fix only:
- No database schema changes
- No permission changes
- No access control changes
- Only affects how API timeouts are handled



