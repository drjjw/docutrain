# Document Registry Migration Guide

This guide walks you through migrating the chatbot from hardcoded document configuration to the scalable database-backed document registry system.

## Overview

The migration transforms:
- **Before:** Hardcoded document lists in 5+ files
- **After:** Dynamic document registry in database with automatic loading

## Pre-Migration Checklist

### 1. Backup Your Data
```bash
# Backup your Supabase database before running migration
# Use Supabase dashboard or pg_dump
```

### 2. Verify Environment
- ✅ Node.js and npm installed
- ✅ Supabase project accessible
- ✅ `.env` file with credentials configured
- ✅ All dependencies installed (`npm install`)

### 3. Check Current State
```bash
# Verify PDFs exist
ls PDFs/*.pdf

# Should show:
# - PIIS1499267125000206.pdf
# - smh-manual-2023.pdf
# - uhn-manual-2025.pdf
```

## Migration Steps

### Step 1: Run Database Migration

**Using Supabase MCP (Recommended):**

The migration SQL is already created at `scripts/migrate-to-document-registry.sql`.

Use the Supabase MCP tool to execute it:

```
Ask your AI assistant to run the migration using Supabase MCP
```

**Alternatively, using Supabase Dashboard:**

1. Go to SQL Editor in Supabase Dashboard
2. Open `scripts/migrate-to-document-registry.sql`
3. Execute the entire script
4. Verify no errors in output

**What the migration does:**
- Creates `documents` table with indexes and RLS policies
- Updates `document_chunks` table to use `document_slug`
- Updates `document_chunks_local` table to use `document_slug`
- Updates database functions for similarity search
- Seeds 3 initial documents (smh, uhn, CKD-dc-2025)

### Step 2: Verify Migration Success

Check that the migration completed:

```sql
-- Check documents table
SELECT slug, title, embedding_type, active FROM documents;

-- Should return 3 rows:
-- smh | Nephrology Manual | openai | t
-- uhn | Nephrology Manual | openai | t
-- CKD-dc-2025 | CKD in Diabetes Guidelines | local | t

-- Check that chunks were migrated
SELECT COUNT(*) FROM document_chunks WHERE document_slug IS NOT NULL;
SELECT COUNT(*) FROM document_chunks_local WHERE document_slug IS NOT NULL;
```

### Step 3: Verify PDF Organization

PDFs should already be organized in subdirectories:

```bash
ls -R PDFs/

# Should show:
# PDFs/manuals/:
# - smh-manual-2023.pdf
# - uhn-manual-2025.pdf
#
# PDFs/guidelines/:
# - PIIS1499267125000206.pdf
```

If not organized, the files have been moved automatically during implementation.

### Step 4: Test the System

**Start the server:**
```bash
node server.js
```

**Look for these log messages:**
```
🔄 Loading document registry from database...
✓ Document registry loaded: 3 active documents
📄 Loading PDFs...
✓ PDF loaded successfully
  - Document: smh-manual-2023.pdf (SMH)
  - Title: Nephrology Manual
  ...
🚀 Server running at http://localhost:3456
📚 Multi-document chatbot ready!
   - Loaded documents:
     • smh: Nephrology Manual (2023, openai)
     • uhn: Nephrology Manual (2025, openai)
     • CKD-dc-2025: CKD in Diabetes Guidelines (2025, local)
```

**Test the API endpoints:**
```bash
# Check health
curl http://localhost:3456/api/health

# Check documents endpoint
curl http://localhost:3456/api/documents
```

**Test the frontend:**
1. Open `http://localhost:3456`
2. Check browser console for:
   ```
   🔄 Fetching documents from API...
   ✓ Loaded 3 documents from registry
   ```
3. Try different documents: `?doc=smh`, `?doc=uhn`, `?doc=CKD-dc-2025`
4. Verify UI updates correctly

### Step 5: Test RAG Functionality

```bash
# Test with OpenAI embeddings
curl -X POST http://localhost:3456/api/chat-rag \
  -H "Content-Type: application/json" \
  -d '{"message": "What is acute kidney injury?", "doc": "smh", "model": "gemini"}'

# Test with local embeddings
curl -X POST http://localhost:3456/api/chat-rag \
  -H "Content-Type: application/json" \
  -d '{"message": "What are CKD stages?", "doc": "CKD-dc-2025", "model": "gemini"}'
```

## Post-Migration

### Verify Everything Works

Use the testing checklist from `URL-PARAMETERS.md`:

