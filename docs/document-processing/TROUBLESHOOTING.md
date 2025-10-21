# Troubleshooting Document Processing

## 🔍 Common Issues and Solutions

### Page Number Issues

#### Problem: All chunks show "Page 1"

**Symptoms**:
```
⚠️  WARNING: doc-slug has only 1 unique page number (95 total chunks)
```

**Diagnosis**:
```sql
SELECT 
    metadata->>'page_number' as page, 
    COUNT(*) as chunks 
FROM document_chunks 
WHERE document_slug = 'doc-slug' 
GROUP BY metadata->>'page_number';
```

**Causes**:
1. PDF has no text (scanned images only)
2. Page marker insertion failed
3. PDF has unusual text extraction format

**Solutions**:

1. **Check if PDF is text-based**:
   - Open PDF and try to select/copy text
   - If you can't select text, it's a scanned image
   - Solution: Use OCR to convert to text-based PDF

2. **Reprocess the document**:
   ```bash
   # Delete existing chunks
   node scripts/chunk-and-embed.js --doc=doc-slug
   ```

3. **Verify PDF page count**:
   - Open PDF and check actual page count
   - Compare to detected page count in logs
   - If mismatch, PDF metadata may be incorrect

4. **Manual inspection**:
   ```sql
   -- Check a few chunks
   SELECT 
       content,
       metadata
   FROM document_chunks 
   WHERE document_slug = 'doc-slug'
   LIMIT 5;
   ```

#### Problem: Page numbers seem inaccurate

**Symptoms**:
- Citations reference wrong pages
- Page numbers don't match PDF content

**Diagnosis**:
1. Query the document with a specific question
2. Note the cited page number
3. Check that page in the actual PDF
4. Verify if content matches

**Causes**:
1. Page estimation is approximate (not exact)
2. PDF has uneven text distribution
3. PDF has many figures/tables (less text)

**Solutions**:

1. **Understand estimation**:
   - System estimates page boundaries by character count
   - Pages with figures/tables may be off by 1-2 pages
   - This is normal and acceptable for most use cases

2. **Check if "good enough"**:
   - Are citations within 1-2 pages of correct location?
   - Can users still find the information?
   - If yes, no action needed

3. **For critical documents**:
   - Consider adding explicit "Page X" headers to PDF
   - Reprocess after adding headers
   - System will use explicit headers instead of estimation

### Processing Errors

#### Problem: "Document not found in registry"

**Error**:
```
❌ Error: Document 'doc-slug' not found in registry
```

**Solution**:

1. **Check registry**:
   ```sql
   SELECT * FROM document_registry WHERE slug = 'doc-slug';
   ```

2. **Add to registry**:
   ```sql
   INSERT INTO document_registry (
     slug, name, owner, embedding_type, file_path, is_active
   ) VALUES (
     'doc-slug',
     'Document Display Name',
     'owner',
     'openai',
     'PDFs/path/to/file.pdf',
     true
   );
   ```

3. **Reprocess**:
   ```bash
   node scripts/chunk-and-embed.js --doc=doc-slug
   ```

#### Problem: "OpenAI API rate limit exceeded"

**Error**:
```
❌ Error: Rate limit exceeded. Please try again later.
```

**Solutions**:

1. **Wait and retry**:
   ```bash
   # Wait 1-2 minutes, then:
   node scripts/chunk-and-embed.js --doc=doc-slug
   ```

2. **Process in smaller batches**:
   ```bash
   # Instead of 20 documents at once:
   ./scripts/batch-train.sh openai doc1 doc2 doc3
   # Wait a few minutes
   ./scripts/batch-train.sh openai doc4 doc5 doc6
   ```

3. **Use local embeddings** (no rate limits):
   ```bash
   node scripts/chunk-and-embed-local.js --doc=doc-slug
   ```

#### Problem: "Database timeout"

**Error**:
```
❌ Error inserting batch: canceling statement due to statement timeout
```

**Causes**:
- Large document with many chunks
- Slow network connection
- Database under heavy load

**Solutions**:

1. **Retry** (usually works):
   ```bash
   node scripts/chunk-and-embed.js --doc=doc-slug
   ```

2. **Check document size**:
   ```bash
   ls -lh PDFs/path/to/file.pdf
   ```
   - If > 50MB, consider splitting into smaller documents

3. **Check Supabase connection**:
   - Verify `SUPABASE_URL` and `SUPABASE_KEY` in `.env`
   - Test connection: `curl $SUPABASE_URL/rest/v1/`

#### Problem: "PDF parse error"

**Error**:
```
❌ Error loading PDF: Invalid PDF structure
```

**Causes**:
- PDF is corrupted
- PDF is password-protected
- PDF has unusual format

**Solutions**:

1. **Verify PDF**:
   - Try opening in a PDF reader
   - If it doesn't open, re-download

2. **Remove password**:
   ```bash
   # Using qpdf (install: brew install qpdf)
   qpdf --decrypt input.pdf output.pdf
   ```

3. **Re-download**:
   - Original PDF may have been corrupted during download
   - Download fresh copy and retry

### Search/Retrieval Issues

#### Problem: Document doesn't appear in search results

**Symptoms**:
- Document processed successfully
- But queries don't return results from it

