# KDIGO ANCA Vasculitis 2024 Guideline Setup

**Date:** October 18, 2025  
**Document:** KDIGO 2024 ANCA Vasculitis Clinical Practice Guideline Update  
**PDF Location:** `/Users/jordanweinstein/GitHub/docutrain/PDFs/guidelines/KDIGO-2024-ANCA-Vasculitis-Guideline-Update.pdf`

## Summary

Successfully trained the KDIGO 2024 ANCA Vasculitis Clinical Practice Guideline Update with both embedding types using the **batch training script**.

## Database Entries

Two document entries were created:

### 1. OpenAI Embeddings (slug: `kdigo-anca-2024`)
- **Embedding Model:** OpenAI text-embedding-3-small (1536 dimensions)
- **Chunks:** 100
- **Processing Time:** 40.3s
- **Table:** `document_chunks`

### 2. Local Embeddings (slug: `kdigo-anca-2024-local`)
- **Embedding Model:** all-MiniLM-L6-v2 (384 dimensions)
- **Chunks:** 100
- **Processing Time:** 5.5s
- **Table:** `document_chunks_local`

## Document Details

- **Title:** KDIGO ANCA Vasculitis Clinical Practice Guideline Update
- **Subtitle:** 2024
- **Year:** 2024
- **Pages:** 47
- **Total Characters:** 158,638
- **File Size:** 2.0 MB
- **Back Link:** https://kdigo.org/
- **Welcome Message:** "KDIGO ANCA Vasculitis Clinical Practice Guideline Update 2024"
- **PDF Subdirectory:** `guidelines`
- **PDF Filename:** `KDIGO-2024-ANCA-Vasculitis-Guideline-Update.pdf`
- **Status:** Active

## Chunking Configuration

- **Chunk Size:** ~500 tokens (2000 chars)
- **Chunk Overlap:** ~100 tokens (400 chars)
- **Total Chunks:** 100

## Usage

### Access via URL Parameters

**OpenAI Version:**
```
http://your-domain.com/?doc=kdigo-anca-2024
```

**Local Version:**
```
http://your-domain.com/?doc=kdigo-anca-2024-local
```

### Re-processing Commands

If you need to re-chunk and re-embed this document:

**Using Batch Script (Recommended):**
```bash
node scripts/batch-train-documents.js --config=documents-to-train.json
```

**Using Individual Scripts:**
```bash
# OpenAI embeddings
node scripts/chunk-and-embed.js --doc=kdigo-anca-2024

# Local embeddings
node scripts/chunk-and-embed-local.js --doc=kdigo-anca-2024-local
```

## Metadata

Both document entries include metadata:
```json
{
  "source": "KDIGO",
  "guideline_type": "ANCA Vasculitis",
  "version": "2024",
  "update": true
}
```

## Verification

Confirmed in database:
- ✅ Documents registered in `documents` table
- ✅ 100 chunks in `document_chunks` (OpenAI)
- ✅ 100 chunks in `document_chunks_local` (Local)
- ✅ Both documents marked as active
- ✅ Foreign key constraints in place
- ✅ PDF added to `build.js` for deployment (automatically)

## Performance Comparison

- **OpenAI Embeddings:** 40.3s (0.40s per chunk)
- **Local Embeddings:** 5.5s (0.055s per chunk)

Local embeddings were ~7.3x faster than OpenAI embeddings for this document.

## Batch Training Efficiency

This document was trained using the new **batch training script**, which automated:
- ✅ Database registration (both embedding types)
- ✅ Build script update
- ✅ OpenAI embedding training
- ✅ Local embedding training
- ✅ Verification and summary report

**Total time:** 46.3 seconds (including all steps)

**Manual process would have taken:** ~15-20 minutes

## Configuration Used

```json
{
  "documents": [
    {
      "slug": "kdigo-anca-2024",
      "title": "KDIGO ANCA Vasculitis Clinical Practice Guideline Update",
      "subtitle": "2024",
      "year": "2024",
      "backLink": "https://kdigo.org/",
      "welcomeMessage": "KDIGO ANCA Vasculitis Clinical Practice Guideline Update 2024",
      "pdfFilename": "KDIGO-2024-ANCA-Vasculitis-Guideline-Update.pdf",
      "pdfSubdirectory": "guidelines",
      "embeddingTypes": "both",
      "metadata": {
        "source": "KDIGO",
        "guideline_type": "ANCA Vasculitis",
        "version": "2024",
        "update": true
      }
    }
  ]
}
```

## Notes

- This is a clinical practice guideline update focused on ANCA-associated vasculitis
- The document contains 47 pages of updated clinical recommendations
- Smaller document (100 chunks vs 264-705 chunks for other KDIGO guidelines)
- Both embedding types are available for performance testing and comparison
- The document is now searchable through the RAG system using either embedding model
- First document successfully trained using the new batch training system!

## Document Library Status

You now have **10 active documents** in the system:

| Slug | Title | Type | Year | Chunks |
|------|-------|------|------|--------|
| `smh` | Nephrology Manual | OpenAI | 2023 | - |
| `uhn` | Nephrology Manual | OpenAI | 2025 | - |
| `ckd-dc-2025` | CKD in Diabetes Guidelines | Local | 2025 | - |
| `smh-tx` | SMH Renal Transplant Manual | Local | 2024 | - |
| `kdigo-adpkd-2025` | KDIGO ADPKD Guideline | OpenAI | 2025 | 705 |
| `kdigo-adpkd-2025-local` | KDIGO ADPKD Guideline | Local | 2025 | 705 |
| `kdigo-bp-2021` | KDIGO BP Guideline | OpenAI | 2021 | 264 |
| `kdigo-bp-2021-local` | KDIGO BP Guideline | Local | 2021 | 264 |
| `kdigo-anca-2024` | **KDIGO ANCA Vasculitis Update** | **OpenAI** | **2024** | **100** |
| `kdigo-anca-2024-local` | **KDIGO ANCA Vasculitis Update** | **Local** | **2024** | **100** |

