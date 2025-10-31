# OpenAI Abstract Generation Fix

**Date:** October 31, 2025  
**Issue:** Abstract and keyword generation failing with 400 errors  
**Status:** ✅ Fixed

## Problem

After adding timeout parameters to prevent infinite hangs, all OpenAI abstract and keyword generation started failing with:

```
400 Unrecognized request argument supplied: timeout
```

## Root Cause

The `timeout` parameter was incorrectly placed **inside the request body** instead of as a separate **options parameter**.

### Incorrect (Caused 400 Error):
```javascript
await openaiClient.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [...],
    timeout: 30000  // ❌ WRONG - OpenAI doesn't accept this in request body
});
```

### Correct:
```javascript
await openaiClient.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [...]
}, {
    timeout: 30000  // ✅ CORRECT - Pass as second parameter (options)
});
```

## Timeline of Issue

| Time | Event |
|------|-------|
| Before 11:06 AM | Abstracts working fine (no timeout yet) |
| 11:06 AM | Added timeout parameter to prevent hangs |
| 11:06 AM+ | All abstracts started failing with 400 error |
| Now | Fixed by moving timeout to options parameter |

## Solution Applied

Updated all three OpenAI API calls in `lib/document-processor.js`:

### 1. Abstract Generation
```javascript
const response = await openaiClient.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [...],
    temperature: 0.7,
    max_tokens: 200
}, {
    timeout: 30000 // Moved to options parameter
});
```

### 2. Keyword Generation
```javascript
const response = await openaiClient.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [...],
    temperature: 0.7,
    max_tokens: 500,
    response_format: { type: "json_object" }
}, {
    timeout: 30000 // Moved to options parameter
});
```

### 3. Embedding Generation
```javascript
const response = await openaiClient.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
    encoding_format: 'float'
}, {
    timeout: 30000 // Moved to options parameter
});
```

## Testing

Verified the fix works:
```bash
✅ Success in 638ms: Hello! How are you today?
```

## What This Means

- ✅ **Timeouts still work** - Prevents infinite hangs
- ✅ **No more 400 errors** - Correct API usage
- ✅ **Abstracts will generate** - For new document uploads
- ✅ **Keywords will generate** - For document metadata

## Next Steps

**Server needs restart** for the fix to take effect:

```bash
# Restart your server
npm run dev
```

Then try uploading a new document - abstracts and keywords should generate successfully!

## Files Modified

- `lib/document-processor.js` - Fixed timeout parameter placement for all 3 OpenAI API calls

