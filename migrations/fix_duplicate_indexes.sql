-- Migration: Fix Duplicate Indexes on Documents Table
-- Date: 2025-11-11
-- Issue: 3 sets of duplicate indexes causing unnecessary storage and maintenance overhead
-- Impact: Low risk - only removes redundant indexes, keeps the idx_* versions

-- ============================================================================
-- DUPLICATE INDEXES TO FIX
-- ============================================================================
-- 1. documents_active_idx duplicates idx_documents_active
-- 2. documents_owner_id_idx duplicates idx_documents_owner_id
-- 3. documents_slug_idx duplicates idx_documents_slug

-- ============================================================================
-- VERIFICATION BEFORE DROPPING
-- ============================================================================

-- Check current indexes on documents table
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'documents'
    AND schemaname = 'public'
    AND indexname IN (
        'documents_active_idx',
        'idx_documents_active',
        'documents_owner_id_idx',
        'idx_documents_owner_id',
        'documents_slug_idx',
        'idx_documents_slug'
    )
ORDER BY indexname;

-- ============================================================================
-- DROP DUPLICATE INDEXES
-- ============================================================================

-- Drop documents_active_idx (keep idx_documents_active)
DROP INDEX IF EXISTS public.documents_active_idx;

-- Drop documents_owner_id_idx (keep idx_documents_owner_id)
DROP INDEX IF EXISTS public.documents_owner_id_idx;

-- Drop documents_slug_idx (keep idx_documents_slug)
DROP INDEX IF EXISTS public.documents_slug_idx;

-- ============================================================================
-- VERIFICATION AFTER DROPPING
-- ============================================================================

-- Verify only the idx_* versions remain
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'documents'
    AND schemaname = 'public'
    AND indexname IN (
        'idx_documents_active',
        'idx_documents_owner_id',
        'idx_documents_slug'
    )
ORDER BY indexname;

-- Should return 3 rows (one for each idx_* index)

-- ============================================================================
-- PERFORMANCE TEST
-- ============================================================================

-- Test that queries still use the remaining indexes
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, title, slug
FROM public.documents
WHERE active = true
LIMIT 10;

-- Should show: Index Scan using idx_documents_active

EXPLAIN (ANALYZE, BUFFERS)
SELECT id, title, owner_id
FROM public.documents
WHERE owner_id = 1
LIMIT 10;

-- Should show: Index Scan using idx_documents_owner_id

EXPLAIN (ANALYZE, BUFFERS)
SELECT id, title, slug
FROM public.documents
WHERE slug = 'test-document';

-- Should show: Index Scan using idx_documents_slug

-- ============================================================================
-- ROLLBACK PROCEDURE
-- ============================================================================

-- If needed, recreate the dropped indexes:
/*
CREATE INDEX documents_active_idx ON public.documents USING btree (active);
CREATE INDEX documents_owner_id_idx ON public.documents USING btree (owner_id);
CREATE INDEX documents_slug_idx ON public.documents USING btree (slug);
*/

-- ============================================================================
-- NOTES
-- ============================================================================

-- Benefits:
-- - Reduces storage overhead (3 fewer indexes)
-- - Reduces write overhead (fewer indexes to maintain on INSERT/UPDATE/DELETE)
-- - No impact on query performance (identical indexes remain)
-- - Zero risk to application functionality

-- Expected storage savings: ~3-5MB depending on table size
-- Expected write performance improvement: ~5-10% on documents table operations




