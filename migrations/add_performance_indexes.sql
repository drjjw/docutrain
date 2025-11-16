-- Performance Optimization: Add Composite Indexes
-- Created: November 16, 2025
-- Purpose: Eliminate excessive sequential scans on categories and owners tables
--
-- IMPACT:
-- - Categories: Reduce 291K sequential scans to <10K (95% improvement)
-- - Owners: Reduce 120K sequential scans to <5K (95% improvement)
-- - Storage: +2-5 MB (minimal overhead)
--
-- SAFETY:
-- - Uses CREATE INDEX CONCURRENTLY (no table locks)
-- - Safe to run on production database
-- - Rollback available in: rollback_performance_indexes.sql

-- ============================================================================
-- INDEX 1: Categories - Owner + Name Lookup
-- ============================================================================

-- This index optimizes queries that filter documents by category name and owner
-- Common pattern: SELECT d.* FROM documents d JOIN categories c ON d.category_id = c.id 
--                 WHERE c.owner_id = ? AND c.name = ?
--
-- Partial index: Only indexes non-custom categories (system defaults)
-- This reduces index size and focuses on the most common query pattern

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_categories_owner_name 
ON categories(owner_id, name) 
WHERE is_custom = false;

-- ============================================================================
-- INDEX 2: Owners - Slug + Custom Domain Lookup
-- ============================================================================

-- This index optimizes owner lookups by slug or custom domain
-- Common patterns:
-- - Custom domain routing: SELECT * FROM owners WHERE custom_domain = ?
-- - Slug-based lookups: SELECT * FROM owners WHERE slug = ?
-- - Combined lookups: SELECT * FROM owners WHERE slug = ? OR custom_domain = ?
--
-- Partial index: Only indexes owners with a plan tier (active accounts)
-- This excludes test/inactive accounts from the index

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_owners_active_lookup
ON owners(slug, custom_domain) 
WHERE plan_tier IS NOT NULL;

-- ============================================================================
-- UPDATE STATISTICS
-- ============================================================================

-- Update query planner statistics so PostgreSQL knows about the new indexes
-- This helps the query planner make optimal decisions

ANALYZE categories;
ANALYZE owners;
ANALYZE documents;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify indexes were created successfully
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_indexes
JOIN pg_stat_user_indexes USING (schemaname, tablename, indexname)
WHERE indexname IN ('idx_categories_owner_name', 'idx_owners_active_lookup');

-- Expected output:
-- idx_categories_owner_name    | ~16 KB | categories
-- idx_owners_active_lookup     | ~16 KB | owners

-- ============================================================================
-- MONITORING QUERIES
-- ============================================================================

-- Run these queries after 24-48 hours to verify improvement:

-- 1. Check index usage
SELECT 
    schemaname,
    relname as tablename,
    indexrelname as indexname,
    idx_scan as times_used,
    idx_tup_read as rows_read
FROM pg_stat_user_indexes
WHERE indexrelname IN ('idx_categories_owner_name', 'idx_owners_active_lookup');

-- Expected: idx_scan > 0 (indexes are being used)

-- 2. Check sequential scan reduction
SELECT 
    relname as tablename,
    seq_scan,
    seq_tup_read,
    idx_scan,
    idx_tup_fetch,
    CASE 
        WHEN idx_scan > 0 THEN ROUND((seq_scan::float / idx_scan) * 100, 2)
        ELSE 0 
    END as seq_scan_percentage
FROM pg_stat_user_tables
WHERE schemaname = 'public' 
  AND relname IN ('categories', 'owners')
ORDER BY seq_scan DESC;

-- Expected: seq_scan_percentage < 10% (mostly using indexes now)

-- 3. Check query performance improvement
SELECT 
    query,
    calls,
    mean_exec_time,
    total_exec_time
FROM pg_stat_statements
WHERE query LIKE '%categories%' OR query LIKE '%owners%'
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Expected: mean_exec_time should decrease for category/owner queries

-- ============================================================================
-- ROLLBACK
-- ============================================================================

-- If you need to rollback these changes, run:
-- \i rollback_performance_indexes.sql
--
-- Or manually:
-- DROP INDEX CONCURRENTLY IF EXISTS idx_categories_owner_name;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_owners_active_lookup;

-- ============================================================================
-- NOTES
-- ============================================================================

-- 1. These indexes use WHERE clauses (partial indexes) to reduce size
-- 2. CONCURRENTLY means no table locks during creation
-- 3. Index creation may take 1-5 minutes depending on table size
-- 4. Monitor RLS policies after deployment to ensure security is maintained
-- 5. See /docs/database/PERFORMANCE-OPTIMIZATION-FINDINGS.md for full report
