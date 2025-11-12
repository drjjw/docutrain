-- ============================================================================
-- Migration: Fix RLS Auth Function Re-evaluation - Batch 5
-- ============================================================================
-- Batch: 5 - User Invitations (Low-Medium Risk)
-- Table: user_invitations
-- Policies: 3 total
-- Date: 2025-11-11
-- ============================================================================
--
-- ISSUE: Auth RLS Initialization Plan Performance
-- Problem: Policies calling auth.uid() and auth.jwt() in EXISTS subqueries
--          causes per-row re-evaluation instead of once-per-query
-- Fix: Wrap auth.uid() and auth.jwt() in (select ...) subquery
-- Impact: Performance improvement on invitation queries
--
-- ============================================================================
-- USER_INVITATIONS TABLE (3 policies)
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Owner admins can view their invitations" ON public.user_invitations;
DROP POLICY IF EXISTS "Service role can manage invitations" ON public.user_invitations;
DROP POLICY IF EXISTS "Super admins can view all invitations" ON public.user_invitations;

-- Recreate with optimized auth.uid() and auth.jwt()

CREATE POLICY "Owner admins can view their invitations" 
ON public.user_invitations 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE (
            (ur.user_id = (select auth.uid())) 
            AND (ur.role = 'owner_admin'::text) 
            AND (ur.owner_id = user_invitations.owner_id)
        )
    )
);

CREATE POLICY "Service role can manage invitations" 
ON public.user_invitations 
USING (((select auth.jwt()) ->> 'role'::text) = 'service_role'::text);

CREATE POLICY "Super admins can view all invitations" 
ON public.user_invitations 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE (
            (ur.user_id = (select auth.uid())) 
            AND (ur.role = 'super_admin'::text)
        )
    )
);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify policies are created correctly
SELECT 
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename = 'user_invitations'
    AND policyname IN (
        'Owner admins can view their invitations',
        'Service role can manage invitations',
        'Super admins can view all invitations'
    )
ORDER BY policyname;

-- Expected: 3 rows

-- ============================================================================
-- TEST QUERIES
-- ============================================================================

-- Test 1: Owner admin can view own invitations
-- Run as: owner_admin user
-- SELECT * FROM public.user_invitations WHERE owner_id = ...;

-- Test 2: Super admin can view all invitations
-- Run as: super_admin user
-- SELECT * FROM public.user_invitations;

-- Test 3: Service role can manage invitations
-- Run as: service_role
-- SELECT * FROM public.user_invitations;
-- INSERT INTO public.user_invitations (...) VALUES (...);
-- UPDATE public.user_invitations SET ... WHERE ...;
-- DELETE FROM public.user_invitations WHERE ...;

-- ============================================================================
-- ROLLBACK
-- ============================================================================

-- To rollback this batch, run the Batch 5 section from:
-- migrations/rollback_rls_auth_fixes.sql

-- ============================================================================
-- NOTES
-- ============================================================================

-- Changes Made:
-- - Wrapped auth.uid() calls in EXISTS subqueries with (select auth.uid())
-- - Wrapped auth.jwt() call with (select auth.jwt())
-- - No logic changes - only performance optimization

-- Expected Benefits:
-- - auth.uid() and auth.jwt() evaluated once per query instead of per row
-- - Performance improvement on invitation queries
-- - Query plans will show InitPlan instead of per-row evaluation

-- Testing:
-- - Run EXPLAIN ANALYZE on queries to verify InitPlan usage
-- - Test owner admin access to own invitations
-- - Test super admin access to all invitations
-- - Test service role management capabilities





