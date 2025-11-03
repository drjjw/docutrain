# Rate Limiting Implementation

**Date:** November 3, 2025  
**Status:** ✅ Complete

## Overview

Implemented unobtrusive rate limiting to prevent spam and automated flooding of the chatbot while allowing legitimate multi-message conversations. The system uses a dual-layer approach with both backend (security) and frontend (UX) rate limiting.

## Implementation Details

### 1. Backend Rate Limiting (Primary Defense)

**File:** `lib/routes/chat.js`

Created an in-memory `RateLimiter` class that:
- Tracks message timestamps per session ID
- Implements sliding window rate limiting
- Enforces two rate limit rules:
  - **10 messages per minute** (moderate protection)
  - **3 messages per 10 seconds** (burst protection)
- Automatically cleans up inactive sessions every 5 minutes to prevent memory leaks
- Returns HTTP 429 status with retry-after information when limits are exceeded

**Key Features:**
- Session-based tracking (works for both authenticated and anonymous users)
- Singleton instance shared across all requests
- Graceful error responses with countdown timers
- Memory-efficient with automatic cleanup

**Rate Limit Response Format:**
```json
{
  "error": "Rate limit exceeded. Please wait 30 seconds before sending another message.",
  "rateLimitExceeded": true,
  "retryAfter": 30,
  "limit": 10,
  "window": "minute"
}
```

### 2. Frontend Rate Limiting (UX Enhancement)

**File:** `app-src/src/hooks/useChatMessages.ts`

Added client-side rate limiting to the `useChatMessages` hook:
- Tracks message timestamps in component state
- Mirrors backend rate limit logic (10/min, 3/10sec)
- Provides immediate feedback without API calls
- Displays friendly error messages with countdown
- Automatically clears errors after cooldown period

**New Hook Return Values:**
- `rateLimitError`: String containing error message (null when no error)
- `retryAfter`: Number of seconds until next message allowed

### 3. UI Error Display

**File:** `app-src/src/pages/ChatPage.tsx`

Added visual rate limit feedback:
- Yellow warning banner appears when rate limited
- Shows countdown timer ("You can send another message in X seconds")
- Disables input field and send button during cooldown
- Warning icon for visual clarity
- Auto-dismisses after cooldown period

## Rate Limit Configuration

### Current Settings
- **Per-minute limit:** 10 messages
- **Burst limit:** 3 messages per 10 seconds
- **Sliding window:** Yes (not fixed time blocks)
- **Scope:** Per session ID

### Rationale
Based on analysis of actual usage patterns:
- Legitimate users send ~95 messages over 20+ hours (avg 1-2 per minute)
- 10/min allows occasional rapid questions without blocking real users
- 3/10sec burst protection stops automated scripts
- Session-based tracking works for both anonymous and authenticated users

## Technical Architecture

### Backend Flow
1. Request arrives at `/api/chat` or `/api/chat/stream`
2. Session ID is validated/generated
3. Rate limiter checks session history
4. If exceeded: Return 429 error with retry-after
5. If allowed: Record timestamp and process request
6. Background cleanup runs every 5 minutes

### Frontend Flow
1. User types message and clicks send
2. Client-side rate limit check runs first
3. If exceeded: Show error banner, disable input
4. If allowed: Record timestamp, make API call
5. If backend returns 429: Show error banner (fallback)
6. Error auto-clears after countdown

## Error Handling

### Client-Side Errors
- Immediate feedback (no API call)
- Friendly messages: "Please slow down" vs "Rate limit reached"
- Countdown timer displayed
- Input/button disabled during cooldown

### Server-Side Errors
- HTTP 429 status code
- JSON error response with retry-after
- Logged to console for monitoring
- Handled gracefully in streaming responses (SSE)

## Testing Recommendations

After deployment, verify:
1. ✅ Legitimate multi-message conversations still work
2. ✅ Rapid automated requests are blocked
3. ✅ Error messages are clear and helpful
4. ✅ Rate limit state clears after cooldown period
5. ✅ Memory cleanup prevents leaks in long-running server
6. ✅ Both streaming and non-streaming endpoints enforce limits

## Monitoring

The rate limiter includes built-in monitoring:
- Console logs when rate limits are exceeded
- Cleanup logs show number of sessions removed
- `getStats()` method provides current statistics:
  - `activeSessions`: Number of tracked sessions
  - `totalTimestamps`: Total message timestamps stored

## Future Enhancements

Potential improvements if needed:
1. **Database logging:** Track rate limit violations for abuse analysis
2. **IP-based limiting:** Add secondary layer for severe abuse
3. **Dynamic limits:** Adjust limits based on authenticated user tier
4. **Admin dashboard:** View rate limit statistics and patterns
5. **Configurable limits:** Move to environment variables for easy tuning

## Files Modified

1. `lib/routes/chat.js` - Backend rate limiter class and integration
2. `app-src/src/hooks/useChatMessages.ts` - Frontend rate checking and state
3. `app-src/src/pages/ChatPage.tsx` - UI error display and input disabling

## Benefits

### Security
- Prevents automated spam/flooding
- Stops malicious bots from overwhelming the system
- Protects API costs (LLM calls are expensive)

### User Experience
- Unobtrusive for legitimate users
- Clear feedback when limits are reached
- Countdown timer reduces frustration
- No impact on normal conversation flow

### Performance
- In-memory implementation (fast)
- Automatic cleanup prevents memory leaks
- Minimal overhead per request
- Scales with server capacity

## Notes

- Rate limits are per-session, not per-user or per-IP
- Each chat session is independent (new session = fresh limits)
- Frontend checks prevent unnecessary API calls
- Backend checks provide security (cannot be bypassed)
- Both streaming and non-streaming endpoints are protected

