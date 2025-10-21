# Batch Processing Documents

## 🎯 Overview

Batch processing allows you to process multiple documents efficiently, either with OpenAI embeddings, local embeddings, or both.

## 📝 Scripts Available

### 1. batch-train.sh (Simple Batch Processing)

**Location**: `scripts/batch-train.sh`

**Purpose**: Process multiple documents with a single embedding type

**Usage**:
```bash
./scripts/batch-train.sh <embedding-type> <doc1> <doc2> <doc3> ...
```

**Examples**:
```bash
# OpenAI embeddings
./scripts/batch-train.sh openai doc1-slug doc2-slug doc3-slug

# Local embeddings
./scripts/batch-train.sh local doc1-slug doc2-slug doc3-slug
```

**Features**:
- Processes documents sequentially
- Tracks success/failure for each document
- Provides summary at the end
- Logs output to file (optional)

### 2. batch-train-documents.js (Full Pipeline)

**Location**: `scripts/batch-train-documents.js`

**Purpose**: Complete document pipeline including registry updates and training

**Usage**:
```bash
node scripts/batch-train-documents.js
```

**Features**:
- Reads configuration from JSON file
- Adds documents to registry
- Updates build.js
- Trains both embedding types
- More comprehensive but slower

## 🚀 Quick Examples

### Example 1: Process KDIGO Guidelines

```bash
./scripts/batch-train.sh openai \
  kdigo-ckd-2024 \
  kdigo-igan-2025 \
  kdigo-adpkd-2025 \
  kdigo-bp-2021

./scripts/batch-train.sh local \
  kdigo-ckd-2024 \
  kdigo-igan-2025 \
  kdigo-adpkd-2025 \
  kdigo-bp-2021
```

### Example 2: Process AJKD Papers

```bash
# Create a list file
cat > /tmp/ajkd-batch.txt << EOF
ajkd-cc-iga-nephropathy
ajkd-cc-membranous-nephropathy
ajkd-cc-lupus-nephritis
ajkd-cc-anca-vasculitis
EOF

# Process with OpenAI
cat /tmp/ajkd-batch.txt | xargs ./scripts/batch-train.sh openai

# Process with local
cat /tmp/ajkd-batch.txt | xargs ./scripts/batch-train.sh local
```

### Example 3: Reprocess All Documents

```bash
# Get all document slugs from database
psql $DATABASE_URL -c "SELECT slug FROM document_registry WHERE is_active = true" -t > /tmp/all-docs.txt

# Clean up the list
cat /tmp/all-docs.txt | tr -d ' ' | grep -v '^$' > /tmp/all-docs-clean.txt

# Process in batches of 30
split -l 30 /tmp/all-docs-clean.txt /tmp/batch-

# Process each batch
for batch in /tmp/batch-*; do
  cat $batch | xargs ./scripts/batch-train.sh openai
  sleep 60  # Wait between batches to avoid rate limits
done
```

## 📊 Monitoring Progress

### Real-time Monitoring

```bash
# Watch the log file
tail -f /tmp/batch-processing.log

# Monitor with grep
tail -f /tmp/batch-processing.log | grep -E "Success|Failed|Processing"

# Count completed
grep -c "Success" /tmp/batch-processing.log
```

### Create a Monitoring Script

```bash
cat > /tmp/monitor-batch.sh << 'EOF'
#!/bin/bash
echo "=== Batch Processing Status ==="
echo "Time: $(date)"
echo ""
echo "Succeeded: $(grep -c '✅ Success:' $1)"
echo "Failed: $(grep -c '❌ Failed:' $1)"
echo ""
echo "Currently processing:"
tail -5 "$1" | grep "📄 Processing:" | tail -1
EOF

chmod +x /tmp/monitor-batch.sh

# Use it
/tmp/monitor-batch.sh /tmp/batch-processing.log
```

## ⚡ Parallel Processing

For faster processing, you can run multiple batches in parallel:

```bash
# Split documents into 4 batches
split -n l/4 /tmp/all-docs.txt /tmp/parallel-batch-

# Process in parallel (background jobs)
./scripts/batch-train.sh openai $(cat /tmp/parallel-batch-aa) > /tmp/log1.txt 2>&1 &
./scripts/batch-train.sh openai $(cat /tmp/parallel-batch-ab) > /tmp/log2.txt 2>&1 &
./scripts/batch-train.sh openai $(cat /tmp/parallel-batch-ac) > /tmp/log3.txt 2>&1 &
./scripts/batch-train.sh openai $(cat /tmp/parallel-batch-ad) > /tmp/log4.txt 2>&1 &

# Wait for all to complete
wait

# Check results
for log in /tmp/log*.txt; do
  echo "=== $log ==="
  grep -E "Batch Complete|Succeeded|Failed" "$log"
done
```

**⚠️ Warning**: Parallel processing with OpenAI embeddings may hit rate limits. Use with caution or only for local embeddings.

## 🔍 Validation After Batch Processing

After processing a batch, validate the results:

```sql
-- Check all documents were processed
SELECT 
    dr.slug,
    COUNT(dc.id) as openai_chunks,
    COUNT(dcl.id) as local_chunks
FROM document_registry dr
LEFT JOIN document_chunks dc ON dr.slug = dc.document_slug
LEFT JOIN document_chunks_local dcl ON dr.slug = dcl.document_slug
WHERE dr.is_active = true
GROUP BY dr.slug
HAVING COUNT(dc.id) = 0 OR COUNT(dcl.id) = 0
ORDER BY dr.slug;
```

### Check Page Number Quality

