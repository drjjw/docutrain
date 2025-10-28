-- Migration: Add Performance Indexes for Slow Queries
-- Created: 2025-10-28
-- Description: Add database indexes to optimize slow API endpoints

-- =====================================================
-- Performance Optimization: Document Access Queries
-- =====================================================

-- Index on documents.slug (heavily used in access checks)
CREATE INDEX IF NOT EXISTS idx_documents_slug ON documents(slug);

-- Index on documents.active for faster filtering
CREATE INDEX IF NOT EXISTS idx_documents_active ON documents(active);

-- Index on documents.owner_id for owner-based queries
CREATE INDEX IF NOT EXISTS idx_documents_owner_id ON documents(owner_id);

-- Composite index for documents access checks
CREATE INDEX IF NOT EXISTS idx_documents_active_access_level ON documents(active, access_level);

-- =====================================================
-- Performance Optimization: Owner Logo Queries
-- =====================================================

-- Index on owners.logo_url for faster logo filtering
CREATE INDEX IF NOT EXISTS idx_owners_logo_url ON owners(logo_url) WHERE logo_url IS NOT NULL;

-- =====================================================
-- Performance Optimization: User Role Queries
-- =====================================================

-- Composite index for user_roles queries in access checks
CREATE INDEX IF NOT EXISTS idx_user_roles_user_owner_role ON user_roles(user_id, owner_id, role);

-- Composite index for user_owner_access queries
CREATE INDEX IF NOT EXISTS idx_user_owner_access_user_owner ON user_owner_access(user_id, owner_id);

-- =====================================================
-- Performance Optimization: Document Registry Caching
-- =====================================================

-- Index on documents for registry queries (active documents)
CREATE INDEX IF NOT EXISTS idx_documents_registry ON documents(active, slug, title, owner_id);

-- =====================================================
-- Performance Analysis Query (run after deployment)
-- =====================================================
/*
-- Query to check index usage (run in Supabase SQL Editor):
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Query to check slow queries (run in Supabase SQL Editor):
SELECT
    query,
    calls,
    total_time,
    mean_time,
    rows
FROM pg_stat_statements
WHERE mean_time > 100  -- queries taking more than 100ms on average
ORDER BY mean_time DESC
LIMIT 20;
*/