**Basic Functionality:**
- [ ] Server starts without errors
- [ ] All 3 documents load on startup
- [ ] Health check returns document info
- [ ] `/api/documents` endpoint works
- [ ] Frontend loads and displays correctly
- [ ] Document switching works (`?doc=` parameter)
- [ ] RAG mode works with all documents
- [ ] Full document mode works

**Database:**
- [ ] `documents` table has 3 records
- [ ] `document_chunks` uses `document_slug`
- [ ] `document_chunks_local` uses `document_slug`
- [ ] Foreign key constraints work
- [ ] RLS policies allow anonymous reads

### Update Your Deployment

If you deploy to production, update your deployment process:

1. Run the migration on production database
2. Deploy the updated code
3. Verify PDF files are in correct subdirectories
4. Test thoroughly before directing users

## Adding New Documents

Now that migration is complete, you can add new documents easily:

### 1. Add Document to Registry

```sql
INSERT INTO documents (
    slug, 
    title, 
    subtitle, 
    back_link, 
    welcome_message, 
    pdf_filename, 
    pdf_subdirectory, 
    embedding_type, 
    year, 
    active,
    metadata
) VALUES (
    'new-doc',  -- URL-friendly identifier
    'New Document Title',
    'Subtitle for display',
    'https://example.com/link',
    'Welcome message for chat',
    'new-document.pdf',  -- Filename in PDFs/
    'manuals',  -- Or 'guidelines', etc.
    'openai',  -- or 'local'
    '2025',
    true,
    '{"key": "value"}'::jsonb
);
```

### 2. Add PDF File

```bash
# Place PDF in appropriate subdirectory
cp new-document.pdf PDFs/manuals/
```

### 3. Generate Embeddings

```bash
# For OpenAI embeddings:
node scripts/chunk-and-embed.js --doc=new-doc

# For local embeddings:
node scripts/chunk-and-embed-local.js --doc=new-doc
```

### 4. Restart Server

The new document will be automatically loaded on next server start!

## Troubleshooting

### Migration Failed

**Error: Column already exists**
- Migration may have partially run
- Check which parts completed
- Manually fix or restore from backup

**Error: Foreign key violation**
- Existing chunks reference documents not in registry
- Check `document_type` values in chunks tables
- Add missing documents to registry first

### Server Won't Start

**"Document not found in registry"**
- Migration didn't complete
- Check database has seeded documents
- Run: `SELECT * FROM documents;`

**"Failed to load documents"**
- Supabase credentials incorrect
- Check `.env` file
- Verify database connection

### Frontend Issues

**"Using fallback configuration"**
- `/api/documents` endpoint not responding
- Server not running
- CORS issue (check browser console)

**Documents not updating**
- Clear browser cache: `localStorage.clear()`
- Or use: `clearDocumentCache()` in console

### RAG Not Working

**"No chunks found"**
- Chunks not migrated to use `document_slug`
- Re-run migration Step 1
- Verify: `SELECT document_slug FROM document_chunks LIMIT 1;`

**Wrong embedding dimensions**
- Check document `embedding_type` in registry
- Verify chunks are in correct table (document_chunks vs document_chunks_local)

## Rollback Plan

If you need to rollback (not recommended after migration):

1. **Restore database from backup**
2. **Revert code changes:**
   ```bash
   git checkout <previous-commit>
   ```
3. **Move PDFs back to root:**
   ```bash
   mv PDFs/manuals/* PDFs/
   mv PDFs/guidelines/* PDFs/
   ```

**Note:** It's better to fix forward than rollback. The new system is more maintainable.

## Getting Help

If you encounter issues:

1. Check server logs for error messages
2. Check browser console for frontend errors
3. Verify database state with SQL queries
4. Review this guide and `URL-PARAMETERS.md`
5. Check the implementation plan in `plans/document-registry-refactor.md`

## Success Indicators

You'll know the migration succeeded when:

✅ Server logs show "Document registry loaded"
✅ All 3 documents load on startup  
✅ `/api/documents` returns document list
✅ Frontend validates slugs dynamically
✅ You can add new documents via database INSERT
✅ No code changes needed for new documents
✅ Everything works the same as before (backward compatible)

## Next Steps

After successful migration:

1. **Monitor** - Watch for any issues in production
2. **Document** - Update internal docs with new process
3. **Train** - Teach team how to add new documents
4. **Scale** - Start adding more documents to the system!

The system is now ready to scale to many documents without code changes. Enjoy! 🎉

