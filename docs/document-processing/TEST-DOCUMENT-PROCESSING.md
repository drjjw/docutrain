# Testing Document Processing System

## Prerequisites

1. Server must be running with OpenAI API key configured
2. User must be logged in to Dashboard
3. Have a small test PDF ready (< 5 pages recommended)

## Test Steps

### 1. Start the Server

```bash
# Make sure you're in the project root
cd /Users/jordanweinstein/GitHub/chat

# Build the project (includes React app and server)
npm run build

# Start the server from dist directory
cd dist
node server.js
```

Server should start on `http://localhost:3456`

### 2. Login to Dashboard

1. Navigate to `http://localhost:3456/app/login`
2. Login with your credentials
3. Navigate to Dashboard (`/app/dashboard`)

### 3. Upload a Test PDF

1. In the "Upload New Document" section:
   - Click "Choose File" and select a PDF
   - Wait for upload to complete (progress bar reaches 100%)
   - Upload should trigger processing automatically

2. Check "Your Uploaded Documents" section:
   - Document should appear with status "Processing" (blue badge with spinner)
   - Status should auto-update every 5 seconds

### 4. Monitor Processing

**Option A: Watch the UI**
- Stay on Dashboard page
- Status will automatically update from "Processing" → "Ready"
- If error occurs, status shows "Error" with error message

**Option B: Watch the Logs**
```bash
# In a separate terminal
tail -f logs/document-processing.log
```

You should see log entries like:
```
[2025-10-29T...] [uuid] [download:started] Starting document processing
[2025-10-29T...] [uuid] [download:completed] PDF downloaded successfully
[2025-10-29T...] [uuid] [extract:started] Extracting text from PDF
[2025-10-29T...] [uuid] [extract:completed] Text extracted successfully
[2025-10-29T...] [uuid] [chunk:started] Chunking text
[2025-10-29T...] [uuid] [chunk:completed] Text chunked successfully
[2025-10-29T...] [uuid] [embed:started] Generating embeddings
[2025-10-29T...] [uuid] [embed:progress] Processing batch 1/X
[2025-10-29T...] [uuid] [embed:completed] Embeddings generated
[2025-10-29T...] [uuid] [store:started] Storing chunks in database
[2025-10-29T...] [uuid] [store:completed] Chunks stored successfully
[2025-10-29T...] [uuid] [complete:completed] Processing complete
```

### 5. Verify Database

Connect to your Supabase project and run:

```sql
-- Check the user_documents record
SELECT id, title, status, error_message, created_at, updated_at
FROM user_documents
ORDER BY created_at DESC
LIMIT 1;

-- Get the document slug (should start with 'user-')
SELECT slug, title, access_level, embedding_type, active
FROM documents
WHERE slug LIKE 'user-%'
ORDER BY created_at DESC
LIMIT 1;

-- Count the chunks created
SELECT 
    document_slug,
    COUNT(*) as chunk_count,
    COUNT(DISTINCT metadata->>'page_number') as unique_pages
FROM document_chunks
WHERE document_slug LIKE 'user-%'
GROUP BY document_slug
ORDER BY MAX(created_at) DESC
LIMIT 1;

-- View processing logs
SELECT stage, status, message, metadata, created_at
FROM document_processing_logs
WHERE user_document_id = 'YOUR_DOC_ID_HERE'
ORDER BY created_at ASC;
```

### 6. Test Document in Chat

1. Navigate to the main chat interface: `http://localhost:3456/`

2. In the document selector, search for your uploaded document
   - It should appear in the list
   - Title should match what you uploaded

3. Select the document and ask a question about its content
   - Example: "What is this document about?"
   - Example: "Summarize the main points"

4. Verify the response:
   - Should include relevant information from the PDF
   - Check that chunks are being retrieved (look for page citations)

### 7. Test Error Handling

**Test 1: Upload Invalid File**
- Try uploading a non-PDF file
- Should show validation error before upload

**Test 2: Upload Very Large PDF**
- Try uploading a PDF > 50MB
- Should show file size error

**Test 3: Check Processing Logs**
```bash
# View all processing logs
cat logs/document-processing.log

# Check for errors
grep "error\|failed" logs/document-processing.log
```

## Expected Results

### Success Criteria

✅ Upload completes successfully
✅ Status changes from "Pending" → "Processing" → "Ready"
✅ No errors in logs
✅ Document appears in documents table with correct slug
✅ Chunks are created in document_chunks table
✅ Document is queryable in chat interface
✅ RAG retrieves relevant chunks when asking questions

### Timing Expectations

- **Small PDF (5 pages)**: 30-60 seconds
- **Medium PDF (20 pages)**: 1-3 minutes
- **Large PDF (50+ pages)**: 5-15 minutes

## Troubleshooting

### Issue: Status Stuck on "Processing"

**Check:**
1. Is the server still running?
   ```bash
   ps aux | grep node
   ```

2. Are there errors in the logs?
   ```bash
   tail -100 logs/document-processing.log | grep error
   ```

3. Is OpenAI API responding?
   ```bash
   # Check server console for OpenAI errors
   ```

**Fix:**
- Restart the server
- Check OpenAI API key is valid
- Verify OpenAI API quota hasn't been exceeded

### Issue: Status Shows "Error"

**Check:**
1. Look at error message in UI
2. Check processing logs:
   ```sql
   SELECT * FROM document_processing_logs 
   WHERE user_document_id = 'YOUR_DOC_ID' 
   AND status = 'failed';
   ```

3. Common errors:
   - "Failed to download PDF" → Check storage permissions
   - "Embedding generation failed" → Check OpenAI API key
   - "Failed to insert batch" → Check database connection

### Issue: Document Not Appearing in Chat

**Check:**
1. Is document status "ready"?
2. Is document active?
   ```sql
   SELECT slug, title, active, access_level 
   FROM documents 
   WHERE slug LIKE 'user-%';
   ```

3. Does user have access?
   - Document should have `access_level = 'owner_restricted'`
   - Only the uploader can see it

4. Refresh document registry:
   ```bash
   curl -X POST http://localhost:3456/api/refresh-registry
   ```

### Issue: No Chunks Retrieved in Chat

**Check:**
1. Do chunks exist?
   ```sql
   SELECT COUNT(*) FROM document_chunks 
   WHERE document_slug = 'YOUR_SLUG';
   ```

2. Do chunks have embeddings?
   ```sql
   SELECT COUNT(*) FROM document_chunks 
   WHERE document_slug = 'YOUR_SLUG' 
   AND embedding IS NOT NULL;
   ```

3. Is embedding type correct?
   ```sql
   SELECT embedding_type FROM documents 
   WHERE slug = 'YOUR_SLUG';
   ```

## Clean Up After Testing

```sql
-- Remove test document and its chunks
DELETE FROM document_chunks WHERE document_slug = 'YOUR_TEST_SLUG';
DELETE FROM documents WHERE slug = 'YOUR_TEST_SLUG';
DELETE FROM user_documents WHERE id = 'YOUR_TEST_DOC_ID';
DELETE FROM document_processing_logs WHERE user_document_id = 'YOUR_TEST_DOC_ID';
```

## Success!

If all tests pass, the document processing system is working correctly! 🎉

You can now:
- Upload PDFs through the Dashboard
- Track processing status in real-time
- Query uploaded documents in chat
- View detailed processing logs for debugging

