# Cache Management Guide

**Last Updated:** October 20, 2025

## Overview

The application uses multiple cache layers to optimize performance and reduce database queries. Understanding these caches is essential when updating content like intro messages, document configurations, or owner settings.

## Cache Layers

### 1. Server-Side Document Registry Cache

**Location:** `lib/document-registry.js`

**Configuration:**
```javascript
documentCache = {
    documents: [],
    lastUpdated: null,
    ttl: 5 * 60 * 1000  // 5 minutes
}
```

**Behavior:**
- Caches all active documents from the database
- Includes owner information (joined data)
- Auto-refreshes every 2 minutes via background job
- Manually refreshable via API endpoint

**When It Updates:**
- Automatically every 2 minutes (background job)
- On server startup
- When `/api/refresh-registry` is called
- After 5 minutes of staleness if database query fails

**How to Force Refresh:**
```bash
# Local
curl -X POST http://localhost:3456/api/refresh-registry

# Production
curl -X POST https://your-domain.com/api/refresh-registry
```

**Response:**
```json
{
  "success": true,
  "message": "Document registry cache cleared and refreshed",
  "documentCount": 121
}
```

---

### 2. Browser localStorage Cache (Documents)

**Location:** `public/js/config.js`

**Configuration:**
```javascript
const CACHE_KEY = 'ukidney-documents-cache-v2';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
```

**What's Cached:**
- Complete document configurations
- Intro messages (sanitized HTML)
- Owner information
- Document metadata

**Cache Structure:**
```javascript
{
  "documents": [...],
  "timestamp": 1729436400000
}
```

**When It Updates:**
- Automatically expires after 5 minutes
- On page load if cache is expired
- When `clearDocumentCache()` is called
- When cache version changes

**How to Clear (User):**
```javascript
// In browser console
localStorage.removeItem('ukidney-documents-cache-v2');
```

**How to Clear (Developer):**
```javascript
// In code
import { clearDocumentCache } from './config.js';
clearDocumentCache();
```

---

### 3. Browser localStorage Cache (Owner Logos)

**Location:** `public/js/config.js`

**Configuration:**
```javascript
const OWNER_LOGO_CACHE_KEY = 'owner-logo-config-cache-v3';
const OWNER_LOGO_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
```

**What's Cached:**
- Owner logo URLs
- Accent colors
- Owner names and links

**When It Updates:**
- Automatically expires after 10 minutes
- On page load if cache is expired
- When cache version changes

---

### 4. Browser HTTP Cache

**Controlled By:** Browser and server headers

**Affects:**
- JavaScript files
- CSS files
- Images

**How to Clear:**
- Hard refresh: `Cmd + Shift + R` (Mac) or `Ctrl + Shift + R` (Windows)
- Clear browser cache in settings
- Incognito/Private mode bypasses cache

---

## Content Update Workflows

### Updating Intro Messages

**Scenario:** You've updated an intro message in the database and want users to see it.

#### Option A: Wait for Automatic Expiration ⏰

