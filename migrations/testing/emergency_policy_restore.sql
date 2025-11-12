-- Emergency Policy Restore Script
-- Purpose: Restore ALL RLS policies from backup files
-- Use: Only in worst-case scenario if policy changes cause critical issues
-- Date: 2025-11-11

-- ============================================================================
-- WARNING: This script will DROP ALL existing policies and restore from backup
-- ============================================================================

-- BEFORE RUNNING:
-- 1. Ensure you have the backup files in /backups/supabase_backup_latest/schema/policies/
-- 2. Verify you want to restore to the pre-fix state
-- 3. Consider restoring individual policies first if only specific tables are affected

-- ============================================================================
-- STEP 1: Drop all existing policies
-- ============================================================================

-- User tables
DROP POLICY IF EXISTS "Users can read own documents" ON public.user_documents;
DROP POLICY IF EXISTS "Users can insert own documents" ON public.user_documents;
DROP POLICY IF EXISTS "Users can update own documents" ON public.user_documents;
DROP POLICY IF EXISTS "Users can delete own documents" ON public.user_documents;

DROP POLICY IF EXISTS "Users can read own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Service role can manage profiles" ON public.user_profiles;

DROP POLICY IF EXISTS "Users read own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Owner admins read group roles" ON public.user_roles;
DROP POLICY IF EXISTS "Global super admins read all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Global super admins manage all roles" ON public.user_roles;

DROP POLICY IF EXISTS "Users read own access" ON public.user_owner_access;
DROP POLICY IF EXISTS "Owner admins read group access" ON public.user_owner_access;
DROP POLICY IF EXISTS "Super admins read all access" ON public.user_owner_access;
DROP POLICY IF EXISTS "Admins grant access" ON public.user_owner_access;
DROP POLICY IF EXISTS "Admins revoke access" ON public.user_owner_access;

-- Documents table
DROP POLICY IF EXISTS "Public and passcode documents readable by all" ON public.documents;
DROP POLICY IF EXISTS "Registered documents readable by authenticated users" ON public.documents;
DROP POLICY IF EXISTS "Owner-restricted documents require owner membership" ON public.documents;
DROP POLICY IF EXISTS "Owner-admin-only documents require owner admin role" ON public.documents;
DROP POLICY IF EXISTS "Super admins and owner admins can view all documents" ON public.documents;
DROP POLICY IF EXISTS "Users can insert their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update their own documents" ON public.documents;
DROP POLICY IF EXISTS "Owner admins can insert documents" ON public.documents;
DROP POLICY IF EXISTS "Owner admins can update documents" ON public.documents;
DROP POLICY IF EXISTS "Owner admins can delete documents" ON public.documents;

-- Supporting tables
DROP POLICY IF EXISTS "Service role can manage invitations" ON public.user_invitations;
DROP POLICY IF EXISTS "Owner admins can view their invitations" ON public.user_invitations;
DROP POLICY IF EXISTS "Super admins can view all invitations" ON public.user_invitations;

DROP POLICY IF EXISTS "document_attachments_select_policy" ON public.document_attachments;
DROP POLICY IF EXISTS "document_attachments_insert_policy" ON public.document_attachments;
DROP POLICY IF EXISTS "document_attachments_update_policy" ON public.document_attachments;
DROP POLICY IF EXISTS "document_attachments_delete_policy" ON public.document_attachments;

DROP POLICY IF EXISTS "attachment_downloads_select_policy" ON public.document_attachment_downloads;
DROP POLICY IF EXISTS "attachment_downloads_insert_policy" ON public.document_attachment_downloads;

DROP POLICY IF EXISTS "Users can view their own document processing logs" ON public.document_processing_logs;
DROP POLICY IF EXISTS "Users can view quiz generation logs for accessible documents" ON public.document_processing_logs;
DROP POLICY IF EXISTS "Admins can view all quiz generation logs" ON public.document_processing_logs;
DROP POLICY IF EXISTS "Service role can insert processing logs" ON public.document_processing_logs;

DROP POLICY IF EXISTS "Users can view training history for accessible documents" ON public.document_training_history;
DROP POLICY IF EXISTS "Admins can view all training history" ON public.document_training_history;
DROP POLICY IF EXISTS "Service role can insert training history" ON public.document_training_history;

