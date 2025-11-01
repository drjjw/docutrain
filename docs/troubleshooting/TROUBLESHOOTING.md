# Troubleshooting Guide

## Common Issues and Solutions

### New Documents Don't Appear After Training

**Problem:** After training a new document with batch training, accessing `?doc=new-slug` loads the default document (SMH) instead.

**Cause:** The frontend caches the document list in browser localStorage for 5 minutes to reduce API calls.

**Solutions:**

1. **Clear Browser Cache (Fastest):**
   - Open browser DevTools (F12)
   - Go to Application/Storage tab
   - Find "Local Storage" → your domain
   - Delete the key: `ukidney-documents-cache`
   - Refresh the page

2. **Hard Refresh:**
   - **Mac:** `Cmd + Shift + R`
   - **Windows/Linux:** `Ctrl + Shift + R`
   - **Safari:** `Cmd + Option + R`

3. **Console Command:**
   ```javascript
   localStorage.removeItem('ukidney-documents-cache');
   location.reload();
   ```

4. **Wait 5 Minutes:**
   - The cache automatically expires after 5 minutes
   - The next page load will fetch fresh data

**Prevention:**
- After training new documents, always clear localStorage
- Or use incognito/private browsing for testing
- Or reduce CACHE_TTL in `public/js/config.js` during development

---

### Server Doesn't Load New Documents

**Problem:** Server started before documents were added to database.

**Cause:** Server loads document registry at startup and caches it.

**Solution:**
1. Restart the server:
   ```bash
   # Find the process
   ps aux | grep "node server.js"
   
   # Kill it
   kill <PID>
   
   # Restart
   node server.js > server.log 2>&1 &
   ```

2. Check server log to verify documents loaded:
   ```bash
   tail -50 server.log | grep "Loaded documents"
   ```

---

### Document Loads But Shows Wrong Content

**Problem:** Document slug is correct but content is from different document.

**Possible Causes:**
1. **Wrong embedding type:** Check if you're using the right slug (e.g., `doc-slug` vs `doc-slug-local`)
2. **Chunks not trained:** Document exists in registry but embeddings not generated
3. **Database mismatch:** Chunks point to wrong document_slug

**Solutions:**

1. **Verify chunks exist:**
   ```sql
   SELECT document_slug, COUNT(*) 
   FROM document_chunks 
   WHERE document_slug = 'your-slug' 
   GROUP BY document_slug;
   
   SELECT document_slug, COUNT(*) 
   FROM document_chunks_local 
   WHERE document_slug = 'your-slug-local' 
   GROUP BY document_slug;
   ```

2. **Re-train if needed:**
   ```bash
   node scripts/chunk-and-embed.js --doc=your-slug
   node scripts/chunk-and-embed-local.js --doc=your-slug-local
   ```

---

### Build Script Missing PDF

**Problem:** Server crashes or fails to load document with "PDF file not found" error.

**Cause:** PDF not included in `build.js` pdfFiles array.

**Solution:**
1. Add PDF to `build.js`:
   ```javascript
   const pdfFiles = [
     // ... existing PDFs
     { from: 'PDFs/guidelines/your-file.pdf', to: 'PDFs/guidelines/your-file.pdf' }
   ];
   ```

2. Rebuild:
   ```bash
   node build.js
   ```

**Prevention:** Always use batch training script which automatically updates build.js.

---

### Batch Training Validation Fails

**Problem:** `--dry-run` reports "PDF file not found" or "Invalid configuration"

**Common Issues:**

1. **Wrong path:**
   - Check `pdfSubdirectory` is either `"guidelines"` or `"manuals"`
   - Verify `pdfFilename` matches exactly (case-sensitive)

2. **Missing required fields:**
   - `slug`, `title`, `pdfFilename`, `pdfSubdirectory`, `embeddingTypes` are required

3. **Invalid embedding type:**
   - Must be `"both"`, `"openai"`, or `"local"`

**Solution:**
```bash
# Check PDF exists
ls -la PDFs/guidelines/your-file.pdf

# Validate JSON syntax
cat documents-to-train.json | jq .

# Run dry run
node scripts/batch-train-documents.js --config=documents-to-train.json --dry-run
```

---

### PubMed Link Not Showing

**Problem:** Document trained but PubMed link missing in metadata.

**Cause:** `pubmedId` not included in training configuration.

**Solution:**

1. **For new documents:** Add `pubmedId` to config:
   ```json
   {
     "slug": "your-doc",
     "pubmedId": "12345678",
     ...
   }
   ```

2. **For existing documents:** Update manually:
   ```sql
   UPDATE documents 
   SET metadata = jsonb_set(
       jsonb_set(
           COALESCE(metadata, '{}'::jsonb),
           '{pubmed_id}',
           '"12345678"'::jsonb
       ),
       '{pubmed_url}',
       '"https://pubmed.ncbi.nlm.nih.gov/12345678/"'::jsonb
   )
   WHERE slug IN ('your-slug', 'your-slug-local');
   ```

