# Cache Busting Strategy - Document Registry

## Overview

The application uses a two-tier caching system for document metadata (titles, subtitles, configuration). This document outlines the current system, identifies the cache invalidation challenge, and proposes solutions for immediate updates when document metadata changes in the database.

## Current Caching Architecture

### 1. Backend Cache (Server-side)
- **Location**: `lib/document-registry.js` in-memory cache
- **TTL**: 5 minutes
- **Auto-refresh**: Every 2 minutes via `initializeRegistryAutoRefresh()`
- **Manual refresh**: `POST /api/refresh-registry` endpoint
- **Scope**: Server-wide (affects all users immediately after refresh)

### 2. Frontend Cache (Client-side)
- **Location**: Browser `localStorage` with key `ukidney-documents-cache`
- **TTL**: 5 minutes
- **Refresh**: Only on cache expiration or manual clear
- **Scope**: Per-browser (each user maintains their own cache)

## The Problem

When a document's metadata (e.g., title) is updated in Supabase:

1. ✅ Backend cache can be refreshed immediately via `POST /api/refresh-registry`
2. ❌ Frontend caches remain stale until TTL expires (up to 5 minutes)
3. 👥 **Impact**: Users must wait 5 minutes OR manually clear localStorage to see changes

### Current Workaround

Users can manually refresh by running in browser console:
```javascript
localStorage.removeItem('ukidney-documents-cache');
location.reload();
```

## Proposed Solutions

### Option 1: Accept Current Behavior ✅ (Easiest)

**Description**: Document the 5-minute propagation delay and treat it as acceptable latency.

**Pros**:
- No code changes required
- Minimizes API calls
- Simple to understand

**Cons**:
- Up to 5-minute delay for metadata changes
- Manual refresh required for immediate updates

**Best for**: Low-frequency metadata updates, non-critical title changes

**Implementation**: None required

---

### Option 2: Version-Based Cache Invalidation 🎯 (Recommended)

**Description**: Add a cache version timestamp to the API response. Frontend checks version on load and invalidates cache if version has changed.

**How it works**:
1. Backend maintains `registryCacheVersion` timestamp
2. Version bumps when registry is refreshed
3. Frontend compares cached version with API version
4. Auto-refreshes if versions don't match

**Pros**:
- Automatic invalidation when backend updates
- Lightweight (single version field)
- No user intervention required
- Graceful fallback if version check fails

**Cons**:
- Requires code changes in backend and frontend
- Adds one extra API call on page load (for version check)

**Implementation**:

#### Backend Changes (`server.js`)

```javascript
// Add near line 975 with other tracking variables
let registryCacheVersion = Date.now();

// Update refresh endpoint (around line 800)
app.post('/api/refresh-registry', async (req, res) => {
    try {
        console.log('🔄 Forcing document registry refresh...');
        await documentRegistry.refreshRegistry();
        activeDocumentSlugs = await documentRegistry.getActiveSlugs();
        
        // Bump cache version to invalidate frontend caches
        registryCacheVersion = Date.now();
        
        console.log('✅ Document registry refreshed successfully');
        
        res.json({
            success: true,
            message: 'Document registry cache cleared and refreshed',
            documentCount: activeDocumentSlugs.length,
            cacheVersion: registryCacheVersion
        });
    } catch (error) {
        console.error('Registry refresh error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to refresh document registry',
            error: error.message
        });
    }
});

// Update documents endpoint (around line 964)
app.get('/api/documents', async (req, res) => {
    try {
        const docs = await documentRegistry.getDocumentsForAPI();
        res.json({ 
            documents: docs,
            cacheVersion: registryCacheVersion
        });
    } catch (error) {
        console.error('Error fetching documents:', error);
        res.status(500).json({ error: 'Failed to fetch documents' });
    }
});

// Also bump version in auto-refresh (around line 985)
setInterval(async () => {
    try {
        console.log('🔄 Auto-refreshing document registry...');
        await documentRegistry.refreshRegistry();
        activeDocumentSlugs = await documentRegistry.getActiveSlugs();
        registryCacheVersion = Date.now(); // Add this line
        console.log(`✓ Registry auto-refreshed: ${activeDocumentSlugs.length} active documents`);
    } catch (error) {
        console.error('❌ Auto-refresh failed:', error.message);
    }
}, REFRESH_INTERVAL);
```

#### Frontend Changes (`public/js/config.js`)

```javascript
// Update loadDocuments function (around line 98)
export async function loadDocuments(forceRefresh = false) {
    try {
        // Check cache first (unless force refresh requested)
        if (!forceRefresh) {
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                const { documents, timestamp, cacheVersion } = JSON.parse(cached);
                const age = Date.now() - timestamp;

                if (age < CACHE_TTL) {
                    // Quick version check to detect backend updates
                    try {
                        const versionCheck = await fetch(`${API_URL}/api/documents`);
                        if (versionCheck.ok) {
                            const versionData = await versionCheck.json();
                            
                            if (versionData.cacheVersion === cacheVersion) {
                                console.log('📦 Using cached documents (version verified)');
                                docConfigCache = documents;
                                return documents;
                            } else {
                                console.log('🔄 Cache version mismatch, refreshing...');
                                // Continue to fetch fresh data below
                            }
                        }
                    } catch (versionError) {
                        // If version check fails, use cache anyway (graceful degradation)
                        console.warn('⚠️  Version check failed, using cache:', versionError.message);
                        docConfigCache = documents;
                        return documents;
                    }
                }
            }
        }
        
        // Fetch from API
        console.log('🔄 Fetching documents from API...');
        const response = await fetch(`${API_URL}/api/documents`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        const documents = {};
        
        // Convert array to object keyed by slug
        data.documents.forEach(doc => {
            documents[doc.slug] = doc;
        });
        
        // Cache the results with version
        localStorage.setItem(CACHE_KEY, JSON.stringify({
            documents,
            timestamp: Date.now(),
            cacheVersion: data.cacheVersion
        }));
        
        docConfigCache = documents;
        console.log(`✓ Loaded ${data.documents.length} documents from registry`);

        return documents;
    } catch (error) {
        console.warn('⚠️  Failed to load documents from API:', error.message);
        console.log('   Using fallback configuration');
        docConfigCache = fallbackDocConfig;
        return fallbackDocConfig;
    }
}
```

