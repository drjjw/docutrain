# AJKD Core Curriculum Training Status

**Date:** October 18, 2025  
**Status:** ✅ In Progress (Restarted from Batch 01)

## Current Status

- **Started:** October 18, 2025 ~10:20 PM
- **Current Batch:** 01/20
- **Documents Processed:** 1/100 (ANCA Associated Vasculitis completed)
- **Documents In Progress:** Document 2/5 in Batch 01
- **Estimated Completion:** ~2-3 hours from start

## Fix Applied

### Issue
The shell script loop `for i in {01..20}` was interpreted by bash as `{1..20}`, causing it to look for files without leading zeros (e.g., `ajkd-batch-7.json` instead of `ajkd-batch-07.json`).

### Solution
Changed loop to: `for i in $(seq -f "%02g" 1 20)`

This properly generates: 01, 02, 03, ..., 20

### Actions Taken
1. ✅ Stopped running process
2. ✅ Fixed shell script loop
3. ✅ Deleted 4 partially-added documents from batch 10
4. ✅ Cleaned up chunks from database
5. ✅ Restarted training from batch 01

## Progress Tracking

### Batch 01 (Documents 1-5)
- ✅ ajkd-cc-anca-associated-vasculitis (completed)
- 🔄 ajkd-cc-approach-to-diagnosis-and-management-of-primary-gl (in progress)
- ⏳ ajkd-cc-approach-to-kidney-biopsy (pending)
- ⏳ ajkd-cc-approach-to-patients-with-high-anion-gap-metabolic (pending)
- ⏳ ajkd-cc-autosomal-dominant-polycystic-kidney-disease-core (pending)

### Remaining Batches
- Batch 02-20: Pending (95 documents)

## Monitoring

To check progress:
```bash
# View live log
tail -f /Users/jordanweinstein/GitHub/docutrain/ajkd-batch-training.log

# Check how many documents added
psql -c "SELECT COUNT(*) FROM documents WHERE slug LIKE 'ajkd-cc-%';"

# Check current batch
grep "Processing Batch" ajkd-batch-training.log | tail -1
```

## Expected Timeline

- **Per document:** ~20-30 seconds average (both embeddings)
- **Per batch (5 docs):** ~2-3 minutes
- **Total (20 batches):** ~40-60 minutes for all batches
- **Plus overhead:** ~30-45 minutes for OpenAI API calls
- **Total estimated:** 1.5-2 hours

## System Impact

### Current Database State
- **Total documents before:** 14
- **Documents added so far:** 1
- **Target total:** 114 (14 + 100)

### Resources
- **OpenAI API:** Being used (monitor costs)
- **Local embeddings:** Running on CPU
- **Database:** Supabase (plenty of capacity)
- **Disk space:** Adequate

## Post-Training Checklist

After all 20 batches complete:

- [ ] Restart server to load all new documents
- [ ] Verify 114 total documents in system
- [ ] Check database chunk counts
- [ ] Clear browser localStorage cache
- [ ] Test sample AJKD documents
- [ ] Verify both embedding types work
- [ ] Update documentation

## Files Created/Modified

### Configuration Files
- `ajkd-batch-01.json` through `ajkd-batch-20.json` (20 files)

### Scripts
- `scripts/generate-ajkd-configs.js` (created)
- `scripts/fix-duplicate-slugs.js` (created)
- `scripts/run-ajkd-batches.sh` (created, fixed)

### Documentation
- `AJKD-BATCH-TRAINING-SETUP.md` (created)
- `AJKD-TRAINING-STATUS.md` (this file)

### Build Script
- `build.js` (will be updated automatically with PDF paths)

## Next Steps

1. **Monitor Progress:** Check log periodically
2. **Wait for Completion:** Let all 20 batches finish (~1.5-2 hours)
3. **Restart Server:** Load all new documents
4. **Verify:** Test sample documents in browser
5. **Document:** Create final summary

## Troubleshooting

If training stops or fails:

1. Check the log file for errors
2. Note which batch was running
3. Check database for partial documents
4. Can resume from failed batch if needed

## Contact/Notes

- Training is fully automated
- No user interaction required
- Will complete in background
- Safe to leave running overnight

---

**Last Updated:** October 18, 2025 10:25 PM  
**Status:** ✅ Running Successfully  
**ETA:** ~12:00 AM - 12:30 AM


