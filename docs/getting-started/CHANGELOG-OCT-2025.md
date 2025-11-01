# Changelog - October 16, 2025

## Major Features & Enhancements

### 1. Local Embeddings Implementation ✅

**Added support for local all-MiniLM-L6-v2 embeddings as alternative to OpenAI**

- Created parallel database table `document_chunks_local` (384D vectors)
- Implemented local embedding module using @xenova/transformers
- Added embedding type switching via URL parameter: `?embedding=local` or `?embedding=openai`
- Model downloads automatically on first use (~23MB)
- Zero ongoing costs for local embeddings

**Testing Results:**
- 100% chunk overlap with OpenAI embeddings
- Comparable performance (varies by query)
- Identical answer quality (retrieves same chunks)

**New Files:**
- `lib/local-embeddings.js` - Local embedding module
- `scripts/chunk-and-embed-local.js` - Local indexing script
- `scripts/compare-embeddings.js` - Comparison test harness
- `scripts/setup-database-local.sql` - Database schema
- `LOCAL-EMBEDDINGS-TEST.md` - Documentation
- `IMPLEMENTATION-COMPLETE.md` - Quick reference

**Database Changes:**
- Added `document_chunks_local` table (Supabase)
- Added `match_document_chunks_local()` function
- Populated with 360 chunks (186 SMH, 174 UHN)

### 2. URL Parameter Control ✅

**Full configuration via URL parameters**

| Parameter | Values | Default | Description |
|-----------|--------|---------|-------------|
| `doc` | `smh`, `uhn` | `smh` | Document selection |
| `model` | `gemini`, `grok` | `gemini` | AI model selection |
| `method` | `full`, `rag` | `full` | Search mode |
| `embedding` | `openai`, `local` | `openai` | Embedding type |

**Examples:**
```
?doc=uhn&model=grok&method=rag&embedding=local
?model=grok
?doc=uhn
?method=rag&embedding=local
```

**Implementation:**
- URL parameters set initial state on page load
- Buttons reflect URL-configured selection
- Console displays all active parameters
- User can still manually switch after load

### 3. Enhanced Error Handling ✅

**Timeout Management:**
- RAG queries: 60-second timeout
- Full document queries: 30-second timeout
- Clear timeout error messages with guidance

**Error Messages:**
- Specific error details from server
- Actionable guidance for users
- Better JSON parsing error handling
- Network error differentiation

**Server Logging:**
- Request/response timing
- Embedding type tracking
- Chunk retrieval metrics
- Error tracking with timestamps
- Stage-by-stage logging (embed → retrieve → generate)

### 4. Console Debugging ✅

**URL Parameter Display:**
```
📋 URL Parameters Applied:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Document:        uhn
  Model:           grok
  Search Mode:     Targeted (RAG)
  Embedding Type:  local (384D)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Metadata Display:**
- Embedding type in dev mode
- Dimensions (1536D vs 384D)
- Response time breakdown
- Chunk retrieval info

## Modified Files

### Frontend
1. **`public/js/config.js`**
   - Added `getEmbeddingType()` function
   - Export embedding parameter helper

2. **`public/js/api.js`**
   - Added 60s/30s timeout with AbortController
   - Pass embedding parameter to API
   - Better error handling for timeouts

3. **`public/js/chat.js`**
   - Improved JSON parsing error handling
   - Better error message display
   - Enhanced error recovery

4. **`public/js/ui.js`**
   - Display embedding type in metadata
   - Show dimensions (384D or 1536D)
   - Enhanced local dev info

5. **`public/js/main.js`**
   - Added model URL parameter support
   - Console logging for all parameters
   - Button state sync with URL params

### Backend
6. **`server.js`**
   - Import local embeddings module
   - Lazy-load local model
   - Embedding type detection from URL
   - Conditional embedding generation
   - Parallel chunk retrieval functions
   - Enhanced logging throughout
   - Metadata tracking for embedding type

### Build & Configuration
7. **`build.js`**
   - Copy `lib/` directory to dist
   - Include local-embeddings module

8. **`package.json`**
   - Added @xenova/transformers dependency
   - Added `npm run embed:local` script
   - Added `npm run compare` script

9. **`.gitignore`**
   - Added `.cache/` directory

### Documentation
10. **`DEPLOYMENT.md`**
    - Added URL parameters section
    - Updated environment variables
    - Added local embeddings setup
    - New troubleshooting sections
    - Updated file structure
    - Added new features section

11. **New Documentation Files:**
    - `LOCAL-EMBEDDINGS-TEST.md`
    - `IMPLEMENTATION-COMPLETE.md`
    - `TYPO-ERROR-ANALYSIS.md`
    - `HEADER-COLLAPSE-FEATURE.md`
    - `CHANGELOG-OCT-2025.md` (this file)

## Dependencies Added

```json
{
  "@xenova/transformers": "^2.x.x"
}
```

## Database Changes

**New Table:** `document_chunks_local`
```sql
CREATE TABLE document_chunks_local (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_type TEXT NOT NULL CHECK (document_type IN ('smh', 'uhn')),
    document_name TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding vector(384),  -- 384D vs 1536D for OpenAI
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(document_type, chunk_index)
);
```

**New Function:** `match_document_chunks_local()`
- Mirrors `match_document_chunks()` but for 384D vectors
- Same similarity search algorithm
- Separate index for performance

## NPM Scripts Added

```bash
npm run embed:local  # Generate local embeddings
npm run compare      # Compare OpenAI vs local
npm run build        # Build dist/ folder
```

## Breaking Changes

**None** - All changes are backward compatible:
- Defaults to OpenAI embeddings
- URL parameters are optional
- Original functionality preserved
- No changes to existing API endpoints

## Migration Guide

### For Existing Deployments

1. **Update code:**
   ```bash
   git pull
   npm install
   npm run build
   ```

2. **Optional - Generate local embeddings:**
   ```bash
   npm run embed:local
   ```

3. **Restart server:**
   ```bash
   pm2 restart manual-bot
   ```

4. **Test:**
   - Default: Should work exactly as before
   - With `?embedding=local`: Uses local embeddings
   - All URL parameters: Full customization

### For New Deployments

Follow updated `DEPLOYMENT.md` - all steps included.

## Performance Metrics

### Test Results (8 queries)

**Response Times:**
- OpenAI: 3-25 seconds (avg 8.3s)
- Local: 3-19 seconds (avg 7.6s)
- Local faster: 5/8 queries
- OpenAI faster: 3/8 queries

**Chunk Retrieval:**
- Overlap: 100% (all queries)
- Same chunks retrieved by both systems
- Identical answer quality

**Recommendation:** 
- Use OpenAI (default) for reliability
- Use local for high-volume or offline scenarios

## Security Notes

- `.cache/` directory added to .gitignore
- No sensitive data in cache (only model files)
- API keys still required in .env
- OpenAI key optional if using local only

## Known Issues

None - All features tested and working.

## Future Enhancements

Potential improvements identified:
1. Query spell-checking/correction
2. Response streaming for better UX
3. Query result caching
4. Automatic retry on API overload
5. Progress indicators for long queries

## Credits

Implementation completed October 16, 2025.

All changes maintain backward compatibility and original functionality while adding powerful new features for customization and cost optimization.




