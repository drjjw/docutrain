-- ============================================================================
-- Migration: Fix RLS Auth Function Re-evaluation - Batch 4
-- ============================================================================
-- Batch: 4 - Document Processing Tables (Medium Risk)
-- Tables: document_processing_logs, document_training_history
-- Policies: 5 total
-- Date: 2025-11-11
-- ============================================================================
--
-- ISSUE: Auth RLS Initialization Plan Performance
-- Problem: Policies calling auth.uid() in EXISTS subqueries and function calls
--          causes per-row re-evaluation instead of once-per-query
-- Fix: Wrap auth.uid() in (select auth.uid()) subquery
-- Impact: Performance improvement on processing log queries (4,619+ rows)
--
-- ============================================================================
-- TABLE 1: document_processing_logs (3 policies)
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view all quiz generation logs" ON public.document_processing_logs;
DROP POLICY IF EXISTS "Users can view quiz generation logs for accessible documents" ON public.document_processing_logs;
DROP POLICY IF EXISTS "Users can view their own document processing logs" ON public.document_processing_logs;

-- Recreate with optimized auth.uid()

CREATE POLICY "Admins can view all quiz generation logs" 
ON public.document_processing_logs 
FOR SELECT 
USING (
    (
        (stage = 'quiz'::text) 
        AND (document_slug IS NOT NULL) 
        AND ((select auth.uid()) IS NOT NULL)
    ) 
    AND (
        (
            EXISTS (
                SELECT 1
                FROM public.user_permissions_summary
                WHERE (
                    (user_permissions_summary.user_id = (select auth.uid())) 
                    AND (user_permissions_summary.role = 'super_admin'::text)
                )
            )
        ) 
        OR (
            EXISTS (
                SELECT 1
                FROM public.user_permissions_summary
                WHERE (
                    (user_permissions_summary.user_id = (select auth.uid())) 
                    AND (user_permissions_summary.role = 'owner_admin'::text)
                )
            )
        )
    )
);

CREATE POLICY "Users can view quiz generation logs for accessible documents" 
ON public.document_processing_logs 
FOR SELECT 
USING (
    (
        (stage = 'quiz'::text) 
        AND (document_slug IS NOT NULL) 
        AND ((select auth.uid()) IS NOT NULL)
    ) 
    AND (user_has_document_access_by_slug((select auth.uid()), document_slug) = true)
);

CREATE POLICY "Users can view their own document processing logs" 
ON public.document_processing_logs 
FOR SELECT 
USING (
    user_document_id IN (
        SELECT user_documents.id
        FROM public.user_documents
        WHERE (user_documents.user_id = (select auth.uid()))
    )
);

-- ============================================================================
-- TABLE 2: document_training_history (2 policies)
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view all training history" ON public.document_training_history;
DROP POLICY IF EXISTS "Users can view training history for accessible documents" ON public.document_training_history;

-- Recreate with optimized auth.uid()

CREATE POLICY "Admins can view all training history" 
ON public.document_training_history 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE (
            (user_roles.user_id = (select auth.uid())) 
            AND (user_roles.role = ANY (ARRAY['admin'::text, 'superadmin'::text]))
        )
    )
);

CREATE POLICY "Users can view training history for accessible documents" 
ON public.document_training_history 
FOR SELECT 
USING (
    (
        (user_id = (select auth.uid())) 
        OR (
            document_id IN (
                SELECT documents.id
                FROM public.documents
                WHERE (
                    (
                        documents.owner_id IN (
                            SELECT owners.id
                            FROM public.owners
                            WHERE (document_training_history.user_id = (select auth.uid()))
                        )
                    ) 
                    OR (documents.uploaded_by_user_id = (select auth.uid())) 
                    OR (
                        documents.id IN (
                            SELECT d.id
                            FROM public.documents d
                            WHERE (
                                (
                                    (d.access_level = 'public'::public.document_access_level) 
                                    OR (
                                        (d.access_level = 'registered'::public.document_access_level) 
                                        AND ((select auth.uid()) IS NOT NULL)
                                    )
                                ) 
                                OR (
                                    (d.access_level = 'owner_restricted'::public.document_access_level) 
                                    AND (
                                        EXISTS (
                                            SELECT 1
                                            FROM (
                                                public.user_owner_access uoa
                                                JOIN public.owners o ON ((o.id = uoa.owner_id))
                                            )
                                            WHERE (
                                                (uoa.user_id = (select auth.uid())) 
                                                AND (o.id = d.owner_id)
                                            )
                                        )
                                    )
                                ) 
                                OR (
                                    (d.access_level = 'owner_admin_only'::public.document_access_level) 
                                    AND (
                                        EXISTS (
                                            SELECT 1
                                            FROM (
                                                public.user_roles ur
                                                JOIN public.owners o ON ((o.id = ur.owner_id))
                                            )
                                            WHERE (
                                                (ur.user_id = (select auth.uid())) 
                                                AND (ur.role = 'owner_admin'::text) 
                                                AND (o.id = d.owner_id)
                                            )
                                        )
                                    )
                                )
                            )
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
    AND tablename IN ('document_processing_logs', 'document_training_history')
    AND (
        (tablename = 'document_processing_logs' AND policyname LIKE '%quiz generation logs%')
        OR (tablename = 'document_processing_logs' AND policyname LIKE '%document processing logs%')
        OR (tablename = 'document_training_history' AND policyname LIKE '%training history%')
    )
ORDER BY tablename, policyname;

-- Expected: 5 rows

-- ============================================================================
-- TEST QUERIES
-- ============================================================================

-- Test 1: Admins can view all logs/history
-- Run as: admin user
-- SELECT * FROM public.document_processing_logs WHERE stage = 'quiz';
-- SELECT * FROM public.document_training_history;

-- Test 2: Users can view logs for accessible documents
-- Run as: authenticated user
-- SELECT * FROM public.document_processing_logs 
--   WHERE stage = 'quiz' AND document_slug = '...';

-- Test 3: Users can view own processing logs
-- Run as: authenticated user
-- SELECT * FROM public.document_processing_logs 
--   WHERE user_document_id IN (
--     SELECT id FROM public.user_documents WHERE user_id = auth.uid()
--   );

-- Test 4: Function user_has_document_access_by_slug works correctly
-- Run as: authenticated user
-- SELECT user_has_document_access_by_slug(auth.uid(), 'document-slug');

-- ============================================================================
-- ROLLBACK
-- ============================================================================

-- To rollback this batch, run the Batch 4 section from:
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
-- - Significant performance improvement on document_processing_logs (4,619+ rows)
-- - Query plans will show InitPlan instead of per-row evaluation

-- Testing:
-- - Run EXPLAIN ANALYZE on queries to verify InitPlan usage
-- - Test admin access to all logs
-- - Test user access to accessible document logs
-- - Verify function user_has_document_access_by_slug works correctly

-- Important:
-- - Function user_has_document_access_by_slug() may also need optimization
-- - Complex nested EXISTS subqueries require careful testing






