# Accurate Page Number Detection

## Overview

As of this implementation, all document chunking and embedding scripts use **accurate page number detection** instead of page estimation. This ensures that page citations in the RAG system are reliable and precise.

## How It Works

### Page Marker Detection

1. **PDF Parsing**: When a PDF is loaded, the `cleanPDFText()` function converts "Page X" headers into standardized `[Page X]` citation markers.

2. **Marker Indexing**: The `chunkText()` function:
   - Finds all `[Page X]` markers in the text
   - Records their positions
   - Sorts them by position

3. **Chunk Assignment**: For each chunk:
   - Calculates the chunk's center position
   - Finds which page markers it falls between
   - Assigns the accurate page number based on marker positions

### Metadata Storage

Each chunk is stored with:
- `page_number`: The accurate page number (integer)
- `page_markers_found`: Total number of page markers detected in the document

**Old field (deprecated)**: `estimated_page` - no longer used

## Training Scripts

Both training scripts implement accurate page detection:

### OpenAI Embeddings
**Script**: `scripts/chunk-and-embed.js`
- Uses: `text-embedding-3-small` model
- Stores in: `document_chunks` table
- Field: `metadata.page_number`

### Local Embeddings
**Script**: `scripts/chunk-and-embed-local.js`
- Uses: `all-MiniLM-L6-v2` model (local)
- Stores in: `document_chunks_local` table
- Field: `metadata.page_number`

## Server-Side Usage

The server (`server.js`) retrieves page numbers from chunks:

```javascript
const pageInfo = chunk.metadata?.page_number 
    ? ` [Page ${chunk.metadata.page_number}]` 
    : '';
```

This appends accurate page citations to context provided to the AI.

## Training New Documents

To train new documents with accurate page detection:

### Single Document
```bash
# OpenAI embeddings
node scripts/chunk-and-embed.js --doc=<document-slug>

# Local embeddings
node scripts/chunk-and-embed-local.js --doc=<document-slug>
```

### Multiple Documents (Batch)
```bash
# OpenAI embeddings
./scripts/batch-train.sh openai <doc1> <doc2> <doc3> ...

# Local embeddings
./scripts/batch-train.sh local <doc1> <doc2> <doc3> ...
```

### All Documents
```bash
# OpenAI embeddings
node scripts/chunk-and-embed.js --all

# Local embeddings
node scripts/chunk-and-embed-local.js --all
```

## Migration Status

**Completed**: All 120 documents have been trained/migrated with accurate page detection in both tables:
- ✅ `document_chunks` (OpenAI): 120 documents
- ✅ `document_chunks_local` (Local): 120 documents

## Verification

To verify a document has accurate page numbers:

```javascript
const { data } = await supabase
    .from('document_chunks')
    .select('metadata')
    .eq('document_slug', '<slug>')
    .limit(1);

// Should have: data[0].metadata.page_number
// Should NOT have: data[0].metadata.estimated_page
```

## Key Implementation Details

### Page Detection Logic

```javascript
// Find chunk center position
const chunkCenter = start + (end - start) / 2;

// Find which page markers it falls between
for (let i = 0; i < pageMarkers.length; i++) {
    if (chunkCenter < pageMarkers[i].position) {
        if (i === 0) {
            actualPage = 1; // Before first marker
        } else {
            actualPage = pageMarkers[i - 1].pageNum; // Between markers
        }
        break;
    }
}

// After last marker
if (chunkCenter >= pageMarkers[pageMarkers.length - 1].position) {
    actualPage = pageMarkers[pageMarkers.length - 1].pageNum;
}
```

### Fallback Behavior

- If no page markers are found: `page_markers_found = 0`
- Default page assignment: Page 1
- Page numbers are clamped to valid range: `[1, totalPages]`

## Benefits

1. **Accuracy**: Page citations are based on actual page markers, not estimates
2. **Reliability**: Users can trust page references in AI responses
3. **Consistency**: All documents use the same detection method
4. **Transparency**: `page_markers_found` indicates detection confidence

## Future Considerations

- Documents with no "Page X" headers will default to page 1 for all chunks
- Consider alternative page detection methods for PDFs without page markers
- Monitor `page_markers_found = 0` cases for potential improvements

