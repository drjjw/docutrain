# Performance Logging Output Example

## Sample Console Output

Here's what you'll see in the browser console when loading a document:

```
═══════════════════════════════════════════════════════════
🚀 PAGE LOAD STARTED
═══════════════════════════════════════════════════════════
⏱️  Start Time: 2025-10-27T14:23:45.123Z
📍 Location: http://localhost:3456/chat?doc=smh

[STEP 1/10] 🎨 Preloading logos...
🎨 Logo preloading optimized - loading on-demand
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
      ┌─ loadDocuments() started
      │  → Force refresh: true
      │  → Loading specific document(s): smh
      │  ✓ Using cached documents (age: 0.1s, 0.45ms)
      └─ loadDocuments() completed (from cache) in 0.67ms
    │     Configs fetched (1.23ms)
    │  → Valid configs: 1/1
    │  → Primary config: smh - SMH Housestaff Manual
    │  → Updating logo for owner: ukidney
    │     Logo config retrieved (12.34ms): {logo: "/logos/ukidney-logo.svg", ...}
    │     Logo elements found: img=true, link=true
    │     Logo processing complete (23.45ms)
    │  → Processing document cover and welcome message...
    │     Loading cover image: https://example.com/cover.jpg
    │     ✓ Cover image loaded (156.78ms)
    │     Container heights equalized (2.34ms)
    │     Cover image layout displayed: https://example.com/cover.jpg
    │     Cover/welcome processing complete (162.34ms)
    │  ✓ Document set to: SMH - SMH Housestaff Manual
    └─ updateDocumentUI() completed in 189.23ms
  │     Document UI updated (189.45ms)
  └─ initializeDocument() completed in 245.67ms
✓ Document initialized in 245.67ms

[STEP 4/10] 🔬 Initializing PubMed popup...
✓ PubMed popup initialized in 0.89ms

[STEP 5/10] 💡 Initializing AI hint...
✓ AI hint initialized in 1.23ms

[STEP 6/10] 👤 Initializing user menu...
✓ User menu initialized in 34.56ms

[STEP 7/10] 📱 Initializing mobile menu...
✓ Mobile menu initialized in 5.67ms

[STEP 8/10] 🏥 Running health check...
  → Server health check - RAG-only mode active
✓ Health check completed in 0.12ms

[STEP 9/10] ⚠️  Checking disclaimer requirements...
  → UKidney document detected, showing disclaimer if needed
✓ Disclaimer check completed in 12.34ms

[STEP 10/10] 🎯 Final setup...
  → Focusing message input
  → Updating user menu visibility
✓ Final setup completed in 2.34ms

═══════════════════════════════════════════════════════════
✅ PAGE LOAD COMPLETE
═══════════════════════════════════════════════════════════
⏱️  Performance Summary:
  Step 1 (Logos):         1.23ms (0.4%)
  Step 2 (Access):        12.34ms (3.8%)
  Step 3 (Document):      245.67ms (75.5%)
  Step 4 (PubMed):        0.89ms (0.3%)
  Step 5 (AI Hint):       1.23ms (0.4%)
  Step 6 (User Menu):     34.56ms (10.6%)
  Step 7 (Mobile Menu):   5.67ms (1.7%)
  Step 8 (Health Check):  0.12ms (0.0%)
  Step 9 (Disclaimer):    12.34ms (3.8%)
  Step 10 (Final Setup):  2.34ms (0.7%)
  ─────────────────────────────────────────────────────────
  🏁 TOTAL TIME:          325.39ms

💡 Performance Tips:
  • Open DevTools → Performance tab to see detailed timeline
  • Look for "total-page-load" measure in User Timing
  • Check Network tab for slow resource loads
  • Bottlenecks are highlighted above with percentages

⚠️  BOTTLENECK DETECTED: Document took 245.67ms (75.5%)
═══════════════════════════════════════════════════════════
```

## Interpreting This Output

### 1. **Overall Performance: 325ms**
This is acceptable performance. The page loaded in under half a second.

### 2. **Bottleneck Identified: Document (75.5%)**
Step 3 (Document initialization) took 245ms, which is 75.5% of total time.

### 3. **Drilling Down into the Bottleneck**
Looking at the nested logs under Step 3:
- Document validation: 54.56ms (22% of step 3)
- Document UI update: 189.45ms (77% of step 3)
  - Cover image loading: 156.78ms (64% of UI update)
  - Logo processing: 23.45ms (10% of UI update)

### 4. **Root Cause: Cover Image**
The cover image took 156ms to load, which is the primary bottleneck.

### 5. **Optimization Opportunities**

**Immediate Wins:**
1. **Optimize cover image**: Compress or resize the image
2. **Use lazy loading**: Load cover image after initial render
3. **Preload critical images**: Add `<link rel="preload">` for cover

