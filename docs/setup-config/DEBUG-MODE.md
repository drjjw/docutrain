# Debug Mode Configuration

**Date:** November 3, 2025  
**Status:** ✅ Complete

## Overview

The application supports a global debug mode that controls all debug logging throughout the entire codebase. By default, debug logs only appear in development environments, but can be explicitly enabled in production for troubleshooting.

## Environment Variables

### Backend Debug Mode

**Variable:** `DEBUG`  
**Values:** `true` | `false` (or unset)  
**Default:** Enabled in development (`NODE_ENV=development`), disabled in production

```bash
# Enable debug logging in production
DEBUG=true

# Disable debug logging (or omit the variable)
DEBUG=false
```

### Frontend Debug Mode

**Variable:** `VITE_DEBUG`  
**Values:** `true` | `false` (or unset)  
**Default:** Enabled in development mode, disabled in production builds

```bash
# Enable frontend debug logging in production
VITE_DEBUG=true

# Disable frontend debug logging (or omit the variable)
VITE_DEBUG=false
```

## Usage

### Development Environment

Debug logging is **automatically enabled** in development:
- Backend: When `NODE_ENV=development`
- Frontend: When running dev server (`npm run dev`)

No configuration needed - just start your dev server and check the console.

### Production Environment

Debug logging is **disabled by default** in production. To enable:

1. **Add to your `.env` file:**
   ```bash
   DEBUG=true
   VITE_DEBUG=true
   ```

2. **Restart your application:**
   ```bash
   # Rebuild frontend with debug enabled
   npm run build
   
   # Restart backend server
   pm2 restart all
   # or
   npm start
   ```

3. **Debug logs will now appear** in production console

4. **When finished troubleshooting:**
   - Remove or set to `false` in `.env`
   - Rebuild and restart

## What Gets Logged

### Rate Limiting Debug Logs

**Backend (Node.js console):**
```
🔍 Rate Limit Check [abc12345]:
   📊 Last minute: 3/10 messages
   ⚡ Last 10 sec: 1/3 messages
   ✅ Status: WITHIN LIMITS
   ✅ Request ALLOWED - Message recorded
   📈 New counts: 4/10 (minute), 2/3 (10sec)
```

**Frontend (Browser console):**
```
🔍 Frontend Rate Limit Check:
   📊 Last minute: 2/10 messages
   ⚡ Last 10 sec: 1/3 messages
   ✅ Status: WITHIN LIMITS
   ✅ Request ALLOWED - Will record timestamp
   📈 Timestamp recorded - New counts: 3/10 (minute), 2/3 (10sec)
```

### Adding Debug Logs

**Backend:**
```javascript
const debugEnabled = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development';

if (debugEnabled) {
    console.log('🐛 Debug: Your message here');
}
```

**Frontend (Recommended - Use Debug Utility):**
```typescript
import { debugLog, debugWarn, debugError } from '@/utils/debug';

// Simple debug log
debugLog('🐛 Debug: Your message here');

// With data
debugLog('[ComponentName] Debug info:', { data, moreData });

// Warnings and errors
debugWarn('⚠️ Warning message');
debugError('❌ Error message');
```

**Frontend (Alternative - Manual Check):**
```typescript
const debugEnabled = (import.meta as any).env?.VITE_DEBUG === 'true' || (import.meta as any).env?.DEV;

if (debugEnabled) {
    console.log('🐛 Debug: Your message here');
}
```

### Debug Utility Functions

The app includes a debug utility (`app-src/src/utils/debug.ts`) with helper functions:

- `debugLog(...args)` - Conditional console.log
- `debugWarn(...args)` - Conditional console.warn
- `debugError(...args)` - Conditional console.error
- `isDebug()` - Check if debug mode is enabled

These automatically respect the `VITE_DEBUG` environment variable and development mode.

## Best Practices

### When to Use Debug Mode in Production

✅ **Good reasons:**
- Troubleshooting a specific issue
- Investigating rate limit behavior
- Verifying configuration changes
- Monitoring performance metrics

