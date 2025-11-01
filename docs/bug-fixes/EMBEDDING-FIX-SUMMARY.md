# Embedding Parameter Fix - Summary

**Date:** October 18, 2025  
**Status:** ✅ Complete

## Problem

The batch training system was creating duplicate document entries with `-local` suffix, which was inconsistent with the original design:

```
❌ BEFORE:
- kdigo-ckd-2024 (OpenAI)
- kdigo-ckd-2024-local (Local)
```

This required users to know about the `-local` suffix and use different slugs for the same document.

## Solution

Fixed to match the original design where a single document can use either embedding type via URL parameter:

```
✅ AFTER:
- kdigo-ckd-2024 (primary: OpenAI, supports both)
  Access: ?doc=kdigo-ckd-2024&embedding=openai
  Access: ?doc=kdigo-ckd-2024&embedding=local
```

## Changes Made

### 1. Database Cleanup ✅

```sql
-- Updated chunk references
UPDATE document_chunks_local 
SET document_slug = REPLACE(document_slug, '-local', '')
WHERE document_slug LIKE 'kdigo%-local';

-- Removed duplicate entries
DELETE FROM documents WHERE slug LIKE '%-local';
```

**Result:**
- Reduced from 14 to 9 document entries
- All chunks now reference base slugs
- No more `-local` suffixes in database

### 2. Batch Training Script ✅

**File:** `scripts/batch-train-documents.js`

**Changed:**
- Creates ONE document entry per document
- Sets primary embedding type (prefers OpenAI if both specified)
- Trains chunks in both tables when `embeddingTypes: "both"`
- Returns results for all trained embedding types

**Key change:**
```javascript
// OLD: Created separate entries with -local suffix
const slug = embeddingType === 'local' && embeddingTypes.length > 1
    ? `${doc.slug}-local`
    : doc.slug;

// NEW: Always use base slug
const slug = doc.slug;
const primaryEmbeddingType = embeddingTypes.includes('openai') ? 'openai' : 'local';
```

### 3. Documentation Updates ✅

**Updated files:**
- `BATCH-TRAINING-GUIDE.md` - Corrected embedding type descriptions
- `EMBEDDING-PARAMETER-FIX.md` - Detailed fix documentation
- `DOCUMENT-ACCESS-GUIDE.md` - New comprehensive access guide
- `TROUBLESHOOTING.md` - Added common issues and solutions

**Updated memory:**
- Memory ID 10056120 now includes correct `?embedding=` parameter usage

### 4. Server Verification ✅

Server already had correct logic (no changes needed):
- Reads `?embedding=` parameter from query string
- Routes to appropriate table based on embedding type
- Supports both OpenAI and local embeddings per document

## Verification

### Database State ✅

**Documents:**
```
9 total documents (5 KDIGO + 4 original)
All with single slugs, no -local suffix
```

**Chunks:**
```
| Document          | OpenAI | Local |
|-------------------|--------|-------|
| kdigo-adpkd-2025  | 705    | 705   |
| kdigo-bp-2021     | 264    | 264   |
| kdigo-anca-2024   | 100    | 100   |
| kdigo-ckd-2024    | 614    | 614   |
| kdigo-igan-2025   | 178    | 178   |
```

### Server Status ✅

```
✓ Server running on port 3456
✓ 9 documents loaded
✓ All KDIGO documents accessible
✓ No -local suffixes in loaded documents
```

### API Response ✅

```bash
curl http://localhost:3456/api/documents
```

Returns 9 documents, all with base slugs:
- ✅ `kdigo-adpkd-2025`
- ✅ `kdigo-bp-2021`
- ✅ `kdigo-anca-2024`
- ✅ `kdigo-ckd-2024`
- ✅ `kdigo-igan-2025`

## Usage Examples

### Correct Usage ✅

**OpenAI embeddings (default):**
```
http://localhost:3456/?doc=kdigo-ckd-2024
http://localhost:3456/?doc=kdigo-ckd-2024&embedding=openai
```

**Local embeddings:**
```
http://localhost:3456/?doc=kdigo-ckd-2024&embedding=local
```

**With other parameters:**
```
http://localhost:3456/?doc=kdigo-ckd-2024&embedding=local&model=grok&method=rag
```

### Incorrect Usage ❌

**Don't use -local suffix:**
```
http://localhost:3456/?doc=kdigo-ckd-2024-local  ❌ (no longer works)
```

**Use ?embedding= parameter instead:**
```
http://localhost:3456/?doc=kdigo-ckd-2024&embedding=local  ✅
```

## Training New Documents

### Configuration

When using `embeddingTypes: "both"`:

```json
{
  "slug": "your-doc",
  "embeddingTypes": "both",
  ...
}
```

**Result:**
- ✅ Creates ONE document entry: `your-doc`
- ✅ Trains OpenAI chunks in `document_chunks`
- ✅ Trains local chunks in `document_chunks_local`
- ✅ Both accessible via `?embedding=` parameter

### Running Training

```bash
node scripts/batch-train-documents.js --config=documents.json
```

**Output:**
```
1️⃣  Adding to database registry...
  ✓ Added your-doc to registry (primary: openai)

3️⃣  Training embeddings...
  🔄 Training your-doc with openai embeddings...
  ✓ Completed your-doc (openai) in 145.3s
  
  🔄 Training your-doc with local embeddings...
  ✓ Completed your-doc (local) in 28.7s
```

## Browser Cache

**Important:** After adding new documents, clear browser cache:

1. **Clear localStorage:**
   - DevTools → Application → Local Storage
   - Delete `ukidney-documents-cache`
   - Refresh page

2. **Or hard refresh:**
   - Mac: `Cmd + Shift + R`
   - Windows: `Ctrl + Shift + R`

3. **Or wait 5 minutes** for automatic cache expiration

## Benefits

1. ✅ **Consistency** - Matches original design pattern
2. ✅ **Simplicity** - One slug per document
3. ✅ **Flexibility** - Switch embedding types via URL
4. ✅ **Clean URLs** - No `-local` suffix clutter
5. ✅ **Better UX** - Same document, different engines
6. ✅ **Fewer entries** - Cleaner database (9 vs 14 documents)

## Testing Checklist

- [x] Database cleaned (no `-local` entries)
- [x] Chunks reference base slugs
- [x] Server loads 9 documents
- [x] API returns correct structure
- [x] Batch training script updated
- [x] Documentation updated
- [x] Memory updated
- [x] All KDIGO documents accessible
- [x] Both embedding types work per document

## Next Steps

1. **Test in browser:**
   - Clear localStorage
   - Try `?doc=kdigo-igan-2025`
   - Try `?doc=kdigo-igan-2025&embedding=local`
   - Verify both work correctly

2. **Train future documents:**
   - Use updated batch training script
   - Single slug per document
   - Use `embeddingTypes: "both"` for dual support

3. **Monitor:**
   - Check server logs for errors
   - Verify queries return results
   - Compare OpenAI vs Local performance

## Related Documentation

- [EMBEDDING-PARAMETER-FIX.md](EMBEDDING-PARAMETER-FIX.md) - Detailed technical fix
- [DOCUMENT-ACCESS-GUIDE.md](DOCUMENT-ACCESS-GUIDE.md) - How to access documents
- [BATCH-TRAINING-GUIDE.md](BATCH-TRAINING-GUIDE.md) - How to train documents
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common issues

---

**Completed:** October 18, 2025  
**Verified:** All systems operational ✅

