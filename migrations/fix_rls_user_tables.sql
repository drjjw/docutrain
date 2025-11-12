-- Migration: Fix Auth RLS Init Plan for User Tables
-- Date: 2025-11-11
-- Batch: 1 - User Tables (Low Risk)
-- Tables: user_documents, user_profiles, user_roles, user_owner_access
-- Policies: 13 total

-- ============================================================================
-- ISSUE: Auth RLS Initialization Plan Performance
-- ============================================================================
-- Problem: Policies calling auth.uid() or auth.jwt() without (select ...)
--          causes per-row re-evaluation instead of once-per-query
-- Fix: Wrap auth.uid() and auth.jwt() in (select ...) subquery
-- Impact: Significant performance improvement on large result sets

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
-- TABLE 4: user_owner_access (6 policies)
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
USING (owner_id IN (
  SELECT user_roles.owner_id
  FROM public.user_roles
  WHERE user_roles.user_id = (select auth.uid())
    AND user_roles.role = 'owner_admin'::text
));

CREATE POLICY "Super admins read all access" 
ON public.user_owner_access 
FOR SELECT 
USING (EXISTS (
  SELECT 1
  FROM public.user_roles
  WHERE user_roles.user_id = (select auth.uid())
    AND user_roles.role = 'super_admin'::text
));

CREATE POLICY "Admins grant access" 
ON public.user_owner_access 
FOR INSERT 
WITH CHECK (
  (EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.role = 'super_admin'::text
  ))
  OR 
  (owner_id IN (
    SELECT user_roles.owner_id
    FROM public.user_roles
    WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.role = 'owner_admin'::text
  ))
);

CREATE POLICY "Admins revoke access" 
ON public.user_owner_access 
FOR DELETE 
USING (
  (EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.role = 'super_admin'::text
  ))
  OR 
  (owner_id IN (
    SELECT user_roles.owner_id
    FROM public.user_roles
    WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.role = 'owner_admin'::text
  ))
);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify all policies were recreated
SELECT 
    tablename,
    policyname,
    cmd as command,
    qual as using_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('user_documents', 'user_profiles', 'user_roles', 'user_owner_access')
ORDER BY tablename, policyname;

-- Expected: 13 policies total
-- - user_documents: 4 policies
-- - user_profiles: 4 policies
-- - user_roles: 1 policy
-- - user_owner_access: 5 policies

-- ============================================================================
-- ROLLBACK PROCEDURE
-- ============================================================================

-- To rollback, run the original policy files from:
-- /backups/supabase_backup_latest/schema/policies/
-- Files to restore:
-- - public_Users can read own documents.sql
-- - public_Users can insert own documents.sql
-- - public_Users can update own documents.sql
-- - public_Users can delete own documents.sql
-- - public_Users can read own profile.sql
-- - public_Users can insert own profile.sql
-- - public_Users can update own profile.sql
-- - public_Service role can manage profiles.sql
-- - public_Users read own roles.sql
-- - public_Users read own access.sql
-- - public_Owner admins read group access.sql
-- - public_Super admins read all access.sql
-- - public_Admins grant access.sql
-- - public_Admins revoke access.sql

-- ============================================================================
-- NOTES
-- ============================================================================

-- Changes Made:
-- - Wrapped all auth.uid() calls in (select auth.uid())
-- - Wrapped all auth.jwt() calls in (select auth.jwt())
-- - No logic changes - only performance optimization

-- Expected Benefits:
-- - auth.uid() evaluated once per query instead of per row
-- - Significant performance improvement on tables with many rows
-- - Query plans will show InitPlan instead of per-row evaluation

-- Testing:
-- - Run EXPLAIN ANALYZE on queries to verify InitPlan usage
-- - Test user access to own data
-- - Test admin access to group data
-- - Test super admin access to all data


