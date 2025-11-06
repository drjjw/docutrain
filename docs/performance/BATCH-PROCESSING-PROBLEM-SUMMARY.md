# PDF Batch Processing Performance Problem & Fix Summary

## The Problem

**Symptom**: Large PDF documents (1000 pages) were taking too long to process, with ~78 batches queued for a single document.

**Root Cause**: The embedding generation code was making **individual API calls for each chunk**, even though it was organized into "batches". 

**What was happening**:
- Code had a `processEmbeddingsBatch()` function that took 50 chunks
- But inside that function, it looped through each chunk and made a separate OpenAI API call
- So a "batch" of 50 chunks = 50 separate API calls
- For 3900 chunks: 78 batches × 50 API calls = **3,900 individual API calls**
- Each API call has ~200ms network latency
- Total time: ~13-14 minutes just for API calls

**The bottleneck**: Not the batch size, but the fact that each chunk was processed individually instead of using OpenAI's batch API.

## The Fix

**Solution**: Use OpenAI's batch embedding API which accepts an array of texts in a single request.

**Changes made**:
1. **Modified `processEmbeddingsBatch()`** to pass an array of texts to OpenAI instead of looping:
   ```javascript
   // Before: Loop through chunks, make individual calls
   for (const chunk of batch) {
       await generateEmbedding(chunk.content); // Individual API call
   }
   
   // After: Pass array to batch API
   const texts = batch.map(chunk => chunk.content);
   await openaiClient.embeddings.create({
       input: texts, // Array = batch processing
   });
   ```

2. **Increased batch sizes**: 50 → 200 chunks per batch (OpenAI supports up to 2048)
3. **Reduced delays**: 100ms → 50ms between batches (fewer API calls = less delay needed)

**Result**:
- 3,900 API calls → 20 API calls (195x reduction)
- ~13-14 minutes → ~40-45 seconds (18-20x faster)
- Same cost, much faster processing

## Key Insight

The problem wasn't that batches were too small - it was that **the code wasn't actually batching at the API level**. It was batching at the organizational level (grouping chunks) but still making individual API calls. OpenAI's embedding API supports true batch processing by accepting an array of inputs, which the code wasn't using.

## Files Changed

- `lib/processors/embedding-generator.js` - Implemented batch API with fallback
- `lib/config/document-processing.js` - Increased batch sizes (50→200) and reduced delays (100ms→50ms)

## Configuration

Defaults changed:
- `EMBEDDING_BATCH_SIZE`: 50 → 200
- `BASE_BATCH_DELAY_MS`: 100 → 50
- `STORAGE_INSERT_BATCH_SIZE`: 50 → 200

Can be overridden via environment variables if needed.