```sql
-- Documents with potential page number issues
SELECT 
    document_slug,
    COUNT(*) as total_chunks,
    COUNT(DISTINCT metadata->>'page_number') as unique_pages,
    CASE 
        WHEN COUNT(DISTINCT metadata->>'page_number') = 1 THEN '⚠️ Only 1 page'
        WHEN COUNT(DISTINCT metadata->>'page_number') < COUNT(*) * 0.1 THEN '⚠️ Very few pages'
        ELSE '✅ Good'
    END as status
FROM document_chunks
GROUP BY document_slug
HAVING COUNT(DISTINCT metadata->>'page_number') < COUNT(*) * 0.1
ORDER BY unique_pages ASC;
```

## 📝 October 2024 Reprocessing Example

This is how we reprocessed all 123 documents in October 2024:

### Step 1: Create Document List

```bash
# All 123 documents
cat > /tmp/all-123-docs.txt << 'EOF'
smh
ckd-dc-2025
uhn
smh-tx
kdigo-adpkd-2025
kdigo-bp-2021
kdigo-anca-2024
kdigo-ckd-2024
kdigo-igan-2025
kdigo-gd-2021
kdigo-tx-recipient-2009
kdigo-tx-candidate-2020
kdigo-nephrotic-children-2025
kdigo-living-donor-2017
[... all 123 documents ...]
EOF
```

### Step 2: Process OpenAI Embeddings in Parallel

```bash
# Split into 4 batches
head -30 /tmp/all-123-docs.txt | xargs ./scripts/batch-train.sh openai > /tmp/openai-batch1.log 2>&1 &
head -60 /tmp/all-123-docs.txt | tail -30 | xargs ./scripts/batch-train.sh openai > /tmp/openai-batch2.log 2>&1 &
head -90 /tmp/all-123-docs.txt | tail -30 | xargs ./scripts/batch-train.sh openai > /tmp/openai-batch3.log 2>&1 &
tail -33 /tmp/all-123-docs.txt | xargs ./scripts/batch-train.sh openai > /tmp/openai-batch4.log 2>&1 &
```

### Step 3: Process Local Embeddings in Parallel

```bash
# Split into 2 batches (faster, no rate limits)
head -40 /tmp/all-123-docs.txt | xargs ./scripts/batch-train.sh local > /tmp/local-batch1.log 2>&1 &
tail -83 /tmp/all-123-docs.txt | xargs ./scripts/batch-train.sh local > /tmp/local-batch2.log 2>&1 &
```

### Step 4: Monitor and Validate

```bash
# Monitor progress
watch -n 60 'grep -h "Succeeded:" /tmp/*-batch*.log'

# Final validation
grep -h "Batch Complete" /tmp/*-batch*.log
```

**Results**:
- OpenAI: 117/117 documents (1 retry needed)
- Local: 123/123 documents
- Total time: ~1.5 hours
- All documents now have proper page numbers

## 🛠️ Troubleshooting Batch Processing

### Issue: Rate Limit Errors

**Solution**:
```bash
# Process in smaller batches with delays
for batch in batch1 batch2 batch3; do
  ./scripts/batch-train.sh openai $(cat /tmp/$batch.txt)
  echo "Waiting 2 minutes before next batch..."
  sleep 120
done
```

### Issue: Some Documents Failed

**Solution**:
```bash
# Extract failed documents
grep "❌ Failed:" /tmp/batch.log | sed 's/.*Failed: //' > /tmp/failed-docs.txt

# Retry failed documents
cat /tmp/failed-docs.txt | xargs ./scripts/batch-train.sh openai
```

### Issue: Process Interrupted

**Solution**:
```bash
# Find which documents were completed
grep "✅ Success:" /tmp/batch.log | sed 's/.*Success: //' > /tmp/completed.txt

# Get remaining documents
comm -23 <(sort /tmp/all-docs.txt) <(sort /tmp/completed.txt) > /tmp/remaining.txt

# Process remaining
cat /tmp/remaining.txt | xargs ./scripts/batch-train.sh openai
```

## 📊 Performance Metrics

### OpenAI Embeddings
- **Small doc** (10-20 pages): ~10-15 seconds
- **Medium doc** (50-100 pages): ~30-60 seconds
- **Large doc** (200+ pages): ~2-5 minutes
- **Rate limit**: ~50-100 documents/hour (depends on size)

### Local Embeddings
- **Small doc**: ~1-3 seconds
- **Medium doc**: ~5-10 seconds
- **Large doc**: ~20-30 seconds
- **Rate limit**: None (local processing)

### Batch Processing
- **Sequential**: ~2-3 minutes per document (OpenAI)
- **Parallel (4 batches)**: ~4x faster
- **Local only**: ~10-20x faster than OpenAI

## 💡 Best Practices

1. **Always process both embedding types**
   - OpenAI for accuracy
   - Local for speed and cost

2. **Use parallel processing carefully**
   - Safe for local embeddings
   - Risky for OpenAI (rate limits)

3. **Monitor progress**
   - Use log files
   - Check for failures
   - Validate results

4. **Handle failures gracefully**
   - Extract failed documents
   - Retry individually
   - Investigate errors

5. **Validate after completion**
   - Check chunk counts
   - Verify page numbers
   - Test search functionality

## 📚 Related Documentation

- [ADDING-NEW-DOCUMENTS.md](./ADDING-NEW-DOCUMENTS.md) - Single document processing
- [PAGE-NUMBER-SYSTEM.md](./PAGE-NUMBER-SYSTEM.md) - Page detection details
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues
- [TECHNICAL-ARCHITECTURE.md](./TECHNICAL-ARCHITECTURE.md) - System internals

