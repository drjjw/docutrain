-- Rollback Script for Performance Optimization Indexes
-- Created: November 16, 2025
-- Purpose: Remove composite indexes added for performance optimization
-- 
-- ONLY RUN THIS IF:
-- - Indexes are causing performance degradation
-- - RLS policies are being bypassed
-- - Query planner is making poor choices with new indexes
--
-- NOTE: This will NOT affect data, only remove indexes

-- ============================================================================
-- ROLLBACK: Priority 1 Performance Indexes
-- ============================================================================

-- Remove categories composite index
DROP INDEX CONCURRENTLY IF EXISTS idx_categories_owner_name;

-- Remove owners composite index  
DROP INDEX CONCURRENTLY IF EXISTS idx_owners_active_lookup;

-- ============================================================================
-- VERIFICATION: Check indexes were removed
-- ============================================================================

-- This should return 0 rows if rollback was successful
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE indexname IN ('idx_categories_owner_name', 'idx_owners_active_lookup');

-- ============================================================================
-- POST-ROLLBACK: Update statistics
-- ============================================================================

-- Update query planner statistics after removing indexes
ANALYZE categories;
ANALYZE owners;
ANALYZE documents;

-- ============================================================================
-- MONITORING: Check sequential scans after rollback
-- ============================================================================

-- After rollback, sequential scans will likely increase again
-- Run this to verify the rollback impact:
SELECT 
    schemaname,
    relname as tablename,
    seq_scan,
    seq_tup_read,
    idx_scan,
    idx_tup_fetch
FROM pg_stat_user_tables
WHERE schemaname = 'public' 
  AND relname IN ('categories', 'owners')
ORDER BY seq_scan DESC;

-- ============================================================================
-- NOTES
-- ============================================================================

-- If you need to re-apply the indexes after rollback, run:
-- /migrations/add_performance_indexes.sql
--
-- Or manually recreate with:
-- 
-- CREATE INDEX CONCURRENTLY idx_categories_owner_name 
-- ON categories(owner_id, name) WHERE is_custom = false;
--
-- CREATE INDEX CONCURRENTLY idx_owners_active_lookup
-- ON owners(slug, custom_domain) WHERE plan_tier IS NOT NULL;

