# Performance Logging System

## Overview

A comprehensive console logging system has been added to track document rendering performance from page load to completion. This helps identify bottlenecks in the rendering pipeline.

## Features

### 1. **Hierarchical Logging Structure**
The logging uses a tree-like structure with visual indicators:
- `┌─` Start of a function
- `│` Continuation within a function
- `└─` End of a function
- `→` Action being performed
- `✓` Success
- `❌` Error
- `⚠️` Warning

### 2. **Performance Timing**
Every major operation is timed using `performance.now()` with millisecond precision:
```javascript
const start = performance.now();
// ... operation ...
const elapsed = performance.now() - start;
console.log(`✓ Operation completed in ${elapsed.toFixed(2)}ms`);
```

### 3. **10-Step Page Load Tracking**

The main initialization is broken into 10 tracked steps:

1. **Logos** - Preloading owner logos and setting accent colors
2. **Access** - Checking document access permissions
3. **Document** - Initializing and validating document configuration
4. **PubMed** - Setting up PubMed popup functionality
5. **AI Hint** - Initializing AI hint messages
6. **User Menu** - Loading user avatar and menu
7. **Mobile Menu** - Setting up mobile navigation
8. **Health Check** - Verifying server connectivity
9. **Disclaimer** - Showing disclaimers if needed
10. **Final Setup** - Focus input and final UI updates

### 4. **Nested Function Tracking**

Sub-functions are tracked with deeper indentation:
```
[STEP 3/10] 📄 Initializing document...
  ┌─ initializeDocument() started
  │  → Parsing URL parameters...
  │  → Starting document validation...
  │     Config module imported (2.34ms)
  │       ✓ Validated: smh (45.67ms)
  │  → Updating document UI...
  │     Document UI updated (123.45ms)
  └─ initializeDocument() completed in 234.56ms
✓ Document initialized in 234.56ms
```

### 5. **Performance Summary**

At the end of page load, a comprehensive summary is displayed:

```
═══════════════════════════════════════════════════════════
✅ PAGE LOAD COMPLETE
═══════════════════════════════════════════════════════════
⏱️  Performance Summary:
  Step 1 (Logos):         12.34ms (5.2%)
  Step 2 (Access):        23.45ms (9.8%)
  Step 3 (Document):      156.78ms (65.4%)  ← BOTTLENECK
  Step 4 (PubMed):        1.23ms (0.5%)
  Step 5 (AI Hint):       2.34ms (1.0%)
  Step 6 (User Menu):     34.56ms (14.4%)
  Step 7 (Mobile Menu):   5.67ms (2.4%)
  Step 8 (Health Check):  0.12ms (0.1%)
  Step 9 (Disclaimer):    1.23ms (0.5%)
  Step 10 (Final Setup):  2.34ms (1.0%)
  ─────────────────────────────────────────────────────────
  🏁 TOTAL TIME:          240.06ms

💡 Performance Tips:
  • Open DevTools → Performance tab to see detailed timeline
  • Look for "total-page-load" measure in User Timing
  • Check Network tab for slow resource loads
  • Bottlenecks are highlighted above with percentages

⚠️  BOTTLENECK DETECTED: Document took 156.78ms (65.4%)
═══════════════════════════════════════════════════════════
```

### 6. **Browser DevTools Integration**

Performance marks and measures are created for use in Chrome/Firefox DevTools:
```javascript
performance.mark('page-load-start');
// ... operations ...
performance.mark('page-load-end');
performance.measure('total-page-load', 'page-load-start', 'page-load-end');
```

View these in DevTools:
1. Open DevTools (F12)
2. Go to Performance tab
3. Record a page load
4. Look for "User Timing" section in the timeline

## Key Files Modified

### 1. `/public/js/main.js`
- Main initialization tracking
- 10-step page load breakdown
- Performance summary generation
- Bottleneck detection

### 2. `/public/js/ui-document.js`
- Document UI rendering tracking
- Cover image load timing
- Logo configuration timing
- Welcome message processing

### 3. `/public/js/config.js`
- Document loading from API/cache
- Cache hit/miss tracking
- API request timing
- JSON parsing performance

## Usage

### Viewing Logs

Simply open the browser console when loading a document page. You'll see:
1. Initial page load banner with timestamp and URL
2. Step-by-step progress through initialization
3. Nested function calls with timing
4. Final summary with bottleneck analysis

### Interpreting Results

**Fast Load (< 200ms total)**
- All steps should complete quickly
- No bottleneck warnings

**Moderate Load (200-500ms total)**
- Look for steps taking > 30% of total time
- Check Network tab for slow API calls
- Verify cache is working (should see "Using cached documents")

**Slow Load (> 500ms total)**
- Bottleneck warning will appear
- Focus on the slowest step
- Common culprits:
  - Document API fetch (Step 3)
  - Cover image loading (Step 3)
  - User menu/permissions (Step 6)

### Common Bottlenecks

1. **Document Loading (Step 3)**
   - **Cause**: API fetch or cache miss
   - **Solution**: Ensure cache is working, check network speed
   - **Expected**: < 100ms with cache, < 300ms without

2. **Cover Image Loading**
   - **Cause**: Large image file or slow CDN
   - **Solution**: Optimize image size, use CDN
   - **Expected**: < 200ms for typical images

3. **User Menu (Step 6)**
   - **Cause**: Permissions API call
   - **Solution**: Cache permissions, optimize query
   - **Expected**: < 50ms with cache

## Performance Targets

### Optimal Performance
- **Total Load**: < 200ms
- **Document Init**: < 100ms
- **Image Load**: < 150ms
- **No step > 30%** of total time

### Acceptable Performance
- **Total Load**: < 500ms
- **Document Init**: < 300ms
- **Image Load**: < 300ms
- **No step > 50%** of total time

### Needs Optimization
- **Total Load**: > 500ms
- **Document Init**: > 300ms
- **Any step > 50%** of total time

## Debugging Tips

### 1. Enable Verbose Logging
All logging is already enabled. To see more detail:
- Check nested function calls (indented lines)
- Look for timing after each operation

### 2. Compare Cached vs Uncached
- **First load**: Will be slower (no cache)
- **Second load**: Should be much faster (cache hit)
- If second load is still slow, cache isn't working

### 3. Check Network Tab
- Look for slow API requests
- Check image load times
- Verify resources are cached (304 status)

### 4. Use Performance Tab
- Record a page load
- Look for long tasks
- Check User Timing marks
- Analyze main thread activity

### 5. Test on Different Networks
- Fast WiFi: Should be < 200ms
- 3G: May be 500-1000ms
- Offline: Should fail gracefully with fallback

## Future Enhancements

Potential improvements to the logging system:

1. **Configurable Log Levels** (Future Enhancement)
   - Currently: `?debug=true` or `?debug=verbose` enables all debug logs (simple on/off)
   - Future: Add `?debug=quiet` for summary only, `?debug=verbose` for detailed logs
   - See [DEBUG-URL-PARAMETER.md](../api-docs/DEBUG-URL-PARAMETER.md) for current implementation

2. **Performance Metrics Export**
   - Export timing data to analytics
   - Track performance over time
   - Alert on regressions

3. **Visual Performance Graph**
   - Show waterfall chart in console
   - Color-code by performance
   - Highlight bottlenecks visually

4. **Real User Monitoring**
   - Send performance data to server
   - Track 95th percentile load times
   - Monitor by device/browser/network

## Notes

- All timing uses `performance.now()` for high precision
- Logs are only visible in development (console)
- Production builds include same logging (helps debug user issues)
- No performance impact when console is closed
- Logs are structured for easy parsing/analysis

