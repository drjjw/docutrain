# AJKD Core Curriculum Batch Training Setup

**Date:** October 18, 2025  
**Status:** Ready to Execute  

## Overview

Prepared for training 100 AJKD Core Curriculum documents in 20 batches of 5 documents each.

## Configuration Summary

- **Total documents:** 100
- **Batch size:** 5 documents per batch
- **Total batches:** 20
- **Embedding types:** Both OpenAI and local
- **PDF location:** `/Users/jordanweinstein/GitHub/docutrain/PDFs/ajkd-core-curriculum/`
- **Slug format:** `ajkd-cc-{topic}-{year}`

## Batch Files Created

All 20 configuration files have been generated:
- `ajkd-batch-01.json` through `ajkd-batch-20.json`
- Each contains 5 documents with full metadata
- Duplicate slugs resolved (3 pairs identified and fixed)

## Duplicate Slugs Resolved

Fixed 3 duplicate slug conflicts by adding year suffixes:

1. **Critical Care Nephrology:**
   - `ajkd-cc-critical-care-nephrology-2009` (2009 version)
   - `ajkd-cc-critical-care-nephrology-2020` (2020 version)

2. **Therapeutic Plasma Exchange:**
   - `ajkd-cc-therapeutic-plasma-exchange-2008` (2008 version)
   - `ajkd-cc-therapeutic-plasma-exchange-2023` (2023 version)

3. **Viral Nephropathies:**
   - `ajkd-cc-viral-nephropathies-2008` (2008 version)
   - `ajkd-cc-viral-nephropathies-2024` (2024 version)

## Automation Script

Created `scripts/run-ajkd-batches.sh` to:
- Run all 20 batches sequentially
- Handle errors gracefully
- Provide progress updates
- Track timing and success rate
- Prompt user on failures

## Validation

✅ Dry run completed successfully for batch 01  
✅ All PDF files exist and accessible  
✅ No duplicate slugs remaining  
✅ Batch training script accepts `ajkd-core-curriculum` subdirectory  

## Estimated Metrics

### Time Estimates
- **Per document:** ~86 seconds average (OpenAI + Local)
- **Per batch (5 docs):** ~7-8 minutes
- **Total (20 batches):** ~2.5-3 hours

### Cost Estimates
- **OpenAI API:** ~$10-15 USD
- **Local embeddings:** FREE
- **Total chunks:** ~20,000-30,000 (estimated)

### Database Impact
- **New documents:** 100
- **Total system documents:** 114 (14 existing + 100 new)
- **Database size increase:** ~500MB-1GB
- **Server startup time:** May increase to 30-60 seconds

## Execution Command

To start the batch training:

```bash
cd /Users/jordanweinstein/GitHub/docutrain
./scripts/run-ajkd-batches.sh
```

Or run individual batches:

```bash
node scripts/batch-train-documents.js --config=ajkd-batch-01.json
node scripts/batch-train-documents.js --config=ajkd-batch-02.json
# ... etc
```

## Post-Training Steps

After all batches complete:

1. **Restart Server:**
   ```bash
   ps aux | grep "node server.js" | grep -v grep | awk '{print $2}' | xargs kill
   cd /Users/jordanweinstein/GitHub/docutrain && node server.js > server.log 2>&1 &
   ```

2. **Verify Documents Loaded:**
   ```bash
   tail -100 server.log | grep "Loaded documents"
   ```

3. **Check Database:**
   ```sql
   SELECT COUNT(*) FROM documents WHERE slug LIKE 'ajkd-cc-%';
   SELECT COUNT(*) FROM document_chunks WHERE document_slug LIKE 'ajkd-cc-%';
   SELECT COUNT(*) FROM document_chunks_local WHERE document_slug LIKE 'ajkd-cc-%';
   ```

4. **Clear Browser Cache:**
   - Delete `ukidney-documents-cache` from localStorage
   - Or hard refresh: `Cmd + Shift + R`

5. **Test Sample Documents:**
   ```
   http://localhost:3456/?doc=ajkd-cc-anca-associated-vasculitis
   http://localhost:3456/?doc=ajkd-cc-iga-nephropathy&embedding=local
   ```

## Sample Document Slugs

Here are some example slugs from the collection:

- `ajkd-cc-anca-associated-vasculitis`
- `ajkd-cc-iga-nephropathy`
- `ajkd-cc-acute-kidney-injury`
- `ajkd-cc-hypertension-in-ckd`
- `ajkd-cc-diabetic-nephropathy`
- `ajkd-cc-lupus-nephritis`
- `ajkd-cc-membranous-nephropathy`
- `ajkd-cc-hemodialysis`
- `ajkd-cc-peritoneal-dialysis`
- `ajkd-cc-kidney-transplant`

## Risk Mitigation

### Rate Limits
- OpenAI API batching built into script (50 at a time)
- 5-second delay between batches
- Can pause and resume if needed

### Error Handling
- Script continues on individual document failures
- User prompted on batch failures
- Failed batches tracked and reported
- Can resume from any batch

### Monitoring
- Real-time progress updates
- Timing for each batch
- Success/failure tracking
- Total time calculation

## Rollback Plan

If issues occur:

1. **Stop Training:**
   - Press `Ctrl+C` to stop script
   - Note which batch was running

2. **Check Database:**
   ```sql
   SELECT slug, title FROM documents 
   WHERE slug LIKE 'ajkd-cc-%' 
   ORDER BY created_at DESC;
   ```

3. **Delete Failed Entries:**
   ```sql
   DELETE FROM documents WHERE slug = 'failed-slug';
   DELETE FROM document_chunks WHERE document_slug = 'failed-slug';
   DELETE FROM document_chunks_local WHERE document_slug = 'failed-slug';
   ```

4. **Resume Training:**
   - Fix any configuration issues
   - Resume from failed batch number

## PubMed IDs

Note: PubMed IDs were not automatically added during configuration generation. These can be added later if needed by:

1. Searching for each article on PubMed
2. Updating the document metadata:
   ```sql
   UPDATE documents 
   SET metadata = jsonb_set(
       jsonb_set(
           COALESCE(metadata, '{}'::jsonb),
           '{pubmed_id}',
           '"12345678"'::jsonb
       ),
       '{pubmed_url}',
       '"https://pubmed.ncbi.nlm.nih.gov/12345678/"'::jsonb
   )
   WHERE slug = 'ajkd-cc-document-slug';
   ```

## Files Created

- `scripts/generate-ajkd-configs.js` - Configuration generator
- `scripts/fix-duplicate-slugs.js` - Duplicate slug resolver
- `scripts/run-ajkd-batches.sh` - Batch automation script
- `ajkd-batch-01.json` through `ajkd-batch-20.json` - Batch configurations

## System Requirements

- **Node.js:** v14+ (installed)
- **OpenAI API Key:** Required (configured)
- **Supabase Access:** Required (configured)
- **Disk Space:** ~1GB free for database growth
- **RAM:** 4GB+ recommended for server
- **Time:** 2-3 hours uninterrupted

## Ready to Execute

All preparation complete. System is ready to begin training 100 AJKD Core Curriculum documents.

---

**Prepared:** October 18, 2025  
**Status:** ✅ Ready for Execution  
**Next Step:** Run `./scripts/run-ajkd-batches.sh`


