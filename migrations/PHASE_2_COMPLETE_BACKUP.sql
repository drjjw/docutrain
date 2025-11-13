-- ============================================================================
-- PHASE 2 COMPLETE - INTERIM BACKUP
-- Date: 2025-11-11
-- Status: All Auth RLS Init Plan fixes applied successfully
-- ============================================================================

-- This file documents the state after Phase 2 completion
-- All policies have been optimized with (select auth.uid()) wrapper
-- EXCEPT user_owner_access which was rolled back due to performance issues

-- ============================================================================
-- WHAT WAS FIXED
-- ============================================================================

-- Phase 1: Duplicate Indexes (COMPLETED)
-- - Removed 3 duplicate indexes from documents table
-- - documents_active_idx (kept idx_documents_active)
-- - documents_owner_id_idx (kept idx_documents_owner_id)
-- - documents_slug_idx (kept idx_documents_slug)

-- Phase 2: Auth RLS Init Plan Optimization (COMPLETED)
-- Fixed 30 policies across 9 tables (45 total policies in warnings, but 5 skipped)

-- Tables Fixed:
-- 1. user_documents (4 policies) ✅
-- 2. user_profiles (4 policies) ✅
-- 3. user_roles (1 policy) ✅
-- 4. user_owner_access (5 policies) ⏭️ SKIPPED - caused performance regression
-- 5. documents (6 policies) ✅
-- 6. user_invitations (3 policies) ✅
-- 7. document_attachments (3 policies) ✅
-- 8. quizzes (2 policies) ✅
-- 9. quiz_questions (2 policies) ✅
-- 10. quiz_attempts (3 policies) ✅
-- 11. categories (2 policies) ✅

-- Total: 30 policies optimized, 5 left as-is (user_owner_access)

-- ============================================================================
-- PERFORMANCE RESULTS
-- ============================================================================

-- Testing performed by owner admin user (shlomo@makerpizza.com)
-- All features working normally:
-- ✅ Documents table loads quickly
-- ✅ Document editing works
-- ✅ User profiles accessible
-- ✅ Quizzes accessible
-- ✅ Categories manageable
-- ✅ Attachments functional
-- ✅ No timeout errors (pre-existing frontend timeouts unrelated to RLS)

-- ============================================================================
-- REMAINING WORK
-- ============================================================================

-- Phase 3: Consolidate Multiple Permissive Policies (58 warnings)
-- - documents table: 5 SELECT policies → 1
-- - user_profiles: 2 policies per action → 1 each
-- - document_processing_logs: 3 SELECT → 1
-- - document_training_history: 2 SELECT → 1
-- - user_invitations: 3 SELECT → 1
-- - user_owner_access: 3 SELECT → 1
-- - user_roles: 4 SELECT → 1
-- - quiz_attempts: 2 SELECT, 2 INSERT → 1 each
-- - quiz_questions: 2 SELECT → 1
-- - quizzes: 2 SELECT → 1
-- - owners table: multiple → consolidated

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================

-- If issues arise, rollback using the backup policy files:
-- Location: /backups/supabase_backup_latest/schema/policies/

-- To rollback specific tables:
-- 1. Drop the optimized policies
-- 2. Re-run the original CREATE POLICY statements from backup files

-- To rollback everything:
-- Run: /migrations/testing/emergency_policy_restore.sql

-- ============================================================================
-- CURRENT POLICY STATE
-- ============================================================================

-- All policies below use (select auth.uid()) or (select auth.jwt()) optimization
-- except user_owner_access which uses direct auth.uid() calls

-- Verification query:
-- SELECT tablename, COUNT(*) as policy_count
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN (
--     'user_documents', 'user_profiles', 'user_roles', 'documents',
--     'user_invitations', 'document_attachments', 'quizzes',
--     'quiz_questions', 'quiz_attempts', 'categories'
--   )
-- GROUP BY tablename
-- ORDER BY tablename;

-- Expected counts:
-- categories: 4 policies (2 optimized + 2 other)
-- document_attachments: 4 policies (3 optimized + 1 select)
-- documents: 11 policies (6 optimized + 5 select)
-- quiz_attempts: 3 policies (all optimized)
-- quiz_questions: 2 policies (all optimized)
-- quizzes: 2 policies (all optimized)
-- user_documents: 4 policies (all optimized)
-- user_invitations: 3 policies (all optimized)
-- user_profiles: 4 policies (all optimized)
-- user_roles: 4 policies (1 optimized + 3 other)

-- ============================================================================
-- NOTES
-- ============================================================================

-- Key Learning: The (select auth.uid()) optimization works well for simple
-- policies but can cause performance regression in complex policies with
-- nested subqueries and LEFT JOINs (like user_owner_access).

-- Strategy: Apply optimization selectively based on policy complexity.

-- Testing: Always test after each batch of changes, especially for high-traffic
-- tables like documents.

-- ============================================================================
-- END OF PHASE 2 BACKUP
-- ============================================================================






