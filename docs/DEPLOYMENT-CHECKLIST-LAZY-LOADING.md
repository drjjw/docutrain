# Deployment Checklist: Lazy Loading Optimization

**Feature:** Lazy Loading for Document Registry  
**Date:** October 22, 2025  
**Status:** Ready for Deployment

---

## Pre-Deployment Checklist

### 1. Code Review
- [x] Backend changes reviewed (`lib/routes/documents.js`)
- [x] Frontend changes reviewed (`public/js/document-selector.js`, `public/js/config.js`)
- [x] No linting errors
- [x] Backward compatibility verified
- [x] Error handling implemented

### 2. Testing
- [ ] Run automated test suite: `./tests/test-lazy-loading.sh`
- [ ] Test single document: `?doc=smh`
- [ ] Test multi-document: `?doc=smh+uhn`
- [ ] Test owner mode: `?owner=ukidney`
- [ ] Test default (no params)
- [ ] Test error cases (invalid slug)
- [ ] Test on mobile device
- [ ] Test with slow network (throttling)

### 3. Build & Verify
- [x] Build completed: `npm run build`
- [ ] Verify dist/ folder has updated files
- [ ] Check file hashes changed for modified files
- [ ] Verify no build errors

---

## Deployment Steps

### Step 1: Backup Current State
```bash
# On server
cd /path/to/production
cp -r dist dist-backup-$(date +%Y%m%d-%H%M%S)
```

### Step 2: Deploy New Build
```bash
# From local machine
cd /Users/jordanweinstein/GitHub/chat
npm run build

# Copy dist/ to server
rsync -avz --delete dist/ user@server:/path/to/production/dist/

# Or use your existing deployment script
./deploy.sh
```

### Step 3: Restart Server
```bash
# On server
cd /path/to/production/dist
pm2 restart ecosystem.config.js

# Verify server started
pm2 status
pm2 logs --lines 50
```

### Step 4: Verify Deployment
```bash
# Check server is responding
curl https://your-domain.com/api/health

# Test filtered endpoint
curl https://your-domain.com/api/documents?doc=smh | jq '.documents | length'
# Should return: 1

# Test owner endpoint
curl https://your-domain.com/api/documents?owner=ukidney | jq '.documents | length'
# Should return: 10+
```

---

## Post-Deployment Verification

### 1. Functional Tests
- [ ] Visit `/?doc=smh` - verify page loads
- [ ] Visit `/?owner=ukidney` - verify document selector shows
- [ ] Check browser Network tab - verify response size ~1-10 KB (not 100 KB)
- [ ] Check browser Console - verify no errors
- [ ] Test document switching in selector
- [ ] Test multi-document: `/?doc=smh+uhn`

### 2. Performance Tests
- [ ] Check API response time (should be <200ms)
- [ ] Check page load time (should be <2s)
- [ ] Check memory usage in browser DevTools
- [ ] Test on mobile device
- [ ] Test with slow 3G network

### 3. Cache Verification
- [ ] Open browser DevTools → Application → Local Storage
- [ ] Verify cache keys are context-specific:
  - `ukidney-documents-cache-v3-doc-smh`
  - `ukidney-documents-cache-v3-owner-ukidney`
- [ ] Verify cache expires after 5 minutes
- [ ] Test cache refresh: `localStorage.clear()` and reload

### 4. Error Handling
- [ ] Test invalid document: `/?doc=invalid` (should show error)
- [ ] Test invalid owner: `/?owner=invalid` (should show error)
- [ ] Test network error (disconnect and reload)
- [ ] Verify fallback configuration works

---

## Rollback Plan

If issues are detected:

### Quick Rollback
```bash
# On server
cd /path/to/production
rm -rf dist
mv dist-backup-YYYYMMDD-HHMMSS dist
pm2 restart ecosystem.config.js
```

### Clear Client Caches
```javascript
// Ask users to run in browser console
localStorage.clear()
location.reload()
```

---

## Monitoring

### Server Logs
```bash
# Watch logs for errors
pm2 logs --lines 100

# Look for:
# ✓ "Returned X document(s) for doc=..."
# ✓ "Returned X documents for owner=..."
# ❌ Any error messages
```

### Performance Metrics
Monitor these metrics for 24-48 hours:
- API response times (should decrease)
- Server memory usage (should decrease)
- Error rates (should remain low)
- User complaints (should decrease)

### Key Indicators of Success
- ✅ API responses <100ms (was 200-500ms)
- ✅ Response sizes 1-10 KB (was 100 KB)
- ✅ No increase in error rates
- ✅ Faster page loads reported by users

---

## User Communication

### If Announcing Feature
```
📢 Performance Improvement

We've optimized document loading for faster page loads:
- 5x faster initial load time
- 99% reduction in data transfer
- Better mobile experience

If you experience any issues, please clear your browser cache:
1. Open browser console (F12)
2. Type: localStorage.clear()
3. Reload the page

Questions? Contact support@example.com
```

### If Silent Deployment
No announcement needed - this is a transparent performance improvement.

---

## Success Criteria

Deployment is successful if:
- ✅ All functional tests pass
- ✅ API response size reduced by 90%+
- ✅ Page load time reduced by 50%+
- ✅ No increase in error rates
- ✅ No user complaints
- ✅ Server logs show filtered responses

---

## Documentation Links

- **Summary:** `LAZY-LOADING-SUMMARY.md`
- **Quick Reference:** `docs/LAZY-LOADING-QUICK-REFERENCE.md`
- **Performance Comparison:** `docs/PERFORMANCE-COMPARISON.md`
- **Architecture:** `docs/LAZY-LOADING-DIAGRAM.md`
- **Full Details:** `docs/LAZY-LOADING-OPTIMIZATION.md`
- **Test Script:** `tests/test-lazy-loading.sh`

---

## Contact

**Developer:** [Your Name]  
**Date:** October 22, 2025  
**Deployment Window:** [Specify time]  
**Rollback Deadline:** [Specify time]

---

## Sign-Off

- [ ] Code reviewed and approved
- [ ] Tests passed locally
- [ ] Documentation complete
- [ ] Deployment plan reviewed
- [ ] Rollback plan tested
- [ ] Monitoring plan in place
- [ ] Ready for production deployment

**Approved by:** ________________  
**Date:** ________________

