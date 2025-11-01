# Embedding Parameter Fix

## Issue

The batch training system was incorrectly creating **duplicate document entries** with `-local` suffix for documents trained with both embedding types:

**Wrong approach:**
- `kdigo-ckd-2024` (OpenAI embeddings)
- `kdigo-ckd-2024-local` (Local embeddings)

This was inconsistent with the original design where a single document could use either embedding type via URL parameter.

## Original Design

The system was designed to have:
- **One document entry** per actual document
- **Two embedding tables**: `document_chunks` (OpenAI) and `document_chunks_local` (Local)
- **URL parameter** to switch: `?doc=slug&embedding=local` or `?doc=slug&embedding=openai`

## Fix Applied

### 1. Database Cleanup

Removed duplicate `-local` entries and updated chunk references:

```sql
-- Update local chunks to reference base slug
UPDATE document_chunks_local 
SET document_slug = REPLACE(document_slug, '-local', '')
WHERE document_slug LIKE 'kdigo%-local';

-- Delete duplicate document entries
DELETE FROM documents 
WHERE slug IN (
    'kdigo-adpkd-2025-local',
    'kdigo-bp-2021-local',
    'kdigo-anca-2024-local',
    'kdigo-ckd-2024-local',
    'kdigo-igan-2025-local'
);
```

### 2. Batch Training Script Update

Modified `scripts/batch-train-documents.js` to create only **one document entry** with a primary embedding type:

**Before:**
```javascript
for (const embeddingType of embeddingTypes) {
    const slug = embeddingType === 'local' && embeddingTypes.length > 1
        ? `${doc.slug}-local`  // ❌ Creates duplicate
        : doc.slug;
    // ... insert with slug
}
```

**After:**
```javascript
// Determine primary embedding type (prefer OpenAI if both are specified)
const primaryEmbeddingType = embeddingTypes.includes('openai') ? 'openai' : 'local';

const record = {
    slug: doc.slug,  // ✅ Always use base slug
    embedding_type: primaryEmbeddingType,
    // ...
};

// Insert once, train both types
```

### 3. Server Logic (Already Correct)

The server already had the correct logic to handle the `?embedding=` parameter:

```javascript
// Get embedding type from query parameter
const embeddingType = req.query.embedding || 'openai';

// Route to appropriate table
if (embeddingType === 'local') {
    retrievedChunks = await findRelevantChunksLocal(queryEmbedding, documentType, 5);
} else {
    retrievedChunks = await findRelevantChunks(queryEmbedding, documentType, 5);
}
```

## Correct Usage

### Access Documents

**OpenAI embeddings (default):**
```
http://localhost:3456/?doc=kdigo-ckd-2024
http://localhost:3456/?doc=kdigo-ckd-2024&embedding=openai
```

**Local embeddings:**
```
http://localhost:3456/?doc=kdigo-ckd-2024&embedding=local
```

### Training Documents

When using `embeddingTypes: "both"` in the batch training config:
- Creates **one** document entry with `embedding_type: 'openai'`
- Trains embeddings in **both** tables:
  - `document_chunks` (OpenAI, 1536 dimensions)
  - `document_chunks_local` (Local, 384 dimensions)
- Both use the **same slug** (no `-local` suffix)

## Results

### Before Fix
- 14 document entries (5 KDIGO × 2 + 4 original)
- Inconsistent with original design
- Required `-local` suffix in URLs

### After Fix
- 9 document entries (5 KDIGO + 4 original)
- Consistent with original design
- Uses `?embedding=` parameter

### Verification

All KDIGO documents now have chunks in both tables:

| Document | OpenAI Chunks | Local Chunks |
|----------|---------------|--------------|
| kdigo-adpkd-2025 | 705 | 705 |
| kdigo-bp-2021 | 264 | 264 |
| kdigo-anca-2024 | 100 | 100 |
| kdigo-ckd-2024 | 614 | 614 |
| kdigo-igan-2025 | 178 | 178 |

## Benefits

1. **Consistency**: Matches original design pattern
2. **Simplicity**: One slug per document
3. **Flexibility**: Switch embedding types via URL parameter
4. **Clean URLs**: No `-local` suffix needed
5. **Better UX**: Same document, different embedding engines

## Related Files

- `scripts/batch-train-documents.js` - Fixed to create single entries
- `server.js` - Already had correct logic (lines 701, 726, 756)
- `public/js/config.js` - Already supports `?embedding=` parameter (line 147)

## Migration Notes

If you have existing documents with `-local` suffix:

1. Update chunk references:
   ```sql
   UPDATE document_chunks_local 
   SET document_slug = REPLACE(document_slug, '-local', '')
   WHERE document_slug LIKE '%-local';
   ```

2. Delete duplicate entries:
   ```sql
   DELETE FROM documents WHERE slug LIKE '%-local';
   ```

3. Update any hardcoded URLs from `?doc=slug-local` to `?doc=slug&embedding=local`

## Testing

After fix, verify:

1. ✅ Documents load with base slug: `?doc=kdigo-ckd-2024`
2. ✅ OpenAI embeddings work: `?doc=kdigo-ckd-2024&embedding=openai`
3. ✅ Local embeddings work: `?doc=kdigo-ckd-2024&embedding=local`
4. ✅ No `-local` entries in database
5. ✅ Chunks exist in both tables with same slug
6. ✅ Server starts without errors
7. ✅ Clear browser localStorage to refresh document cache

---

**Date:** October 18, 2025  
**Status:** ✅ Fixed and Verified