**Future Improvements:**
1. **Cache images**: Use service worker or CDN caching
2. **Responsive images**: Serve smaller images on mobile
3. **Progressive loading**: Show low-res placeholder first

## Fast Load Example (Cached)

When the page is loaded a second time with cache:

```
═══════════════════════════════════════════════════════════
🚀 PAGE LOAD STARTED
═══════════════════════════════════════════════════════════
⏱️  Start Time: 2025-10-27T14:24:15.456Z
📍 Location: http://localhost:3456/chat?doc=smh

[STEP 1/10] 🎨 Preloading logos...
✓ Logos preloaded in 0.89ms

[STEP 2/10] 🔒 Checking document access...
  → Access granted for all documents
✓ Access check completed in 8.90ms

[STEP 3/10] 📄 Initializing document...
  ┌─ initializeDocument() started
  │  → Starting document validation...
      ┌─ loadDocuments() started
      │  ✓ Using cached documents (age: 30.5s, 0.34ms)
      └─ loadDocuments() completed (from cache) in 0.56ms
  │       ✓ Validated: smh (1.23ms)
  │  → Updating document UI...
    ┌─ updateDocumentUI() started
    │  → Fetching document configs...
      │  ✓ Using cached documents (age: 30.5s, 0.23ms)
    │     Configs fetched (0.45ms)
    │     Loading cover image: https://example.com/cover.jpg
    │     ✓ Cover image loaded (45.67ms)  ← Much faster (cached)
    └─ updateDocumentUI() completed in 67.89ms
  └─ initializeDocument() completed in 78.90ms
✓ Document initialized in 78.90ms

[Steps 4-10 omitted for brevity...]

═══════════════════════════════════════════════════════════
✅ PAGE LOAD COMPLETE
═══════════════════════════════════════════════════════════
⏱️  Performance Summary:
  Step 1 (Logos):         0.89ms (0.7%)
  Step 2 (Access):        8.90ms (7.1%)
  Step 3 (Document):      78.90ms (63.1%)  ← Much faster!
  Step 4 (PubMed):        0.67ms (0.5%)
  Step 5 (AI Hint):       0.89ms (0.7%)
  Step 6 (User Menu):     23.45ms (18.7%)
  Step 7 (Mobile Menu):   4.56ms (3.6%)
  Step 8 (Health Check):  0.09ms (0.1%)
  Step 9 (Disclaimer):    8.90ms (7.1%)
  Step 10 (Final Setup):  1.89ms (1.5%)
  ─────────────────────────────────────────────────────────
  🏁 TOTAL TIME:          125.14ms  ← 2.6x faster!

💡 Performance Tips:
  • Open DevTools → Performance tab to see detailed timeline
  • Look for "total-page-load" measure in User Timing
  • Check Network tab for slow resource loads
  • Bottlenecks are highlighted above with percentages
═══════════════════════════════════════════════════════════
```

**Key Improvements with Cache:**
- Total time: 325ms → 125ms (2.6x faster)
- Document step: 245ms → 78ms (3.1x faster)
- Cover image: 156ms → 45ms (3.5x faster, browser cache)
- API calls: All served from localStorage cache

## Slow Load Example (Network Issues)

When network is slow or server is under load:

```
[STEP 3/10] 📄 Initializing document...
  ┌─ initializeDocument() started
  │  → Starting document validation...
      ┌─ loadDocuments() started
      │  → Fetching documents from API...
      │     Fetching from: http://localhost:3456/api/documents?doc=smh
      │     Response received: 200 (1234.56ms)  ← SLOW!
      │     JSON parsed (3.45ms)
      │  ✓ Loaded 1 documents from registry
      └─ loadDocuments() completed (from API) in 1245.67ms
  │       ✓ Validated: smh (1246.78ms)
  │  → Updating document UI...
    │     Loading cover image: https://example.com/cover.jpg
    │     ✓ Cover image loaded (567.89ms)  ← SLOW!
    └─ updateDocumentUI() completed in 789.12ms
  └─ initializeDocument() completed in 2045.67ms
✓ Document initialized in 2045.67ms

═══════════════════════════════════════════════════════════
⏱️  Performance Summary:
  Step 3 (Document):      2045.67ms (92.3%)  ← MAJOR BOTTLENECK
  🏁 TOTAL TIME:          2216.78ms

⚠️  BOTTLENECK DETECTED: Document took 2045.67ms (92.3%)
═══════════════════════════════════════════════════════════
```

**Issues Identified:**
1. API response: 1234ms (should be < 100ms)
2. Cover image: 567ms (should be < 200ms)
3. Total load: 2.2 seconds (unacceptable)

**Actions to Take:**
1. Check server logs for slow database queries
2. Verify network connection
3. Check if CDN is working for images
4. Consider showing loading skeleton while data loads