-- Quiz tables
DROP POLICY IF EXISTS "Authenticated users can read quizzes" ON public.quizzes;
DROP POLICY IF EXISTS "Service role can manage quizzes" ON public.quizzes;

DROP POLICY IF EXISTS "Authenticated users can read quiz questions" ON public.quiz_questions;
DROP POLICY IF EXISTS "Service role can manage quiz questions" ON public.quiz_questions;

DROP POLICY IF EXISTS "Users can read own attempts" ON public.quiz_attempts;
DROP POLICY IF EXISTS "Users can create own attempts" ON public.quiz_attempts;
DROP POLICY IF EXISTS "Service role can manage attempts" ON public.quiz_attempts;

-- Categories table
DROP POLICY IF EXISTS "Allow authenticated update own categories" ON public.categories;
DROP POLICY IF EXISTS "Allow authenticated delete own categories" ON public.categories;
DROP POLICY IF EXISTS "Allow authenticated insert categories" ON public.categories;
DROP POLICY IF EXISTS "Allow read access to categories" ON public.categories;
DROP POLICY IF EXISTS "Allow service role full access on categories" ON public.categories;

-- Owners table
DROP POLICY IF EXISTS "Allow anonymous read owners" ON public.owners;
DROP POLICY IF EXISTS "Read owners for active documents" ON public.owners;
DROP POLICY IF EXISTS "Super admins read all owners" ON public.owners;
DROP POLICY IF EXISTS "Super admins manage owners" ON public.owners;
DROP POLICY IF EXISTS "Allow authenticated insert owners" ON public.owners;
DROP POLICY IF EXISTS "Allow authenticated update owners" ON public.owners;
DROP POLICY IF EXISTS "Allow service role full access on owners" ON public.owners;

-- Other tables
DROP POLICY IF EXISTS "Allow anon reads" ON public.ratings;
DROP POLICY IF EXISTS "Allow anonymous inserts" ON public.ratings;
DROP POLICY IF EXISTS "Allow anonymous update ratings" ON public.ratings;
DROP POLICY IF EXISTS "Allow authenticated inserts" ON public.ratings;

DROP POLICY IF EXISTS "Allow anonymous read access" ON public.document_access;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.document_access;
DROP POLICY IF EXISTS "Allow authenticated insert access" ON public.document_access;

DROP POLICY IF EXISTS "Allow read access to system_config" ON public.system_config;
DROP POLICY IF EXISTS "Allow service role full access on system_config" ON public.system_config;
DROP POLICY IF EXISTS "Allow service role full access" ON public.system_config;

DROP POLICY IF EXISTS "Allow service role full access on documents" ON public.documents;

-- ============================================================================
-- STEP 2: Restore policies from backup files
-- ============================================================================

-- NOTE: The actual CREATE POLICY statements should be run from the individual
-- backup files in /backups/supabase_backup_latest/schema/policies/
-- 
-- This can be done via Supabase MCP by reading each file and executing it.
-- 
-- The files are named like:
-- - public_Users can read own documents.sql
-- - public_Owner admins can update documents.sql
-- etc.

-- To restore all policies programmatically:
-- 1. Read each .sql file from the backup directory
-- 2. Execute the CREATE POLICY statement
-- 3. Verify the policy was created successfully

-- ============================================================================
-- STEP 3: Verification
-- ============================================================================

-- After restoration, verify key policies exist:
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Expected count: Should match the number of backup files (73 policies)
SELECT COUNT(*) as total_policies
FROM pg_policies
WHERE schemaname = 'public';

-- ============================================================================
-- STEP 4: Test basic access
-- ============================================================================

-- Test public document access (should work without auth)
SELECT COUNT(*) FROM public.documents WHERE access_level = 'public' AND active = true;

-- Test authenticated access (run as authenticated user)
-- SELECT COUNT(*) FROM public.user_profiles WHERE user_id = auth.uid();

-- ============================================================================
-- NOTES
-- ============================================================================

-- This script provides the DROP statements for all policies.
-- The CREATE statements must be run from the backup files.
-- 
-- Restoration process:
-- 1. Run this script to drop all policies
-- 2. Use Supabase MCP or psql to execute each backup file
-- 3. Run verification queries
-- 4. Test application functionality
--
-- Estimated time: 2-3 minutes for complete restoration