**Testing**:
1. Make a title change in Supabase
2. Call `POST /api/refresh-registry`
3. Reload any client page
4. Should see "🔄 Cache version mismatch, refreshing..." in console
5. Title should update immediately

---

### Option 3: Cache Header with ETags 🔧 (More Complex)

**Description**: Use HTTP ETags/Last-Modified headers to leverage browser cache validation.

**Pros**:
- Standard HTTP caching mechanism
- Automatic 304 Not Modified responses

**Cons**:
- More complex to implement
- Requires tracking ETags per document set
- Still relies on localStorage for cross-page persistence

**Implementation**: Not recommended - Option 2 provides similar benefits with less complexity

---

### Option 4: WebSocket/Server-Sent Events 🚀 (Most Advanced)

**Description**: Real-time push notifications when registry updates occur.

**How it works**:
1. Clients subscribe to registry update events
2. Server broadcasts update events when registry changes
3. Clients automatically invalidate cache and refresh

**Pros**:
- True real-time updates
- Zero user-perceived latency
- Best user experience

**Cons**:
- Requires WebSocket/SSE infrastructure
- More complex server architecture
- Overkill for infrequent metadata updates
- Added connection overhead

**Implementation**: Future consideration for real-time features

---

### Option 5: Shorter TTL with Conditional Requests

**Description**: Reduce frontend cache TTL to 1 minute and use If-None-Match headers.

**Pros**:
- Faster propagation than current 5 minutes
- Leverages HTTP standards

**Cons**:
- More frequent API calls
- Still has delay (up to 1 minute)
- Increases server load

**Best for**: High-frequency metadata updates with acceptable 1-min delay

---

### Option 6: Admin Broadcast Invalidation

**Description**: Add an admin endpoint that broadcasts cache invalidation to all connected clients.

**How it works**:
1. Admin calls `/api/broadcast-cache-invalidate`
2. Server sets a "global cache version" in database
3. All clients check this version periodically (e.g., every 30 seconds)

**Pros**:
- Controlled invalidation
- Works across multiple server instances (via database)

**Cons**:
- Requires database storage for version
- Polling overhead
- More complex than Option 2

---

## Comparison Matrix

| Option | Complexity | Update Speed | API Overhead | User Action Required |
|--------|-----------|--------------|--------------|---------------------|
| 1. Current | None | 5 min | Low | Manual clear |
| 2. Version Check | Low | Immediate | Low | None |
| 3. ETags | Medium | Immediate | Low | None |
| 4. WebSocket | High | Real-time | Medium | None |
| 5. Shorter TTL | Low | 1 min | Medium | None |
| 6. Broadcast | Medium | Near-instant | Low-Medium | None |

## Recommendation

**Implement Option 2 (Version-Based Cache Invalidation)** for the best balance of:
- Immediate updates when needed
- Low complexity
- Minimal performance impact
- No user intervention required
- Graceful degradation if version check fails

## Future Considerations

### Phased Rollout
1. **Phase 1**: Implement Option 2 (version checking)
2. **Phase 2**: If real-time features are added later (chat, collaborative editing), upgrade to Option 4 (WebSocket)

### Monitoring
After implementing cache busting, monitor:
- Cache hit/miss rates
- API call frequency per user
- Average update propagation time
- Failed version checks (for graceful degradation stats)

## Implementation Checklist

When implementing Option 2:

### Backend
- [ ] Add `registryCacheVersion` variable
- [ ] Bump version in `/api/refresh-registry` endpoint
- [ ] Bump version in auto-refresh interval
- [ ] Add `cacheVersion` to `/api/documents` response
- [ ] Test version bumping behavior

### Frontend
- [ ] Update localStorage schema to include `cacheVersion`
- [ ] Add version check logic to `loadDocuments()`
- [ ] Test cache invalidation on version mismatch
- [ ] Test graceful degradation if version check fails
- [ ] Add console logging for debugging

### Testing
- [ ] Change document title in Supabase
- [ ] Call `POST /api/refresh-registry`
- [ ] Verify version bump in API response
- [ ] Reload frontend in different browser tabs
- [ ] Confirm immediate title update
- [ ] Test with network offline (graceful degradation)

### Documentation
- [ ] Update API_REFERENCE.md with new response fields
- [ ] Document version checking behavior
- [ ] Add troubleshooting guide for cache issues

## Related Files

- `server.js` - Backend API endpoints and auto-refresh logic
- `lib/document-registry.js` - Server-side registry cache
- `public/js/config.js` - Frontend document loading and caching
- `docs/API_REFERENCE.md` - API documentation

## See Also

- [API Reference](./API_REFERENCE.md) - Current API endpoints
- [Deployment Guide](./DEPLOYMENT.md) - Production deployment considerations
- [Troubleshooting](./TROUBLESHOOTING.md) - Common cache issues

---

**Last Updated**: October 19, 2025  
**Status**: Proposed (not yet implemented)

