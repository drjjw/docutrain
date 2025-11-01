# Batch Training Summary - KDIGO CKD 2024 & IgAN 2025

**Date:** October 18, 2025  
**Method:** Batch Training Script  
**Documents Processed:** 2 guidelines (4 total with both embedding types)

## Summary

Successfully trained two major KDIGO guidelines using the automated batch training system:
1. KDIGO CKD 2024 (199 pages, 614 chunks)
2. KDIGO IgAN/IgAV 2025 (71 pages, 178 chunks)

## Documents Trained

### 1. KDIGO CKD 2024 - Chronic Kidney Disease Guideline

**Slugs:** `kdigo-ckd-2024` (OpenAI) and `kdigo-ckd-2024-local` (Local)

#### Details:
- **Title:** KDIGO Clinical Practice Guideline for the Evaluation and Management of Chronic Kidney Disease
- **Year:** 2024
- **Pages:** 199
- **File Size:** 5.7 MB
- **Total Characters:** 980,972
- **Chunks:** 614 per embedding type
- **PubMed ID:** 38490803
- **PubMed URL:** https://pubmed.ncbi.nlm.nih.gov/38490803/

#### Training Performance:
- **OpenAI Embeddings:** 221.5s (0.36s per chunk)
- **Local Embeddings:** 26.5s (0.043s per chunk)
- **Speed Ratio:** Local was 8.4x faster

### 2. KDIGO IgAN/IgAV 2025 - IgA Nephropathy & Vasculitis Guideline

**Slugs:** `kdigo-igan-2025` (OpenAI) and `kdigo-igan-2025-local` (Local)

#### Details:
- **Title:** KDIGO Clinical Practice Guideline for IgA Nephropathy and IgA Vasculitis
- **Year:** 2025
- **Pages:** 71
- **File Size:** 2.2 MB
- **Total Characters:** 283,928
- **Chunks:** 178 per embedding type
- **PubMed ID:** 40975525
- **PubMed URL:** https://pubmed.ncbi.nlm.nih.gov/40975525/

#### Training Performance:
- **OpenAI Embeddings:** 67.9s (0.38s per chunk)
- **Local Embeddings:** 13.2s (0.074s per chunk)
- **Speed Ratio:** Local was 5.1x faster

## Batch Training Performance

### Overall Statistics

| Metric | Value |
|--------|-------|
| **Total Documents** | 2 guidelines |
| **Total Database Entries** | 4 (2 × 2 embedding types) |
| **Total Chunks Generated** | 1,584 (792 × 2 embedding types) |
| **Total Processing Time** | 330.1 seconds (5.5 minutes) |
| **Average per Document** | 82.3 seconds |

### Breakdown by Stage

| Stage | Time | Details |
|-------|------|---------|
| Validation | < 1s | Checked PDFs exist, config valid |
| Database Registration | < 1s | Added 4 document entries |
| Build Script Update | < 1s | Added 2 PDF paths |
| OpenAI Training | 289.4s | 792 chunks embedded |
| Local Training | 39.7s | 792 chunks embedded |

### Efficiency Gains

**Compared to Manual Process:**

| Task | Manual | Batch Script | Time Saved |
|------|--------|--------------|------------|
| Database setup | ~10 min | < 1s | ~10 min |
| Build.js update | ~2 min | < 1s | ~2 min |
| Training coordination | ~5 min | Automatic | ~5 min |
| **Total overhead** | **~17 min** | **< 5s** | **~17 min** |

**Actual training time** (embedding generation) is the same, but all setup and coordination is automated.

## Database Verification

### Chunks Stored

| Document | Embedding Type | Chunks | Table |
|----------|----------------|--------|-------|
| kdigo-ckd-2024 | OpenAI | 614 | document_chunks |
| kdigo-ckd-2024-local | Local | 614 | document_chunks_local |
| kdigo-igan-2025 | OpenAI | 178 | document_chunks |
| kdigo-igan-2025-local | Local | 178 | document_chunks_local |

### Metadata Included

Both documents include complete metadata:
```json
{
  "source": "KDIGO",
  "guideline_type": "CKD" | "IgA Nephropathy / IgA Vasculitis",
  "version": "2024" | "2025",
  "pubmed_id": "38490803" | "40975525",
  "pubmed_url": "https://pubmed.ncbi.nlm.nih.gov/..."
}
```

## Build Script Updates

Both PDFs automatically added to `build.js`:
```javascript
{ from: 'PDFs/guidelines/KDIGO-2024-CKD-Guideline.pdf', to: 'PDFs/guidelines/KDIGO-2024-CKD-Guideline.pdf' },
{ from: 'PDFs/guidelines/KDIGO-2025-IgAN-IgAV-Guideline.pdf', to: 'PDFs/guidelines/KDIGO-2025-IgAN-IgAV-Guideline.pdf' }
```

