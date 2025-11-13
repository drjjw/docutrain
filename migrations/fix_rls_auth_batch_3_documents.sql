-- ============================================================================
-- Migration: Fix RLS Auth Function Re-evaluation - Batch 3
-- ============================================================================
-- Batch: 3 - Documents Table (Medium Risk - Core Functionality)
-- Table: documents
-- Policies: 8 total
-- Date: 2025-11-11
-- ============================================================================
--
-- ISSUE: Auth RLS Initialization Plan Performance
-- Problem: Policies calling auth.uid() in EXISTS subqueries and function calls
--          causes per-row re-evaluation instead of once-per-query
-- Fix: Wrap auth.uid() in (select auth.uid()) subquery
-- Impact: Critical performance improvement on document access queries
--
-- ============================================================================
-- DOCUMENTS TABLE (8 policies)
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Owner admins can delete documents" ON public.documents;
DROP POLICY IF EXISTS "Owner admins can insert documents" ON public.documents;
DROP POLICY IF EXISTS "Owner admins can update documents" ON public.documents;
DROP POLICY IF EXISTS "Owner-admin-only documents require owner admin role" ON public.documents;
DROP POLICY IF EXISTS "Owner-restricted documents require owner membership" ON public.documents;
DROP POLICY IF EXISTS "Super admins and owner admins can view all documents" ON public.documents;
DROP POLICY IF EXISTS "Users can insert their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update their own documents" ON public.documents;

-- Recreate with optimized auth.uid()

CREATE POLICY "Owner admins can delete documents" 
ON public.documents 
FOR DELETE 
TO authenticated 
USING (
    EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE (
            (user_roles.user_id = (select auth.uid())) 
            AND (
                (user_roles.role = 'super_admin'::text) 
                OR (
                    (user_roles.role = 'owner_admin'::text) 
                    AND (user_roles.owner_id = documents.owner_id)
                )
            )
        )
    )
);

CREATE POLICY "Owner admins can insert documents" 
ON public.documents 
FOR INSERT 
TO authenticated 
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE (
            (user_roles.user_id = (select auth.uid())) 
            AND (
                (user_roles.role = 'super_admin'::text) 
                OR (
                    (user_roles.role = 'owner_admin'::text) 
                    AND (user_roles.owner_id = documents.owner_id)
                )
            )
        )
    )
);

CREATE POLICY "Owner admins can update documents" 
ON public.documents 
FOR UPDATE 
TO authenticated 
USING (
    EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE (
            (user_roles.user_id = (select auth.uid())) 
            AND (
                (user_roles.role = 'super_admin'::text) 
                OR (
                    (user_roles.role = 'owner_admin'::text) 
                    AND (user_roles.owner_id = documents.owner_id)
                )
            )
        )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE (
            (user_roles.user_id = (select auth.uid())) 
            AND (
                (user_roles.role = 'super_admin'::text) 
                OR (
                    (user_roles.role = 'owner_admin'::text) 
                    AND (user_roles.owner_id = documents.owner_id)
                )
            )
        )
    )
);

CREATE POLICY "Owner-admin-only documents require owner admin role" 
ON public.documents 
FOR SELECT 
TO authenticated 
USING (
    (
        (active = true) 
        AND (access_level = 'owner_admin_only'::public.document_access_level)
    ) 
    AND user_has_document_access((select auth.uid()), id)
);

CREATE POLICY "Owner-restricted documents require owner membership" 
ON public.documents 
FOR SELECT 
TO authenticated 
USING (
    (
        (active = true) 
        AND (access_level = 'owner_restricted'::public.document_access_level)
    ) 
    AND user_has_document_access((select auth.uid()), id)
);

CREATE POLICY "Super admins and owner admins can view all documents" 
ON public.documents 
FOR SELECT 
TO authenticated 
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
        EXISTS (
            SELECT 1
            FROM public.user_roles
            WHERE (
                (user_roles.user_id = (select auth.uid())) 
                AND (user_roles.role = 'owner_admin'::text) 
                AND (user_roles.owner_id = documents.owner_id)
            )
        )
    )
);

CREATE POLICY "Users can insert their own documents" 
ON public.documents 
FOR INSERT 
TO authenticated 
WITH CHECK (
    (
        (access_level = 'owner_restricted'::public.document_access_level) 
        AND (owner_id IS NULL) 
        AND (((metadata ->> 'user_id'::text))::uuid = (select auth.uid()))
    )
);

CREATE POLICY "Users can update their own documents" 
ON public.documents 
FOR UPDATE 
TO authenticated 
USING (
    (
        (access_level = 'owner_restricted'::public.document_access_level) 
        AND (owner_id IS NULL) 
        AND (((metadata ->> 'user_id'::text))::uuid = (select auth.uid()))
    )
)
WITH CHECK (
    (
        (access_level = 'owner_restricted'::public.document_access_level) 
        AND (owner_id IS NULL) 
        AND (((metadata ->> 'user_id'::text))::uuid = (select auth.uid()))
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
    AND tablename = 'documents'
    AND policyname IN (
        'Owner admins can delete documents',
        'Owner admins can insert documents',
        'Owner admins can update documents',
        'Owner-admin-only documents require owner admin role',
        'Owner-restricted documents require owner membership',
        'Super admins and owner admins can view all documents',
        'Users can insert their own documents',
        'Users can update their own documents'
    )
ORDER BY policyname;

-- Expected: 8 rows

-- ============================================================================
-- TEST QUERIES
-- ============================================================================

-- Test 1: Owner admin can insert/update/delete documents
-- Run as: owner_admin user
-- INSERT INTO public.documents (title, owner_id, ...) VALUES (...);
-- UPDATE public.documents SET title = '...' WHERE id = '...';
-- DELETE FROM public.documents WHERE id = '...';

-- Test 2: Super admin can view all documents
-- Run as: super_admin user
-- SELECT * FROM public.documents;

-- Test 3: Users can insert/update own documents
-- Run as: authenticated user
-- INSERT INTO public.documents (title, access_level, metadata) 
--   VALUES (..., 'owner_restricted', '{"user_id": "' || auth.uid() || '"}'::jsonb);
-- UPDATE public.documents SET title = '...' WHERE metadata->>'user_id' = auth.uid()::text;

-- Test 4: Document access levels work correctly
-- Run as: authenticated user
-- SELECT * FROM public.documents WHERE access_level = 'public';
-- SELECT * FROM public.documents WHERE access_level = 'registered';
-- SELECT * FROM public.documents WHERE access_level = 'owner_restricted';
-- SELECT * FROM public.documents WHERE access_level = 'owner_admin_only';

-- ============================================================================
-- ROLLBACK
-- ============================================================================

-- To rollback this batch, run the Batch 3 section from:
-- migrations/rollback_rls_auth_fixes.sql

-- ============================================================================
-- NOTES
-- ============================================================================

-- Changes Made:
-- - Wrapped all auth.uid() calls in EXISTS subqueries with (select auth.uid())
-- - Wrapped auth.uid() in function calls with (select auth.uid())
-- - No logic changes - only performance optimization

-- Expected Benefits:
-- - auth.uid() evaluated once per query instead of per row
-- - Critical performance improvement on document access queries
-- - Query plans will show InitPlan instead of per-row evaluation
-- - Significant improvement on large document tables

-- Testing:
-- - Run EXPLAIN ANALYZE on queries to verify InitPlan usage
-- - Test all document access levels
-- - Test admin document management functionality
-- - Verify user document creation/editing works correctly

-- Important:
-- - This affects core document functionality - test thoroughly
-- - Function user_has_document_access() may also need optimization
-- - Document access level logic must remain unchanged







