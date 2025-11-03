-- Migration: Allow Admins to View Inactive Documents
-- Created: 2025-01-27
-- Description: Add RLS policy to allow super admins and owner admins to view all documents, including inactive ones, for the admin dashboard

-- =====================================================
-- Add RLS policy for admin users to view all documents
-- =====================================================

-- Drop policy if it exists (for idempotency)
DROP POLICY IF EXISTS "Super admins and owner admins can view all documents" ON documents;

-- Create policy that allows super admins and owner admins to view documents regardless of active status
CREATE POLICY "Super admins and owner admins can view all documents" ON documents
  FOR SELECT TO authenticated
  USING (
    -- Allow if user is super admin
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
    OR
    -- Allow if user is owner admin and document belongs to their owner group
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'owner_admin'
      AND owner_id = documents.owner_id
    )
  );

COMMENT ON POLICY "Super admins and owner admins can view all documents" ON documents IS 
  'Allows super admins and owner admins to view all documents including inactive ones for admin dashboard management';


