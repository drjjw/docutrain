# Webhook Setup - Quick Start Guide

## The Problem You're Experiencing

When you update `downloads` (or any field) in the Supabase database:
- ❌ Page refresh shows old data
- ❌ Need to manually run: `curl -X POST http://localhost:3456/api/refresh-registry`
- ❌ Users see stale data for up to 2 minutes

## The Solution: Database Webhook Trigger

Set up a database trigger using `pg_net` so changes trigger instant cache refresh automatically.

**Note**: Supabase "webhooks" are actually database triggers that make HTTP requests. See [Supabase Webhooks Documentation](https://supabase.com/docs/guides/database/webhooks).

---

## Setup Steps (2 minutes)

### Step 1: Run the Migration SQL

1. Open: https://supabase.com/dashboard/project/mlxctdgnojvkgfqldaob
2. Click **SQL Editor** in left sidebar
3. Click **New query**
4. Copy and paste the SQL from `/migrations/add_document_change_webhook.sql`
5. Click **Run** (or press Cmd/Ctrl + Enter)

The migration will:
- Enable the `pg_net` extension (for async HTTP requests)
- Create trigger on `documents` table (INSERT, UPDATE, DELETE)
- Create trigger on `owners` table (UPDATE)
- Both triggers POST to `https://bot.ukidney.com/api/refresh-registry`

### Alternative: Use Supabase MCP

If you have Supabase MCP configured, you can apply the migration directly:

```bash
# From project root
cat migrations/add_document_change_webhook.sql | supabase db execute
```

### Step 2: Test It

1. In **SQL Editor**, run this test:
```sql
UPDATE documents 
SET subtitle = 'Test - ' || NOW()::TEXT 
WHERE slug = 'jjw-stones';
```

2. Check your production server logs (the trigger fires asynchronously):
```bash
# SSH to production or check PM2 logs
pm2 logs chat --lines 50

# Look for:
# 🔄 Forcing document registry refresh...
# ✓ Loaded 125 active documents from registry
```

3. Refresh your page: http://localhost:3456/chat?doc=jjw-stones
   - Should see the updated subtitle immediately (once server cache refreshes)

### Step 3: Test with Downloads

Now test with the actual field you changed:

```sql
UPDATE documents 
SET downloads = '[
  {
    "url": "https://example.com/slides.pdf",
    "title": "Download Slides"
  }
]'::jsonb
WHERE slug = 'jjw-stones';
```

Refresh the page - downloads should update within 1-2 seconds!

### Step 4: Monitor Webhook Calls (Optional)

Database webhook calls are logged in the `net` schema:

```sql
-- View recent webhook requests
SELECT * FROM net._http_response 
ORDER BY created_at DESC 
LIMIT 10;

-- Check for failed requests
SELECT * FROM net._http_response 
WHERE status_code != 200 
ORDER BY created_at DESC;
```

---

## What About Local Development?

The trigger is set to POST to production (`https://bot.ukidney.com`), so it won't affect your local server.

For local testing, you have three options:

### Option A: Manual refresh (Simplest)

```bash
# After updating documents in Supabase
curl -X POST http://localhost:3456/api/refresh-registry
```

### Option B: Temporary trigger for local testing

Create a separate trigger that points to your local server via ngrok:

```sql
-- Temporary local dev trigger (remove when done)
CREATE TRIGGER refresh_registry_local_dev
  AFTER INSERT OR UPDATE OR DELETE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION supabase_functions.http_request(
    'https://your-ngrok-url.ngrok-free.app/api/refresh-registry',
    'POST',
    '{"Content-Type":"application/json"}',
    '{}',
    '5000'
  );
```

### Option C: Use host.docker.internal (if running local Supabase)

If you're running Supabase locally with Docker, you can use:

```sql
'http://host.docker.internal:3456/api/refresh-registry'
```

**Recommendation**: 
- Production trigger → `https://bot.ukidney.com/api/refresh-registry` (permanent)
- Local dev → Manual refresh (simplest, no extra setup)

---

## Verification Checklist

After setup, verify:

- [ ] Migration SQL executed successfully (no errors)
- [ ] Triggers exist: `SELECT * FROM information_schema.triggers WHERE trigger_name LIKE 'refresh_registry%';`
- [ ] `pg_net` extension enabled: `SELECT * FROM pg_extension WHERE extname = 'pg_net';`
- [ ] Test update triggers HTTP request (check `net._http_response` table)
- [ ] Server logs show cache refresh
- [ ] Page refresh shows new data immediately

---

## Troubleshooting

### Trigger not firing

**Check trigger exists**:
```sql
SELECT trigger_name, event_manipulation, event_object_table 
FROM information_schema.triggers 
WHERE trigger_name LIKE 'refresh_registry%';
```

**Check pg_net extension**:
```sql
SELECT * FROM pg_extension WHERE extname = 'pg_net';
```

### Trigger fires but server doesn't respond

**Check**: Is your production server running?
```bash
curl https://bot.ukidney.com/api/health
```

**Check**: Is the endpoint accessible?
```bash
curl -X POST https://bot.ukidney.com/api/refresh-registry
```

**Check webhook logs**:
```sql
-- View recent HTTP responses
SELECT id, status_code, content, created_at 
FROM net._http_response 
ORDER BY created_at DESC 
LIMIT 5;
```

### Data doesn't update after trigger fires

**Check server logs** on production:
```bash
# SSH to production server
pm2 logs chat --lines 50

# Look for:
# 🔄 Forcing document registry refresh...
# ✓ Loaded 125 active documents from registry
```

**Check response in database**:
```sql
SELECT status_code, content 
FROM net._http_response 
WHERE status_code != 200 
ORDER BY created_at DESC;
```

---

## Expected Behavior After Setup

### Before Webhook:
1. Update downloads in Supabase ✏️
2. Wait 2 minutes ⏰
3. OR run manual refresh 🔧
4. Page refresh shows new data ✅

### After Webhook:
1. Update downloads in Supabase ✏️
2. Webhook fires instantly (< 1 second) ⚡
3. Server cache refreshes automatically 🔄
4. Page refresh shows new data ✅

**Zero manual intervention!**

---

## Next Steps

Once the production webhook is working:

1. ✅ Test with different fields (title, subtitle, downloads, metadata)
2. ✅ Create second webhook for `owners` table (same config)
3. ✅ Monitor webhook logs occasionally to ensure reliability
4. ✅ Keep auto-refresh enabled as backup (already running)

---

## Quick Reference

**Webhook Dashboard**: https://supabase.com/dashboard/project/mlxctdgnojvkgfqldaob/database/webhooks

**Manual Refresh** (if needed):
```bash
curl -X POST https://bot.ukidney.com/api/refresh-registry
```

**Check Server Health**:
```bash
curl https://bot.ukidney.com/api/health
```

---

## Summary

- **Setup time**: 5 minutes
- **Cost**: Free (included in Supabase)
- **Maintenance**: Zero
- **Result**: Instant updates, no waiting, no manual refresh needed

This solves your current issue where downloads don't appear until manual refresh!

