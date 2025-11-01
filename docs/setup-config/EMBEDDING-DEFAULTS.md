# Embedding Type Defaults and Multi-Doc Strategy

**Date**: October 19, 2025  
**Status**: ✅ Implemented

## Overview

All documents in the system now default to **OpenAI embeddings** to ensure maximum compatibility and enable seamless multi-document searches.

## Current State

- **Total documents**: 117
- **Default embedding type**: OpenAI (all 117 documents)
- **Local embeddings**: Available as fallback for some documents

## Key Decisions

### 1. All Documents Default to OpenAI

**Why**: 
- Consistency across the entire document library
- Highest quality embeddings (1536 dimensions)
- Enables any document combination in multi-doc searches

**Documents with both embedding types available**:
- `smh-tx`: Has both OpenAI (23 chunks) and local (23 chunks)
- `ckd-dc-2025`: Has both OpenAI (84 chunks) and local (84 chunks)

These documents can still use local embeddings for single-document searches with `?embedding=local`, but default to OpenAI.

### 2. Multi-Doc Searches Always Use OpenAI

**Implementation**: Server automatically forces OpenAI embeddings for any multi-document search, regardless of individual document settings or URL parameters.

**Code location**: `server.js` lines 496-503

```javascript
// For multi-document searches, ALWAYS use OpenAI embeddings for consistency
if (documentSlugs.length > 1) {
    if (embeddingType !== 'openai') {
        console.log(`🔄 Multi-doc search: Forcing OpenAI embeddings (was: ${embeddingType})`);
    }
    embeddingType = 'openai';
}
```

**Validation removed**:
- ❌ Old: Rejected multi-doc searches with embedding type mismatch
- ✅ New: Auto-corrects to OpenAI, allowing all combinations

## URL Parameter Behavior

### Single Document
- `?doc=smh` → Uses OpenAI (default)
- `?doc=smh&embedding=local` → Uses local if available
- `?doc=ckd-dc-2025` → Uses OpenAI (default)
- `?doc=ckd-dc-2025&embedding=local` → Uses local (384D embeddings)

### Multi-Document
- `?doc=smh+uhn` → **Forces OpenAI** (ignores document settings)
- `?doc=smh+uhn&embedding=local` → **Still forces OpenAI** (multi-doc override)
- `?doc=smh+smh-tx` → **Forces OpenAI** (even though smh-tx was previously set to local)

## Benefits

1. ✅ **Eliminates "Embedding Type Mismatch" errors**
2. ✅ **Any document can be combined** with any other document
3. ✅ **Consistent search quality** across multi-doc queries
4. ✅ **Simpler user experience** - no need to understand embedding compatibility
5. ✅ **Preserves flexibility** - single-doc searches can still use local embeddings if desired

## Technical Details

### Database Schema
```sql
-- All documents now have:
embedding_type = 'openai'

-- Documents with dual embedding support have chunks in both tables:
-- document_chunks (OpenAI, 1536D)
-- document_chunks_local (all-MiniLM-L6-v2, 384D)
```

### Embedding Tables

**`document_chunks`** (OpenAI embeddings):
- Model: `text-embedding-3-small`
- Dimensions: 1536
- Used for: All multi-doc searches, default for single-doc

**`document_chunks_local`** (Local embeddings):
- Model: `all-MiniLM-L6-v2`
- Dimensions: 384
- Used for: Single-doc searches with `?embedding=local` (if available)

## Migration Notes

### Documents Updated (2025-10-19)
- `smh-tx`: Changed from `local` → `openai`
- `ckd-dc-2025`: Changed from `local` → `openai`

Both documents retain their local chunks in `document_chunks_local` for optional use.

### Backward Compatibility
✅ No breaking changes:
- Single-doc searches work exactly as before
- URL parameter `?embedding=local` still respected for single-doc
- Multi-doc searches now work with MORE combinations (less restrictive)

## Future Considerations

### Adding New Documents

**Default workflow** (recommended):
```bash
# 1. Add document to registry with embedding_type='openai'
# 2. Embed with OpenAI
node scripts/chunk-and-embed.js <slug>
```

**Dual embedding workflow** (optional):
```bash
# 1. Embed with OpenAI (primary)
node scripts/chunk-and-embed.js <slug>

# 2. Also embed with local (backup/testing)
node scripts/chunk-and-embed-local.js <slug>
```

### Cost Optimization

If you want to **reduce OpenAI costs** for a specific document:
1. Embed with local: `node scripts/chunk-and-embed-local.js <slug>`
2. Update DB: `UPDATE documents SET embedding_type='local' WHERE slug='<slug>'`
3. ⚠️ **Limitation**: Can't be used in multi-doc searches unless re-embedded with OpenAI

### Performance Testing

Monitor multi-doc search performance:
```sql
SELECT 
    metadata->'document_slugs' as docs,
    metadata->>'is_multi_document' as multi_doc,
    AVG(retrieval_time_ms) as avg_retrieval_ms,
    AVG(response_time_ms) as avg_response_ms,
    COUNT(*) as query_count
FROM chat_conversations
WHERE metadata->>'is_multi_document' = 'true'
GROUP BY metadata->'document_slugs', metadata->>'is_multi_document'
ORDER BY query_count DESC
LIMIT 20;
```

## Related Files

- `server.js` (lines 473-533): Multi-doc embedding override logic
- `lib/document-registry.js`: Document metadata and validation
- `scripts/chunk-and-embed.js`: OpenAI embedding script
- `scripts/chunk-and-embed-local.js`: Local embedding script

## Changelog

**2025-10-19**:
- ✅ Set all 117 documents to default to `openai` embedding type
- ✅ Added automatic OpenAI override for multi-doc searches
- ✅ Removed embedding type mismatch validation for multi-doc
- ✅ Updated `smh-tx` and `ckd-dc-2025` from local to openai
- ✅ Documented embedding strategy and behavior

---

**See Also**:
- [Multi-Document RAG Implementation](./MULTI-DOCUMENT-RAG-IMPLEMENTATION.md)
- [Multi-Doc Citation Fix](./MULTI-DOC-CITATION-FIX.md)
- [API Reference](./API_REFERENCE.md)

