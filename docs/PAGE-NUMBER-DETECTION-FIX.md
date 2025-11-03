# Page Number Detection Fix

**Date**: November 1, 2025  
**Issue**: Incorrect page numbers in chunk metadata causing AI to cite non-existent pages

## Problem Description

When processing PDFs, the chunking algorithm was incorrectly detecting which page each chunk belonged to. This caused the AI to cite page numbers that didn't exist in the document.

### Example Issue
- User document: "Evidence-to-Action_Obesity-Management" (97 pages total)
- AI response cited: "Page 100 (SURMOUNT-5 trial overview)"
- Actual page in document: Much lower page number

### Root Cause

The original algorithm used the **center position** of each chunk to determine its page number:

```javascript
// OLD ALGORITHM (INCORRECT)
const chunkCenter = start + (end - start) / 2;
// Find which page marker is closest to chunk center
```

**Why this failed:**
1. Chunks often span multiple pages
2. Using the center position could miss page markers at the beginning or end of chunks
3. When chunks had multiple page markers, it would pick the wrong one based on center position
4. This led to chunks being assigned incorrect page numbers (e.g., page 1 or 2 when they actually contained content from page 20+)

## Solution

Changed the algorithm to find the **LAST page marker within the chunk's range**:

```javascript
// NEW ALGORITHM (CORRECT)
// Find all page markers that fall within this chunk's range
const markersInChunk = pageMarkers.filter(marker => 
    marker.position >= start && marker.position < end
);

if (markersInChunk.length > 0) {
    // Use the LAST page marker found in this chunk
    actualPage = markersInChunk[markersInChunk.length - 1].pageNum;
} else {
    // No markers in this chunk - find the last marker BEFORE this chunk
    for (let i = pageMarkers.length - 1; i >= 0; i--) {
        if (pageMarkers[i].position < start) {
            actualPage = pageMarkers[i].pageNum;
            break;
        }
    }
}
```

**Why this works:**
1. If a chunk contains multiple page markers, we use the LAST one (most recent page)
2. If a chunk has no page markers, we find the last marker BEFORE the chunk starts
3. This ensures chunks are assigned to the correct page, especially when spanning multiple pages

## Files Modified

1. `/lib/document-processor.js` - Main document processing (user uploads)
2. `/scripts/chunk-and-embed.js` - Batch processing script (OpenAI embeddings)
3. `/scripts/chunk-and-embed-local.js` - Batch processing script (local embeddings)
4. `/scripts/chunk-and-embed-with-abstract-test.js` - Test script

## Impact on Existing Documents

**IMPORTANT**: This fix only applies to documents processed AFTER the fix is deployed.

### For Existing Documents with Wrong Page Numbers

Documents that were already processed with the old algorithm will still have incorrect page numbers in their chunk metadata. To fix them:

**Option 1: Reprocess the document**
1. Delete the document from the admin panel
2. Re-upload and reprocess it
3. The new chunks will have correct page numbers

**Option 2: Run a database migration** (for batch fixes)
- Would need to re-extract and re-chunk all affected documents
- More complex but fixes all documents at once

## How Page Numbers Work in the System

1. **PDF Extraction** (`extractPDFTextWithPageMarkers`):
   - Extracts text page by page
   - Inserts `[Page X]` markers at the start of each page
   - Example: `[Page 1]\nContent...\n\n[Page 2]\nMore content...`

2. **Chunking** (`chunkText`):
   - Splits text into overlapping chunks (~500 tokens each)
   - Detects which page each chunk belongs to using page markers
   - Stores page number in `metadata.page_number`

3. **RAG Retrieval** (`getRAGSystemPrompt` in `/lib/rag.js`):
   - Retrieves relevant chunks from database
   - Reads `chunk.metadata.page_number` for citations
   - Formats as `[Page X]` in references

4. **AI Citations**:
   - AI includes footnotes like `[1]`, `[2]` in response
   - References section shows: `[1] Page 15`, `[2] Page 42`

## Testing

To verify the fix works:

1. Upload a new PDF document
2. Ask a question that retrieves specific chunks
3. Check the page numbers in the AI's references
4. Manually verify those page numbers exist in the original PDF
5. Cross-reference with the actual content on those pages

## Related Issues

- Page numbers appearing as `null` in metadata → Different issue (metadata not being saved)
- Page markers not appearing in content → Issue with PDF extraction
- Wrong page numbers (this issue) → Fixed by this change

## RLS Considerations

When making changes to document processing:
- ✅ No RLS policies affected (this is a data processing fix)
- ✅ No database schema changes
- ✅ No permission changes
- ✅ Only affects how page numbers are calculated during chunking



