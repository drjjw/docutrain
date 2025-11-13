-- ============================================================================
-- Migration: Fix RLS Auth Function Re-evaluation - Batch 7
-- ============================================================================
-- Batch: 7 - Document Attachments (Medium-High Risk - Most Complex)
-- Tables: document_attachments, document_attachment_downloads
-- Policies: 6 total
-- Date: 2025-11-11
-- ============================================================================
--
-- ISSUE: Auth RLS Initialization Plan Performance
-- Problem: Policies calling auth.uid() in complex EXISTS subqueries with joins
--          causes per-row re-evaluation instead of once-per-query
-- Fix: Wrap auth.uid() in (select auth.uid()) subquery
-- Impact: Performance improvement on attachment queries
--
-- ============================================================================
-- TABLE 1: document_attachments (5 policies)
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "document_attachments_delete_policy" ON public.document_attachments;
DROP POLICY IF EXISTS "document_attachments_insert_policy" ON public.document_attachments;
DROP POLICY IF EXISTS "document_attachments_select_policy" ON public.document_attachments;
DROP POLICY IF EXISTS "document_attachments_update_policy" ON public.document_attachments;

-- Recreate with optimized auth.uid()

CREATE POLICY "document_attachments_delete_policy" 
ON public.document_attachments 
FOR DELETE 
USING (
    EXISTS (
        SELECT 1
        FROM (
            public.documents d
            LEFT JOIN public.user_roles ur ON (
                ((ur.user_id = (select auth.uid())) AND (ur.owner_id = d.owner_id))
            )
        )
        WHERE (
            (d.id = document_attachments.document_id) 
            AND (
                (ur.role = ANY (ARRAY['owner_admin'::text, 'super_admin'::text])) 
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
            )
        )
    )
);

CREATE POLICY "document_attachments_insert_policy" 
ON public.document_attachments 
FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM (
            public.documents d
            LEFT JOIN public.user_roles ur ON (
                ((ur.user_id = (select auth.uid())) AND (ur.owner_id = d.owner_id))
            )
        )
        WHERE (
            (d.id = document_attachments.document_id) 
            AND (
                (ur.role = ANY (ARRAY['owner_admin'::text, 'super_admin'::text])) 
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
            )
        )
    )
);