**Timeline:**
1. Update database (immediate)
2. Server cache refreshes (within 2 minutes - auto job)
3. Browser cache expires (5 minutes from user's last fetch)

**Total Wait:** 5-7 minutes maximum

**Steps:**
```sql
-- 1. Update the database
UPDATE documents 
SET intro_message = '<h2>New Intro</h2>...'
WHERE slug = 'document-slug';

-- 2. Wait 5-7 minutes
-- 3. Users see changes automatically
```

**Pros:**
- No code changes required
- No deployment needed
- Automatic

**Cons:**
- Not immediate
- Different users see changes at different times

---

#### Option B: Force Immediate Update 🚀

**Timeline:**
1. Update database (immediate)
2. Force server refresh (immediate)
3. Bump cache version (immediate after deployment)
4. Users see changes on next page load

**Steps:**
```sql
-- 1. Update the database
UPDATE documents 
SET intro_message = '<h2>New Intro</h2>...'
WHERE slug = 'document-slug';
```

```bash
# 2. Force server cache refresh
curl -X POST http://localhost:3456/api/refresh-registry
```

```javascript
// 3. Bump cache version in public/js/config.js
const CACHE_KEY = 'ukidney-documents-cache-v3'; // v2 → v3
```

```bash
# 4. Deploy the change
git add public/js/config.js dist/public/js/config.js
git commit -m "Bump cache version for intro message updates"
git push
```

**Pros:**
- Immediate for all users
- Controlled rollout
- No waiting

**Cons:**
- Requires code change
- Requires deployment
- Need to remember to bump version

---

#### Option C: Reduce Cache TTL ⚡

**For frequently changing content**, reduce the TTL permanently:

```javascript
// In public/js/config.js
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes instead of 5
```

**Pros:**
- Faster automatic updates
- No manual intervention needed

**Cons:**
- More API calls
- Slightly higher server load
- Still not immediate

---

### Updating Owner Settings

**Scenario:** You've updated owner logo, accent color, or default intro message.

**Same workflow as above**, but note:
- Owner logo cache has 10-minute TTL (longer)
- Owner logo cache is already versioned (`v3`)
- To force update: increment `OWNER_LOGO_CACHE_KEY` version

```javascript
// In public/js/config.js
const OWNER_LOGO_CACHE_KEY = 'owner-logo-config-cache-v4'; // v3 → v4
```

---

## Cache Version Management

### When to Bump Cache Version

**Always bump version for:**
- ✅ New intro messages for multiple documents
- ✅ Major content updates
- ✅ Owner branding changes
- ✅ Document structure changes

**Don't bump version for:**
- ❌ Minor text edits (wait for expiration)
- ❌ Testing changes (use force refresh)
- ❌ Single document updates (wait for expiration)

### Version Naming Convention

Use incremental integers:
```javascript
// Documents
'ukidney-documents-cache-v1'  // Initial
'ukidney-documents-cache-v2'  // First update
'ukidney-documents-cache-v3'  // Second update

// Owner logos
'owner-logo-config-cache-v3'  // Current
'owner-logo-config-cache-v4'  // Next update
```

### Where to Update Versions

**Both locations must be updated:**
1. `/public/js/config.js` (source)
2. `/dist/public/js/config.js` (production)

**Or use build script** to sync automatically.

---

## Testing Cache Changes

### Test Locally

```bash
# 1. Start server
npm start

# 2. Make database change
# (use Supabase SQL editor or MCP)

# 3. Force server refresh
curl -X POST http://localhost:3456/api/refresh-registry

# 4. Clear browser cache
# In browser console:
localStorage.clear()

# 5. Hard refresh browser
# Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)

# 6. Verify changes appear
```

### Test Cache Expiration

```javascript
// In browser console

// Check cache age
const cached = localStorage.getItem('ukidney-documents-cache-v2');
if (cached) {
    const { timestamp } = JSON.parse(cached);
    const ageMinutes = (Date.now() - timestamp) / 1000 / 60;
    console.log(`Cache age: ${ageMinutes.toFixed(1)} minutes`);
}

// Force cache to expire (for testing)
const cached = localStorage.getItem('ukidney-documents-cache-v2');
if (cached) {
    const data = JSON.parse(cached);
    data.timestamp = Date.now() - (10 * 60 * 1000); // 10 minutes ago
    localStorage.setItem('ukidney-documents-cache-v2', JSON.stringify(data));
}
```

---

## Troubleshooting

### Problem: Changes Not Showing

**Check each cache layer:**

```bash
# 1. Verify database has the change
# Use Supabase SQL editor

# 2. Check server cache
curl -s http://localhost:3456/api/documents | jq '.documents[] | select(.slug == "your-slug")'

# 3. Force server refresh
curl -X POST http://localhost:3456/api/refresh-registry

# 4. Clear browser cache
localStorage.clear()

# 5. Hard refresh browser
# Cmd+Shift+R or Ctrl+Shift+R
```

### Problem: Some Users See Changes, Others Don't

**Cause:** Browser cache timing differences

**Solutions:**
1. Bump cache version (forces all users to refresh)
2. Wait for all caches to expire (5-7 minutes)
3. Communicate to users: "Please refresh your browser"

### Problem: Server Cache Not Refreshing

**Check background job:**
```bash
# Look for this in server logs
"✓ Registry auto-refresh enabled (every 120s)"
"🔄 Auto-refreshing document registry..."
"✓ Registry auto-refreshed: 121 active documents"
```

**If not running:**
- Restart server
- Check for errors in logs
- Verify database connection

---

## Production Deployment Checklist

When deploying intro message changes:

- [ ] Update database (intro messages)
- [ ] Force server cache refresh via API
- [ ] Decide: wait or bump version?
- [ ] If bumping: update both `config.js` files
- [ ] Test locally first
- [ ] Deploy to production
- [ ] Verify changes appear
- [ ] Monitor for errors

---

## API Endpoints

### Refresh Document Registry

```bash
POST /api/refresh-registry
```

**Response:**
```json
{
  "success": true,
  "message": "Document registry cache cleared and refreshed",
  "documentCount": 121
}
```

### Get Documents (with cache)

```bash
GET /api/documents
```

**Response:**
```json
{
  "documents": [
    {
      "slug": "smh",
      "title": "SMH Nephrology Manual",
      "introMessage": "<h2>Welcome...</h2>",
      ...
    }
  ]
}
```

---

## Configuration Reference

### Current Cache Settings

**Documents:**
- Key: `ukidney-documents-cache-v2`
- TTL: 5 minutes
- Auto-refresh: Every 2 minutes

**Owner Logos:**
- Key: `owner-logo-config-cache-v3`
- TTL: 10 minutes
- No auto-refresh (only on expiration)

**Server Registry:**
- TTL: 5 minutes
- Auto-refresh: Every 2 minutes
- Background job: Active

---

## Best Practices

1. **For urgent updates:** Bump cache version
2. **For minor updates:** Wait for expiration
3. **Always test locally** before production
4. **Update both source and dist** when changing config
5. **Document version bumps** in commit messages
6. **Monitor server logs** after deployments
7. **Communicate with users** for major changes

---

## Related Documentation

- [HTML Intro Messages Feature](./HTML-INTRO-MESSAGES-FEATURE.md)
- [HTML Intro Messages Quickstart](./HTML-INTRO-MESSAGES-QUICKSTART.md)
- [Deployment Guide](./DEPLOYMENT-REFACTORED-APP.md)

---

**For questions or issues, check server logs or use the troubleshooting section above.**