## Access URLs

### KDIGO CKD 2024
- OpenAI: `?doc=kdigo-ckd-2024`
- Local: `?doc=kdigo-ckd-2024-local`

### KDIGO IgAN 2025
- OpenAI: `?doc=kdigo-igan-2025`
- Local: `?doc=kdigo-igan-2025-local`

## Complete Document Library

You now have **14 active documents** (7 unique × 2 embedding types):

| # | Document | Year | Type | Pages | Chunks | PMID |
|---|----------|------|------|-------|--------|------|
| 1 | SMH Nephrology Manual | 2023 | Manual | 193 | - | - |
| 2 | UHN Nephrology Manual | 2025 | Manual | 187 | - | - |
| 3 | CKD in Diabetes Guidelines | 2025 | Guideline | 28 | - | - |
| 4 | SMH Renal Transplant Manual | 2024 | Manual | 17 | - | - |
| 5 | KDIGO ADPKD | 2025 | Guideline | 240 | 705 | 39848746 |
| 6 | KDIGO Blood Pressure | 2021 | Guideline | 92 | 264 | 33637192 |
| 7 | KDIGO ANCA Vasculitis | 2024 | Guideline | 47 | 100 | 38388102 |
| 8 | **KDIGO CKD** | **2024** | **Guideline** | **199** | **614** | **38490803** |
| 9 | **KDIGO IgAN/IgAV** | **2025** | **Guideline** | **71** | **178** | **40975525** |

## Configuration Used

```json
{
  "documents": [
    {
      "slug": "kdigo-ckd-2024",
      "title": "KDIGO Clinical Practice Guideline for the Evaluation and Management of Chronic Kidney Disease",
      "subtitle": "2024",
      "year": "2024",
      "backLink": "https://kdigo.org/",
      "welcomeMessage": "KDIGO Clinical Practice Guideline for CKD 2024",
      "pdfFilename": "KDIGO-2024-CKD-Guideline.pdf",
      "pdfSubdirectory": "guidelines",
      "embeddingTypes": "both",
      "pubmedId": "38490803",
      "metadata": {
        "source": "KDIGO",
        "guideline_type": "CKD",
        "version": "2024"
      }
    },
    {
      "slug": "kdigo-igan-2025",
      "title": "KDIGO Clinical Practice Guideline for IgA Nephropathy and IgA Vasculitis",
      "subtitle": "2025",
      "year": "2025",
      "backLink": "https://kdigo.org/",
      "welcomeMessage": "KDIGO Clinical Practice Guideline for IgAN and IgAV 2025",
      "pdfFilename": "KDIGO-2025-IgAN-IgAV-Guideline.pdf",
      "pdfSubdirectory": "guidelines",
      "embeddingTypes": "both",
      "pubmedId": "40975525",
      "metadata": {
        "source": "KDIGO",
        "guideline_type": "IgA Nephropathy / IgA Vasculitis",
        "version": "2025"
      }
    }
  ]
}
```

## Key Achievements

✅ **Automated Everything**
- Database registration
- Build script updates
- Embedding generation
- PubMed link integration
- Verification and reporting

✅ **Zero Manual Intervention**
- Single command processed both documents
- All metadata automatically populated
- Both embedding types trained in sequence
- Complete summary generated

✅ **Error-Free Execution**
- All validations passed
- All chunks successfully stored
- All foreign keys properly linked
- Build script correctly updated

✅ **Performance**
- 330 seconds total (5.5 minutes)
- Processed 1,584 chunks
- Generated 1,584 embeddings
- Stored in 2 database tables

## Lessons Learned

### What Worked Well

1. **Batch configuration format** - JSON structure is clear and easy to use
2. **Validation step** - Dry run caught any issues before processing
3. **Sequential processing** - Easier to debug than parallel
4. **Automatic PubMed integration** - No manual lookup needed
5. **Progress reporting** - Clear visibility into each stage

### Future Improvements

1. **Parallel processing** - Could train OpenAI and local simultaneously
2. **Resume capability** - Handle interruptions gracefully
3. **Incremental updates** - Only re-train changed documents
4. **Automatic PMID lookup** - Use PubMed API to find PMIDs
5. **Citation extraction** - Pull authors, journal, etc. from PubMed

## Next Steps

1. **Deploy to production** - Run `node build.js` and deploy
2. **Test documents** - Verify both work in the UI
3. **Add more guidelines** - Continue building the library
4. **Monitor performance** - Compare OpenAI vs local embedding quality

## Related Files

- `documents-to-train.json` - Configuration file used
- `scripts/batch-train-documents.js` - Batch training script
- `build.js` - Updated with new PDFs
- `BATCH-TRAINING-GUIDE.md` - Complete documentation
- `PUBMED-INTEGRATION.md` - PubMed integration guide