CREATE POLICY "document_attachments_select_policy" 
ON public.document_attachments 
FOR SELECT 
USING (
    (
        (
            EXISTS (
                SELECT 1
                FROM public.documents d
                WHERE (
                    (d.id = document_attachments.document_id) 
                    AND (d.access_level = 'public'::public.document_access_level)
                )
            )
        ) 
        OR (
            EXISTS (
                SELECT 1
                FROM public.documents d
                WHERE (
                    (d.id = document_attachments.document_id) 
                    AND (d.access_level = 'passcode'::public.document_access_level)
                )
            )
        ) 
        OR (
            EXISTS (
                SELECT 1
                FROM public.documents d
                WHERE (
                    (d.id = document_attachments.document_id) 
                    AND (d.access_level = 'registered'::public.document_access_level) 
                    AND ((select auth.uid()) IS NOT NULL)
                )
            )
        )
    ) 
    OR (
        EXISTS (
            SELECT 1
            FROM (
                public.documents d
                JOIN public.user_owner_access uoa ON ((uoa.owner_id = d.owner_id))
            )
            WHERE (
                (d.id = document_attachments.document_id) 
                AND (d.access_level = 'owner_restricted'::public.document_access_level) 
                AND (uoa.user_id = (select auth.uid()))
            )
        )
    ) 
    OR (
        EXISTS (
            SELECT 1
            FROM (
                public.documents d
                LEFT JOIN public.user_roles ur ON (
                    ((ur.user_id = (select auth.uid())) AND (ur.owner_id = d.owner_id))
                )
            )
            WHERE (
                (d.id = document_attachments.document_id) 
                AND (d.access_level = 'owner_admin_only'::public.document_access_level) 
                AND (
                    (ur.role = 'owner_admin'::text) 
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
                )
            )
        )
    ) 
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

CREATE POLICY "document_attachments_update_policy" 
ON public.document_attachments 
FOR UPDATE 
USING (
    EXISTS (
        SELECT 1
        FROM (
            public.documents d
            LEFT JOIN public.user_roles ur ON (
                ((ur.user_id = (select auth.uid())) AND (ur.owner_id = d.owner_id))
            )
        )
        WHERE (
            (d.id = document_attachments.document_id) 
            AND (
                (ur.role = ANY (ARRAY['owner_admin'::text, 'super_admin'::text])) 
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
            )
        )
    )
);

-- ============================================================================
-- TABLE 2: document_attachment_downloads (1 policy)
-- ============================================================================

-- Drop existing policy
DROP POLICY IF EXISTS "attachment_downloads_select_policy" ON public.document_attachment_downloads;

-- Recreate with optimized auth.uid()

CREATE POLICY "attachment_downloads_select_policy" 
ON public.document_attachment_downloads 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1
        FROM (
            (
                public.document_attachments da
                JOIN public.documents d ON ((d.id = da.document_id))
            )
            LEFT JOIN public.user_roles ur ON (
                ((ur.user_id = (select auth.uid())) AND (ur.owner_id = d.owner_id))
            )
        )
        WHERE (
            (da.id = document_attachment_downloads.attachment_id) 
            AND (
                (ur.role = ANY (ARRAY['owner_admin'::text, 'super_admin'::text])) 
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
    AND tablename IN ('document_attachments', 'document_attachment_downloads')
    AND (
        (tablename = 'document_attachments' AND policyname LIKE 'document_attachments_%')
        OR (tablename = 'document_attachment_downloads' AND policyname = 'attachment_downloads_select_policy')
    )
ORDER BY tablename, policyname;

-- Expected: 6 rows

-- ============================================================================
-- TEST QUERIES
-- ============================================================================

-- Test 1: Users can select attachments based on document access level
-- Run as: authenticated user
-- SELECT * FROM public.document_attachments WHERE document_id = '...';

-- Test 2: Owner admins can insert/update/delete attachments
-- Run as: owner_admin user
-- INSERT INTO public.document_attachments (document_id, ...) VALUES (...);
-- UPDATE public.document_attachments SET ... WHERE id = ...;
-- DELETE FROM public.document_attachments WHERE id = ...;

-- Test 3: Attachment downloads work correctly
-- Run as: authenticated user
-- SELECT * FROM public.document_attachment_downloads WHERE attachment_id = '...';

-- Test 4: All document access levels respected
-- Run as: authenticated user
-- Test with documents of each access_level:
--   - public
--   - passcode
--   - registered
--   - owner_restricted
--   - owner_admin_only

-- ============================================================================
-- ROLLBACK
-- ============================================================================

-- To rollback this batch, run the Batch 7 section from:
-- migrations/rollback_rls_auth_fixes.sql

-- ============================================================================
-- NOTES
-- ============================================================================

-- Changes Made:
-- - Wrapped all auth.uid() calls in complex EXISTS subqueries with (select auth.uid())
-- - No logic changes - only performance optimization
-- - Most complex policies with nested EXISTS and joins

-- Expected Benefits:
-- - auth.uid() evaluated once per query instead of per row
-- - Performance improvement on attachment queries
-- - Query plans will show InitPlan instead of per-row evaluation

-- Testing:
-- - Run EXPLAIN ANALYZE on queries to verify InitPlan usage
-- - Test all document access levels with attachments
-- - Test owner admin attachment management
-- - Test attachment download functionality
-- - Verify complex nested EXISTS subqueries work correctly

-- Important:
-- - These are the most complex policies - test thoroughly
-- - Document access level logic must remain unchanged
-- - Nested EXISTS subqueries require careful verification






