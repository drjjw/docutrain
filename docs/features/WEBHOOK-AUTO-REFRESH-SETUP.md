# Webhook Auto-Refresh Setup

## Overview

This document explains how to set up Supabase Database Webhooks to automatically refresh the document registry cache whenever documents are updated in the database.

**Goal**: Zero-delay updates - when you change document metadata in Supabase, the server cache refreshes instantly.

## Why Webhooks (Not Realtime)?

- **Realtime**: For pushing updates to connected browser clients (WebSocket)
- **Webhooks**: For triggering server-side actions when data changes (HTTP POST)

We need webhooks because we want to refresh the **server's cache**, not notify individual browsers.

---

## Setup Instructions

### Step 1: Verify the Refresh Endpoint Works

First, test that the endpoint is accessible:

```bash
# Local testing
curl -X POST http://localhost:3456/api/refresh-registry

# Production testing
curl -X POST https://brightbean.io/api/refresh-registry
```

Expected response:
```json
{
  "success": true,
  "message": "Document registry cache cleared and refreshed",
  "documentCount": 125
}
```

### Step 2: Create Webhook in Supabase Dashboard

1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/mlxctdgnojvkgfqldaob
2. Navigate to **Database** → **Webhooks**
3. Click **Create a new hook**

#### Webhook Configuration

**Name**: `refresh-registry-on-document-change`

**Table**: `documents`

**Events**: Select all that affect metadata:
- ✅ `INSERT` - New documents added
- ✅ `UPDATE` - **ANY column changed** (title, subtitle, pmid, downloads, cover, intro_message, etc.)
- ✅ `DELETE` - Documents removed

**Important**: The UPDATE event triggers on **any column change** in the row, not just specific fields. This means changes to title, subtitle, downloads, pmid, cover, intro_message, metadata, or any other field will all trigger the webhook.

**Type**: `HTTP Request`

**Method**: `POST`

**URL**: 
- **Local**: `http://localhost:3456/api/refresh-registry`
- **Production**: `https://brightbean.io/api/refresh-registry`

**HTTP Headers** (optional but recommended):
```
Content-Type: application/json
X-Webhook-Source: supabase
```

