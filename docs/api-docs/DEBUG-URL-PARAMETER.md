# Debug URL Parameter

## Overview

You can enable debug logging in production using the `?debug` URL parameter. This allows you to see debug logs (`debugLog()`, `debugWarn()`, `debugError()`) that are normally hidden in production builds.

**Note:** This only works if `ALLOW_DEBUG_OVERRIDE=true` is set on the server (which it is by default).

## Usage

Add `?debug=<value>` to any document URL:

```
https://www.docutrain.io/app/chat?doc=smh&debug=verbose
https://www.docutrain.io/app/chat?doc=smh&debug=true
https://www.docutrain.io/app/chat?doc=smh&debug=off
```

## Debug Values

### Enable Debug Mode

These values **enable** debug logging:
- `?debug=true`
- `?debug=1`
- `?debug=verbose`

**What you'll see:**
- All `debugLog()` calls will output to console
- All `debugWarn()` calls will output to console
- All `debugError()` calls will output to console
- Any code that checks `isDebug()` will return `true`

### Disable Debug Mode

These values **disable** debug logging:
- `?debug=false`
- `?debug=0`
- `?debug=off`

**What you'll see:**
- No debug logs (clean console)
- Minimal performance overhead

### Default Behavior

**In Development (Vite dev server):**
- Debug logging is **ON by default**
- No URL parameter needed

**In Production:**
- Debug logging is **OFF by default**
- Use `?debug=true` or `?debug=verbose` to enable

## Examples

### Production - Enable Debug Logs
```
https://www.docutrain.io/app/chat?doc=smh&debug=verbose
https://www.docutrain.io/app/chat?doc=smh&debug=true
```
See all debug logs in the browser console.

### Production - Disable Debug Logs
```
https://www.docutrain.io/app/chat?doc=smh&debug=off
https://www.docutrain.io/app/chat?doc=smh&debug=false
```
Clean console, no debug output.

### Development - Default
```
http://localhost:5173/app/chat?doc=smh
```
Debug logs are already enabled (no parameter needed).

## Alternative: localStorage

You can also enable debug mode via the browser console:

```javascript
// Enable debug mode
localStorage.setItem('debug', 'true')
// or
localStorage.setItem('debug', 'verbose')

// Disable debug mode
localStorage.setItem('debug', 'false')
// or
localStorage.setItem('debug', 'off')

// Then refresh the page
```

## Combining with Other Parameters

The `?debug` parameter works with all other URL parameters:

```
# Document + Debug
?doc=smh&debug=verbose

# Owner + Debug
?owner=ukidney&debug=true

# Model + Embedding + Debug
?doc=smh&model=grok&embedding=local&debug=true
```

## How It Works

1. **URL Parameter Check** (highest priority)
   - Checks `?debug` parameter in URL
   - Accepts: `true`, `1`, `verbose` (enable) or `false`, `0`, `off` (disable)

2. **localStorage Check** (if URL parameter not present)
   - Checks `localStorage.getItem('debug')`
   - Accepts same values as URL parameter

3. **Build-time Check** (if no runtime override)
   - Checks `VITE_DEBUG` environment variable
   - `VITE_DEBUG=true` enables debug in production builds
   - `VITE_DEBUG=false` disables debug even in development

4. **Default Behavior**
   - Development mode: Debug ON
   - Production build: Debug OFF

## Server Control

The server can disable runtime overrides by setting:

```bash
ALLOW_DEBUG_OVERRIDE=false
```

When disabled:
- URL parameters (`?debug=true`) are ignored
- localStorage overrides are ignored
- Only build-time `VITE_DEBUG` works

**Default:** `ALLOW_DEBUG_OVERRIDE=true` (allows runtime overrides)

## Performance Impact

| Mode | Console Output | Performance Impact |
|------|---------------|-------------------|
| **Disabled** (`off`/`false`/`0`) | None | Minimal (~0.1ms) |
| **Enabled** (`true`/`1`/`verbose`) | All debug logs | Low (~1-2ms) |

**Note:** The performance impact is negligible compared to actual page operations (API calls, rendering, etc.)

## Programmatic Usage

In your code, use the debug utilities:

```typescript
import { debugLog, debugWarn, debugError, isDebug } from '@/utils/debug';

// These only output when debug is enabled
debugLog('User clicked button:', buttonId);
debugWarn('Rate limit approaching');
debugError('Failed to fetch:', error);

// Check if debug is enabled
if (isDebug()) {
  console.log('Debug mode is active');
}
```

## Troubleshooting

### Logs not appearing?

1. **Check the URL parameter:**
   - Use `?debug=verbose` or `?debug=true` (not `?verbose=true`)
   - Make sure the parameter is in the URL bar

2. **Check server setting:**
   - Verify `ALLOW_DEBUG_OVERRIDE=true` in server `.env`
   - Check `/api/users/config` endpoint to confirm

3. **Check browser console:**
   - Open DevTools (F12)
   - Check Console tab
   - Make sure filters aren't hiding logs

4. **Try localStorage:**
   ```javascript
   localStorage.setItem('debug', 'true');
   // Then refresh the page
   ```

### Still not working?

1. **Verify in development first:**
   - Debug logs should appear automatically in dev mode
   - If they don't, check your code is using `debugLog()` correctly

2. **Check build:**
   - Make sure you've rebuilt and deployed after code changes
   - Old builds won't have the latest debug code

3. **Check browser cache:**
   - Hard refresh: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
   - Or clear browser cache

## Related Documentation

- [Debug Mode Configuration](../setup-config/DEBUG-MODE.md) - Server-side debug settings
- [Logging Standards](../../.cursor/rules/logging-standards.mdc) - When to use debug logs vs console logs