**Diagnosis**:
```sql
-- Check if chunks exist
SELECT COUNT(*) 
FROM document_chunks 
WHERE document_slug = 'doc-slug';

-- Check if embeddings are present
SELECT COUNT(*) 
FROM document_chunks 
WHERE document_slug = 'doc-slug' 
  AND embedding IS NOT NULL;
```

**Solutions**:

1. **Verify chunks exist**:
   - If count is 0, document wasn't processed
   - Reprocess: `node scripts/chunk-and-embed.js --doc=doc-slug`

2. **Verify embeddings exist**:
   - If embeddings are NULL, generation failed
   - Check logs for errors
   - Reprocess document

3. **Check document is active**:
   ```sql
   SELECT is_active 
   FROM document_registry 
   WHERE slug = 'doc-slug';
   ```
   - If false, set to true:
     ```sql
     UPDATE document_registry 
     SET is_active = true 
     WHERE slug = 'doc-slug';
     ```

4. **Test with specific query**:
   - Ask a question you know the document answers
   - If still no results, check embedding quality

#### Problem: Poor search quality

**Symptoms**:
- Search returns irrelevant results
- Expected documents not retrieved

**Solutions**:

1. **Try different embedding type**:
   - If using local, try OpenAI
   - If using OpenAI, ensure it's processed correctly

2. **Check chunk size**:
   - Default is ~500 tokens (2000 chars)
   - Very technical documents may need smaller chunks
   - Very narrative documents may need larger chunks

3. **Verify document content**:
   ```sql
   SELECT content 
   FROM document_chunks 
   WHERE document_slug = 'doc-slug'
   LIMIT 3;
   ```
   - Check if content looks reasonable
   - Check if text extraction worked properly

### Build/Deployment Issues

#### Problem: Document doesn't appear in UI selector

**Symptoms**:
- Document processed successfully
- But not visible in dropdown

**Solutions**:

1. **Check build.js**:
   ```javascript
   // Verify document is in the array
   const documents = [
     // ...
     { slug: 'doc-slug', name: 'Display Name', owner: 'owner' }
   ];
   ```

2. **Rebuild**:
   ```bash
   npm run build
   ```

3. **Restart server**:
   ```bash
   # Stop server (Ctrl+C)
   npm start
   ```

4. **Clear browser cache**:
   - Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)

#### Problem: Changes not reflected in production

**Solutions**:

1. **Rebuild**:
   ```bash
   npm run build
   ```

2. **Deploy**:
   ```bash
   ./deploy.sh
   ```

3. **Verify deployment**:
   - Check production URL
   - Clear browser cache
   - Test document selector

## 🔧 Diagnostic Commands

### Check document status

```sql
-- Full document info
SELECT 
    slug,
    name,
    owner,
    embedding_type,
    is_active,
    file_path
FROM document_registry 
WHERE slug = 'doc-slug';
```

### Check chunks

```sql
-- Chunk count and page distribution
SELECT 
    COUNT(*) as total_chunks,
    COUNT(DISTINCT metadata->>'page_number') as unique_pages,
    MIN((metadata->>'page_number')::int) as min_page,
    MAX((metadata->>'page_number')::int) as max_page
FROM document_chunks 
WHERE document_slug = 'doc-slug';
```

### Check embeddings

```sql
-- Verify embeddings exist
SELECT 
    COUNT(*) as total,
    COUNT(embedding) as with_embeddings,
    COUNT(*) - COUNT(embedding) as missing_embeddings
FROM document_chunks 
WHERE document_slug = 'doc-slug';
```

### Sample chunks

```sql
-- View sample chunks
SELECT 
    metadata->>'page_number' as page,
    LEFT(content, 100) as preview,
    CASE 
        WHEN embedding IS NULL THEN 'Missing'
        ELSE 'Present'
    END as embedding_status
FROM document_chunks 
WHERE document_slug = 'doc-slug'
ORDER BY (metadata->>'page_number')::int
LIMIT 10;
```

## 🆘 When to Ask for Help

Contact the development team if:

1. **Persistent processing failures**
   - Document fails repeatedly after multiple retries
   - Error messages are unclear or unusual

2. **Data corruption**
   - Chunks contain garbled text
   - Embeddings seem to be corrupted
   - Database queries return unexpected results

3. **Performance issues**
   - Processing takes unusually long (> 5 minutes for normal doc)
   - Database queries timeout consistently
   - System becomes unresponsive

4. **Critical documents**
   - High-priority document needs special handling
   - Document has unusual format requiring custom processing
   - Accuracy requirements are higher than normal

## 📚 Related Documentation

- [ADDING-NEW-DOCUMENTS.md](./ADDING-NEW-DOCUMENTS.md) - Step-by-step guide
- [PAGE-NUMBER-SYSTEM.md](./PAGE-NUMBER-SYSTEM.md) - Page detection details
- [TECHNICAL-ARCHITECTURE.md](./TECHNICAL-ARCHITECTURE.md) - System internals
- [BATCH-PROCESSING.md](./BATCH-PROCESSING.md) - Batch processing guide

## 🔍 Debug Mode

To enable verbose logging:

```bash
# Set debug environment variable
DEBUG=* node scripts/chunk-and-embed.js --doc=doc-slug

# Or for specific modules
DEBUG=pdf,embedding node scripts/chunk-and-embed.js --doc=doc-slug
```

This will show detailed information about:
- PDF parsing steps
- Text cleaning operations
- Chunk creation
- Embedding generation
- Database operations

