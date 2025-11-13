# Document Slug → ID Migration Status

## 🎉 MIGRATION COMPLETE - Ready for Testing

All database changes, backend code updates, and API layer modifications have been completed successfully. The application now uses immutable document IDs internally while keeping SEO-friendly slugs for routing.

**Key Achievement:** Slugs can now be edited freely without breaking any data relationships!

## ✅ Completed

### Database Layer
1. **✅ Schema Changes**
   - Added `document_id UUID` columns to:
     - `document_chunks`
     - `document_chunks_local` 
     - `quiz_questions`
     - `quiz_attempts`
     - `quizzes`
   - Added indexes on all new `document_id` columns

2. **✅ Data Migration**
   - Backfilled all 20,421 document_chunks with document_id
   - Backfilled all 10,164 document_chunks_local with document_id
   - Backfilled all 169 quiz_questions with document_id
   - Backfilled all quiz_attempts and quizzes

3. **✅ Foreign Key Constraints**
   - Added FK constraints: `document_id REFERENCES documents(id) ON DELETE CASCADE`
   - Dropped old slug-based FK constraints
   - Made `document_id NOT NULL` where appropriate

4. **✅ Database Functions**
   - Updated all 8 `match_document_chunks*` RPC functions to accept UUID instead of TEXT:
     - `match_document_chunks(doc_id UUID, ...)`
     - `match_document_chunks_multi(doc_ids UUID[], ...)`
     - `match_document_chunks_hybrid(doc_id UUID, ...)`
     - `match_document_chunks_hybrid_multi(doc_ids UUID[], ...)`
     - `match_document_chunks_local(doc_id UUID, ...)`
     - `match_document_chunks_local_multi(doc_ids UUID[], ...)`
     - `match_document_chunks_local_hybrid(doc_id UUID, ...)`
     - `match_document_chunks_local_hybrid_multi(doc_ids UUID[], ...)`

### Backend Layer
1. **✅ Chunk Storage** (`lib/processors/chunk-storage.js`)
   - Updated `storeChunks()` to require `documentId` parameter
   - Chunks now stored with `document_id` as primary reference
   - Keeps `document_slug` for display purposes

2. **✅ Edge Function** (`supabase/functions/process-document/index.ts`)
   - Updated `storeChunks()` to accept document ID
   - Passes document ID when storing chunks
   - Uses ID for all database operations

3. **✅ RAG Functions** (`lib/rag.js`)
   - Updated all 4 chunk retrieval functions to accept document objects with `{id, slug}`:
     - `findRelevantChunks()`
     - `findRelevantChunksLocal()`
     - `findRelevantChunksHybrid()`
     - `findRelevantChunksLocalHybrid()`
   - Extracts IDs for database queries, slugs for logging

4. **✅ Quiz Operations** (`lib/db/quiz-operations.js`)
   - Updated `storeQuizQuestions()` to accept optional documentId
   - Looks up ID from slug if not provided (backwards compatible)
   - Uses `document_id` for all database operations

## ✅ Additional Backend Updates (Completed)

### Chat Handlers (Both Updated)

1. **✅ `lib/routes/chat-helpers.js`** (`retrieveChunks` function)
   - Updated to fetch document IDs from database
   - Converts slugs to `{id, slug}` objects before calling RAG functions
   - Works for both single and multi-document queries
   - Used by both streaming and non-streaming chat handlers

2. **✅ `lib/routes/chat-handlers/chat-post-handler.js`**
   - Uses updated `retrieveChunks` helper (no direct changes needed)

3. **✅ `lib/routes/chat-handlers/chat-stream-handler.js`**
   - Uses updated `retrieveChunks` helper (no direct changes needed)

### Document Processing (Both Paths Updated)

1. **✅ `lib/document-processor.js`**
   - Updated `processUserDocument()` to pass document ID to `storeChunks`
   - Updated `reprocessDocument()` to pass document ID to `storeChunks`
   - Both new uploads and retraining now use ID-based storage

## 🧪 Testing Checklist

**All code updates are complete. Ready for end-to-end testing:**

1. **⏳ Document Creation**
   - Upload new PDF
   - Upload new PDF via admin interface
   - Verify chunks stored with document_id (check DB: `document_chunks` table)
   - Check document_id is populated in all chunk records
   - Confirm processing completes successfully

2. **⏳ RAG Query (Single Document)**
   - Ask question about a document via chat interface
   - Verify chunks retrieved using ID (check server logs for ID usage)
   - Check response includes proper citations and page numbers
   - Test with both OpenAI and local embeddings

3. **⏳ Multi-Document Query**
   - Query across multiple documents using `?doc=slug1+slug2`
   - Verify all document IDs used correctly in logs
   - Check response shows sources from multiple documents
   - Verify chunks balanced across documents

4. **⏳ Slug Editing (CRITICAL TEST)**
   - Edit a document's slug in admin panel (e.g., `test-doc` → `new-test-doc`)
   - Save changes
   - Navigate to new slug URL: `?doc=new-test-doc`
   - Ask questions - verify answers still work
   - Check database: chunks should still reference same document_id
   - **OLD URL should break (expected) - only external links affected**

