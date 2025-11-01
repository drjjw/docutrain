# Debug URL Parameter

## Overview

You can now control the amount of performance logging using the `?debug` URL parameter. This allows you to see more or less detail depending on your needs.

## Usage

Add `?debug=<level>` to any document URL:

```
http://localhost:3456/chat?doc=smh&debug=verbose
http://localhost:3456/chat?doc=smh&debug=quiet
http://localhost:3456/chat?doc=smh&debug=off
```

## Debug Levels

### `?debug=off` (or `false` or `0`)
**No performance logging**
- Completely silent - no performance logs
- Use when you don't want any debug output
- Fastest (minimal overhead)

**Output:**
```
(no output)
```

---

### `?debug=quiet` (or `summary`)
**Summary only**
- Shows only the final performance summary
- No step-by-step progress
- Good for quick performance checks

**Output:**
```
═══════════════════════════════════════════════════════════
✅ PAGE LOAD COMPLETE
═══════════════════════════════════════════════════════════
⏱️  Performance Summary:
  Step 1 (Logos):         1.23ms (0.4%)
  Step 2 (Access):        12.34ms (3.8%)
  Step 3 (Document):      245.67ms (75.5%)
  ...
  🏁 TOTAL TIME:          325.39ms

⚠️  BOTTLENECK DETECTED: Document took 245.67ms (75.5%)
═══════════════════════════════════════════════════════════
```

---

### **Default (no parameter)**
**Normal logging**
- Shows step-by-step progress
- Shows timing for each major step
- Shows performance summary
- **This is the default if no `?debug` parameter is provided**

**Output:**
```
═══════════════════════════════════════════════════════════
🚀 PAGE LOAD STARTED
═══════════════════════════════════════════════════════════

[STEP 1/10] 🎨 Preloading logos...
✓ Logos preloaded in 1.23ms

[STEP 2/10] 🔒 Checking document access...
✓ Access check completed in 12.34ms

[STEP 3/10] 📄 Initializing document...
✓ Document initialized in 245.67ms

...

═══════════════════════════════════════════════════════════
✅ PAGE LOAD COMPLETE
═══════════════════════════════════════════════════════════
⏱️  Performance Summary:
  Step 1 (Logos):         1.23ms (0.4%)
  ...
  🏁 TOTAL TIME:          325.39ms
═══════════════════════════════════════════════════════════
```

---

### `?debug=verbose` (or `true` or `1`)
**Everything**
- Shows all nested function calls
- Shows detailed timing for sub-operations
- Shows URL parameters, cache hits/misses
- Shows API request/response timing
- Most detailed output

**Output:**
```
═══════════════════════════════════════════════════════════
🚀 PAGE LOAD STARTED
═══════════════════════════════════════════════════════════
⏱️  Start Time: 2025-10-27T14:23:45.123Z
📍 Location: http://localhost:3456/chat?doc=smh
🐛 Debug Level: verbose

[STEP 1/10] 🎨 Preloading logos...
✓ Logos preloaded in 1.23ms

[STEP 2/10] 🔒 Checking document access...
  → Checking access for 1 document(s): smh
  → Access granted for all documents
✓ Access check completed in 12.34ms

[STEP 3/10] 📄 Initializing document...
  ┌─ initializeDocument() started
  │  → Parsing URL parameters...
  │     doc: smh
  │     owner: none
  │     embedding: openai
  │     model: default
  │  → Model set to: grok
  │     (0.45ms)
  │  → Starting document validation...
  │     Config module imported (1.23ms)
  │     Validating 1 document(s): smh
      ┌─ loadDocuments() started
      │  → Force refresh: true
      │  → Loading specific document(s): smh
      │  → Skipping cache due to force refresh
      │  → Fetching documents from API...
      │     No session data found (0.12ms)
      │     Fetching from: http://localhost:3456/api/documents?doc=smh
      │     Response received: 200 (45.67ms)
      │     JSON parsed (2.34ms)
      │     Processed 1 documents (0.89ms)
      │     Cached to localStorage (1.23ms)
      │  ✓ Loaded 1 documents from registry
      └─ loadDocuments() completed (from API) in 51.48ms
  │       ✓ Validated: smh (52.34ms)
  │     Total validation time: 54.56ms
  │  → Updating document UI...
    ┌─ updateDocumentUI() started
    │  → Document: smh
    │  → Force refresh: true
    │  → Send button found: true (0.23ms)
    │  → Parsed 1 slug(s): smh (0.34ms)
    │  → Fetching document configs...
      │  ✓ Using cached documents (age: 0.1s, 0.45ms)
    │     Configs fetched (1.23ms)
    │  → Valid configs: 1/1
    │  → Primary config: smh - SMH Housestaff Manual
    │  → Updating logo for owner: ukidney
    │     Logo config retrieved (12.34ms)
    │     Logo elements found: img=true, link=true
    │     Logo processing complete (23.45ms)
    │  → Processing document cover and welcome message...
    │     Loading cover image: https://example.com/cover.jpg
    │     ✓ Cover image loaded (156.78ms)
    │     Container heights equalized (2.34ms)
    │     Cover image layout displayed
    │     Cover/welcome processing complete (162.34ms)
    │  ✓ Document set to: SMH - SMH Housestaff Manual
    └─ updateDocumentUI() completed in 189.23ms
  │     Document UI updated (189.45ms)
  └─ initializeDocument() completed in 245.67ms
✓ Document initialized in 245.67ms

...

═══════════════════════════════════════════════════════════
✅ PAGE LOAD COMPLETE
═══════════════════════════════════════════════════════════
⏱️  Performance Summary:
  ...
═══════════════════════════════════════════════════════════
```

