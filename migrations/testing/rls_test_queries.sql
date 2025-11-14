-- RLS Performance Fix - Test Queries
-- Purpose: Verify RLS policies work correctly after performance optimizations
-- Date: 2025-11-11

-- ============================================================================
-- TEST SETUP: Create test users and data
-- ============================================================================

-- Note: These are example test queries. Run with appropriate test user sessions.

-- ============================================================================
-- TEST 1: Public Access (Unauthenticated)
-- ============================================================================

-- Test: Public documents should be readable without authentication
-- Expected: Returns public documents only
SELECT id, title, access_level 
FROM public.documents 
WHERE active = true 
  AND access_level = 'public'
LIMIT 5;

-- Test: Verify public owners are readable
SELECT id, name 
FROM public.owners 
LIMIT 5;

-- ============================================================================
-- TEST 2: Registered User Access
-- ============================================================================

-- Test: Authenticated users can read registered documents
-- Expected: Returns public + registered documents
-- Run as: authenticated user
SELECT id, title, access_level 
FROM public.documents 
WHERE active = true 
  AND access_level IN ('public', 'registered')
LIMIT 10;

-- Test: User can read own profile
-- Expected: Returns only the authenticated user's profile
-- Run as: authenticated user
SELECT id, email, full_name 
FROM public.user_profiles 
WHERE user_id = auth.uid();

-- Test: User can read own documents
-- Expected: Returns only user's own documents
-- Run as: authenticated user
SELECT id, document_id, user_id 
FROM public.user_documents 
WHERE user_id = auth.uid()
LIMIT 5;

-- Test: User can read own roles
-- Expected: Returns user's roles
-- Run as: authenticated user
SELECT id, user_id, role, owner_id 
FROM public.user_roles 
WHERE user_id = auth.uid();

-- ============================================================================
-- TEST 3: Owner-Restricted Access
-- ============================================================================

-- Test: Users with owner access can read owner-restricted documents
-- Expected: Returns documents where user has owner membership
-- Run as: user with owner access
SELECT d.id, d.title, d.access_level, d.owner_id
FROM public.documents d
WHERE d.active = true
  AND d.access_level = 'owner-restricted'
  AND EXISTS (
    SELECT 1 FROM public.user_owner_access uoa
    WHERE uoa.user_id = auth.uid()
      AND uoa.owner_id = d.owner_id
  )
LIMIT 5;

-- ============================================================================
-- TEST 4: Owner Admin Access
-- ============================================================================

-- Test: Owner admins can manage their owner's documents
-- Expected: Returns documents for owner admin's owner
-- Run as: owner_admin user
SELECT d.id, d.title, d.owner_id
FROM public.documents d
WHERE EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = auth.uid()
    AND ur.role = 'owner_admin'
    AND ur.owner_id = d.owner_id
)
LIMIT 5;

-- Test: Owner admins can view their invitations
-- Expected: Returns invitations for their owner
-- Run as: owner_admin user
SELECT id, email, role, owner_id, status
FROM public.user_invitations
WHERE owner_id IN (
  SELECT owner_id FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'owner_admin'
);

-- ============================================================================
-- TEST 5: Super Admin Access
-- ============================================================================

-- Test: Super admins can view all documents
-- Expected: Returns all documents
-- Run as: super_admin user
SELECT id, title, access_level, owner_id
FROM public.documents
LIMIT 10;

-- Test: Super admins can view all user roles
-- Expected: Returns all user roles
-- Run as: super_admin user
SELECT id, user_id, role, owner_id
FROM public.user_roles
LIMIT 10;

-- Test: Super admins can view all invitations
-- Expected: Returns all invitations
-- Run as: super_admin user
SELECT id, email, role, owner_id, status
FROM public.user_invitations
LIMIT 10;

-- ============================================================================
-- TEST 6: User Isolation (Security)
-- ============================================================================

-- Test: User cannot access other users' private data
-- Expected: Returns 0 rows (or only own data)
-- Run as: regular user
SELECT id, user_id 
FROM public.user_documents 
WHERE user_id != auth.uid()
LIMIT 1;

-- Test: User cannot read other users' profiles
-- Expected: Returns 0 rows (or only own profile)
-- Run as: regular user
SELECT id, email 
FROM public.user_profiles 
WHERE user_id != auth.uid()
LIMIT 1;

-- ============================================================================
-- TEST 7: Service Role Access
-- ============================================================================

-- Test: Service role can manage profiles
-- Expected: Full access to user_profiles
-- Run as: service_role
SELECT COUNT(*) as total_profiles
FROM public.user_profiles;

-- Test: Service role can manage invitations
-- Expected: Full access to user_invitations
-- Run as: service_role
SELECT COUNT(*) as total_invitations
FROM public.user_invitations;

-- ============================================================================
-- TEST 8: Quiz Access
-- ============================================================================

-- Test: Authenticated users can read quizzes
-- Expected: Returns quizzes
-- Run as: authenticated user
SELECT id, document_id, title
FROM public.quizzes
LIMIT 5;

-- Test: Users can read own quiz attempts
-- Expected: Returns only user's attempts
-- Run as: authenticated user
SELECT id, quiz_id, user_id, score
FROM public.quiz_attempts
WHERE user_id = auth.uid()
LIMIT 5;

-- ============================================================================
-- TEST 9: Document Attachments
-- ============================================================================

-- Test: Users can access attachments for accessible documents
-- Expected: Returns attachments for documents user can access
-- Run as: authenticated user
SELECT da.id, da.document_id, da.filename
FROM public.document_attachments da
WHERE EXISTS (
  SELECT 1 FROM public.documents d
  WHERE d.id = da.document_id
    AND d.active = true
)
LIMIT 5;

-- ============================================================================
-- TEST 10: Training History & Processing Logs
-- ============================================================================

-- Test: Users can view training history for accessible documents
-- Expected: Returns training history for accessible documents
-- Run as: authenticated user
SELECT dth.id, dth.document_id, dth.action
FROM public.document_training_history dth
WHERE EXISTS (
  SELECT 1 FROM public.documents d
  WHERE d.id = dth.document_id
    AND d.active = true
)
LIMIT 5;

-- Test: Users can view their own processing logs
-- Expected: Returns only user's processing logs
-- Run as: authenticated user
SELECT id, document_id, user_id, status
FROM public.document_processing_logs
WHERE user_id = auth.uid()
LIMIT 5;

-- ============================================================================
-- PERFORMANCE VERIFICATION
-- ============================================================================

-- Test: Verify RLS policy is evaluated once per query (not per row)
-- Run EXPLAIN ANALYZE to check query plan
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT id, title, access_level 
FROM public.documents 
WHERE active = true 
  AND access_level = 'public'
LIMIT 10;

-- Look for: InitPlan should show auth.uid() evaluated once
-- Before fix: Shows "auth.uid()" in scan condition (evaluated per row)
-- After fix: Shows "(InitPlan 1 (returns $0))" (evaluated once)

-- ============================================================================
-- ROLLBACK VERIFICATION
-- ============================================================================

-- After each migration, verify these key queries still work:
-- 1. Public document access (unauthenticated)
-- 2. User profile access (authenticated)
-- 3. Document management (owner admin)
-- 4. Full access (super admin)

-- If any query fails or returns unexpected results, rollback immediately.











