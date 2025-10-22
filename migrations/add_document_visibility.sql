-- Migration: Add Document Visibility Controls
-- Created: 2025-10-22
-- Description: Add public/private flags to documents table and create permission check function

-- =====================================================
-- Add visibility columns to documents table
-- =====================================================
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS requires_auth BOOLEAN DEFAULT false;

COMMENT ON COLUMN documents.is_public IS 'True = accessible via URL without login. False = requires authentication and owner group access';
COMMENT ON COLUMN documents.requires_auth IS 'True = user must be logged in to access (even if is_public=true)';

-- Backfill: Set all existing documents to public (maintains current behavior)
UPDATE documents 
SET is_public = true, requires_auth = false 
WHERE is_public IS NULL;

-- =====================================================
-- Permission Check Function
-- =====================================================
CREATE OR REPLACE FUNCTION user_has_document_access(
  p_user_id UUID,
  p_document_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  doc_owner_id UUID;
  doc_is_public BOOLEAN;
  doc_requires_auth BOOLEAN;
  is_super_admin BOOLEAN;
  has_owner_access BOOLEAN;
BEGIN
  -- Get document info
  SELECT owner_id, is_public, requires_auth 
  INTO doc_owner_id, doc_is_public, doc_requires_auth
  FROM documents 
  WHERE id = p_document_id;
  
  -- Document not found
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Public documents are accessible to everyone (unless requires_auth)
  IF doc_is_public AND NOT doc_requires_auth THEN
    RETURN true;
  END IF;
  
  -- If requires_auth but user not logged in
  IF doc_requires_auth AND p_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Public but requires auth - allow if user is logged in
  IF doc_is_public AND doc_requires_auth AND p_user_id IS NOT NULL THEN
    RETURN true;
  END IF;
  
  -- Private document - not logged in = no access
  IF NOT doc_is_public AND p_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if super admin
  SELECT EXISTS(
    SELECT 1 FROM user_roles 
    WHERE user_id = p_user_id AND role = 'super_admin'
  ) INTO is_super_admin;
  
  IF is_super_admin THEN
    RETURN true;
  END IF;
  
  -- Check if user has owner access or is owner admin
  SELECT EXISTS(
    SELECT 1 FROM user_owner_access 
    WHERE user_id = p_user_id AND owner_id = doc_owner_id
    UNION
    SELECT 1 FROM user_roles
    WHERE user_id = p_user_id AND owner_id = doc_owner_id 
    AND role IN ('owner_admin', 'registered')
  ) INTO has_owner_access;
  
  RETURN has_owner_access;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION user_has_document_access IS 'Check if user has permission to access a document based on visibility and owner group membership';

-- =====================================================
-- Convenience function to check access by slug
-- =====================================================
CREATE OR REPLACE FUNCTION user_has_document_access_by_slug(
  p_user_id UUID,
  p_document_slug TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  doc_id UUID;
BEGIN
  SELECT id INTO doc_id FROM documents WHERE slug = p_document_slug;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  RETURN user_has_document_access(p_user_id, doc_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Update existing documents RLS policies
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable read access for all users" ON documents;

-- Public documents are readable by everyone
CREATE POLICY "Public documents readable by all" ON documents
  FOR SELECT USING (is_public = true AND NOT requires_auth);

-- Public documents requiring auth - readable by authenticated users
CREATE POLICY "Public auth-required docs readable by authenticated" ON documents
  FOR SELECT TO authenticated
  USING (is_public = true AND requires_auth = true);

-- Private documents - readable by users with owner access
CREATE POLICY "Private documents require owner access" ON documents
  FOR SELECT TO authenticated
  USING (
    is_public = false 
    AND user_has_document_access(auth.uid(), id)
  );

-- =====================================================
-- Helper view: Get user permissions summary
-- =====================================================
CREATE OR REPLACE VIEW user_permissions_summary AS
SELECT 
  ur.user_id,
  ur.role,
  o.id as owner_id,
  o.slug as owner_slug,
  o.name as owner_name
FROM user_roles ur
JOIN owners o ON o.id = ur.owner_id
UNION
SELECT 
  uoa.user_id,
  'registered'::TEXT as role,
  o.id as owner_id,
  o.slug as owner_slug,
  o.name as owner_name
FROM user_owner_access uoa
JOIN owners o ON o.id = uoa.owner_id;

COMMENT ON VIEW user_permissions_summary IS 'Summary of all user permissions across owner groups';