## Examples

### Production - No Logs
```
https://ukidney.brightbean.io/chat?doc=smh&debug=off
```
Clean console, no performance overhead.

### Quick Performance Check
```
https://ukidney.brightbean.io/chat?doc=smh&debug=quiet
```
Just see the summary to identify bottlenecks.

### Development - Normal
```
http://localhost:3456/chat?doc=smh
```
Default behavior, step-by-step progress.

### Debugging Issues
```
http://localhost:3456/chat?doc=smh&debug=verbose
```
See everything - API calls, cache hits, nested functions.

### Testing Multiple Documents
```
http://localhost:3456/chat?doc=smh+uhn&debug=verbose
```
Verbose logging for multi-document queries.

## Combining with Other Parameters

The `?debug` parameter works with all other URL parameters:

```
# Document + Debug
?doc=smh&debug=verbose

# Owner + Debug
?owner=ukidney&debug=quiet

# Model + Embedding + Debug
?doc=smh&model=grok&embedding=local&debug=verbose

# Back Button + Debug
?doc=smh&back-button=/docs&debug=quiet
```

## Performance Impact

| Level | Console Output | Performance Impact |
|-------|---------------|-------------------|
| `off` | None | Minimal (~0.1ms) |
| `quiet` | Summary only | Very low (~1ms) |
| `normal` | Steps + Summary | Low (~2-5ms) |
| `verbose` | Everything | Moderate (~5-10ms) |

**Note:** The performance impact is negligible compared to actual page load operations (API calls, image loading, etc.)

## Tips

1. **Use `quiet` in production** if you need to debug user issues without overwhelming the console
2. **Use `verbose` for development** to see exactly what's happening
3. **Use `off` for demos** to keep the console clean
4. **Default (no parameter) is best** for normal development work

## Programmatic Access

You can also check the debug level in your own code:

```javascript
import { DEBUG_LEVEL, DEBUG_LEVELS, debugLog } from './main.js';

// Check current level
if (DEBUG_LEVEL >= DEBUG_LEVELS.VERBOSE) {
    console.log('Verbose logging enabled');
}

// Use debugLog in your code
debugLog.verbose('This only shows in verbose mode');
debugLog.normal('This shows in normal and verbose modes');
debugLog.quiet('This shows in all modes except off');
debugLog.always('This always shows (same as console.log)');
```

## Browser Console Commands

You can also check the debug level from the browser console:

```javascript
// Check current level
window.debugLog

// Manually log something
window.debugLog.verbose('Test message')
```

## Troubleshooting

### Logs not appearing?
- Check you're using the correct parameter: `?debug=verbose` (not `?verbose=true`)
- Check browser console filter (should show "All levels")
- Try refreshing with the parameter in the URL

### Too much output?
- Use `?debug=quiet` for just the summary
- Use `?debug=off` to disable completely

### Want to see specific details?
- Use `?debug=verbose` to see everything
- Look for the nested tree structure (`┌─`, `│`, `└─`)

