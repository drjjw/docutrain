# Cache Management - Quick Reference

## TL;DR

**After updating intro messages in database:**

### Option 1: Wait (Easiest)
```bash
# Do nothing - changes appear in 5-7 minutes automatically
```

### Option 2: Force Immediate Update
```bash
# 1. Force server refresh
curl -X POST http://localhost:3456/api/refresh-registry

# 2. Bump cache version in public/js/config.js
# Change: 'ukidney-documents-cache-v2' → 'ukidney-documents-cache-v3'

# 3. Deploy
```

---

## Cache Layers Cheat Sheet

| Layer | TTL | Auto-Refresh | Manual Refresh |
|-------|-----|--------------|----------------|
| Server Registry | 5 min | Every 2 min | `/api/refresh-registry` |
| Browser Documents | 5 min | On expiry | Clear localStorage or bump version |
| Browser Logos | 10 min | On expiry | Bump version |
| HTTP Cache | Browser | On expiry | Hard refresh (Cmd+Shift+R) |

---

## Common Commands

### Force Server Refresh
```bash
curl -X POST http://localhost:3456/api/refresh-registry
```

### Clear Browser Cache (User)
```javascript
// In browser console
localStorage.removeItem('ukidney-documents-cache-v2');
location.reload();
```

### Check Cache Age (Debug)
```javascript
const cached = localStorage.getItem('ukidney-documents-cache-v2');
if (cached) {
    const { timestamp } = JSON.parse(cached);
    const ageMin = (Date.now() - timestamp) / 1000 / 60;
    console.log(`Cache age: ${ageMin.toFixed(1)} minutes`);
}
```

### Verify API Response
```bash
curl -s http://localhost:3456/api/documents | \
  jq '.documents[] | select(.slug == "smh") | .introMessage'
```

---

## Version Bumping

### When to Bump
- ✅ Multiple intro message updates
- ✅ Major content changes
- ✅ Immediate rollout needed
- ❌ Minor edits (just wait)
- ❌ Testing (use force refresh)

### How to Bump
```javascript
// In public/js/config.js (line 14)
const CACHE_KEY = 'ukidney-documents-cache-v3'; // Increment number

// Also update dist/public/js/config.js
```

---

## Troubleshooting One-Liners

```bash
# Check if database has your change
echo "SELECT intro_message FROM documents WHERE slug = 'your-slug';" | psql

# Check if server has your change
curl -s http://localhost:3456/api/documents | jq '.documents[] | select(.slug == "your-slug")'

# Force everything to refresh
curl -X POST http://localhost:3456/api/refresh-registry && \
  echo "localStorage.clear(); location.reload();" && \
  echo "Run the above in browser console"
```

---

## Full Documentation

For detailed information, see [Cache Management Guide](./CACHE-MANAGEMENT.md)