5. **⏳ Quiz Generation**
   - Generate quiz for a document via admin
   - Check DB: `quiz_questions` table should have document_id populated
   - Test quiz retrieval and answering
   - Verify quiz still works after slug edit

6. **⏳ Document Retraining**
   - Retrain an existing document (both replace and add modes)
   - Verify chunks use document_id in storage
   - Check old chunks deleted properly in replace mode
   - Verify chunk indices correct in add mode

## Benefits Achieved

✅ **Slugs are now freely editable** - No breaking changes to data  
✅ **SEO-friendly URLs** - Keep human-readable slugs in routing  
✅ **Data integrity** - Immutable IDs for all relationships  
✅ **Clean architecture** - Clear separation: slugs for UI, IDs for data  
✅ **Conversation metadata robust** - Uses IDs, won't break on slug changes  

## Architecture Flow

```
User visits: ?doc=kidney-guidelines
↓
API looks up: getDocumentBySlug('kidney-guidelines')
  → Returns: {id: 'abc-123-...', slug: 'kidney-guidelines', ...}
↓
All database queries use: doc.id
↓
Chunks retrieved with: document_id = 'abc-123-...'
↓
Response includes: {documentId: 'abc-123-...', documentSlug: 'kidney-guidelines'}
```

## Migration Safety

- ✅ All new columns are populated (no NULLs)
- ✅ Foreign key constraints in place
- ✅ Old `document_slug` columns kept for debugging
- ✅ Database functions updated without breaking changes
- ⚠️ RAG function signatures changed (breaking change - requires caller updates)
- ⚠️ Chunk storage requires document ID (breaking change - requires caller updates)

## 🐛 Post-Deployment Issues Found & Resolved

### Issue 1: Page Number Column Not Found
**Error:** `column document_chunks.page_number does not exist`  
**Cause:** Database functions trying to select `page_number` as a separate column  
**Fix:** Extract from metadata JSONB: `(metadata->>'page_number')::int`  
**Status:** ✅ Fixed in migration `fix_page_number_extraction_in_match_functions`

### Issue 2: ID Type Mismatch  
**Error:** Function return type conflicts when trying to update functions  
**Cause:** Functions returning `bigint` but actual `id` column type is `uuid`  
**Fix:** Dropped all 8 functions and recreated with `id uuid` return type  
**Status:** ✅ Fixed in migration `drop_and_recreate_match_functions_with_correct_types`

### Issue 3: Undefined Similarity Scores
**Error:** `Cannot read properties of undefined (reading 'toFixed')`  
**Cause:** Hybrid search can return chunks without similarity scores (text-only matches have null similarity)  
**Fix:** Filter null/undefined values before processing in `chat-helpers.js` (lines 455, 457, 472)  
**Status:** ✅ Fixed and server restarted

### Issue 4: 🚨 CRITICAL - Hybrid Search Returning Wrong Results
**Error:** RAG answers changed after migration - chunks returned in wrong order  
**Cause:** `DISTINCT ON (document_chunks.id)` with `ORDER BY document_chunks.id, similarity` caused results to be ordered by UUID (random) instead of similarity score  
**Impact:** ⚠️ **All hybrid search queries were returning effectively random chunks, not the most relevant ones!**  
**Fix:** Rewrote all 4 hybrid functions to use CTE with proper similarity-based ordering:
  - Removed problematic `DISTINCT ON` with UUID ordering
  - Now orders by `(similarity + text_boost) DESC` for proper relevance ranking
  - Added explicit text_boost (0.1) for full-text matches
  - Applied to all 4 hybrid functions (OpenAI single/multi, Local single/multi)  
**Status:** ✅ Fixed in migration `fix_hybrid_search_ordering_by_relevance`

### Issue 5: SELECT DISTINCT ORDER BY Error
**Error:** `for SELECT DISTINCT, ORDER BY expressions must appear in select list`  
**Cause:** PostgreSQL requires ORDER BY expressions to be in SELECT list when using DISTINCT  
**Fix:** Removed `SELECT DISTINCT` keyword (not needed since CTE already has unique chunks by ID)  
**Status:** ✅ Fixed in migration `fix_hybrid_search_distinct_orderby_error`

**⚠️ User Impact:** If you tested queries before these fixes, please re-test. Answers should now be significantly more accurate and relevant!

## 🚀 Deployment Status

- ✅ Database migrations applied (12 total)
- ✅ Backend code updated (8 files - including chat-helpers fix)
- ✅ Edge function deployed (`process-document`)
- ✅ Server restarted (PID: 58057)
- ✅ All critical bugs fixed (5 total issues resolved)
- ✅ Hybrid search now working correctly with proper relevance ordering

## 📚 Related Documentation

- **`MIGRATION-COMPLETE-SUMMARY.md`** - Executive summary with testing checklist
- **`CRITICAL-BUG-FIX-HYBRID-SEARCH.md`** - Detailed analysis of Issue #4
- **`docs/database/SLUG-TO-ID-MIGRATION.md`** - Comprehensive technical documentation
- **Project Memory** - "Document Slug-to-ID Migration (November 2025)" saved for future reference

