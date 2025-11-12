# Audio Processing System

## Overview

The audio processing system extends the document processing pipeline to support audio file transcription and chunking. Audio files are transcribed using OpenAI Whisper API, then processed into searchable chunks with time metadata, following the same architecture as PDF processing.

## Architecture

### Components

1. **Audio Extractor** (`lib/processors/audio-extractor.js`)
   - Handles audio file transcription using OpenAI Whisper API
   - Returns transcript text with time segments (start/end timestamps)
   - Supports common audio formats: MP3, WAV, M4A, OGG, FLAC, AAC
   - Downloads audio files from Supabase Storage

2. **Text Chunker** (`lib/processors/text-chunker.js`)
   - Enhanced to support time metadata mapping for audio chunks
   - Maps text chunks to time ranges based on transcription segments
   - Maintains backward compatibility with PDF/text processing

3. **Document Processor** (`lib/document-processor.js`)
   - Detects audio files by MIME type or file extension
   - Routes audio files to transcription pipeline
   - Reuses existing chunking, embedding, and storage logic

4. **Frontend Components**
   - `AudioUploadZone` - Audio file upload component
   - `CombinedUploadZone` - Updated to include audio as third option
   - Validation updated to accept audio MIME types

### Database Tables

#### `user_documents`
- Tracks uploaded audio files and processing status
- Status: `pending` → `processing` → `ready` (or `error`)
- Links to Supabase Storage
- Stores `mime_type` for audio files

#### `document_chunks`
- Stores processed chunks with embeddings
- Audio chunks include time metadata:
  - `start_time` (seconds, decimal)
  - `end_time` (seconds, decimal)
  - `page_number` set to null or 0 for audio files

#### `document_processing_logs`
- Audit trail for all processing operations
- Tracks new stage: `TRANSCRIBE` for audio transcription
- Includes audio format and duration metadata

## Workflow

### 1. Upload
```
User uploads audio → Supabase Storage (user-documents bucket)
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
Download audio from storage
  ↓
Transcribe audio using OpenAI Whisper API
  ↓
Create document record in documents table
  ↓
Chunk transcript text (500 tokens, 100 overlap)
  ↓
Map chunks to time ranges based on segments
  ↓
Generate OpenAI embeddings (batches of 50)
  ↓
Store chunks in document_chunks table (with time metadata)
  ↓
Update status to 'ready'
```

### 4. Availability
```
Document becomes immediately queryable in chat
- Accessible only to the user who uploaded it
- Shows up in document registry
- Can be searched with RAG
- Chunks include time metadata for audio playback
```

## Supported Formats

- **MP3** (`audio/mpeg`)
- **WAV** (`audio/wav`)
- **M4A** (`audio/x-m4a`, `audio/m4a`)
- **OGG** (`audio/ogg`)
- **FLAC** (`audio/flac`)
- **AAC** (`audio/aac`)

## File Size Limits

- **Regular users**: 50MB (production), 200MB (development)
- **Superadmin**: 75MB (production), 200MB (development)
- **Whisper API limit**: 25MB (enforced by audio extractor)

## Time Metadata

Audio chunks include time metadata in the `metadata` JSONB field:

```json
{
  "char_start": 0,
  "char_end": 500,
  "tokens_approx": 125,
  "page_number": null,
  "start_time": 12.5,
  "end_time": 45.3
}
```

Time values are in seconds (decimal format). This allows:
- Linking chunks back to specific audio timestamps
- Audio playback controls in UI (future enhancement)
- Time-based search and navigation

## Processing Time

- **Short audio** (< 5 minutes): ~2-5 minutes
- **Medium audio** (5-30 minutes): ~5-10 minutes
- **Long audio** (30+ minutes): ~10-15 minutes

Processing time depends on:
- Audio file size
- Transcription API response time
- Number of chunks generated
- Embedding generation time

## Usage

### For Users

1. Navigate to Dashboard (`/app/dashboard`)
2. Click "Train with Audio" button
3. Select audio file (MP3, WAV, M4A, OGG, FLAC, or AAC)
4. Monitor processing in "Your Uploaded Documents" table
5. Once status shows "Ready", document is available in chat

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

## Error Handling

### Common Issues

1. **File Too Large**
   - Error: "Audio file is too large. Whisper API supports files up to 25MB."
   - Solution: Split audio into smaller files or compress