---

### RAG Returns No Results

**Problem:** Document loads but queries return "I don't have specific information..."

**Possible Causes:**
1. Embeddings not generated
2. Wrong embedding type (OpenAI vs local)
3. Query embedding fails
4. Similarity threshold too high

**Debug Steps:**

1. **Check chunks exist:**
   ```sql
   SELECT COUNT(*) FROM document_chunks WHERE document_slug = 'your-slug';
   SELECT COUNT(*) FROM document_chunks_local WHERE document_slug = 'your-slug-local';
   ```

2. **Check server logs:**
   ```bash
   tail -f server.log | grep -i "rag\|embedding\|chunk"
   ```

3. **Test with simple query:**
   - Try very general terms that should definitely be in the document
   - Check if it's a similarity threshold issue

4. **Verify embedding type matches:**
   - OpenAI documents use `document_chunks` table
   - Local documents use `document_chunks_local` table
   - Check document's `embedding_type` in database

---

### Performance Issues

**Problem:** Queries take too long or server is slow.

**Solutions:**

1. **Use local embeddings:**
   - 6-8x faster than OpenAI
   - Access via `?doc=slug-local`

2. **Check database indexes:**
   ```sql
   -- Verify vector indexes exist
   SELECT indexname FROM pg_indexes 
   WHERE tablename IN ('document_chunks', 'document_chunks_local');
   ```

3. **Monitor embedding cache:**
   - Cache cleans up every 60 minutes
   - Check server log for cache stats

4. **Reduce chunk count:**
   - Increase CHUNK_SIZE in training scripts
   - Fewer chunks = faster search

---

### Database Connection Issues

**Problem:** "Failed to connect to Supabase" or similar errors.

**Solutions:**

1. **Check environment variables:**
   ```bash
   cat .env | grep SUPABASE
   ```

2. **Verify credentials:**
   - SUPABASE_URL should be `https://xxx.supabase.co`
   - SUPABASE_SERVICE_ROLE_KEY should be long JWT token
   - SUPABASE_ANON_KEY for client-side access

3. **Test connection:**
   ```bash
   curl -H "apikey: YOUR_ANON_KEY" https://xxx.supabase.co/rest/v1/documents
   ```

4. **Check RLS policies:**
   - Ensure tables have proper Row Level Security policies
   - Service role key bypasses RLS
   - Anon key requires RLS policies

---

## Quick Reference

### After Adding New Documents:
1. ✅ Clear browser localStorage (`ukidney-documents-cache`)
2. ✅ Hard refresh browser (Cmd+Shift+R)
3. ✅ Verify in server log that document loaded
4. ✅ Test with simple query

### After Code Changes:
1. ✅ Restart server
2. ✅ Clear browser cache
3. ✅ Check for linter errors
4. ✅ Test in incognito window

### Before Deployment:
1. ✅ Run `node build.js`
2. ✅ Verify all PDFs in `dist/PDFs/`
3. ✅ Test server startup: `cd dist && node server.js`
4. ✅ Check all documents load
5. ✅ Deploy `dist/` folder

---

## Getting Help

### Check Logs First:
```bash
# Server log
tail -100 server.log

# Build output
node build.js

# Training output
node scripts/batch-train-documents.js --config=your-config.json --dry-run
```

### Verify Database State:
```sql
-- List all documents
SELECT slug, title, active, embedding_type FROM documents ORDER BY created_at;

-- Count chunks
SELECT document_slug, COUNT(*) FROM document_chunks GROUP BY document_slug;
SELECT document_slug, COUNT(*) FROM document_chunks_local GROUP BY document_slug;

-- Check for orphaned chunks
SELECT DISTINCT document_slug FROM document_chunks 
WHERE document_slug NOT IN (SELECT slug FROM documents);
```

### Common SQL Queries:
```sql
-- Find documents without chunks
SELECT d.slug, d.title 
FROM documents d 
LEFT JOIN document_chunks c ON d.slug = c.document_slug 
WHERE c.document_slug IS NULL AND d.embedding_type = 'openai';

-- Find documents with PubMed links
SELECT slug, metadata->>'pubmed_id', metadata->>'pubmed_url' 
FROM documents 
WHERE metadata->>'pubmed_id' IS NOT NULL;

-- Clear all chunks for a document (for re-training)
DELETE FROM document_chunks WHERE document_slug = 'your-slug';
DELETE FROM document_chunks_local WHERE document_slug = 'your-slug-local';
```

---

## Related Documentation

- [Batch Training Guide](BATCH-TRAINING-GUIDE.md)
- [PubMed Integration](PUBMED-INTEGRATION.md)
- [Missing PDF Fix](MISSING-PDF-FIX.md)
- [Deployment Guide](DEPLOYMENT.md)

