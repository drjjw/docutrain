# Local Embeddings Test Documentation

## Overview

This document describes the local embeddings implementation using the all-MiniLM-L6-v2 model as an alternative to OpenAI's text-embedding-3-small API. The implementation allows side-by-side testing and comparison while preserving the existing OpenAI setup for easy rollback.

## Architecture

### Two Parallel Systems

1. **OpenAI Embeddings** (existing)
   - Model: text-embedding-3-small
   - Dimensions: 1536
   - Table: `document_chunks`
   - Function: `match_document_chunks()`
   - Cost: $0.00002 per 1K tokens
   - Requires API key and internet connection

2. **Local Embeddings** (new)
   - Model: all-MiniLM-L6-v2
   - Dimensions: 384
   - Table: `document_chunks_local`
   - Function: `match_document_chunks_local()`
   - Cost: Server compute only (essentially free)
   - Works offline after model download (~90MB)

## Usage

### Switching Between Embedding Types

Use the `embedding` URL parameter to select which system to use:

**OpenAI Embeddings (default)**:
```
http://localhost:3456?embedding=openai
http://localhost:3456  (defaults to openai)
```

**Local Embeddings**:
```
http://localhost:3456?embedding=local
```

Can be combined with other parameters:
```
http://localhost:3456?doc=uhn&embedding=local
http://localhost:3456?doc=smh&embedding=openai
```

### Testing in Production

On your deployed domain:
```
https://yourdomain.com/path/to/chatbot?embedding=local
https://yourdomain.com/path/to/chatbot?embedding=openai
```

## Setup Instructions

### 1. Database Setup (Already Completed)

The `document_chunks_local` table and `match_document_chunks_local()` function have been created in Supabase with the following structure:

- Table: `document_chunks_local` with `vector(384)` column
- HNSW index for fast similarity search
- RLS policies for security
- Similarity search function

### 2. Install Dependencies (Completed)

```bash
npm install @xenova/transformers
```

### 3. Generate Local Embeddings

Run the local embedding script to populate the database:

```bash
node scripts/chunk-and-embed-local.js
```

This will:
- Download the all-MiniLM-L6-v2 model (~90MB) on first run
- Cache it in `.cache/transformers/`
- Process both PDFs (SMH and UHN)
- Generate embeddings for all chunks
- Store in `document_chunks_local` table

**Expected output**:
- SMH: ~150 chunks in ~2-3 minutes
- UHN: ~140 chunks in ~2-3 minutes

### 4. Test the Implementation

**Manual testing**:
1. Start server: `npm start`
2. Open browser: `http://localhost:3456?embedding=local`
3. Enable RAG mode
4. Ask a test question
5. Check metadata shows "Embedding: local (384D)"

**Automated comparison testing**:
```bash
node scripts/compare-embeddings.js
```

Generates `EMBEDDING-COMPARISON-RESULTS.md` with detailed comparison.

## Performance Comparison

### Expected Results

| Metric | OpenAI | Local | Notes |
|--------|--------|-------|-------|
| Embedding Time | 200-500ms | 50-200ms | Local should be faster |
| API Dependency | Yes | No | Local works offline |
| Model Download | N/A | ~90MB first run | One-time cost |
| Ongoing Cost | $0.00002/1K tokens | $0 | Local is free |
| Dimensions | 1536 | 384 | Lower dims = faster search |
| Accuracy | High | Good | Quality testing needed |

### Performance Factors

**Local embeddings are faster when**:
- Network latency to OpenAI is high
- Many concurrent requests
- Server has good CPU

**OpenAI embeddings may be faster when**:
- Very powerful GPUs on OpenAI side
- Server CPU is weak
- Cold start (model not loaded)

## Quality Assessment

### Chunk Retrieval Comparison

Expected chunk overlap: 70-90%

**High overlap (>80%)**: Both systems retrieve similar content
**Medium overlap (60-80%)**: Some differences but still usable
**Low overlap (<60%)**: Significant differences - quality review needed

### Answer Quality

