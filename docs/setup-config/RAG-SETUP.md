# RAG Enhancement Setup Guide

This document explains the RAG (Retrieval Augmented Generation) enhancement added to the PDF chatbot.

## Overview

The RAG enhancement provides an alternative query method that:
- Chunks PDFs into smaller segments
- Generates vector embeddings using OpenAI
- Stores embeddings in Supabase with pgvector
- Retrieves only relevant chunks for each query (instead of sending the entire PDF)
- Potentially faster and more cost-effective for large documents

## Architecture

```
User Query → Generate Query Embedding → Find Similar Chunks → Build Context → AI Response
```

### Components

1. **Database** (`document_chunks` table in Supabase)
   - Stores text chunks with 1536-dimensional embeddings
   - Uses pgvector extension for similarity search
   - Indexed with HNSW for fast retrieval

2. **Embedding Script** (`scripts/chunk-and-embed.js`)
   - Processes PDFs into 500-token chunks with 100-token overlap
   - Generates embeddings using OpenAI `text-embedding-3-small`
   - Stores in Supabase

3. **Backend** (`server.js`)
   - New endpoint: `POST /api/chat-rag`
   - Embeds queries and finds top 5 similar chunks
   - Passes condensed context to AI models

4. **Frontend** (`public/index.html`)
   - Toggle button: "Full Doc" vs "RAG Mode"
   - Displays retrieval metadata in RAG mode

## Setup Instructions

### 1. Prerequisites

- OpenAI API key (for embeddings)
- Supabase project already configured
- Node.js environment

### 2. Add OpenAI API Key

Edit `.env` and add your OpenAI API key:

```bash
OPENAI_API_KEY=sk-your-actual-openai-key-here
```

### 3. Database Schema (Already Applied)

The database has been set up with:
- ✅ `document_chunks` table with vector column
- ✅ pgvector extension enabled
- ✅ HNSW index for fast similarity search
- ✅ `match_document_chunks()` function
- ✅ RLS policies configured

### 4. Generate Embeddings

Run the embedding script to process both PDFs:

```bash
npm run embed
```

This will:
- Load SMH Manual (2023) and UHN Manual (2025)
- Split into ~300-400 chunks each
- Generate OpenAI embeddings
- Store in Supabase

**Expected runtime:** 5-10 minutes (depending on API speed)

**Cost estimate:** ~$0.50-1.00 for both documents (OpenAI embedding pricing)

### 5. Test the RAG Mode

1. Start the server: `npm start`
2. Open http://localhost:3456
3. Click the "🔍 RAG Mode" button
4. Ask a question and compare responses

## Usage

### Full Doc Mode (Default)
- Uses the entire PDF as context
- Best for comprehensive, document-wide queries
- Slower, higher token usage

### RAG Mode
- Uses only top 5 relevant chunks
- Best for specific, targeted questions
- Faster, lower token usage
- Shows chunk metadata in response

## Comparison

| Aspect | Full Doc Mode | RAG Mode |
|--------|---------------|----------|
| Context Size | ~500KB | ~10KB |
| Speed | Slower | Faster |
| Cost per Query | Higher | Lower |
| Accuracy | Comprehensive | Targeted |
| Best For | Broad questions | Specific facts |

## Monitoring

- RAG performance logged in browser console
- Database logging tracks `retrieval_method`, `chunks_used`, `retrieval_time_ms`
- Check Supabase analytics for embedding storage

## Troubleshooting

### "Quota exceeded" Error
- Check OpenAI API limits
- Reduce `BATCH_SIZE` in embedding script
- Wait and retry later

### No Chunks Found
- Verify embeddings were generated: Check `document_chunks` table in Supabase
- Lower `match_threshold` in `findRelevantChunks()` function

### Poor Results in RAG Mode
- Increase number of chunks retrieved (default: 5)
- Adjust `match_threshold` for similarity
- Try Full Doc Mode for comparison

## Files Modified

- ✅ `/scripts/setup-database.sql` - Database schema
- ✅ `/scripts/chunk-and-embed.js` - Embedding generation
- ✅ `/server.js` - RAG backend functions and endpoint
- ✅ `/public/index.html` - RAG mode toggle UI
- ✅ `/package.json` - Added `npm run embed` script
- ✅ `/.env` - Added OPENAI_API_KEY

## Rollback

To disable RAG without removing code:
1. Hide the RAG toggle button in CSS:
   ```css
   .retrieval-selector { display: none; }
   ```
2. Full Doc mode remains unchanged

To remove completely:
1. Drop database table: `DROP TABLE document_chunks;`
2. Remove RAG code sections (marked with comments)
3. Delete `scripts/` directory

## Future Enhancements

- [ ] Hybrid retrieval (combine RAG + full context)
- [ ] Adjustable chunk count in UI
- [ ] Semantic caching for common queries
- [ ] Support for additional documents
- [ ] Re-ranking retrieved chunks
- [ ] Metadata filtering (e.g., by page number)

## Questions?

The RAG enhancement is completely additive - the existing Full Doc mode works exactly as before. Toggle between modes to compare results for your specific use cases.

