# Edge Function Document Processing Setup

This document explains how to set up and use Supabase Edge Functions for document processing, with automatic fallback to VPS processing.

## Overview

Document processing can now run in two ways:
1. **Edge Functions** (default: disabled) - Processing happens in Supabase Edge Functions
2. **VPS Processing** (default: enabled) - Processing happens on your VPS server (existing behavior)

The system automatically falls back to VPS processing if Edge Functions fail or timeout.

## Environment Variables

### VPS Server (.env file)

Add these variables to your VPS `.env` file:

```bash
# Enable/disable Edge Functions for document processing
# Set to 'true' to enable Edge Functions, 'false' or leave unset to use VPS processing
USE_EDGE_FUNCTIONS=false

# Optional: Explicit Edge Function URL
# If not set, will be auto-constructed from SUPABASE_URL
SUPABASE_EDGE_FUNCTIONS_URL=https://mlxctdgnojvkgfqldaob.supabase.co/functions/v1/process-document

# Existing variables (keep these)
SUPABASE_URL=https://mlxctdgnojvkgfqldaob.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
OPENAI_API_KEY=your_openai_key_here  # Keep for fallback + other features
```

### Supabase Edge Functions (via Dashboard)

1. Go to your Supabase Dashboard → Edge Functions → Settings → Secrets
2. Add these secrets:

```
OPENAI_API_KEY=your_openai_key_here
SUPABASE_URL=https://mlxctdgnojvkgfqldaob.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

**Note**: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` may already be available automatically in Edge Functions.

## Database Migration

Run the migration to add the `processing_method` column:

```sql
-- Run this migration via Supabase Dashboard SQL Editor or CLI
\i migrations/add_processing_method_column.sql
```

Or manually:
```sql
ALTER TABLE user_documents 
ADD COLUMN IF NOT EXISTS processing_method TEXT DEFAULT 'vps' 
CHECK (processing_method IN ('vps', 'edge_function'));

CREATE INDEX IF NOT EXISTS idx_user_documents_processing_method 
ON user_documents(processing_method);
```

## Deploying Edge Function

### Prerequisites

1. Install Supabase CLI: `npm install -g supabase`
2. Login: `supabase login`
3. Link your project: `supabase link --project-ref mlxctdgnojvkgfqldaob`

### Deploy

```bash
# Deploy the Edge Function
supabase functions deploy process-document

# Set secrets (if not already set via Dashboard)
supabase secrets set OPENAI_API_KEY=your_key_here
```

### Test Locally (Optional)

```bash
# Serve locally for testing
supabase functions serve process-document --no-verify-jwt

# Test with curl
curl -X POST http://localhost:54321/functions/v1/process-document \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"user_document_id": "your-doc-id"}'
```

## Switching Between Methods

### Enable Edge Functions

1. Set `USE_EDGE_FUNCTIONS=true` in VPS `.env` file
2. Restart server: `pm2 restart docutrainio-bot`
3. New document uploads will use Edge Functions

### Disable Edge Functions (Return to VPS)

1. Set `USE_EDGE_FUNCTIONS=false` in VPS `.env` file (or remove the line)
2. Restart server: `pm2 restart docutrainio-bot`
3. New document uploads will use VPS processing

**Note**: Documents already processing will complete with their current method. Only new uploads use the new setting.

## How It Works

### Processing Flow

1. User uploads document → VPS receives request
2. If `USE_EDGE_FUNCTIONS=true`:
   - VPS calls Edge Function with document ID
   - Edge Function processes document (download → extract → chunk → embed → store)
   - If Edge Function succeeds: Document marked `ready`, method = `edge_function`
   - If Edge Function fails/timeouts: **Automatic fallback to VPS processing**
3. If `USE_EDGE_FUNCTIONS=false`:
   - Direct VPS processing (existing behavior)
   - Document marked `ready`, method = `vps`

### Fallback Scenarios

The system automatically falls back to VPS processing if:

- Edge Function times out (exceeds 380s)
- Edge Function returns error (500, 504, etc.)
- Network error connecting to Edge Function
- Edge Function returns `success: false`

When fallback occurs:
- Error is logged in `user_documents.error_message`
- Processing continues via VPS
- Document marked with `processing_method = 'vps'`

## Monitoring

### Check Processing Method

Query the database to see which method was used:

```sql
SELECT 
  id,
  title,
  status,
  processing_method,
  error_message,
  created_at
FROM user_documents
ORDER BY created_at DESC;
```

### Edge Function Logs

View logs in Supabase Dashboard:
1. Go to Edge Functions → `process-document`
2. Click "Logs" tab
3. See real-time processing logs

### VPS Logs

Check VPS server logs for fallback messages:
```bash
tail -f server.log | grep -E "(Edge Function|VPS processing|fallback)"
```

## Troubleshooting

### Edge Function Not Triggering

1. Check `USE_EDGE_FUNCTIONS=true` in `.env`
2. Verify Edge Function is deployed: `supabase functions list`
3. Check Edge Function URL is correct
4. Check VPS logs for connection errors

### Frequent Fallbacks

1. Check Edge Function logs for error patterns
2. Verify Edge Function secrets are set correctly
3. Check if documents are too large (timeout > 400s)
4. Consider if VPS processing is more reliable for your use case

### Edge Function Timeout

Large documents (>400s processing time) will timeout. The system automatically falls back to VPS. For very large documents, VPS processing may be more reliable.

## Rollback Plan

If Edge Functions cause issues:

1. **Immediate**: Set `USE_EDGE_FUNCTIONS=false` and restart server
2. All new uploads will use VPS processing
3. Documents already processed via Edge Functions remain functional
4. No code changes needed - just environment variable

## Cost Considerations

- **Edge Functions**: Pay-per-invocation + compute time
- **VPS**: Fixed monthly cost regardless of usage
- Monitor Edge Function usage in Supabase Dashboard
- Switch back to VPS if costs are higher than expected

## Next Steps

1. Deploy Edge Function (see Deploying section above)
2. Set Edge Function secrets in Dashboard
3. Run database migration
4. Set `USE_EDGE_FUNCTIONS=true` in VPS `.env` for testing
5. Monitor logs and fallback behavior
6. Gradually enable for production if stable

