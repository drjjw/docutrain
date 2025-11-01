# 🔄 How to Toggle Between Streaming and Non-Streaming

## Overview
The codebase now supports **both streaming and non-streaming** responses with clean, maintainable code. You can easily toggle between them.

## Code Structure

### Files Involved:
1. **`public/js/api.js`** - Controls which endpoint to call
2. **`public/js/chat.js`** - Contains both response handlers
3. **`lib/routes/chat.js`** - Backend endpoints (both `/api/chat` and `/api/chat/stream`)

### Architecture:
```
┌─────────────────────────────────────────────────┐
│  public/js/api.js                               │
│  ┌───────────────────────────────────────────┐  │
│  │ USE_STREAMING = true/false                │  │
│  │   ↓                                       │  │
│  │   true  → /api/chat/stream (SSE)         │  │
│  │   false → /api/chat (JSON)               │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  public/js/chat.js                              │
│  ┌───────────────────────────────────────────┐  │
│  │ handleStreamingResponse()                 │  │
│  │   - ReadableStream API                    │  │
│  │   - Real-time updates                     │  │
│  │   - styleReferences()                     │  │
│  │                                           │  │
│  │ handleNonStreamingResponse()              │  │
│  │   - JSON response                         │  │
│  │   - Full response at once                 │  │
│  │   - addMessage()                          │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

## How to Toggle

### Method 1: Feature Flag (Recommended)
**File**: `public/js/api.js` (line 5)

```javascript
// 🎯 FEATURE FLAG: Enable streaming responses
const USE_STREAMING = true;  // ← Change this!
```

**To enable streaming:**
```javascript
const USE_STREAMING = true;
```

**To disable streaming:**
```javascript
const USE_STREAMING = false;
```

Then rebuild and restart:
```bash
npm run build
pkill -f "node server.js"
node server.js &
```

### Method 2: Temporary Override (For Testing)
**File**: `public/js/chat.js` (line 168)

You can temporarily force a specific mode by changing:
```javascript
const isStreaming = contentType && contentType.includes('text/event-stream');
```

To always use streaming:
```javascript
const isStreaming = true;  // Force streaming
```

To always use non-streaming:
```javascript
const isStreaming = false;  // Force non-streaming
```

## What Each Mode Does

### Streaming Mode (`USE_STREAMING = true`)
**Endpoint**: `/api/chat/stream`

**Behavior**:
- ✅ Response starts appearing in 1-2 seconds
- ✅ Text streams in word-by-word
- ✅ No forced scrolling (user control)
- ✅ Collapsible references (via `styleReferences()`)
- ✅ Drug conversion styling
- ❌ No metadata footer (yet)
- ❌ No conversation logging (yet)
- ❌ No rating buttons (yet)

**Handler**: `handleStreamingResponse()` in `chat.js`

### Non-Streaming Mode (`USE_STREAMING = false`)
**Endpoint**: `/api/chat`

**Behavior**:
- ✅ Full response with metadata
- ✅ Conversation logging to database
- ✅ Rating buttons
- ✅ Model override detection
- ✅ Complete error handling
- ❌ 8-10 second wait before seeing anything
- ❌ Feels slower

**Handler**: `handleNonStreamingResponse()` in `chat.js`

## Code Organization

### `public/js/chat.js` Structure:
```javascript
// ============================================================================
// STREAMING RESPONSE HANDLER
// ============================================================================
async function handleStreamingResponse(response, state, elements) {
    // ~70 lines of clean streaming logic
}

// ============================================================================
// NON-STREAMING RESPONSE HANDLER
// ============================================================================
async function handleNonStreamingResponse(response, state, elements, sendMessage) {
    // ~60 lines of clean non-streaming logic
}

// ============================================================================
// MAIN SEND MESSAGE FUNCTION
// ============================================================================
export async function sendMessage(state, elements) {
    // Setup...
    
    const response = await sendMessageToAPI(...);
    const isStreaming = response.headers.get('content-type')?.includes('text/event-stream');
    
    if (isStreaming) {
        await handleStreamingResponse(response, state, elements);
    } else {
        await handleNonStreamingResponse(response, state, elements, sendMessage);
    }
    
    // Cleanup...
}
```

**Benefits**:
- ✅ Clean separation of concerns
- ✅ Easy to maintain both implementations
- ✅ No code duplication
- ✅ Simple to toggle
- ✅ Both implementations always available

## Testing Both Modes

### Test Streaming:
1. Set `USE_STREAMING = true` in `api.js`
2. Rebuild: `npm run build`
3. Restart server
4. Ask a question
5. Watch response stream in real-time

### Test Non-Streaming:
1. Set `USE_STREAMING = false` in `api.js`
2. Rebuild: `npm run build`
3. Restart server
4. Ask a question
5. Wait for complete response

## Quick Reference

| Feature | Streaming | Non-Streaming |
|---------|-----------|---------------|
| **Time to first content** | 1-2s | 8-10s |
| **User experience** | Fast, responsive | Slow, complete |
| **Metadata footer** | ❌ | ✅ |
| **Database logging** | ❌ | ✅ |
| **Rating buttons** | ❌ | ✅ |
| **Collapsible refs** | ✅ | ✅ |
| **Auto-scroll** | ❌ | ✅ (to top) |

## Future Enhancements

### For Streaming Mode:
- [ ] Add metadata footer after streaming completes
- [ ] Add database logging (async, after stream)
- [ ] Add rating buttons
- [ ] Add model override detection

### For Both:
- [ ] Add performance timing markers
- [ ] Add cache hit/miss tracking
- [ ] Optimize multi-document queries

## Rollback Strategy

If streaming causes issues:
1. **Immediate**: Set `USE_STREAMING = false`
2. **Rebuild**: `npm run build`
3. **Restart**: `pkill -f "node server.js" && node server.js &`
4. **Verify**: Test at http://localhost:3456/

System falls back to proven non-streaming behavior instantly.

## Summary

✅ **Both implementations are always in the codebase**
✅ **Clean, maintainable code structure**
✅ **Single flag to toggle between them**
✅ **Easy to test both modes**
✅ **No code bloat - well-organized handlers**

---

**Current Status**: Streaming enabled (`USE_STREAMING = true`)
**Toggle Location**: `public/js/api.js` line 5
**Rebuild Command**: `npm run build`
**Restart Command**: `pkill -f "node server.js" && node server.js &`

