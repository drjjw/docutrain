# Keyword Generation Fix

**Date:** October 31, 2025  
**Issue:** Keyword generation failing after abstract fix  
**Status:** ✅ Fixed

## Problem

After fixing the abstract generation, keywords were still failing with:

```
400 'messages' must contain the word 'json' in some form, to use 'response_format' of type 'json_object'.
```

## Root Cause

OpenAI's `response_format: { type: "json_object" }` requires the word "json" (or "JSON") to appear in the conversation messages, preferably in the **system message**.

While our user message mentioned "JSON object" multiple times, OpenAI's validation specifically looks for it in the system message.

## Solution

Added "Always respond with valid JSON." to the system message:

### Before (Failed):
```javascript
{
    role: 'system',
    content: 'You are an expert at analyzing document content...'
    // ❌ No mention of JSON
}
```

### After (Works):
```javascript
{
    role: 'system',
    content: 'You are an expert at analyzing document content... Always respond with valid JSON.'
    // ✅ Contains "JSON"
}
```

## Testing

Verified the fix works:
```bash
✅ Success in 937ms:
{
  "keywords": ["kidney disease", "treatment", "guidelines"]
}
```

## Why This Matters

Keywords are used for:
- Word cloud visualization in document metadata
- Better document categorization
- Enhanced search/discovery

Without keywords, documents still work but lose this enhanced metadata.

## Timeline

| Time | Event |
|------|------|
| Earlier | Keywords worked fine |
| 11:06 AM | Added timeout (broke abstracts) |
| 11:15 AM | Fixed abstracts (moved timeout to options) |
| 11:21 AM | Abstracts working, but keywords still failing |
| Now | Fixed keywords (added JSON to system message) |

## Files Modified

- `lib/document-processor.js` - Added "Always respond with valid JSON." to system message

## What Works Now

✅ Abstract generation (with timeout)  
✅ Keyword generation (with timeout + JSON requirement)  
✅ Embedding generation (with timeout)  
✅ All apply to new uploads AND retraining  

## Next Steps

**Restart server** for the fix to take effect:

```bash
# Server should auto-restart with nodemon
# Or manually restart if needed
```

Then upload a new document - both abstracts AND keywords should generate successfully! 🎉