2. **Unsupported Format**
   - Error: "Audio file format is not supported"
   - Solution: Convert to supported format (MP3, WAV, etc.)

3. **Transcription Failed**
   - Error: "Audio transcription failed"
   - Solution: Check audio quality, ensure file is not corrupted

4. **API Rate Limit**
   - Error: "OpenAI API rate limit exceeded"
   - Solution: Wait and retry, or upgrade API plan

## Technical Details

### Transcription API

Uses OpenAI Whisper API (`whisper-1` model) with:
- `response_format: "verbose_json"` for timestamps
- Auto language detection
- Timeout based on file size (5-30 minutes)

### Time Mapping Algorithm

1. Whisper returns segments with start/end times
2. Map segment text to character positions in full transcript
3. For each chunk, find overlapping segments
4. Use start time of first overlapping segment
5. Use end time of last overlapping segment

### Chunking Strategy

- Same as PDF/text: 500 tokens per chunk, 100 token overlap
- Time metadata added based on segment mapping
- Chunks maintain character positions for text search
- Time positions enable audio navigation

## Security

### Access Control
- Users can only process their own audio files
- RLS policies enforce user_id matching
- Documents created with `owner_restricted` access
- Only uploader can query the document

### Authentication
- All API endpoints require Bearer token
- Token validated against Supabase Auth
- User ID extracted from token for authorization

## Performance

### Optimization
- Batched embedding generation (50 at a time)
- Batched database inserts (50 records at a time)
- Async processing (doesn't block upload)
- Status polling every 5 seconds (only when processing)

### Monitoring

Check processing status:
```bash
# View recent logs
tail -f logs/document-processing.log

# Query database logs
SELECT * FROM document_processing_logs 
WHERE user_document_id = 'uuid-here'
ORDER BY created_at ASC;
```

## Future Enhancements

- [ ] Audio playback controls in chat UI
- [ ] Time-based chunk navigation
- [ ] Support for video files (extract audio track)
- [ ] Speaker diarization (identify different speakers)
- [ ] Custom chunk sizes for audio
- [ ] Audio preview before processing
- [ ] Batch audio processing

## Testing

### Manual Test Flow

1. **Upload Test Audio**
   - Login to Dashboard
   - Click "Train with Audio"
   - Upload a short audio file (< 5 minutes recommended)
   - Verify file appears in "Your Uploaded Documents"

2. **Monitor Processing**
   - Watch status change from "Pending" → "Processing" → "Ready"
   - Check logs: `tail -f logs/document-processing.log`
   - Verify transcription stage appears in logs

3. **Verify Database**
   ```sql
   -- Check user_documents
   SELECT * FROM user_documents WHERE mime_type LIKE 'audio/%' ORDER BY created_at DESC LIMIT 1;
   
   -- Check documents
   SELECT * FROM documents WHERE slug LIKE 'user-%' ORDER BY created_at DESC LIMIT 1;
   
   -- Check chunks with time metadata
   SELECT chunk_index, content, metadata->>'start_time', metadata->>'end_time'
   FROM document_chunks 
   WHERE document_slug = 'user-doc-uuid'
   ORDER BY chunk_index
   LIMIT 5;
   ```

4. **Test in Chat**
   - Navigate to chat interface
   - Search for your uploaded audio document
   - Ask a question about the content
   - Verify RAG retrieves relevant chunks
   - Verify chunks include time metadata

## Troubleshooting

### Audio Stuck in "Processing"
1. Check logs for errors
2. Verify OpenAI API is responding
3. Check server is running and not crashed
4. Verify audio file is valid and not corrupted
5. Manually set status to 'error' and retry

### Transcription Shows "Error"
1. Check `error_message` field in user_documents
2. Review processing logs for that document
3. Common fixes:
   - Verify audio file is valid and not corrupted
   - Check OpenAI API key and quota
   - Ensure file size is under 25MB
   - Verify audio format is supported

### Chunks Missing Time Metadata
1. Verify transcription completed successfully
2. Check transcription logs for segment data
3. Review chunk storage logs
4. Verify chunks were created with time segments

## Related Documentation

- [User Document Processing](./user-document-processing.md) - General document processing overview
- [PDF Processing](./README.md) - PDF-specific processing details
- [Text Upload](./user-document-processing.md#text-upload) - Text upload processing

