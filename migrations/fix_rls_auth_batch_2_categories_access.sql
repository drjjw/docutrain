-- ============================================================================
-- Migration: Fix RLS Auth Function Re-evaluation - Batch 2
-- ============================================================================
-- Batch: 2 - Categories & User Owner Access (Low-Medium Risk)
-- Tables: categories, user_owner_access
-- Policies: 7 total
-- Date: 2025-11-11
-- ============================================================================
--
-- ISSUE: Auth RLS Initialization Plan Performance
-- Problem: Policies calling auth.uid() in EXISTS subqueries causes
--          per-row re-evaluation instead of once-per-query
-- Fix: Wrap auth.uid() in (select auth.uid()) subquery
-- Impact: Performance improvement on access control queries
--
-- ============================================================================
-- TABLE 1: categories (2 policies)
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated delete own categories" ON public.categories;
DROP POLICY IF EXISTS "Allow authenticated update own categories" ON public.categories;

-- Recreate with optimized auth.uid()
CREATE POLICY "Allow authenticated delete own categories" 
ON public.categories 
FOR DELETE 
TO authenticated 
USING (
    (created_by = (select auth.uid())) 
    OR (
        EXISTS (
            SELECT 1
            FROM public.user_roles
            WHERE (
                (user_roles.user_id = (select auth.uid())) 
                AND (user_roles.role = 'super_admin'::text)
            )
        )
    )
);

CREATE POLICY "Allow authenticated update own categories" 
ON public.categories 
FOR UPDATE 
TO authenticated 
USING (created_by = (select auth.uid()))
WITH CHECK (created_by = (select auth.uid()));

-- ============================================================================
-- TABLE 2: user_owner_access (5 policies)
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users read own access" ON public.user_owner_access;
DROP POLICY IF EXISTS "Owner admins read group access" ON public.user_owner_access;
DROP POLICY IF EXISTS "Super admins read all access" ON public.user_owner_access;
DROP POLICY IF EXISTS "Admins grant access" ON public.user_owner_access;
DROP POLICY IF EXISTS "Admins revoke access" ON public.user_owner_access;

-- Recreate with optimized auth.uid()
CREATE POLICY "Users read own access" 
ON public.user_owner_access 
FOR SELECT 
USING (user_id = (select auth.uid()));

CREATE POLICY "Owner admins read group access" 
ON public.user_owner_access 
FOR SELECT 
USING (
    owner_id IN (
        SELECT user_roles.owner_id
        FROM public.user_roles
        WHERE (
            (user_roles.user_id = (select auth.uid())) 
            AND (user_roles.role = 'owner_admin'::text)
        )
    )
);

CREATE POLICY "Super admins read all access" 
ON public.user_owner_access 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE (
            (user_roles.user_id = (select auth.uid())) 
            AND (user_roles.role = 'super_admin'::text)
        )
    )
);

CREATE POLICY "Admins grant access" 
ON public.user_owner_access 
FOR INSERT 
WITH CHECK (
    (
        EXISTS (
            SELECT 1
            FROM public.user_roles
            WHERE (
                (user_roles.user_id = (select auth.uid())) 
                AND (user_roles.role = 'super_admin'::text)
            )
        )
    ) 
    OR (
        owner_id IN (
            SELECT user_roles.owner_id
            FROM public.user_roles
            WHERE (
                (user_roles.user_id = (select auth.uid())) 
                AND (user_roles.role = 'owner_admin'::text)
            )
        )
    )
);

CREATE POLICY "Admins revoke access" 
ON public.user_owner_access 
FOR DELETE 
USING (
    (
        EXISTS (
            SELECT 1
            FROM public.user_roles
            WHERE (
                (user_roles.user_id = (select auth.uid())) 
                AND (user_roles.role = 'super_admin'::text)
            )
        )
    ) 
    OR (
        owner_id IN (
            SELECT user_roles.owner_id
            FROM public.user_roles
            WHERE (
                (user_roles.user_id = (select auth.uid())) 
                AND (user_roles.role = 'owner_admin'::text)
            )
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
    AND tablename IN ('categories', 'user_owner_access')
    AND (
        (tablename = 'categories' AND policyname LIKE 'Allow authenticated%')
        OR (tablename = 'user_owner_access' AND policyname IN (
            'Users read own access',
            'Owner admins read group access',
            'Super admins read all access',
            'Admins grant access',
            'Admins revoke access'
        ))
    )
ORDER BY tablename, policyname;

-- Expected: 7 rows

-- ============================================================================
-- TEST QUERIES
-- ============================================================================

-- Test 1: User can update/delete own categories
-- Run as: authenticated user
-- UPDATE public.categories SET name = '...' WHERE created_by = auth.uid();
-- DELETE FROM public.categories WHERE created_by = auth.uid();

-- Test 2: User can read own access
-- Run as: authenticated user
-- SELECT * FROM public.user_owner_access WHERE user_id = auth.uid();

-- Test 3: Owner admin can read group access
-- Run as: owner_admin user
-- SELECT * FROM public.user_owner_access WHERE owner_id IN (...);

-- Test 4: Super admin can read all access
-- Run as: super_admin user
-- SELECT * FROM public.user_owner_access;

-- Test 5: Admins can grant/revoke access
-- Run as: admin user
-- INSERT INTO public.user_owner_access (user_id, owner_id) VALUES (...);
-- DELETE FROM public.user_owner_access WHERE user_id = ... AND owner_id = ...;

-- ============================================================================
-- ROLLBACK
-- ============================================================================

-- To rollback this batch, run the Batch 2 section from:
-- migrations/rollback_rls_auth_fixes.sql

-- ============================================================================
-- NOTES
-- ============================================================================

-- Changes Made:
-- - Wrapped all auth.uid() calls in EXISTS subqueries with (select auth.uid())
-- - No logic changes - only performance optimization

-- Expected Benefits:
-- - auth.uid() evaluated once per query instead of per row
-- - Performance improvement on access control queries
-- - Query plans will show InitPlan instead of per-row evaluation

-- Testing:
-- - Run EXPLAIN ANALYZE on queries to verify InitPlan usage
-- - Test user access to own categories
-- - Test admin access control functionality







