# OpenAI API Timeout Fix

**Date:** October 31, 2025  
**Issue:** Documents getting stuck in "Processing" forever  
**Status:** ✅ Fixed

## Problem

Your Hyperparathyroidism Controversies document got stuck at "Generating AI abstract and keywords" for 4+ minutes. The processing never completed or failed - it just hung indefinitely.

**Root Cause:** OpenAI API calls had no timeout configured, so if OpenAI's API was slow or unresponsive, the process would wait forever.

## Solution

Added **30-second timeouts** to all OpenAI API calls in `lib/document-processor.js`:

### 1. Abstract Generation (line 256)
```javascript
const response = await openaiClient.chat.completions.create({
    model: 'gpt-4o-mini',
    // ... other params ...
    timeout: 30000 // 30 second timeout
});
```

### 2. Keyword Generation (line 308)
```javascript
const response = await openaiClient.chat.completions.create({
    model: 'gpt-4o-mini',
    // ... other params ...
    timeout: 30000 // 30 second timeout
});
```

### 3. Embedding Generation (line 199)
```javascript
const response = await openaiClient.embeddings.create({
    model: 'text-embedding-3-small',
    // ... other params ...
    timeout: 30000 // 30 second timeout
});
```

### 4. Enhanced Error Handling
```javascript
// Detect timeout errors
if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
    console.error(`⚠️  OpenAI API timeout after 30 seconds`);
    throw new Error(`OpenAI API timeout - request took too long`);
}
```

## What Happens Now

- **Before:** Document hangs forever if OpenAI is slow
- **After:** Document fails gracefully after 30 seconds with clear error message
- **User Experience:** Users see error status and can retry instead of waiting indefinitely

## Your Stuck Document

**Fixed:** Document ID `fbc5c9f5-ff6f-4934-9868-8476a0be04dd` has been reset to error state.

**Next Steps:**
1. ✅ Server restarted with new timeout code
2. ✅ Stuck document marked as error
3. 🔄 **Delete the stuck document and re-upload it**
4. ✅ New upload will use the timeout-protected code

## Testing

The fix is live. When you re-upload Hyperparathyroidism Controversies:
- It will process normally (should take 15-20 seconds)
- If OpenAI is slow, it will timeout after 30 seconds with error message
- No more infinite hangs!

## Files Modified

- `lib/document-processor.js` - Added timeouts to all OpenAI API calls

