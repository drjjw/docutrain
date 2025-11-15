-- ============================================================================
-- Migration: Fix RLS Auth Function Re-evaluation - Batch 1
-- ============================================================================
-- Batch: 1 - User Tables (Low Risk)
-- Tables: user_documents, user_profiles, user_roles
-- Policies: 9 total
-- Date: 2025-11-11
-- ============================================================================
--
-- ISSUE: Auth RLS Initialization Plan Performance
-- Problem: Policies calling auth.uid() or auth.jwt() without (select ...)
--          causes per-row re-evaluation instead of once-per-query
-- Fix: Wrap auth.uid() and auth.jwt() in (select ...) subquery
-- Impact: Significant performance improvement on large result sets
--
-- ============================================================================
-- TABLE 1: user_documents (4 policies)
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read own documents" ON public.user_documents;
DROP POLICY IF EXISTS "Users can insert own documents" ON public.user_documents;
DROP POLICY IF EXISTS "Users can update own documents" ON public.user_documents;
DROP POLICY IF EXISTS "Users can delete own documents" ON public.user_documents;

-- Recreate with optimized auth.uid()
CREATE POLICY "Users can read own documents" 
ON public.user_documents 
FOR SELECT 
USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own documents" 
ON public.user_documents 
FOR INSERT 
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own documents" 
ON public.user_documents 
FOR UPDATE 
USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own documents" 
ON public.user_documents 
FOR DELETE 
USING ((select auth.uid()) = user_id);

-- ============================================================================
-- TABLE 2: user_profiles (4 policies)
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Service role can manage profiles" ON public.user_profiles;

-- Recreate with optimized auth.uid() and auth.jwt()
CREATE POLICY "Users can read own profile" 
ON public.user_profiles 
FOR SELECT 
USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own profile" 
ON public.user_profiles 
FOR INSERT 
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own profile" 
ON public.user_profiles 
FOR UPDATE 
USING ((select auth.uid()) = user_id);

CREATE POLICY "Service role can manage profiles" 
ON public.user_profiles 
USING (((select auth.jwt()) ->> 'role'::text) = 'service_role'::text);

-- ============================================================================
-- TABLE 3: user_roles (1 policy)
-- ============================================================================

-- Drop existing policy
DROP POLICY IF EXISTS "Users read own roles" ON public.user_roles;

-- Recreate with optimized auth.uid()
CREATE POLICY "Users read own roles" 
ON public.user_roles 
FOR SELECT 
USING (user_id = (select auth.uid()));

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify policies are created correctly
SELECT 
    tablename,
    policyname,
    cmd,
    qual
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename IN ('user_documents', 'user_profiles', 'user_roles')
    AND (
        (tablename = 'user_documents' AND policyname LIKE 'Users can%')
        OR (tablename = 'user_profiles' AND policyname LIKE 'Users can%')
        OR (tablename = 'user_profiles' AND policyname = 'Service role can manage profiles')
        OR (tablename = 'user_roles' AND policyname = 'Users read own roles')
    )
ORDER BY tablename, policyname;

-- Expected: 9 rows

-- ============================================================================
-- TEST QUERIES
-- ============================================================================

-- Test 1: User can read own user_documents
-- Run as: authenticated user
-- SELECT * FROM public.user_documents WHERE user_id = auth.uid();

-- Test 2: User can insert own user_documents
-- Run as: authenticated user
-- INSERT INTO public.user_documents (user_id, document_id) VALUES (auth.uid(), '...');

-- Test 3: User can read/insert/update own profile
-- Run as: authenticated user
-- SELECT * FROM public.user_profiles WHERE user_id = auth.uid();
-- INSERT INTO public.user_profiles (user_id, email) VALUES (auth.uid(), '...');
-- UPDATE public.user_profiles SET email = '...' WHERE user_id = auth.uid();

-- Test 4: User can read own roles
-- Run as: authenticated user
-- SELECT * FROM public.user_roles WHERE user_id = auth.uid();

-- Test 5: Service role can manage profiles
-- Run as: service_role
-- SELECT * FROM public.user_profiles;

-- ============================================================================
-- ROLLBACK
-- ============================================================================

-- To rollback this batch, run the Batch 1 section from:
-- migrations/rollback_rls_auth_fixes.sql

-- ============================================================================
-- NOTES
-- ============================================================================

-- Changes Made:
-- - Wrapped all auth.uid() calls in (select auth.uid())
-- - Wrapped auth.jwt() call in (select auth.jwt())
-- - No logic changes - only performance optimization

-- Expected Benefits:
-- - auth.uid() evaluated once per query instead of per row
-- - Significant performance improvement on tables with many rows
-- - Query plans will show InitPlan instead of per-row evaluation

-- Testing:
-- - Run EXPLAIN ANALYZE on queries to verify InitPlan usage
-- - Test user access to own data
-- - Test service role access












