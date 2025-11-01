# Performance Logging - Quick Reference

## How to Use

1. **Open browser console** (F12 or Cmd+Option+J)
2. **Load or reload** a document page
3. **Read the output** - structured logs will appear
4. **Look for bottlenecks** - highlighted at the end

## What to Look For

### ✅ Good Performance
```
🏁 TOTAL TIME: 125.14ms
```
- Total < 200ms
- No bottleneck warnings
- All steps < 30% of total

### ⚠️ Acceptable Performance
```
🏁 TOTAL TIME: 325.39ms
⚠️  BOTTLENECK DETECTED: Document took 245.67ms (75.5%)
```
- Total 200-500ms
- One step dominates (> 50%)
- Still usable, but room for improvement

### ❌ Needs Attention
```
🏁 TOTAL TIME: 2216.78ms
⚠️  BOTTLENECK DETECTED: Document took 2045.67ms (92.3%)
```
- Total > 500ms
- One step takes > 1 second
- User experience degraded

## Common Bottlenecks & Fixes

### 1. Document Loading Slow
```
Step 3 (Document): 500ms+ (> 50%)
  → API response: 400ms
```

**Causes:**
- Database query slow
- Network latency
- Cache not working

**Fixes:**
- Check server logs
- Verify cache is enabled
- Optimize database queries
- Use CDN for API

### 2. Cover Image Slow
```
Step 3 (Document): 400ms+ (> 40%)
  → Cover image loaded: 350ms
```

**Causes:**
- Large image file
- Slow CDN/server
- Not cached

**Fixes:**
- Compress/optimize image
- Use responsive images
- Enable browser caching
- Preload critical images

### 3. User Menu Slow
```
Step 6 (User Menu): 200ms+ (> 20%)
```

**Causes:**
- Permissions API slow
- Avatar image slow
- Not cached

**Fixes:**
- Cache permissions
- Optimize query
- Preload avatar

## Log Structure

```
═══════════════════════════════════════════════════════════
🚀 PAGE LOAD STARTED                    ← Start banner
═══════════════════════════════════════════════════════════

[STEP 1/10] 🎨 Preloading logos...     ← Step header
✓ Logos preloaded in 1.23ms             ← Step result

[STEP 3/10] 📄 Initializing document...
  ┌─ initializeDocument() started       ← Function start
  │  → Parsing URL parameters...        ← Action
  │     doc: smh                         ← Details
      ┌─ loadDocuments() started        ← Nested function
      │  ✓ Using cached documents       ← Success
      └─ loadDocuments() completed      ← Function end
  │       ✓ Validated: smh              ← Result
  └─ initializeDocument() completed     ← Function end
✓ Document initialized in 245.67ms      ← Step result

═══════════════════════════════════════════════════════════
✅ PAGE LOAD COMPLETE                   ← End banner
═══════════════════════════════════════════════════════════
⏱️  Performance Summary:                ← Summary
  Step 1 (Logos):         1.23ms (0.4%)
  Step 3 (Document):      245.67ms (75.5%)  ← Bottleneck
  🏁 TOTAL TIME:          325.39ms

⚠️  BOTTLENECK DETECTED: Document took 245.67ms (75.5%)
═══════════════════════════════════════════════════════════
```

## Symbols Guide

| Symbol | Meaning |
|--------|---------|
| `┌─` | Function/section start |
| `│` | Continuation |
| `└─` | Function/section end |
| `→` | Action being performed |
| `✓` | Success |
| `❌` | Error |
| `⚠️` | Warning |
| `🚀` | Start |
| `✅` | Complete |
| `🏁` | Total time |
| `💡` | Tip |

## Performance Targets

| Metric | Optimal | Acceptable | Needs Work |
|--------|---------|------------|------------|
| **Total Time** | < 200ms | 200-500ms | > 500ms |
| **Document Step** | < 100ms | 100-300ms | > 300ms |
| **Image Load** | < 150ms | 150-300ms | > 300ms |
| **API Call** | < 50ms | 50-200ms | > 200ms |
| **Cache Hit** | < 1ms | 1-5ms | > 5ms |

## Quick Diagnostics

### Is cache working?
Look for:
```
✓ Using cached documents (age: 30.5s, 0.34ms)
```
If you see "Fetching from API" on second load, cache is broken.

### Is image cached?
Compare first vs second load:
```
First:  ✓ Cover image loaded (156.78ms)
Second: ✓ Cover image loaded (45.67ms)  ← Should be faster
```

### Is API slow?
Look for:
```
Response received: 200 (1234.56ms)  ← Should be < 100ms
```

### Is network slow?
Check multiple resources:
```
API response: 400ms      ← All slow = network issue
Image load: 350ms
Logo load: 200ms
```

## Browser DevTools

### Performance Tab
1. Open DevTools (F12)
2. Go to **Performance** tab
3. Click **Record** (⚫)
4. Reload page
5. Click **Stop**
6. Look for:
   - **User Timing** section (shows our marks)
   - **Network** section (shows resource loads)
   - **Main** section (shows JavaScript execution)

### Network Tab
1. Open DevTools (F12)
2. Go to **Network** tab
3. Reload page
4. Look for:
   - Slow requests (red/orange)
   - Large files (Size column)
   - Cache status (Status column: 200 vs 304)

### Console Tab
1. Open DevTools (F12)
2. Go to **Console** tab
3. Reload page
4. Read structured logs
5. Look for warnings/errors

## Tips

### Clear Cache to Test
```javascript
// In console:
localStorage.clear();
location.reload();
```

### Force Refresh
```
Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
```

### Test Slow Network
1. Open DevTools
2. Go to Network tab
3. Change throttling to "Slow 3G"
4. Reload page

### Export Performance Data
```javascript
// In console:
const entries = performance.getEntriesByType('measure');
console.table(entries);
```

## Troubleshooting

### No logs appearing?
- Check console is open
- Refresh page
- Check console filter (should show "All levels")

### Logs cut off?
- Increase console buffer size in DevTools settings
- Export logs before they're cleared

### Different results each time?
- Normal for network-dependent operations
- Run 3-5 times and average
- Clear cache between runs for consistency

### Very slow first load?
- Expected (no cache)
- Second load should be much faster
- If not, cache is broken

## Need Help?

1. **Copy console output** (right-click → Save as...)
2. **Take screenshot** of performance summary
3. **Note the bottleneck** step and time
4. **Check Network tab** for slow resources
5. **Share with team** for analysis

