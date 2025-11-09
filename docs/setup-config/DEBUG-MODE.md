# Debug Mode Configuration

**Date:** January 2025 (Updated with runtime debug enabling)  
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

**Server Control:** `ALLOW_DEBUG_OVERRIDE`  
**Values:** `true` | `false` (or unset)  
**Default:** `true` (allows runtime overrides)  
**Purpose:** Controls whether users can enable debug via URL parameter (`?debug=true`) or localStorage. Set to `false` to disable runtime overrides for security.

```bash
# Enable frontend debug logging in production
VITE_DEBUG=true

# Disable frontend debug logging (or omit the variable)
VITE_DEBUG=false

# Disable runtime overrides (URL/localStorage won't work)
ALLOW_DEBUG_OVERRIDE=false
```

## Usage

### Development Environment

Debug logging is **automatically enabled** in development:
- Backend: When `NODE_ENV=development`
- Frontend: When running dev server (`npm run dev`)

No configuration needed - just start your dev server and check the console.

### Production Environment

Debug logging is **disabled by default** in production. There are three ways to enable it:

#### Option 1: Runtime Enable (Frontend Only - No Rebuild Needed) ⚡

**Fastest method** - Works immediately without rebuilding or restarting:

**Method A: URL Parameter**
Add `?debug=true` to any URL:
```
https://www.docutrain.io/app/chat?debug=true
https://www.docutrain.io/app/dashboard?debug=true
```

**Method B: Browser Console**
Open browser console and run:
```javascript
localStorage.setItem('debug', 'true')
```
Then refresh the page.

**To disable:**
- Remove `?debug=true` from URL, or
- Run: `localStorage.setItem('debug', 'false')` or `localStorage.removeItem('debug')`

**Priority:** URL parameter > localStorage > build-time env vars

**Note:** This only enables **frontend** debug logs (browser console). For backend logs, use Option 2 or 3.

**⚠️ Security Control:** Runtime overrides (URL/localStorage) can be disabled by setting `ALLOW_DEBUG_OVERRIDE=false` in the server's `.env` file. When disabled, only build-time `VITE_DEBUG=true` will work. This prevents users from enabling debug logs via URL parameters or localStorage.

#### Option 2: Environment Variables (Requires Rebuild/Restart)

1. **Add to your `.env` file:**
   ```bash
   DEBUG=true          # Backend debug logs (PM2 logs)
   VITE_DEBUG=true    # Frontend debug logs (browser console)
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

3. **Debug logs will now appear** in production

4. **When finished troubleshooting:**
   - Remove or set to `false` in `.env`
   - Rebuild and restart

#### Option 3: Backend Only (No Frontend Rebuild)

For backend debugging only (PM2 logs):

1. **Add to `.env`:**
   ```bash
   DEBUG=true
   ```

2. **Restart backend:**
   ```bash
   pm2 restart docutrainio-bot
   ```

3. **View logs:**
   ```bash
   pm2 logs docutrainio-bot
   ```

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

**Backend (Recommended - Use Debug Utility):**
```javascript
const { debugLog, debugWarn, debugError } = require('./lib/utils/debug');

// Simple debug log
debugLog('🐛 Debug: Your message here');

// With data
debugLog('[HandlerName] Debug info:', { data, moreData });

// Warnings and errors (for debug-only messages)
debugWarn('⚠️ Warning message');
debugError('❌ Debug error message');
```

**Backend (Alternative - Manual Check):**
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

The app includes debug utilities for both frontend and backend:

**Frontend** (`app-src/src/utils/debug.ts`):
- `debugLog(...args)` - Conditional console.log
- `debugWarn(...args)` - Conditional console.warn
- `debugError(...args)` - Conditional console.error
- `isDebug()` - Check if debug mode is enabled

**Backend** (`lib/utils/debug.js`):
- `debugLog(...args)` - Conditional console.log
- `debugWarn(...args)` - Conditional console.warn
- `debugError(...args)` - Conditional console.error (for debug-only errors)
- `debugInfo(...args)` - Conditional console.info
- `isDebug()` / `isDebugEnabled()` - Check if debug mode is enabled

These automatically respect the environment variables (`VITE_DEBUG` for frontend, `DEBUG` for backend) and development mode.

**Important Note:** For actual production errors that should always be logged, continue using `console.error()` directly. Only use `debugError()` for debug-only error messages.

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
const debugEnabled = isDebugEnabled(); // Checks multiple sources
```