**HTTP Params**: Leave empty (we don't need the payload)

**Timeout**: `5000` ms (5 seconds)

**Enable Hook**: ✅ Yes

### Step 3: Test the Webhook

After creating the webhook, test with different column updates:

1. Go to **SQL Editor** in Supabase
2. Run test updates on various columns:
```sql
-- Test 1: Update subtitle
UPDATE documents 
SET subtitle = 'Test Update - ' || NOW()::TEXT 
WHERE slug = 'smh';

-- Test 2: Update downloads array
UPDATE documents 
SET downloads = '[{"url": "https://example.com/test.pdf", "title": "Test"}]'::jsonb
WHERE slug = 'smh';

-- Test 3: Update metadata
UPDATE documents 
SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{pmid}', '"12345678"')
WHERE slug = 'smh';

-- Test 4: Update intro_message
UPDATE documents 
SET intro_message = '<p>Updated intro message</p>'
WHERE slug = 'smh';
```

**All of these should trigger the webhook** because they all modify the `documents` table.

3. Check your server logs - you should see:
```
🔄 Forcing document registry refresh...
🔄 Loading documents from database...
✓ Loaded 125 active documents from registry
✅ Document registry refreshed successfully
```

4. Verify the webhook fired in Supabase:
   - Go to **Database** → **Webhooks**
   - Click on your webhook
   - Check **Logs** tab for recent deliveries

### Step 4: Also Create Webhook for Owners Table

Since documents inherit properties from owners, create a second webhook:

**Name**: `refresh-registry-on-owner-change`

**Table**: `owners`

**Events**: 
- ✅ `UPDATE` - Owner defaults changed (intro_message, default_cover, etc.)

**URL**: Same as above

**Other settings**: Same as documents webhook

---

## How It Works

### Before Webhook (Old Behavior)
1. You update document in Supabase
2. Server cache stays stale for up to 2 minutes
3. Users might see old data
4. Manual refresh required: `curl -X POST .../api/refresh-registry`

### After Webhook (New Behavior)
1. You update document in Supabase
2. Webhook fires instantly → POSTs to `/api/refresh-registry`
3. Server refreshes cache immediately (< 1 second)
4. Next user request gets fresh data
5. **Zero manual intervention needed**

---

## Monitoring and Troubleshooting

### Check Webhook Delivery Status

In Supabase Dashboard:
1. **Database** → **Webhooks**
2. Click your webhook name
3. View **Logs** tab

Status codes:
- ✅ `200` - Success (cache refreshed)
- ❌ `500` - Server error (check server logs)
- ❌ `timeout` - Server didn't respond in 5s

### Check Server Logs

After making a change, your server logs should show:
```
🔄 Forcing document registry refresh...
✓ Loaded 125 active documents from registry
✅ Document registry refreshed successfully
```

If you don't see this, the webhook might not be firing.

### Common Issues

**Issue**: Webhook not firing
- **Check**: Is the hook enabled in Supabase?
- **Check**: Did you select the right events (INSERT/UPDATE/DELETE)?
- **Check**: Is the URL correct?

**Issue**: Webhook fires but server doesn't refresh
- **Check**: Is the endpoint URL accessible from internet?
- **Check**: For localhost testing, use ngrok or similar tunnel
- **Check**: Server logs for errors

**Issue**: 404 or 500 errors
- **Check**: Endpoint path is `/api/refresh-registry` (not `/refresh-registry`)
- **Check**: Server is running and healthy
- **Check**: No authentication required on this endpoint

---

## Local Development with Webhooks

For local testing, Supabase webhooks can't reach `localhost` directly. Options:

### Option 1: Use ngrok (Recommended)
```bash
# Install ngrok
brew install ngrok  # or download from ngrok.com

# Start your server
npm start

# In another terminal, create tunnel
ngrok http 3456

# Copy the https URL (e.g., https://abc123.ngrok.io)
# Use this in webhook: https://abc123.ngrok.io/api/refresh-registry
```

### Option 2: Keep Auto-Refresh for Local Dev
The existing 2-minute auto-refresh works fine for local development:
```javascript
// server.js - already implemented
function initializeRegistryAutoRefresh() {
    const REFRESH_INTERVAL = 2 * 60 * 1000; // 2 minutes
    // ... auto-refresh logic
}
```

### Option 3: Manual Refresh for Local Dev
```bash
# After updating documents locally
curl -X POST http://localhost:3456/api/refresh-registry
```

**Recommendation**: Use webhooks for production, keep auto-refresh for local dev.

---

## Production Deployment Checklist

When deploying webhook functionality:

- [ ] Create webhook in Supabase for `documents` table
- [ ] Create webhook in Supabase for `owners` table
- [ ] Set webhook URL to production: `https://brightbean.io/api/refresh-registry`
- [ ] Test webhook by updating a document
- [ ] Verify in server logs that cache refreshes
- [ ] Check webhook delivery logs in Supabase
- [ ] Keep auto-refresh as fallback (already enabled)

---

## Benefits of This Approach

1. **Instant updates**: No waiting for cache expiration
2. **No user confusion**: Changes appear immediately
3. **Zero manual work**: No need to remember to refresh
4. **Reliable**: Auto-refresh still runs as backup
5. **Scalable**: Works for any number of documents
6. **Simple**: No complex code, just native Supabase feature

---

## Fallback Mechanisms

Even with webhooks, we keep multiple layers:

1. **Primary**: Webhook triggers instant refresh
2. **Backup**: Auto-refresh every 2 minutes (if webhook fails)
3. **Manual**: API endpoint available for emergency refresh
4. **Cache TTL**: 5-minute expiration as last resort

This ensures the system is resilient even if webhooks have issues.

---

## Related Documentation

- [Supabase Webhooks Documentation](https://supabase.com/docs/guides/database/webhooks)
- [API Reference](./API_REFERENCE.md) - `/api/refresh-registry` endpoint
- [Cache Management](./CACHE-MANAGEMENT.md) - Overall caching strategy
- [Document Registry](./document-registry-refactor.md) - Registry architecture

---

## Summary

**Setup**: 5 minutes in Supabase Dashboard
**Result**: Instant cache refresh on any document change
**Maintenance**: Zero - fully automated
**Cost**: Free (included in Supabase)

This eliminates the frustration of waiting for changes to appear and provides the best user experience for content editors.

