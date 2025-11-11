# KDIGO ADPKD 2025 Guideline Setup

**Date:** October 18, 2025  
**Document:** KDIGO 2025 ADPKD Clinical Practice Guideline  
**PDF Location:** `/Users/jordanweinstein/GitHub/docutrain/PDFs/guidelines/KDIGO-2025-ADPKD-Guideline.pdf`

## Summary

Successfully trained the KDIGO 2025 ADPKD Clinical Practice Guideline with both embedding types.

## Database Entries

Two document entries were created:

### 1. OpenAI Embeddings (slug: `kdigo-adpkd-2025`)
- **Embedding Model:** OpenAI text-embedding-3-small (1536 dimensions)
- **Chunks:** 705
- **Processing Time:** 231.9s
- **Table:** `document_chunks`

### 2. Local Embeddings (slug: `kdigo-adpkd-2025-local`)
- **Embedding Model:** all-MiniLM-L6-v2 (384 dimensions)
- **Chunks:** 705
- **Processing Time:** 26.3s
- **Table:** `document_chunks_local`

## Document Details

- **Title:** KDIGO ADPKD Clinical Practice Guideline
- **Subtitle:** 2025
- **Year:** 2025
- **Pages:** 240
- **Total Characters:** 1,127,615
- **Back Link:** https://kdigo.org/
- **Welcome Message:** "KDIGO ADPKD Clinical Practice Guideline 2025"
- **PDF Subdirectory:** `guidelines`
- **PDF Filename:** `KDIGO-2025-ADPKD-Guideline.pdf`
- **Status:** Active

## Chunking Configuration

- **Chunk Size:** ~500 tokens (2000 chars)
- **Chunk Overlap:** ~100 tokens (400 chars)
- **Total Chunks:** 705

## Usage

### Access via URL Parameters

**OpenAI Version:**
```
http://your-domain.com/?doc=kdigo-adpkd-2025
```

**Local Version:**
```
http://your-domain.com/?doc=kdigo-adpkd-2025-local
```

### Re-processing Commands

If you need to re-chunk and re-embed this document:

**OpenAI Embeddings:**
```bash
node scripts/chunk-and-embed.js --doc=kdigo-adpkd-2025
```

**Local Embeddings:**
```bash
node scripts/chunk-and-embed-local.js --doc=kdigo-adpkd-2025-local
```

## Metadata

Both document entries include metadata:
```json
{
  "source": "KDIGO",
  "guideline_type": "ADPKD",
  "version": "2025"
}
```

## Verification

Confirmed in database:
- ✅ Documents registered in `documents` table
- ✅ 705 chunks in `document_chunks` (OpenAI)
- ✅ 705 chunks in `document_chunks_local` (Local)
- ✅ Both documents marked as active
- ✅ Foreign key constraints in place

## Performance Comparison

- **OpenAI Embeddings:** 231.9s (0.33s per chunk)
- **Local Embeddings:** 26.3s (0.037s per chunk)

Local embeddings were ~8.8x faster than OpenAI embeddings for this document.

## Notes

- This is a clinical practice guideline focused on Autosomal Dominant Polycystic Kidney Disease (ADPKD)
- The document contains 240 pages of clinical recommendations and evidence
- Both embedding types are available to allow for performance testing and comparison
- The document is now searchable through the RAG system using either embedding model

