# KDIGO Blood Pressure 2021 Guideline Setup

**Date:** October 18, 2025  
**Document:** KDIGO 2021 Blood Pressure Clinical Practice Guideline  
**PDF Location:** `/Users/jordanweinstein/GitHub/docutrain/PDFs/guidelines/KDIGO-2021-BP-GL.pdf`

## Summary

Successfully trained the KDIGO 2021 Blood Pressure Clinical Practice Guideline with both embedding types.

## Database Entries

Two document entries were created:

### 1. OpenAI Embeddings (slug: `kdigo-bp-2021`)
- **Embedding Model:** OpenAI text-embedding-3-small (1536 dimensions)
- **Chunks:** 264
- **Processing Time:** 123.5s
- **Table:** `document_chunks`

### 2. Local Embeddings (slug: `kdigo-bp-2021-local`)
- **Embedding Model:** all-MiniLM-L6-v2 (384 dimensions)
- **Chunks:** 264
- **Processing Time:** 21.1s
- **Table:** `document_chunks_local`

## Document Details

- **Title:** KDIGO Blood Pressure Clinical Practice Guideline
- **Subtitle:** 2021
- **Year:** 2021
- **Pages:** 92
- **Total Characters:** 422,299
- **File Size:** 4.4 MB
- **Back Link:** https://kdigo.org/
- **Welcome Message:** "KDIGO Blood Pressure Clinical Practice Guideline 2021"
- **PDF Subdirectory:** `guidelines`
- **PDF Filename:** `KDIGO-2021-BP-GL.pdf`
- **Status:** Active

## Chunking Configuration

- **Chunk Size:** ~500 tokens (2000 chars)
- **Chunk Overlap:** ~100 tokens (400 chars)
- **Total Chunks:** 264

## Usage

### Access via URL Parameters

**OpenAI Version:**
```
http://your-domain.com/?doc=kdigo-bp-2021
```

**Local Version:**
```
http://your-domain.com/?doc=kdigo-bp-2021-local
```

### Re-processing Commands

If you need to re-chunk and re-embed this document:

**OpenAI Embeddings:**
```bash
node scripts/chunk-and-embed.js --doc=kdigo-bp-2021
```

**Local Embeddings:**
```bash
node scripts/chunk-and-embed-local.js --doc=kdigo-bp-2021-local
```

## Metadata

Both document entries include metadata:
```json
{
  "source": "KDIGO",
  "guideline_type": "Blood Pressure",
  "version": "2021"
}
```

## Verification

Confirmed in database:
- ✅ Documents registered in `documents` table
- ✅ 264 chunks in `document_chunks` (OpenAI)
- ✅ 264 chunks in `document_chunks_local` (Local)
- ✅ Both documents marked as active
- ✅ Foreign key constraints in place
- ✅ PDF added to `build.js` for deployment

## Performance Comparison

- **OpenAI Embeddings:** 123.5s (0.47s per chunk)
- **Local Embeddings:** 21.1s (0.08s per chunk)

Local embeddings were ~5.9x faster than OpenAI embeddings for this document.

## Build Script Updated

The PDF has been added to `build.js` (line 212) to ensure it's included in the dist folder during deployment:
```javascript
{ from: 'PDFs/guidelines/KDIGO-2021-BP-GL.pdf', to: 'PDFs/guidelines/KDIGO-2021-BP-GL.pdf' }
```

## Notes

- This is a clinical practice guideline focused on Blood Pressure management in CKD
- The document contains 92 pages of clinical recommendations and evidence
- Both embedding types are available to allow for performance testing and comparison
- The document is now searchable through the RAG system using either embedding model
- Smaller than the ADPKD guideline (264 chunks vs 705 chunks)