Manual review needed to compare:
1. **Accuracy**: Are answers factually correct?
2. **Completeness**: Does it cover all relevant information?
3. **Relevance**: Does it answer the actual question?
4. **Typo handling**: How well does it handle misspellings?

## Files Created/Modified

### New Files
1. `scripts/setup-database-local.sql` - Database schema for local embeddings
2. `lib/local-embeddings.js` - Local embedding module
3. `scripts/chunk-and-embed-local.js` - Indexing script for local model
4. `scripts/compare-embeddings.js` - Comparison test harness
5. `LOCAL-EMBEDDINGS-TEST.md` - This documentation

### Modified Files
1. `server.js` - Added embedding type switching logic
2. `public/js/config.js` - Added `getEmbeddingType()` helper
3. `public/js/api.js` - Pass embedding parameter to API
4. `public/js/ui.js` - Display embedding type in metadata
5. `package.json` - Added @xenova/transformers dependency

## Rollback Instructions

If local embeddings don't meet quality requirements:

### Option 1: Keep Both Systems
- URL parameter defaults to 'openai'
- No action needed - original system works as before
- Local system remains available for future testing

### Option 2: Remove Local System
1. Comment out local embedding code in `server.js`:
   ```javascript
   // const { generateLocalEmbedding, ... } = require('./lib/local-embeddings');
   ```
2. Remove URL parameter handling (optional)
3. Keep database table for future use
4. Uninstall package (optional): `npm uninstall @xenova/transformers`
5. Delete `.cache/transformers/` directory to reclaim ~90MB

### Option 3: Switch to Local as Default
1. Change default in `config.js`:
   ```javascript
   export function getEmbeddingType() {
       return params.get('embedding') || 'local'; // Changed from 'openai'
   }
   ```
2. Rebuild: `npm run build`
3. Deploy

## Cost Analysis

### OpenAI Embeddings
- **Per query**: ~10 tokens = $0.0000002
- **Per 1000 queries**: ~$0.20
- **Per 10,000 queries**: ~$2.00
- **Per 100,000 queries**: ~$20.00

### Local Embeddings
- **Setup cost**: $0 (one-time model download)
- **Per query**: $0 (server compute - negligible)
- **Per 1000 queries**: $0
- **Per 10,000 queries**: $0
- **Per 100,000 queries**: $0

**Break-even**: Immediate (all queries are free)

**Server compute**: Minimal - ~50-100ms CPU per query

## Troubleshooting

### Model Download Issues
If model download fails:
1. Check internet connection
2. Clear cache: `rm -rf .cache/transformers`
3. Try again with better connection
4. Model downloads from HuggingFace CDN

### Performance Issues
If local embeddings are slow:
1. Check server CPU usage
2. Ensure model is loaded (first query is slower)
3. Consider increasing server resources
4. Check for memory constraints

### Database Errors
If chunk retrieval fails:
1. Verify table exists: Check Supabase dashboard
2. Run SQL: `SELECT COUNT(*) FROM document_chunks_local;`
3. Verify embeddings were generated
4. Check RLS policies

### Quality Issues
If answer quality is poor:
1. Compare chunk overlap percentage
2. Review retrieved chunks manually
3. Test with both embedding types
4. Consider adjusting similarity threshold
5. May need to re-embed with different chunk size

## Next Steps

After implementing and testing:

1. **Run comparison tests**:
   ```bash
   node scripts/compare-embeddings.js
   ```

2. **Review results**: Check `EMBEDDING-COMPARISON-RESULTS.md`

3. **Manual quality testing**: Compare answers from both systems

4. **Decide on default**:
   - If local is faster and quality is good → switch default
   - If comparable → keep OpenAI for reliability
   - If worse → rollback or keep as option

5. **Deploy to production**: Test with URL parameter first

6. **Monitor performance**: Track response times and user feedback

## Support

For issues or questions:
1. Check this documentation
2. Review comparison test results
3. Check server logs for errors
4. Verify database setup in Supabase
5. Test with URL parameters to isolate issues