❌ **Avoid:**
- Leaving enabled permanently (performance overhead)
- Logging sensitive data (passwords, tokens, etc.)
- Using as a replacement for proper monitoring
- Enabling without a specific reason

### Security Considerations

⚠️ **Important:**
- Debug logs may contain sensitive information
- Only enable when actively troubleshooting
- Disable immediately after issue is resolved
- Never log passwords, API keys, or tokens
- Review logs before sharing with others

### Performance Impact

Debug logging has minimal but measurable impact:
- **Console operations:** ~0.1-1ms per log
- **String formatting:** Negligible for simple logs
- **Memory:** Minimal (logs are not stored)

For high-traffic production systems:
- Only enable for specific troubleshooting sessions
- Monitor server performance while enabled
- Disable as soon as investigation is complete

## Implementation Details

### Backend Check Pattern

```javascript
const debugEnabled = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development';
```

This checks:
1. Is `DEBUG` explicitly set to `'true'`? → Enable
2. Is `NODE_ENV` set to `'development'`? → Enable
3. Otherwise → Disable

### Frontend Check Pattern

```typescript
const debugEnabled = import.meta.env.VITE_DEBUG === 'true' || import.meta.env.DEV;
```

This checks:
1. Is `VITE_DEBUG` explicitly set to `'true'`? → Enable
2. Is Vite running in dev mode? → Enable
3. Otherwise → Disable

### Why Two Variables?

- **Backend:** Uses `DEBUG` (standard Node.js convention)
- **Frontend:** Uses `VITE_DEBUG` (Vite requires `VITE_` prefix for env vars)

This allows you to:
- Enable backend debugging only
- Enable frontend debugging only
- Enable both independently
- Control each layer separately

## Examples

### Example 1: Debug Production Rate Limiting

```bash
# 1. Add to .env
DEBUG=true
VITE_DEBUG=true

# 2. Rebuild and restart
npm run build
pm2 restart all

# 3. Test rate limiting
# Send 4 messages rapidly in browser
# Check both browser console and server logs

# 4. Disable when done
# Remove from .env or set to false
# Rebuild and restart
```

### Example 2: Debug Backend Only

```bash
# Only enable backend debugging
DEBUG=true
# Leave VITE_DEBUG unset

# Restart backend
pm2 restart all

# Backend logs will appear, frontend logs won't
```

### Example 3: Debug Frontend Only

```bash
# Only enable frontend debugging
VITE_DEBUG=true
# Leave DEBUG unset

# Rebuild frontend
npm run build

# Frontend logs will appear, backend logs won't
```

## Troubleshooting

### Debug logs not appearing in production

**Check:**
1. Environment variable is set correctly in `.env`
2. Application was restarted after adding variable
3. Frontend was rebuilt after adding `VITE_DEBUG`
4. Variable value is exactly `'true'` (string, lowercase)

**Verify:**
```bash
# Backend - check if DEBUG is set
echo $DEBUG

# Frontend - check build output
npm run build
# Look for VITE_DEBUG in build logs
```

### Debug logs appearing when they shouldn't

**Likely causes:**
1. `NODE_ENV` is set to `development` in production
2. `DEBUG` or `VITE_DEBUG` is set to `'true'`
3. Running dev server instead of production build

**Fix:**
```bash
# Check NODE_ENV
echo $NODE_ENV

# Should be 'production' in production
export NODE_ENV=production

# Remove debug flags
# Comment out or remove from .env:
# DEBUG=true
# VITE_DEBUG=true
```

## Files Using Debug Mode

Currently implemented in:
1. `lib/routes/chat.js` - Rate limiting debug logs
2. `app-src/src/hooks/useChatMessages.ts` - Frontend rate limiting debug logs

As you add more debug logging, follow the same pattern for consistency.

## Related Documentation

- [Rate Limiting Implementation](../features/RATE-LIMITING-IMPLEMENTATION.md)
- [Rate Limiting Debug Logs](../features/RATE-LIMITING-DEBUG-LOGS.md)
- [Environment Variables](./.env.example)

