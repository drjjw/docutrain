# User Document Processing System

## Overview

This system enables automatic processing of user-uploaded PDFs through the Dashboard, creating chunks with OpenAI embeddings and making documents immediately available to the user who uploaded them.

## Architecture

### Components

1. **Processing Logger** (`lib/processing-logger.js`)
   - Dual logging system (file + database)
   - Logs to `logs/document-processing.log`
   - Stores detailed logs in `document_processing_logs` table
   - Tracks all processing stages with metadata

2. **Document Processor** (`lib/document-processor.js`)
   - Core processing logic extracted from `scripts/chunk-and-embed.js`
   - Handles PDF download from storage
   - Text extraction with page markers
   - Chunking (500 tokens, 100 overlap)
   - OpenAI embedding generation
   - Database storage

3. **Processing API** (`lib/routes/processing.js`)
   - `POST /api/process-document` - Trigger processing
   - `GET /api/processing-status/:id` - Get status and logs
   - `GET /api/user-documents` - List user's uploaded documents
   - Authentication required for all endpoints

4. **Frontend Components**
   - `UserDocumentsTable` - Shows processing status with auto-polling
   - Updated `useUpload` hook - Automatically triggers processing
   - Integrated into Dashboard page

### Database Tables

#### `user_documents`
- Tracks uploaded files and processing status
- Status: `pending` → `processing` → `ready` (or `error`)
- Links to Supabase Storage

#### `documents`
- Auto-created when processing completes
- Slug format: `user-{title}-{timestamp}`
- Access level: `owner_restricted` (private to uploader)
- Embedding type: `openai`

#### `document_chunks`
- Stores processed chunks with embeddings
- Linked via `document_slug`
- Includes metadata (page numbers, character positions)

#### `document_processing_logs`
- Audit trail for all processing operations
- Tracks stages: download, extract, chunk, embed, store, complete, error
- Includes timing and error information

## Workflow

### 1. Upload
```
User uploads PDF → Supabase Storage (user-documents bucket)
                 → user_documents table (status: pending)
```

### 2. Processing Trigger
```
useUpload hook → POST /api/process-document
              → Updates status to 'processing'
              → Starts async processing
```

### 3. Processing Pipeline
```
Download PDF from storage
  ↓
Extract text with page markers
  ↓
Create document record in documents table
  ↓
Chunk text (500 tokens, 100 overlap)
  ↓
Generate OpenAI embeddings (batches of 50)
  ↓
Store chunks in document_chunks table
  ↓
Update status to 'ready'
```

### 4. Availability
```
Document becomes immediately queryable in chat
- Accessible only to the user who uploaded it
- Shows up in document registry
- Can be searched with RAG
```

## Usage

### For Users

1. Navigate to Dashboard (`/app/dashboard`)
2. Upload PDF in "Upload New Document" section
3. Monitor processing in "Your Uploaded Documents" table
4. Once status shows "Ready", document is available in chat

### For Developers

#### Trigger Processing Manually
```javascript
const response = await fetch('/api/process-document', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
    user_document_id: 'uuid-here',
  }),
});
```

#### Check Processing Status
```javascript
const response = await fetch('/api/processing-status/uuid-here', {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});

const { document, logs } = await response.json();
```

#### Get User Documents
```javascript
const response = await fetch('/api/user-documents', {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});

const { documents } = await response.json();
```

## Logging

### File Logs
Location: `logs/document-processing.log`

Format:
```
[2025-10-29T12:34:56.789Z] [doc-uuid] [stage:status] Message | {"metadata": "here"}
```

### Database Logs
Table: `document_processing_logs`

Query example:
```sql
SELECT * FROM document_processing_logs 
WHERE user_document_id = 'uuid-here'
ORDER BY created_at ASC;
```

## Error Handling

### Processing Errors
- Logged to both file and database
- `user_documents.status` set to `error`
- `user_documents.error_message` contains error details
- User sees error badge in UI with message

### Common Issues

1. **PDF Download Fails**
   - Check file_path in user_documents
   - Verify file exists in storage bucket
   - Check RLS policies on storage

2. **Embedding Generation Fails**
   - Verify OPENAI_API_KEY is set
   - Check OpenAI API quota/limits
   - Review error in processing logs

3. **Document Already Exists**
   - Slug collision (rare with timestamp)
   - Check documents table for existing slug

## Security

### Access Control
- Users can only process their own documents
- RLS policies enforce user_id matching
- Documents created with `owner_restricted` access
- Only uploader can query the document

### Authentication
- All API endpoints require Bearer token
- Token validated against Supabase Auth
- User ID extracted from token for authorization

## Performance

### Processing Time
- Small PDF (10 pages): ~30-60 seconds
- Medium PDF (50 pages): ~2-5 minutes
- Large PDF (200 pages): ~10-20 minutes

### Optimization
- Batched embedding generation (50 at a time)
- Batched database inserts (50 records at a time)
- Async processing (doesn't block upload)
- Status polling every 5 seconds (only when processing)

## Monitoring

### Check Processing Status
```bash
# View recent logs
tail -f logs/document-processing.log

# Query database logs
psql -c "SELECT * FROM document_processing_logs ORDER BY created_at DESC LIMIT 20;"
```

### Check for Stuck Documents
```sql
SELECT id, title, status, updated_at 
FROM user_documents 
WHERE status = 'processing' 
  AND updated_at < NOW() - INTERVAL '30 minutes';
```

## Testing

### Manual Test Flow

1. **Upload Test PDF**
   - Login to Dashboard
   - Upload a small PDF (< 5 pages recommended for testing)
   - Verify file appears in "Your Uploaded Documents"

2. **Monitor Processing**
   - Watch status change from "Pending" → "Processing" → "Ready"
   - Check logs: `tail -f logs/document-processing.log`
   - Verify no errors appear

3. **Verify Database**
   ```sql
   -- Check user_documents
   SELECT * FROM user_documents WHERE status = 'ready' ORDER BY created_at DESC LIMIT 1;
   
   -- Check documents
   SELECT * FROM documents WHERE slug LIKE 'user-%' ORDER BY created_at DESC LIMIT 1;
   
   -- Check chunks
   SELECT COUNT(*), document_slug FROM document_chunks 
   WHERE document_slug LIKE 'user-%' 
   GROUP BY document_slug 
   ORDER BY MAX(created_at) DESC LIMIT 1;
   ```

4. **Test in Chat**
   - Navigate to chat interface
   - Search for your uploaded document
   - Ask a question about the content
   - Verify RAG retrieves relevant chunks

## Troubleshooting

### Document Stuck in "Processing"
1. Check logs for errors
2. Verify OpenAI API is responding
3. Check server is running and not crashed
4. Manually set status to 'error' and retry

### Document Shows "Error"
1. Check `error_message` field in user_documents
2. Review processing logs for that document
3. Common fixes:
   - Verify PDF is valid and not corrupted
   - Check OpenAI API key and quota
   - Ensure sufficient disk space for logs

### Chunks Not Created
1. Verify document record exists in documents table
2. Check document_slug matches between tables
3. Review embed stage logs for failures
4. Verify OpenAI embeddings were generated

## Future Enhancements

- [ ] Support for local embeddings (in addition to OpenAI)
- [ ] Batch processing multiple documents
- [ ] Progress percentage during processing
- [ ] Retry failed processing automatically
- [ ] Document preview before processing
- [ ] Custom chunk size per document
- [ ] Support for other file types (DOCX, TXT)

