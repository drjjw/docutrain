# Rate Limiting Debug Logs

**Date:** November 3, 2025  
**Status:** ✅ Complete

## Overview

Added comprehensive debug logging for rate limiting in local development environments. These logs help developers understand the rate limit accounting and see exactly where they are in relation to the limits.

## Debug Output

### Backend Logs (Node.js Console)

When `NODE_ENV=development`, the backend will log:

```
🔍 Rate Limit Check [abc12345]:
   📊 Last minute: 3/10 messages
   ⚡ Last 10 sec: 1/3 messages
   ✅ Status: WITHIN LIMITS
   ✅ Request ALLOWED - Message recorded
   📈 New counts: 4/10 (minute), 2/3 (10sec)
```

**When burst limit exceeded:**
```
🔍 Rate Limit Check [abc12345]:
   📊 Last minute: 5/10 messages
   ⚡ Last 10 sec: 3/3 messages
   ✅ Status: APPROACHING/EXCEEDED
   ❌ BURST LIMIT EXCEEDED: 3/3 in 10 seconds
   ⏱️  Retry after: 7 seconds
```

**When rate limit exceeded:**
```
🔍 Rate Limit Check [abc12345]:
   📊 Last minute: 10/10 messages
   ⚡ Last 10 sec: 2/3 messages
   ✅ Status: APPROACHING/EXCEEDED
   ❌ RATE LIMIT EXCEEDED: 10/10 in 1 minute
   ⏱️  Retry after: 45 seconds
```

### Frontend Logs (Browser Console)

When running in development mode (`import.meta.env.DEV`), the frontend will log:

```
🔍 Frontend Rate Limit Check:
   📊 Last minute: 2/10 messages
   ⚡ Last 10 sec: 1/3 messages
   ✅ Status: WITHIN LIMITS
   ✅ Request ALLOWED - Will record timestamp
   📈 Timestamp recorded - New counts: 3/10 (minute), 2/3 (10sec)
```

**When limits exceeded:**
```
🔍 Frontend Rate Limit Check:
   📊 Last minute: 10/10 messages
   ⚡ Last 10 sec: 2/3 messages
   ✅ Status: APPROACHING/EXCEEDED
   ❌ RATE LIMIT EXCEEDED: 10/10 in 1 minute
   ⏱️  Retry after: 38 seconds
```

## Log Symbols Reference

- 🔍 **Rate limit check initiated**
- 📊 **Per-minute counter** (10 message limit)
- ⚡ **Burst counter** (3 messages in 10 seconds)
- ✅ **Status OK / Request allowed**
- ❌ **Limit exceeded**
- ⏱️ **Countdown timer**
- 📈 **New counts after recording**

## How to Use

### Testing Rate Limits

1. **Start your development server:**
   ```bash
   npm run dev  # or your dev command
   ```

2. **Open browser console** (F12 or Cmd+Option+I)

3. **Send messages rapidly** and watch the logs:
   - First 3 messages in 10 seconds: ✅ Allowed
   - 4th message within 10 seconds: ❌ Burst limit
   - After 10 messages in a minute: ❌ Rate limit

4. **Watch the counters** to see exactly where you are:
   ```
   📊 Last minute: 7/10 messages  ← 3 more allowed
   ⚡ Last 10 sec: 2/3 messages   ← 1 more allowed in next 10 seconds
   ```

### Understanding the Output

**"WITHIN LIMITS"** - You're safe, send away!
- Both counters are below their thresholds
- Messages will be processed normally

**"APPROACHING/EXCEEDED"** - You're at or near the limit
- One or both counters are at their threshold
- Next message may be blocked

**Frontend vs Backend Logs:**
- Frontend logs appear BEFORE the API call
- Backend logs appear AFTER receiving the request
- If frontend allows but backend blocks, you'll see both logs (rare edge case)

## Production Behavior

In production (`NODE_ENV=production` or `import.meta.env.PROD`):
- **No debug logs** - keeps console clean
- Rate limiting still enforced
- Only errors are logged (when limits exceeded)

## Files Modified

1. `lib/routes/chat.js` - Backend debug logging
2. `app-src/src/hooks/useChatMessages.ts` - Frontend debug logging

## Benefits

### For Development
- **Visibility** - See exactly what's happening with rate limits
- **Testing** - Verify limits work correctly
- **Debugging** - Understand why a message was blocked
- **Tuning** - Decide if limits need adjustment

### For Production
- **Clean logs** - No debug noise in production
- **Performance** - No overhead from debug logging
- **Security** - Rate limiting still enforced silently

## Example Testing Session

```
// Message 1
🔍 Frontend Rate Limit Check:
   📊 Last minute: 0/10 messages
   ⚡ Last 10 sec: 0/3 messages
   ✅ Status: WITHIN LIMITS
   ✅ Request ALLOWED - Will record timestamp
   📈 Timestamp recorded - New counts: 1/10 (minute), 1/3 (10sec)

// Message 2 (immediately after)
🔍 Frontend Rate Limit Check:
   📊 Last minute: 1/10 messages
   ⚡ Last 10 sec: 1/3 messages
   ✅ Status: WITHIN LIMITS
   ✅ Request ALLOWED - Will record timestamp
   📈 Timestamp recorded - New counts: 2/10 (minute), 2/3 (10sec)

// Message 3 (immediately after)
🔍 Frontend Rate Limit Check:
   📊 Last minute: 2/10 messages
   ⚡ Last 10 sec: 2/3 messages
   ✅ Status: WITHIN LIMITS
   ✅ Request ALLOWED - Will record timestamp
   📈 Timestamp recorded - New counts: 3/10 (minute), 3/3 (10sec)

// Message 4 (immediately after - BLOCKED!)
🔍 Frontend Rate Limit Check:
   📊 Last minute: 3/10 messages
   ⚡ Last 10 sec: 3/3 messages
   ✅ Status: APPROACHING/EXCEEDED
   ❌ BURST LIMIT EXCEEDED: 3/3 in 10 seconds
   ⏱️  Retry after: 10 seconds
```

## Notes

- Debug logs only appear in development mode
- Session ID is truncated to first 8 characters in logs for readability
- Counters update in real-time as messages are sent
- Both frontend and backend logs use the same format for consistency