This checks (in priority order):
1. **URL parameter:** `?debug=true` → Enable (runtime, no rebuild) - **Only if `ALLOW_DEBUG_OVERRIDE` is not `false`**
2. **localStorage:** `localStorage.getItem('debug') === 'true'` → Enable (runtime, no rebuild) - **Only if `ALLOW_DEBUG_OVERRIDE` is not `false`**
3. **Build-time:** `VITE_DEBUG === 'true'` → Enable (requires rebuild)
4. **Dev mode:** `import.meta.env.DEV === true` → Enable (automatic in dev)
5. Otherwise → Disable

**Runtime enabling (URL/localStorage) takes priority over build-time settings**, allowing you to enable debug logs in production without rebuilding. However, this can be disabled by setting `ALLOW_DEBUG_OVERRIDE=false` in the server's `.env` file for security.

### Why Two Variables?

- **Backend:** Uses `DEBUG` (standard Node.js convention)
- **Frontend:** Uses `VITE_DEBUG` (Vite requires `VITE_` prefix for env vars)

This allows you to:
- Enable backend debugging only
- Enable frontend debugging only
- Enable both independently
- Control each layer separately

## Migration Strategy

**You don't need to update all files at once!** The codebase has ~199 files with console statements, but:

1. **Not all need conversion:**
   - `console.error()` - Usually keep as-is (real errors should always show)
   - `console.warn()` - Usually keep as-is (warnings should usually show)
   - `console.log()` - These are good candidates for `debugLog()`

2. **Gradual migration approach:**
   - Use the debug utilities for **new code** going forward
   - Convert existing files **when you're already editing them**
   - Prioritize high-traffic files (like `lib/routes/chat.js`, handlers, etc.)
   - Scripts and test files can stay as-is

3. **Quick wins:**
   - Files with lots of debug `console.log()` statements
   - Files you're actively working on
   - Critical paths (API routes, handlers)

**Example conversion:**
```javascript
// Before
console.log('🔵 POST /api/retrain-document - Request received');
console.log('   Request body keys:', Object.keys(req.body || {}));

// After
const { debugLog } = require('./lib/utils/debug');
debugLog('🔵 POST /api/retrain-document - Request received');
debugLog('   Request body keys:', Object.keys(req.body || {}));
```

No rush - migrate as you work on files naturally!

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

### Example 3: Debug Frontend Only (Runtime - No Rebuild)

**Fastest method** - No rebuild needed:

```javascript
// In browser console:
localStorage.setItem('debug', 'true')
// Refresh page
```

Or add `?debug=true` to URL:
```
https://www.docutrain.io/app/chat?debug=true
```

### Example 4: Debug Frontend Only (Build-time)

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

**For Frontend (Browser Console):**

**Check runtime options first:**
1. Try URL parameter: `?debug=true` (works immediately)
2. Check localStorage: `localStorage.getItem('debug')` in console
3. If using build-time: Verify `VITE_DEBUG=true` in `.env` and rebuild

**For Backend (PM2 Logs):**

**Check:**
1. Environment variable is set correctly in `.env`: `DEBUG=true`
2. Application was restarted: `pm2 restart docutrainio-bot`
3. Variable value is exactly `'true'` (string, lowercase)

**Verify:**
```bash
# Backend - check if DEBUG is set
echo $DEBUG

# Check PM2 logs
pm2 logs docutrainio-bot --lines 50

# Frontend - check build output (if using build-time)
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

